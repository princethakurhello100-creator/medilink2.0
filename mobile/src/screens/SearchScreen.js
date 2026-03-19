import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, Linking, Platform } from "react-native";
import apiClient from "../services/apiClient";
import { ENDPOINTS } from "../services/config";

const openNavigation = (store) => {
  const lat = store.location?.lat;
  const lng = store.location?.lng;
  if (!lat || !lng) {
    Alert.alert("Navigation Error", "Store location not available");
    return;
  }
  const label = encodeURIComponent(store.storeName || "Pharmacy");
  let url;
  if (Platform.OS === "ios") {
    url = `maps://?q=${label}&ll=${lat},${lng}`;
  } else if (Platform.OS === "android") {
    url = `google.navigation:q=${lat},${lng}&title=${label}`;
  } else {
    // Web browser
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_name=${label}&travelmode=driving`;
  }
  Linking.canOpenURL(url)
    .then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to Google Maps web
        const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        Linking.openURL(fallback);
      }
    })
    .catch(() => {
      const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      Linking.openURL(fallback);
    });
};

export default function SearchScreen() {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta]       = useState(null);

  const handleSearch = async () => {
    if (query.trim().length < 2) return Alert.alert("Error", "Enter at least 2 characters");
    setLoading(true);
    try {
      const { data } = await apiClient.get(ENDPOINTS.SEARCH, { params: { q: query.trim() } });
      setResults(data.data || []);
      setMeta(data.meta);
      if ((data.data || []).length === 0) Alert.alert("No Results", "No medicines found");
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Search failed");
    } finally { setLoading(false); }
  };

  const renderStore = (store, i) => (
    <View key={i} style={styles.storeCard}>
      <View style={styles.storeHeader}>
        <Text style={styles.storeIcon}>🏪</Text>
        <View style={styles.storeMain}>
          <Text style={styles.storeName}>{store.storeName}</Text>
          {store.address && (
            <Text style={styles.storeAddr}>
              {store.address.street}, {store.address.city}, {store.address.state}
            </Text>
          )}
        </View>
        <View style={styles.stockBadge}>
          <Text style={styles.stockQty}>{store.quantity}</Text>
          <Text style={styles.stockLabel}>in stock</Text>
        </View>
      </View>

      <View style={styles.storeFooter}>
        {store.phone && <Text style={styles.storeDetail}>📞 {store.phone}</Text>}
        {store.hours  && <Text style={styles.storeDetail}>🕐 {store.hours.open} – {store.hours.close}</Text>}
        {store.price  && <Text style={styles.storePrice}>₹{store.price.toFixed(2)}</Text>}
      </View>

      <TouchableOpacity
        style={[styles.navBtn, (!store.location?.lat || !store.location?.lng) && styles.navBtnDisabled]}
        onPress={() => openNavigation(store)}
        disabled={!store.location?.lat || !store.location?.lng}
      >
        <Text style={styles.navBtnText}>🗺️ Navigate to Store</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.medName}>{item.name}</Text>
        {item.requiresPrescription && <Text style={styles.rxBadge}>Rx</Text>}
      </View>
      {item.genericName   && <Text style={styles.generic}>Generic: {item.genericName}</Text>}
      <View style={styles.tagRow}>
        <Text style={styles.catBadge}>{item.category}</Text>
        {item.manufacturer && <Text style={styles.mfr}>{item.manufacturer}</Text>}
      </View>
      {item.dosageForms?.length > 0 && (
        <Text style={styles.forms}>Forms: {item.dosageForms.join(", ")}</Text>
      )}

      <View style={styles.divider} />

      {item.availableAt?.length > 0 ? (
        <>
          <Text style={styles.availTitle}>
            ✅ Available at {item.availableAt.length} store{item.availableAt.length > 1 ? "s" : ""}
          </Text>
          {item.availableAt.map((s, i) => renderStore(s, i))}
        </>
      ) : (
        <View style={styles.notAvail}>
          <Text style={styles.notAvailText}>⚠️ Not available at any verified store right now</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Medicine Search</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search medicines..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.btn} onPress={handleSearch} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnText}>Search</Text>}
        </TouchableOpacity>
      </View>

      {meta && (
        <Text style={styles.metaText}>
          {meta.total} result{meta.total !== 1 ? "s" : ""}
          {meta.usedFuzzy ? " · fuzzy match" : ""}
        </Text>
      )}

      <FlatList
        data={results}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={!loading && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💊</Text>
            <Text style={styles.emptyText}>Search for a medicine</Text>
            <Text style={styles.emptySub}>Try: paracetamol, amoxicillin, vitamin c</Text>
          </View>
        )}
      />
      <TouchableOpacity style={styles.chatFab} onPress={() => navigation.navigate('Chat')}>
        <Text style={styles.chatFabText}>🤖</Text>
      </TouchableOpacity>
    </View>
  );
}

const S = "#1B4F8A";
const styles = StyleSheet.create({
  container:      { flex:1, padding:16, backgroundColor:"#f4f6fb" },
  title:          { fontSize:22, fontWeight:"bold", color:S, marginBottom:14 },
  searchRow:      { flexDirection:"row", gap:8, marginBottom:8 },
  input:          { flex:1, backgroundColor:"#fff", borderRadius:10, padding:12, fontSize:15, borderWidth:1, borderColor:"#dde" },
  btn:            { backgroundColor:S, borderRadius:10, paddingHorizontal:16, justifyContent:"center" },
  btnText:        { color:"#fff", fontWeight:"bold" },
  metaText:       { fontSize:12, color:"#999", marginBottom:10, fontStyle:"italic" },
  card:           { backgroundColor:"#fff", borderRadius:14, padding:16, marginBottom:12, elevation:3, shadowColor:"#000", shadowOpacity:0.07, shadowRadius:8 },
  cardHeader:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:4 },
  medName:        { fontSize:17, fontWeight:"bold", color:S, flex:1 },
  rxBadge:        { fontSize:10, color:"#fff", backgroundColor:"#e53935", paddingHorizontal:7, paddingVertical:2, borderRadius:5 },
  generic:        { fontSize:13, color:"#555", marginBottom:6 },
  tagRow:         { flexDirection:"row", gap:8, alignItems:"center", marginBottom:4 },
  catBadge:       { fontSize:11, color:S, backgroundColor:"#dceefb", paddingHorizontal:8, paddingVertical:2, borderRadius:10, textTransform:"capitalize" },
  mfr:            { fontSize:11, color:"#999" },
  forms:          { fontSize:12, color:"#666", marginBottom:6 },
  divider:        { height:1, backgroundColor:"#f0f0f0", marginVertical:10 },
  availTitle:     { fontSize:13, fontWeight:"bold", color:"#2e7d32", marginBottom:8 },
  storeCard:      { backgroundColor:"#f8fffe", borderRadius:10, padding:10, marginBottom:8, borderWidth:1, borderColor:"#e0f2e9" },
  storeHeader:    { flexDirection:"row", alignItems:"flex-start", marginBottom:6 },
  storeIcon:      { fontSize:22, marginRight:8 },
  storeMain:      { flex:1 },
  storeName:      { fontSize:13, fontWeight:"bold", color:"#1b5e20" },
  storeAddr:      { fontSize:11, color:"#555", marginTop:1 },
  stockBadge:     { alignItems:"center", backgroundColor:"#e8f5e9", borderRadius:8, padding:6, minWidth:48 },
  stockQty:       { fontSize:16, fontWeight:"bold", color:"#2e7d32" },
  stockLabel:     { fontSize:9, color:"#66bb6a" },
  storeFooter:    { flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:8 },
  storeDetail:    { fontSize:11, color:"#555" },
  storePrice:     { fontSize:12, fontWeight:"bold", color:"#1B4F8A" },
  navBtn:         { backgroundColor:S, borderRadius:8, padding:10, alignItems:"center", marginTop:4 },
  navBtnDisabled: { backgroundColor:"#bbb" },
  navBtnText:     { color:"#fff", fontSize:13, fontWeight:"bold" },
  notAvail:       { backgroundColor:"#fff3e0", borderRadius:8, padding:10 },
  notAvailText:   { fontSize:12, color:"#e65100" },
  empty:          { alignItems:"center", marginTop:60 },
  emptyIcon:      { fontSize:48, marginBottom:12 },
  emptyText:      { fontSize:16, color:"#999" },
  emptySub:       { fontSize:13, color:"#bbb", marginTop:4 },
  chatFab:     { position: 'absolute', bottom: 24, right: 16, width: 52, height: 52, borderRadius: 26, backgroundColor: '#1B4F8A', alignItems: 'center', justifyContent: 'center', elevation: 6 },
  chatFabText: { fontSize: 24 },
});