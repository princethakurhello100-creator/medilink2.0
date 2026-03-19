import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Email and password required"); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid email or password");
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={s.logoBox}>
        <Text style={s.logo}>💊</Text>
        <Text style={s.title}>MediLink 2.0</Text>
        <Text style={s.sub}>Medical Inventory and Navigation</Text>
      </View>

      {error ? <View style={s.errorBox}><Text style={s.errorText}>⚠️ {error}</Text></View> : null}

      <TextInput style={s.input} placeholder="Email" value={email}
        onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
        placeholderTextColor="#aaa" />
      <TextInput style={s.input} placeholder="Password" value={password}
        onChangeText={setPassword} secureTextEntry placeholderTextColor="#aaa" />

      <TouchableOpacity style={[s.btn, loading && s.btnDis]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Register")} style={s.link}>
        <Text style={s.linkText}>New user? Create account</Text>
      </TouchableOpacity>

      <View style={s.divider}>
        <View style={s.line}/><Text style={s.or}>OR</Text><View style={s.line}/>
      </View>

      <TouchableOpacity style={s.storeBtn} onPress={() => navigation.navigate("StoreEntry")}>
        <Text style={s.storeBtnIcon}>🏪</Text>
        <View style={{flex:1}}>
          <Text style={s.storeBtnTitle}>Store Admin Portal</Text>
          <Text style={s.storeBtnSub}>For pharmacy owners and staff</Text>
        </View>
        <Text style={s.storeBtnArrow}>→</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:     { flex:1, justifyContent:"center", padding:24, backgroundColor:"#f5f5f5" },
  logoBox:       { alignItems:"center", marginBottom:32 },
  logo:          { fontSize:56, marginBottom:8 },
  title:         { fontSize:32, fontWeight:"bold", color:"#1B4F8A" },
  sub:           { fontSize:14, color:"#888", marginTop:4 },
  errorBox:      { backgroundColor:"#ffebee", borderRadius:10, padding:12, marginBottom:14 },
  errorText:     { color:"#c62828", fontSize:13 },
  input:         { backgroundColor:"#fff", borderRadius:10, padding:14, marginBottom:12, fontSize:16, borderWidth:1, borderColor:"#ddd" },
  btn:           { backgroundColor:"#1B4F8A", borderRadius:10, padding:16, alignItems:"center", marginBottom:14 },
  btnDis:        { opacity:0.6 },
  btnText:       { color:"#fff", fontSize:16, fontWeight:"bold" },
  link:          { alignItems:"center", marginBottom:24 },
  linkText:      { color:"#1B4F8A", fontSize:14 },
  divider:       { flexDirection:"row", alignItems:"center", marginBottom:20 },
  line:          { flex:1, height:1, backgroundColor:"#ddd" },
  or:            { marginHorizontal:12, color:"#aaa", fontSize:13 },
  storeBtn:      { backgroundColor:"#fff", borderRadius:14, padding:18, flexDirection:"row", alignItems:"center", borderWidth:1, borderColor:"#dde", gap:12 },
  storeBtnIcon:  { fontSize:32 },
  storeBtnTitle: { fontSize:15, fontWeight:"bold", color:"#1B4F8A" },
  storeBtnSub:   { fontSize:12, color:"#888", marginTop:2 },
  storeBtnArrow: { fontSize:18, color:"#1B4F8A" },
});