import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const validate = () => {
    if (!email || !password) return "Email and password are required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number";
    return null;
  };

  const handleRegister = async () => {
    setError("");
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={s.logoBox}>
        <Text style={s.logo}>👤</Text>
        <Text style={s.title}>Create Account</Text>
        <Text style={s.sub}>Join MediLink 2.0</Text>
      </View>

      {error ? <View style={s.errorBox}><Text style={s.errorText}>⚠️ {error}</Text></View> : null}

      <TextInput style={s.input} placeholder="Email address" value={email}
        onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
        placeholderTextColor="#aaa" />

      <TextInput style={s.input} placeholder="Password" value={password}
        onChangeText={setPassword} secureTextEntry placeholderTextColor="#aaa" />

      <View style={s.requirementsBox}>
        <Text style={s.reqTitle}>Password must have:</Text>
        <Text style={[s.req, password.length >= 8 && s.reqMet]}>
          {password.length >= 8 ? "✅" : "○"} At least 8 characters
        </Text>
        <Text style={[s.req, /[A-Z]/.test(password) && s.reqMet]}>
          {/[A-Z]/.test(password) ? "✅" : "○"} One uppercase letter
        </Text>
        <Text style={[s.req, /[0-9]/.test(password) && s.reqMet]}>
          {/[0-9]/.test(password) ? "✅" : "○"} One number
        </Text>
      </View>

      <TouchableOpacity style={[s.btn, loading && s.btnDis]} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")} style={s.link}>
        <Text style={s.linkText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:       { flex:1, justifyContent:"center", padding:24, backgroundColor:"#f5f5f5" },
  logoBox:         { alignItems:"center", marginBottom:24 },
  logo:            { fontSize:48, marginBottom:8 },
  title:           { fontSize:28, fontWeight:"bold", color:"#1B4F8A" },
  sub:             { fontSize:14, color:"#888", marginTop:4 },
  errorBox:        { backgroundColor:"#ffebee", borderRadius:10, padding:12, marginBottom:14 },
  errorText:       { color:"#c62828", fontSize:13 },
  input:           { backgroundColor:"#fff", borderRadius:10, padding:14, marginBottom:12, fontSize:16, borderWidth:1, borderColor:"#ddd" },
  requirementsBox: { backgroundColor:"#f0f4f8", borderRadius:10, padding:12, marginBottom:16 },
  reqTitle:        { fontSize:12, fontWeight:"bold", color:"#555", marginBottom:6 },
  req:             { fontSize:12, color:"#999", marginBottom:3 },
  reqMet:          { color:"#2e7d32" },
  btn:             { backgroundColor:"#1B4F8A", borderRadius:10, padding:16, alignItems:"center", marginBottom:14 },
  btnDis:          { opacity:0.6 },
  btnText:         { color:"#fff", fontSize:16, fontWeight:"bold" },
  link:            { alignItems:"center" },
  linkText:        { color:"#1B4F8A", fontSize:14 },
});