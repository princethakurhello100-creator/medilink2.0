import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, FlatList, Platform, Alert
} from "react-native";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useStoreAuth } from "../context/StoreAuthContext";
import { API_BASE_URL, ENDPOINTS } from "../services/config";

const TAB_STORE     = "store";
const TAB_INVENTORY = "inventory";
const TAB_ADD       = "add";
const TAB_SCAN      = "scan";

export default function StoreDashboardScreen() {
  const { storeLogout, getStoreToken } = useStoreAuth();
  const [tab, setTab]             = useState(TAB_STORE);
  const [store, setStore]         = useState(null);
  const [inventory, setInventory] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [search, setSearch]       = useState("");

  const [selMed, setSelMed] = useState(null);
  const [qty, setQty]       = useState("");
  const [price, setPrice]   = useState("");

  const [scanning, setScanning]           = useState(false);
  const [scanResult, setScanResult]       = useState(null);
  const [confirming, setConfirming]       = useState(false);
  const [editedMatched, setEditedMatched] = useState([]);

  const headers = () => ({ Authorization: "Bearer " + getStoreToken() });

  const loadStore = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await axios.get(API_BASE_URL + ENDPOINTS.STORE_MY_STORE, { headers: headers() });
      setStore(data.store);
      setInventory(data.inventory || []);
    } catch (e) { setError(e.response?.data?.error || "Failed to load store"); }
    finally { setLoading(false); }
  }, []);

  const loadMedicines = useCallback(async () => {
    try {
      const { data } = await axios.get(API_BASE_URL + ENDPOINTS.STORE_MEDICINES, { headers: headers() });
      setMedicines(data.data || []);
    } catch {}
  }, []);

  useEffect(() => { loadStore(); loadMedicines(); }, []);

  const flash = (msg, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(""); setSuccess(""); }, 4000);
  };

  const handleAddInventory = async () => {
    if (!selMed) { flash("Select a medicine", true); return; }
    if (!qty || isNaN(parseInt(qty))) { flash("Enter valid quantity", true); return; }
    setSaving(true);
    try {
      await axios.post(API_BASE_URL + ENDPOINTS.STORE_INVENTORY,
        { medicineId: selMed._id, quantity: parseInt(qty), price: price ? parseFloat(price) : undefined },
        { headers: headers() });
      flash(`✅ ${selMed.name} added to inventory`);
      setSelMed(null); setQty(""); setPrice("");
      loadStore();
      setTab(TAB_INVENTORY);
    } catch (e) { flash(e.response?.data?.error || "Failed to update", true); }
    finally { setSaving(false); }
  };

  const handleUpdateQty = async (item, newQty) => {
    try {
      await axios.post(API_BASE_URL + ENDPOINTS.STORE_INVENTORY,
        { medicineId: item.medicineId._id, quantity: parseInt(newQty), price: item.price },
        { headers: headers() });
      flash(`✅ ${item.medicineId.name} updated`);
      loadStore();
    } catch (e) { flash(e.response?.data?.error || "Update failed", true); }
  };

  const handleDelete = async (item) => {
    if (Platform.OS === "web" && !window.confirm(`Remove ${item.medicineId.name} from inventory?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}${ENDPOINTS.STORE_INVENTORY}/${item.medicineId._id}`, { headers: headers() });
      flash(`🗑️ ${item.medicineId.name} removed`);
      loadStore();
    } catch (e) { flash("Delete failed", true); }
  };

  const uploadFileForScan = async (file, mimeType, filename) => {
    setScanning(true);
    setScanResult(null);
    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        const response = await fetch(file);
        const blob = await response.blob();
        formData.append("file", blob, filename);
      } else {
        formData.append("file", { uri: file, type: mimeType, name: filename });
      }
      const { data } = await axios.post(
        API_BASE_URL + ENDPOINTS.STOCK_OCR_SCAN,
        formData,
        { headers: { ...headers(), "Content-Type": "multipart/form-data" } }
      );
      setScanResult(data);
      setEditedMatched(data.matched.map(m => ({ ...m, include: true })));
    } catch (e) {
      flash(e.response?.data?.error || "Scan failed. Please try a clearer image.", true);
    } finally {
      setScanning(false);
    }
  };

  const pickImage = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        await uploadFileForScan(url, file.type, file.name);
        URL.revokeObjectURL(url);
      };
      input.click();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { flash("Permission required", true); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      await uploadFileForScan(asset.uri, asset.mimeType || "image/jpeg", asset.fileName || "stock.jpg");
    }
  };

  const pickCamera = async () => {
    if (Platform.OS === "web") { flash("Camera not supported on web. Use Choose Image.", true); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { flash("Camera permission required", true); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      await uploadFileForScan(asset.uri, asset.mimeType || "image/jpeg", "stock_photo.jpg");
    }
  };

  const pickDocument = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        await uploadFileForScan(url, file.type, file.name);
        URL.revokeObjectURL(url);
      };
      input.click();
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        await uploadFileForScan(asset.uri, asset.mimeType, asset.name);
      }
    } catch (e) { flash("Failed to pick document", true); }
  };

  const handleConfirmScan = async () => {
const toAdd = [
  ...editedMatched.filter(m => m.include),
  ...(scanResult.unmatched || []).map(m => ({ ...m, inDatabase: false, include: true })),
];
console.log("[DEBUG] toAdd:", JSON.stringify(toAdd.length), "matched:", editedMatched.length, "unmatched:", scanResult.unmatched?.length);
    if (toAdd.length === 0) { flash("Select at least one medicine", true); return; }
    setConfirming(true);
    try {
      const { data } = await axios.post(
        API_BASE_URL + ENDPOINTS.STOCK_OCR_CONFIRM,
        { medicines: toAdd },
        { headers: headers() }
      );
      flash(`✅ ${data.message}`);
      setScanResult(null);
      setEditedMatched([]);
      loadStore();
      setTab(TAB_INVENTORY);
    } catch (e) {
      flash(e.response?.data?.error || "Failed to update inventory", true);
    } finally {
      setConfirming(false);
    }
  };

  const filteredMeds = medicines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.genericName || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#1B4F8A" />
      <Text style={s.loadingText}>Loading your store...</Text>
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>🏪 {store?.name || "My Store"}</Text>
          <Text style={s.headerSub}>
            {store?.isVerified ? "✅ Verified" : "⏳ Pending"} · {store?.address?.city}
          </Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={storeLogout}>
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {error   && <View style={s.flashError}><Text style={s.flashText}>{error}</Text></View>}
      {success && <View style={s.flashSuccess}><Text style={s.flashText}>{success}</Text></View>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll}>
        <View style={s.tabs}>
          {[
            { key: TAB_STORE,     label: "📋 Store Info" },
            { key: TAB_INVENTORY, label: "📦 Inventory" },
            { key: TAB_ADD,       label: "➕ Add Stock" },
            { key: TAB_SCAN,      label: "📷 Scan Stock" },
          ].map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {tab === TAB_STORE && store && (
        <ScrollView style={s.tabContent}>
          <InfoRow icon="🏪" label="Store Name"     value={store.name} />
          <InfoRow icon="📜" label="License No."    value={store.licenseNumber} />
          <InfoRow icon="📅" label="License Expiry" value={new Date(store.licenseExpiry).toLocaleDateString()} />
          <InfoRow icon="👤" label="Owner"          value={store.ownerName} />
          <InfoRow icon="📞" label="Owner Phone"    value={store.ownerPhone} />
          <InfoRow icon="☎️" label="Store Phone"    value={store.phone} />
          <InfoRow icon="🏠" label="Address"
            value={`${store.address?.street}, ${store.address?.city}, ${store.address?.state} - ${store.address?.postalCode}`} />
          <InfoRow icon="🕐" label="Hours"
            value={`${store.operatingHours?.open} – ${store.operatingHours?.close}`} />
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statNum}>{inventory.length}</Text>
              <Text style={s.statLabel}>Medicines</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statNum}>{inventory.filter(i => i.inStock).length}</Text>
              <Text style={s.statLabel}>In Stock</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statNum}>{inventory.reduce((a, i) => a + (i.quantity || 0), 0)}</Text>
              <Text style={s.statLabel}>Total Units</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {tab === TAB_INVENTORY && (
        <ScrollView style={s.tabContent}>
          {inventory.length === 0
            ? <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>📦</Text>
                <Text style={s.emptyText}>No medicines in inventory yet</Text>
                <TouchableOpacity onPress={() => setTab(TAB_ADD)}>
                  <Text style={s.emptyLink}>Add medicines →</Text>
                </TouchableOpacity>
              </View>
            : inventory.map((item, i) => (
                <InventoryItem key={i} item={item} onUpdate={handleUpdateQty} onDelete={handleDelete} />
              ))
          }
        </ScrollView>
      )}

      {tab === TAB_ADD && (
        <View style={s.tabContent}>
          <TextInput style={s.searchInput} placeholder="Search medicine to add..."
            value={search} onChangeText={setSearch} placeholderTextColor="#aaa" />
          {selMed && (
            <View style={s.selectedMed}>
              <Text style={s.selectedMedName}>💊 {selMed.name}</Text>
              <Text style={s.selectedMedSub}>{selMed.genericName} · {selMed.category}</Text>
              <View style={s.qtyRow}>
                <TextInput style={s.qtyInput} placeholder="Quantity" value={qty}
                  onChangeText={setQty} keyboardType="numeric" placeholderTextColor="#aaa" />
                <TextInput style={s.qtyInput} placeholder="Price (₹)" value={price}
                  onChangeText={setPrice} keyboardType="numeric" placeholderTextColor="#aaa" />
              </View>
              <TouchableOpacity style={[s.addBtn, saving && {opacity:0.6}]} onPress={handleAddInventory} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.addBtnText}>Add to Inventory</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelMed(null)} style={s.cancelBtn}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={filteredMeds}
            keyExtractor={m => m._id}
            renderItem={({ item }) => (
              <TouchableOpacity style={[s.medRow, selMed?._id === item._id && s.medRowSelected]}
                onPress={() => { setSelMed(item); setSearch(""); }}>
                <View style={s.medRowLeft}>
                  <Text style={s.medRowName}>{item.name}</Text>
                  <Text style={s.medRowSub}>{item.genericName} · {item.category}</Text>
                </View>
                {item.requiresPrescription && <Text style={s.rxTag}>Rx</Text>}
              </TouchableOpacity>
            )}
            style={{ maxHeight: 350 }}
          />
        </View>
      )}

      {tab === TAB_SCAN && (
        <ScrollView style={s.tabContent}>
          <Text style={s.scanTitle}>📷 Scan Stock Invoice</Text>
          <Text style={s.scanSub}>Upload an image, PDF or Word file of your medicine invoice. AI will extract medicines and update your inventory automatically.</Text>

          {!scanResult && !scanning && (
            <View style={s.uploadOptions}>
              <TouchableOpacity style={s.uploadBtn} onPress={pickCamera}>
                <Text style={s.uploadBtnIcon}>📸</Text>
                <Text style={s.uploadBtnText}>Take Photo</Text>
                <Text style={s.uploadBtnSub}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.uploadBtn} onPress={pickImage}>
                <Text style={s.uploadBtnIcon}>🖼️</Text>
                <Text style={s.uploadBtnText}>Choose Image</Text>
                <Text style={s.uploadBtnSub}>JPG, PNG</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.uploadBtn} onPress={pickDocument}>
                <Text style={s.uploadBtnIcon}>📄</Text>
                <Text style={s.uploadBtnText}>Upload File</Text>
                <Text style={s.uploadBtnSub}>PDF, DOCX</Text>
              </TouchableOpacity>
            </View>
          )}

          {scanning && (
            <View style={s.scanningBox}>
              <ActivityIndicator size="large" color="#1B4F8A" />
              <Text style={s.scanningText}>🤖 AI is scanning your invoice...</Text>
              <Text style={s.scanningSubText}>Extracting medicine names and quantities</Text>
            </View>
          )}

          {scanResult && (
            <View>
              <View style={s.scanSummary}>
                <Text style={s.scanSummaryTitle}>✅ Scan Complete</Text>
                <Text style={s.scanSummaryText}>
                  Found {scanResult.totalFound} medicines · {scanResult.totalMatched} matched in database
                </Text>
              </View>

              {editedMatched.length > 0 && (
                <View style={s.matchedSection}>
                  <Text style={s.sectionTitle}>✅ Matched Medicines ({editedMatched.length})</Text>
                  {editedMatched.map((med, i) => (
                    <View key={i} style={[s.matchedCard, !med.include && s.matchedCardDisabled]}>
                      <TouchableOpacity style={s.matchedCheck}
                        onPress={() => {
                          const updated = [...editedMatched];
                          updated[i] = { ...updated[i], include: !updated[i].include };
                          setEditedMatched(updated);
                        }}>
                        <Text style={s.checkIcon}>{med.include ? "☑️" : "⬜"}</Text>
                      </TouchableOpacity>
                      <View style={s.matchedInfo}>
                        <Text style={s.matchedName}>{med.name}</Text>
                        <Text style={s.matchedExtracted}>Extracted: "{med.extractedName}"</Text>
                      </View>
                      <View style={s.matchedQtyBox}>
                        <TextInput
                          style={s.matchedQtyInput}
                          value={String(editedMatched[i].quantity)}
                          keyboardType="numeric"
                          onChangeText={v => {
                            const updated = [...editedMatched];
                            updated[i] = { ...updated[i], quantity: parseInt(v) || 0 };
                            setEditedMatched(updated);
                          }}
                        />
                        <Text style={s.matchedQtyLabel}>qty</Text>
                        <TextInput
                          style={s.matchedQtyInput}
                          value={String(editedMatched[i].price)}
                          keyboardType="numeric"
                          onChangeText={v => {
                            const updated = [...editedMatched];
                            updated[i] = { ...updated[i], price: parseFloat(v) || 0 };
                            setEditedMatched(updated);
                          }}
                        />
                        <Text style={s.matchedQtyLabel}>₹</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {scanResult.unmatched?.length > 0 && (
                <View style={s.unmatchedSection}>
                  <Text style={s.sectionTitle}>⚠️ Not in Database ({scanResult.unmatched.length})</Text>
                  <Text style={s.unmatchedNote}>Ask master admin to add these medicines first</Text>
                  {scanResult.unmatched.map((med, i) => (
                    <View key={i} style={s.unmatchedCard}>
                      <Text style={s.unmatchedName}>{med.extractedName}</Text>
                      <Text style={s.unmatchedQty}>Qty: {med.quantity}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={s.scanActions}>
                <TouchableOpacity
                  style={[s.confirmBtn, confirming && { opacity: 0.6 }]}
                  onPress={handleConfirmScan}
                  disabled={confirming}>
                  {confirming
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.confirmBtnText}>✅ Add to Inventory ({editedMatched.filter(m => m.include).length})</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={s.rescanBtn} onPress={() => { setScanResult(null); setEditedMatched([]); }}>
                  <Text style={s.rescanBtnText}>🔄 Scan Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const InfoRow = ({ icon, label, value }) => (
  <View style={s.infoRow}>
    <Text style={s.infoIcon}>{icon}</Text>
    <View style={s.infoContent}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || "—"}</Text>
    </View>
  </View>
);

const InventoryItem = ({ item, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(item.quantity));
  return (
    <View style={s.invCard}>
      <View style={s.invHeader}>
        <View style={s.invLeft}>
          <Text style={s.invName}>{item.medicineId?.name}</Text>
          <Text style={s.invSub}>{item.medicineId?.genericName} · {item.medicineId?.category}</Text>
        </View>
        <View style={[s.stockBadge, !item.inStock && s.outOfStock]}>
          <Text style={s.stockText}>{item.inStock ? "In Stock" : "Out"}</Text>
        </View>
      </View>
      <View style={s.invFooter}>
        {editing ? (
          <View style={s.editRow}>
            <TextInput style={s.editInput} value={qty} onChangeText={setQty} keyboardType="numeric" />
            <TouchableOpacity style={s.saveBtn} onPress={() => { onUpdate(item, qty); setEditing(false); }}>
              <Text style={s.saveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelEditBtn} onPress={() => setEditing(false)}>
              <Text style={s.cancelEditText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.invActions}>
            <Text style={s.invQty}>Qty: <Text style={s.invQtyNum}>{item.quantity}</Text></Text>
            {item.price && <Text style={s.invPrice}>₹{item.price}</Text>}
            <TouchableOpacity style={s.editBtn} onPress={() => setEditing(true)}>
              <Text style={s.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(item)}>
              <Text style={s.deleteBtnText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container:          { flex:1, backgroundColor:"#f0f4f8" },
  center:             { flex:1, justifyContent:"center", alignItems:"center" },
  loadingText:        { marginTop:12, color:"#888" },
  header:             { backgroundColor:"#1B4F8A", padding:20, flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  headerTitle:        { fontSize:18, fontWeight:"bold", color:"#fff" },
  headerSub:          { fontSize:12, color:"rgba(255,255,255,0.8)", marginTop:2 },
  logoutBtn:          { backgroundColor:"rgba(255,255,255,0.2)", borderRadius:8, padding:8 },
  logoutText:         { color:"#fff", fontSize:13 },
  flashError:         { backgroundColor:"#ffebee", padding:10, margin:10, borderRadius:8 },
  flashSuccess:       { backgroundColor:"#e8f5e9", padding:10, margin:10, borderRadius:8 },
  flashText:          { fontSize:13, color:"#333" },
  tabsScroll:         { backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#eee", maxHeight:48 },
  tabs:               { flexDirection:"row" },
  tab:                { paddingHorizontal:16, paddingVertical:12, alignItems:"center" },
  tabActive:          { borderBottomWidth:2, borderBottomColor:"#1B4F8A" },
  tabText:            { fontSize:12, color:"#888" },
  tabTextActive:      { color:"#1B4F8A", fontWeight:"bold" },
  tabContent:         { flex:1, padding:16 },
  infoRow:            { flexDirection:"row", backgroundColor:"#fff", borderRadius:10, padding:14, marginBottom:8 },
  infoIcon:           { fontSize:20, marginRight:12 },
  infoContent:        { flex:1 },
  infoLabel:          { fontSize:11, color:"#888", marginBottom:2 },
  infoValue:          { fontSize:14, color:"#222", fontWeight:"500" },
  statsRow:           { flexDirection:"row", gap:10, marginTop:16 },
  statCard:           { flex:1, backgroundColor:"#1B4F8A", borderRadius:12, padding:16, alignItems:"center" },
  statNum:            { fontSize:24, fontWeight:"bold", color:"#fff" },
  statLabel:          { fontSize:11, color:"rgba(255,255,255,0.8)", marginTop:4 },
  emptyBox:           { alignItems:"center", marginTop:60 },
  emptyIcon:          { fontSize:48, marginBottom:12 },
  emptyText:          { fontSize:16, color:"#888", marginBottom:8 },
  emptyLink:          { color:"#1B4F8A", fontSize:15, fontWeight:"bold" },
  invCard:            { backgroundColor:"#fff", borderRadius:12, padding:14, marginBottom:10, elevation:2 },
  invHeader:          { flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 },
  invLeft:            { flex:1 },
  invName:            { fontSize:15, fontWeight:"bold", color:"#1B4F8A" },
  invSub:             { fontSize:11, color:"#888", marginTop:2 },
  stockBadge:         { backgroundColor:"#e8f5e9", borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  outOfStock:         { backgroundColor:"#ffebee" },
  stockText:          { fontSize:11, fontWeight:"bold", color:"#2e7d32" },
  invFooter:          { borderTopWidth:1, borderTopColor:"#f0f0f0", paddingTop:8 },
  invActions:         { flexDirection:"row", alignItems:"center", gap:8 },
  invQty:             { fontSize:13, color:"#555", flex:1 },
  invQtyNum:          { fontWeight:"bold", color:"#1B4F8A" },
  invPrice:           { fontSize:13, fontWeight:"bold", color:"#2e7d32" },
  editBtn:            { backgroundColor:"#e3f2fd", borderRadius:6, paddingHorizontal:10, paddingVertical:5 },
  editBtnText:        { fontSize:12, color:"#1565c0" },
  deleteBtn:          { padding:5 },
  deleteBtnText:      { fontSize:16 },
  editRow:            { flexDirection:"row", gap:8, alignItems:"center" },
  editInput:          { flex:1, backgroundColor:"#f5f5f5", borderRadius:8, padding:8, borderWidth:1, borderColor:"#ddd" },
  saveBtn:            { backgroundColor:"#1B4F8A", borderRadius:8, paddingHorizontal:12, paddingVertical:8 },
  saveBtnText:        { color:"#fff", fontSize:13, fontWeight:"bold" },
  cancelEditBtn:      { padding:8 },
  cancelEditText:     { fontSize:16, color:"#888" },
  searchInput:        { backgroundColor:"#fff", borderRadius:10, padding:12, marginBottom:12, fontSize:15, borderWidth:1, borderColor:"#dde" },
  selectedMed:        { backgroundColor:"#e3f2fd", borderRadius:12, padding:16, marginBottom:12 },
  selectedMedName:    { fontSize:16, fontWeight:"bold", color:"#1B4F8A" },
  selectedMedSub:     { fontSize:12, color:"#555", marginBottom:12 },
  qtyRow:             { flexDirection:"row", gap:8, marginBottom:12 },
  qtyInput:           { flex:1, backgroundColor:"#fff", borderRadius:8, padding:10, borderWidth:1, borderColor:"#ddd" },
  addBtn:             { backgroundColor:"#1B4F8A", borderRadius:10, padding:14, alignItems:"center", marginBottom:8 },
  addBtnText:         { color:"#fff", fontWeight:"bold", fontSize:15 },
  cancelBtn:          { alignItems:"center", padding:8 },
  cancelText:         { color:"#888", fontSize:13 },
  medRow:             { backgroundColor:"#fff", borderRadius:10, padding:14, marginBottom:6, flexDirection:"row", alignItems:"center", borderWidth:1, borderColor:"#eee" },
  medRowSelected:     { borderColor:"#1B4F8A", backgroundColor:"#e3f2fd" },
  medRowLeft:         { flex:1 },
  medRowName:         { fontSize:14, fontWeight:"bold", color:"#222" },
  medRowSub:          { fontSize:11, color:"#888", marginTop:2 },
  rxTag:              { backgroundColor:"#ffebee", borderRadius:4, paddingHorizontal:6, paddingVertical:2 },
  scanTitle:          { fontSize:18, fontWeight:"bold", color:"#1B4F8A", marginBottom:6 },
  scanSub:            { fontSize:13, color:"#666", marginBottom:20, lineHeight:20 },
  uploadOptions:      { flexDirection:"row", gap:10, marginBottom:20 },
  uploadBtn:          { flex:1, backgroundColor:"#fff", borderRadius:12, padding:16, alignItems:"center", borderWidth:1.5, borderColor:"#e0e0e0", borderStyle:"dashed" },
  uploadBtnIcon:      { fontSize:28, marginBottom:6 },
  uploadBtnText:      { fontSize:13, fontWeight:"bold", color:"#1B4F8A" },
  uploadBtnSub:       { fontSize:11, color:"#aaa", marginTop:2 },
  scanningBox:        { alignItems:"center", padding:40 },
  scanningText:       { fontSize:16, fontWeight:"bold", color:"#1B4F8A", marginTop:16 },
  scanningSubText:    { fontSize:13, color:"#888", marginTop:6 },
  scanSummary:        { backgroundColor:"#e8f5e9", borderRadius:12, padding:16, marginBottom:16 },
  scanSummaryTitle:   { fontSize:16, fontWeight:"bold", color:"#2e7d32" },
  scanSummaryText:    { fontSize:13, color:"#555", marginTop:4 },
  matchedSection:     { marginBottom:16 },
  unmatchedSection:   { marginBottom:16 },
  sectionTitle:       { fontSize:14, fontWeight:"bold", color:"#333", marginBottom:8 },
  unmatchedNote:      { fontSize:12, color:"#e65100", marginBottom:8 },
  matchedCard:        { backgroundColor:"#fff", borderRadius:10, padding:12, marginBottom:6, flexDirection:"row", alignItems:"center", elevation:1, borderWidth:1, borderColor:"#e0f2e9" },
  matchedCardDisabled:{ opacity:0.4 },
  matchedCheck:       { marginRight:8 },
  checkIcon:          { fontSize:20 },
  matchedInfo:        { flex:1 },
  matchedName:        { fontSize:13, fontWeight:"bold", color:"#1B4F8A" },
  matchedExtracted:   { fontSize:11, color:"#888", marginTop:2 },
  matchedQtyBox:      { flexDirection:"row", alignItems:"center", gap:4 },
  matchedQtyInput:    { backgroundColor:"#f5f5f5", borderRadius:6, padding:6, width:52, textAlign:"center", borderWidth:1, borderColor:"#ddd", fontSize:13 },
  matchedQtyLabel:    { fontSize:11, color:"#888" },
  unmatchedCard:      { backgroundColor:"#fff3e0", borderRadius:8, padding:10, marginBottom:4, flexDirection:"row", justifyContent:"space-between" },
  unmatchedName:      { fontSize:13, color:"#e65100" },
  unmatchedQty:       { fontSize:12, color:"#888" },
  scanActions:        { gap:10, marginTop:8, marginBottom:30 },
  confirmBtn:         { backgroundColor:"#2e7d32", borderRadius:12, padding:16, alignItems:"center" },
  confirmBtnText:     { color:"#fff", fontWeight:"bold", fontSize:15 },
  rescanBtn:          { backgroundColor:"#fff", borderRadius:12, padding:14, alignItems:"center", borderWidth:1, borderColor:"#ddd" },
  rescanBtnText:      { color:"#666", fontSize:14 },
});