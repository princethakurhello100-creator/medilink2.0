import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Platform
} from "react-native";
import axios from "axios";
import { API_BASE_URL, ENDPOINTS } from "../services/config";

const Field = ({ label, required, ...props }) => (
  <View style={s.fieldWrap}>
    <Text style={s.label}>{label}{required && <Text style={s.req}> *</Text>}</Text>
    <TextInput style={s.input} placeholderTextColor="#aaa" {...props} />
  </View>
);

const Section = ({ title, icon }) => (
  <View style={s.section}>
    <Text style={s.sectionIcon}>{icon}</Text>
    <Text style={s.sectionTitle}>{title}</Text>
  </View>
);

export default function StoreRegisterScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    email: "", password: "",
    ownerName: "", ownerPhone: "",
    licenseNumber: "", licenseExpiry: "",
    storeName: "", street: "", city: "",
    state: "", postalCode: "", storePhone: "",
    latitude: "", longitude: "",
    openTime: "08:00", closeTime: "22:00",
  });

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    setError("");
    const required = ["email","password","ownerName","ownerPhone",
      "licenseNumber","licenseExpiry","storeName","street",
      "city","state","postalCode","storePhone","latitude","longitude"];
    for (const k of required) {
      if (!form[k]?.trim()) {
        setError(`${k.replace(/([A-Z])/g," $1")} is required`);
        return;
      }
    }
    setLoading(true);
    try {
      const payload = { ...form, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude) };
      const { data } = await axios.post(API_BASE_URL + ENDPOINTS.STORE_REGISTER, payload);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally { setLoading(false); }
  };

  if (success) return (
    <View style={s.successBox}>
      <Text style={s.successIcon}>🎉</Text>
      <Text style={s.successTitle}>Store Registered!</Text>
      <Text style={s.successMsg}>Your pharmacy has been registered successfully. You can now login as Store Admin.</Text>
      <TouchableOpacity style={s.successBtn} onPress={() => navigation.navigate("StoreLogin")}>
        <Text style={s.successBtnText}>Login as Store Admin →</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <Text style={s.headerIcon}>🏥</Text>
        <Text style={s.headerTitle}>Register Your Pharmacy</Text>
        <Text style={s.headerSub}>All fields marked * are required. License number is mandatory.</Text>
      </View>

      {error ? <View style={s.errorBox}><Text style={s.errorText}>⚠️ {error}</Text></View> : null}

      <Section title="Owner Details" icon="👤" />
      <Field label="Owner Full Name" required value={form.ownerName} onChangeText={set("ownerName")} placeholder="Dr. Rajesh Kumar" />
      <Field label="Owner Phone" required value={form.ownerPhone} onChangeText={set("ownerPhone")} placeholder="+91-9876543210" keyboardType="phone-pad" />
      <Field label="Login Email" required value={form.email} onChangeText={set("email")} placeholder="owner@pharmacy.com" keyboardType="email-address" autoCapitalize="none" />
      <Field label="Password" required value={form.password} onChangeText={set("password")} placeholder="Min 8 chars, 1 uppercase, 1 number" secureTextEntry />

      <Section title="License Information" icon="📜" />
      <View style={s.licenseNote}>
        <Text style={s.licenseNoteText}>🔒 A valid pharmacy license is required. Stores without a valid license will not be listed.</Text>
      </View>
      <Field label="License Number" required value={form.licenseNumber} onChangeText={set("licenseNumber")} placeholder="DL-UK-248001-2024" autoCapitalize="characters" />
      <Field label="License Expiry Date" required value={form.licenseExpiry} onChangeText={set("licenseExpiry")} placeholder="YYYY-MM-DD (e.g. 2027-12-31)" />

      <Section title="Pharmacy Details" icon="🏪" />
      <Field label="Pharmacy / Store Name" required value={form.storeName} onChangeText={set("storeName")} placeholder="Apollo Pharmacy" />
      <Field label="Store Phone" required value={form.storePhone} onChangeText={set("storePhone")} placeholder="+91-1234567890" keyboardType="phone-pad" />
      <Field label="Opening Time" required value={form.openTime} onChangeText={set("openTime")} placeholder="08:00" />
      <Field label="Closing Time" required value={form.closeTime} onChangeText={set("closeTime")} placeholder="22:00" />

      <Section title="Address" icon="📍" />
      <Field label="Street Address" required value={form.street} onChangeText={set("street")} placeholder="45 Rajpur Road" />
      <Field label="City" required value={form.city} onChangeText={set("city")} placeholder="Dehradun" />
      <Field label="State" required value={form.state} onChangeText={set("state")} placeholder="Uttarakhand" />
      <Field label="Postal Code" required value={form.postalCode} onChangeText={set("postalCode")} placeholder="248001" keyboardType="numeric" />

      <Section title="Location Coordinates" icon="🗺️" />
      <View style={s.coordNote}>
        <Text style={s.coordNoteText}>Find coordinates at maps.google.com → right click → copy coordinates</Text>
      </View>
      <Field label="Latitude" required value={form.latitude} onChangeText={set("latitude")} placeholder="30.3165" keyboardType="numeric" />
      <Field label="Longitude" required value={form.longitude} onChangeText={set("longitude")} placeholder="78.0322" keyboardType="numeric" />

      <TouchableOpacity style={[s.submitBtn, loading && s.submitDisabled]} onPress={handleSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.submitText}>Register Pharmacy →</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={s.loginLink} onPress={() => navigation.navigate("StoreLogin")}>
        <Text style={s.loginLinkText}>Already registered? Login as Store Admin</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:       { flex:1, backgroundColor:"#f0f4f8" },
  content:         { padding:20, paddingBottom:60 },
  header:          { backgroundColor:"#1B4F8A", borderRadius:16, padding:24, alignItems:"center", marginBottom:24 },
  headerIcon:      { fontSize:48, marginBottom:8 },
  headerTitle:     { fontSize:22, fontWeight:"bold", color:"#fff", textAlign:"center" },
  headerSub:       { fontSize:12, color:"rgba(255,255,255,0.8)", textAlign:"center", marginTop:6 },
  section:         { flexDirection:"row", alignItems:"center", marginTop:20, marginBottom:10 },
  sectionIcon:     { fontSize:18, marginRight:8 },
  sectionTitle:    { fontSize:16, fontWeight:"bold", color:"#1B4F8A" },
  fieldWrap:       { marginBottom:12 },
  label:           { fontSize:13, color:"#555", marginBottom:4, fontWeight:"500" },
  req:             { color:"#e53935" },
  input:           { backgroundColor:"#fff", borderRadius:10, padding:12, fontSize:15, borderWidth:1, borderColor:"#dde" },
  errorBox:        { backgroundColor:"#ffebee", borderRadius:10, padding:12, marginBottom:16 },
  errorText:       { color:"#c62828", fontSize:13 },
  licenseNote:     { backgroundColor:"#fff3e0", borderRadius:10, padding:12, marginBottom:12 },
  licenseNoteText: { color:"#e65100", fontSize:12 },
  coordNote:       { backgroundColor:"#e3f2fd", borderRadius:10, padding:10, marginBottom:12 },
  coordNoteText:   { color:"#1565c0", fontSize:12 },
  submitBtn:       { backgroundColor:"#1B4F8A", borderRadius:12, padding:18, alignItems:"center", marginTop:24 },
  submitDisabled:  { opacity:0.6 },
  submitText:      { color:"#fff", fontSize:16, fontWeight:"bold" },
  loginLink:       { alignItems:"center", marginTop:16, padding:12 },
  loginLinkText:   { color:"#1B4F8A", fontSize:14 },
  successBox:      { flex:1, justifyContent:"center", alignItems:"center", padding:32, backgroundColor:"#f0f4f8" },
  successIcon:     { fontSize:64, marginBottom:16 },
  successTitle:    { fontSize:24, fontWeight:"bold", color:"#2e7d32", marginBottom:12 },
  successMsg:      { fontSize:15, color:"#555", textAlign:"center", lineHeight:22, marginBottom:32 },
  successBtn:      { backgroundColor:"#1B4F8A", borderRadius:12, padding:16, paddingHorizontal:32 },
  successBtnText:  { color:"#fff", fontSize:16, fontWeight:"bold" },
});