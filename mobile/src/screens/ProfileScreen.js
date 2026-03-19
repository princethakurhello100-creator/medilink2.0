import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [joinedDate, setJoinedDate] = useState('');

  useEffect(() => {
    if (user?.id) {
      try {
        const ts = parseInt(user.id.substring(0, 8), 16) * 1000;
        setJoinedDate(new Date(ts).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }));
      } catch { setJoinedDate('Unknown'); }
    }
  }, [user]);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) logout();
    } else {
      const { Alert } = require('react-native');
      Alert.alert('Logout', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]);
    }
  };

  const roleColor = user?.role === 'admin' ? '#7b1fa2' : user?.role === 'pharmacist' ? '#1565c0' : '#2e7d32';
  const roleIcon  = user?.role === 'admin' ? '🛡️' : user?.role === 'pharmacist' ? '💊' : '👤';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.avatarBox}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{roleIcon}</Text>
        </View>
        <View style={[s.roleBadge, { backgroundColor: roleColor }]}>
          <Text style={s.roleBadgeText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Account Information</Text>
        <View style={s.row}>
          <Text style={s.label}>User ID</Text>
          <Text style={s.value} numberOfLines={1}>{user?.id ? user.id.slice(-8).toUpperCase() : 'N/A'}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.label}>Role</Text>
          <Text style={[s.value, { color: roleColor, fontWeight: 'bold' }]}>{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.label}>Member Since</Text>
          <Text style={s.value}>{joinedDate}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.label}>Account Status</Text>
          <View style={s.statusBadge}>
            <View style={s.statusDot} />
            <Text style={s.statusText}>Active</Text>
          </View>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Quick Actions</Text>
        <TouchableOpacity style={s.actionRow} onPress={() => navigation.navigate('Search')}>
          <Text style={s.actionIcon}>💊</Text>
          <Text style={s.actionText}>Search Medicines</Text>
          <Text style={s.actionArrow}>→</Text>
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity style={s.actionRow}>
          <Text style={s.actionIcon}>📋</Text>
          <Text style={s.actionText}>My Prescriptions</Text>
          <Text style={s.actionArrow}>→</Text>
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity style={s.actionRow}>
          <Text style={s.actionIcon}>🔔</Text>
          <Text style={s.actionText}>Notifications</Text>
          <Text style={s.actionArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>App Info</Text>
        <View style={s.row}>
          <Text style={s.label}>Version</Text>
          <Text style={s.value}>2.0.0</Text>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.label}>Environment</Text>
          <Text style={s.value}>Development</Text>
        </View>
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>🚪  Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f5f5f5' },
  content:        { paddingBottom: 40 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  backBtn:        { padding: 8 },
  backText:       { color: '#1B4F8A', fontSize: 15, fontWeight: '600' },
  headerTitle:    { fontSize: 18, fontWeight: 'bold', color: '#1B4F8A' },
  avatarBox:      { alignItems: 'center', marginVertical: 24 },
  avatar:         { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1B4F8A', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText:     { fontSize: 40 },
  roleBadge:      { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText:  { color: '#fff', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  card:           { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 20, marginBottom: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTitle:      { fontSize: 13, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  label:          { fontSize: 14, color: '#666' },
  value:          { fontSize: 14, color: '#222', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  divider:        { height: 1, backgroundColor: '#f0f0f0' },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: '#43a047', marginRight: 5 },
  statusText:     { color: '#2e7d32', fontSize: 12, fontWeight: '600' },
  actionRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  actionIcon:     { fontSize: 20, marginRight: 12 },
  actionText:     { flex: 1, fontSize: 15, color: '#222' },
  actionArrow:    { fontSize: 16, color: '#bbb' },
  logoutBtn:      { marginHorizontal: 20, marginTop: 8, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#e53935', alignItems: 'center' },
  logoutText:     { color: '#e53935', fontWeight: 'bold', fontSize: 15 },
});
