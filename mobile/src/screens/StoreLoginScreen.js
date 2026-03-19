import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useStoreAuth } from "../context/StoreAuthContext";

export default function StoreLoginScreen({ navigation }) {
  const { storeLogin } = useStoreAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Email and password required"); return; }
    setLoading(true);
    try {
      await storeLogin(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials");
    } finally { setLoading(false); }
  };

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.icon}>🏪</Text>
        <Text style={s.title}>Store Admin Login</Text>
        <Text style={s.sub}>For pharmacy owners and staff only</Text>
        {error ? <View style={s.errorBox}><Text style={s.errorText}>⚠️ {error}</Text></View> : null}
        <TextInput style={s.input} placeholder="Admin Email" value={email}
          onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#aaa" />
        <TextInput style={s.input} placeholder="Password" value={password}
          onChangeText={setPassword} secureTextEntry placeholderTextColor="#aaa" />
        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login as Store Admin</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.link} onPress={() => navigation.navigate("StoreRegister")}>
          <Text style={s.linkText}>Register new pharmacy →</Text>
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.userLink}>← Back to User Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex:1, justifyContent:"center", padding:24, backgroundColor:"#f0f4f8" },
  card:        { backgroundColor:"#fff", borderRadius:20, padding:28, shadowColor:"#000", shadowOpacity:0.1, shadowRadius:20, elevation:8 },
  icon:        { fontSize:48, textAlign:"center", marginBottom:8 },
  title:       { fontSize:24, fontWeight:"bold", color:"#1B4F8A", textAlign:"center", marginBottom:4 },
  sub:         { fontSize:13, color:"#888", textAlign:"center", marginBottom:24 },
  errorBox:    { backgroundColor:"#ffebee", borderRadius:8, padding:10, marginBottom:12 },
  errorText:   { color:"#c62828", fontSize:13 },
  input:       { backgroundColor:"#f8f9fa", borderRadius:10, padding:14, marginBottom:12, fontSize:15, borderWidth:1, borderColor:"#eee" },
  btn:         { backgroundColor:"#1B4F8A", borderRadius:12, padding:16, alignItems:"center", marginBottom:16 },
  btnDisabled: { opacity:0.6 },
  btnText:     { color:"#fff", fontSize:16, fontWeight:"bold" },
  link:        { alignItems:"center", marginBottom:16 },
  linkText:    { color:"#1B4F8A", fontSize:14 },
  divider:     { height:1, backgroundColor:"#eee", marginBottom:16 },
  userLink:    { color:"#888", fontSize:13, textAlign:"center" },
});