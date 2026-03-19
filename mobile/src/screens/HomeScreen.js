import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function HomeScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { t } = useLanguage();

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) logout();
    } else {
      const { Alert } = require('react-native');
      Alert.alert(t('logout'), 'Are you sure?', [
        { text: t('cancel'), style: 'cancel' },
        { text: t('logout'), style: 'destructive', onPress: logout },
      ]);
    }
  };

  const roleIcon = user?.role === 'admin' ? '🛡️' : user?.role === 'pharmacist' ? '💊' : '👤';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      <View style={s.topBar}>
        <View>
          <Text style={s.title}>{t('appName')}</Text>
          <Text style={s.welcome}>{t('goodToSeeYou')}</Text>
        </View>
        <TouchableOpacity style={s.profileBtn} onPress={() => navigation.navigate('Profile')}>
          <Text style={s.profileIcon}>{roleIcon}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.infoCard}>
        <Text style={s.infoText}>👋 {t('signedInAs')} </Text>
        <Text style={s.infoRole}>{user?.role?.toUpperCase()}</Text>
      </View>

      <Text style={s.sectionTitle}>{t('whatToDo')}</Text>

      <TouchableOpacity style={s.card} onPress={() => navigation.navigate('Search')}>
        <Text style={s.cardIcon}>💊</Text>
        <View style={s.cardBody}>
          <Text style={s.cardTitle}>{t('searchMedicines')}</Text>
          <Text style={s.cardDesc}>{t('searchMedicinesSub')}</Text>
        </View>
        <Text style={s.cardArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.card}>
        <Text style={s.cardIcon}>🏪</Text>
        <View style={s.cardBody}>
          <Text style={s.cardTitle}>{t('findPharmacy')}</Text>
          <Text style={s.cardDesc}>{t('findPharmacySub')}</Text>
        </View>
        <Text style={s.cardArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.card}>
        <Text style={s.cardIcon}>📋</Text>
        <View style={s.cardBody}>
          <Text style={s.cardTitle}>{t('uploadPrescription')}</Text>
          <Text style={s.cardDesc}>{t('uploadPrescriptionSub')}</Text>
        </View>
        <Text style={s.cardArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.card} onPress={() => navigation.navigate('Profile')}>
        <Text style={s.cardIcon}>👤</Text>
        <View style={s.cardBody}>
          <Text style={s.cardTitle}>{t('myProfile')}</Text>
          <Text style={s.cardDesc}>{t('myProfileSub')}</Text>
        </View>
        <Text style={s.cardArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>🚪  {t('logout')}</Text>
      </TouchableOpacity>

<TouchableOpacity style={s.chatFab} onPress={() => navigation.navigate('Chat')}>
        <Text style={s.chatFabText}>🤖</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f5f5' },
  content:      { padding: 24, paddingBottom: 40 },
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title:        { fontSize: 26, fontWeight: 'bold', color: '#1B4F8A' },
  welcome:      { fontSize: 13, color: '#888', marginTop: 2 },
  profileBtn:   { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1B4F8A', alignItems: 'center', justifyContent: 'center' },
  profileIcon:  { fontSize: 22 },
  infoCard:     { backgroundColor: '#e8f0fe', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  infoText:     { fontSize: 13, color: '#444' },
  infoRole:     { fontSize: 13, fontWeight: 'bold', color: '#1B4F8A' },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardIcon:     { fontSize: 28, marginRight: 16 },
  cardBody:     { flex: 1 },
  cardTitle:    { fontSize: 15, fontWeight: 'bold', color: '#1B4F8A' },
  cardDesc:     { fontSize: 12, color: '#888', marginTop: 2 },
  cardArrow:    { fontSize: 18, color: '#bbb' },
  logoutBtn:    { marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#e53935', alignItems: 'center' },
  logoutText:   { color: '#e53935', fontWeight: 'bold', fontSize: 15 },
  chatFab:      { position: 'absolute', bottom: 30, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1B4F8A', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  chatFabText:  { fontSize: 26 },
});