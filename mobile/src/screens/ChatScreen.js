import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Animated
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { ENDPOINTS } from '../services/config';

// Quick symptom suggestions
const QUICK_SYMPTOMS = [
  { label: '🤒 Fever',        text: 'I have fever' },
  { label: '🤧 Cold',         text: 'I have cold and runny nose' },
  { label: '🤕 Headache',     text: 'I have a bad headache' },
  { label: '🤢 Nausea',       text: 'I feel nauseous and want to vomit' },
  { label: '😮‍💨 Cough',       text: 'I have dry cough' },
  { label: '🦷 Toothache',    text: 'I have severe toothache' },
  { label: '💊 Side effects', text: 'What are common medicine side effects?' },
  { label: '😴 Insomnia',     text: 'I cannot sleep at night' },
];

// Typing dots animation
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0,  duration: 300, useNativeDriver: true }),
      ])
    ).start();
    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  return (
    <View style={s.typingRow}>
      <View style={s.doctorAvatarSmall}>
        <Text style={s.doctorEmojiSmall}>👨‍⚕️</Text>
      </View>
      <View style={s.typingBubble}>
        <View style={s.dotsRow}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View key={i} style={[s.dot, { transform: [{ translateY: dot }] }]} />
          ))}
        </View>
      </View>
    </View>
  );
};

// Medicine detail card shown in chat
const MedicineCard = ({ med, onSearch }) => (
  <TouchableOpacity style={s.medCard} onPress={() => onSearch(med)}>
    <View style={s.medCardLeft}>
      <Text style={s.medCardIcon}>💊</Text>
    </View>
    <View style={s.medCardBody}>
      <Text style={s.medCardName}>{med}</Text>
      <Text style={s.medCardSub}>Tap to search availability →</Text>
    </View>
  </TouchableOpacity>
);

export default function ChatScreen({ navigation }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const flatRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      text: "Hello! I'm Dr. MediLink AI 👨‍⚕️\n\nI'm here to help you with health and medicine questions. Tell me your symptoms or pick a common one below.\n\n⚠️ I'm an AI assistant — always consult a real doctor for serious conditions.",
      medicines: [],
    }
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showSymptoms, setShowSymptoms] = useState(true);

  const scrollToBottom = () => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;

    setShowSymptoms(false);
    const userMsg = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await apiClient.post(ENDPOINTS.AI_CHAT, {
        message: text,
        history: messages.map(m => ({ role: m.role, content: m.text })),
      });

      const aiMsg = {
        id:        (Date.now() + 1).toString(),
        role:      'assistant',
        text:      data.reply,
        medicines: data.medicines || [],
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id:   (Date.now() + 1).toString(),
        role: 'assistant',
        text: '⚠️ Sorry, I could not process your request. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[s.msgRow, isUser ? s.msgRowUser : s.msgRowAI]}>
        {!isUser && (
          <View style={s.doctorAvatarSmall}>
            <Text style={s.doctorEmojiSmall}>👨‍⚕️</Text>
          </View>
        )}
        <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
          <Text style={[s.bubbleText, isUser ? s.bubbleTextUser : s.bubbleTextAI]}>
            {item.text}
          </Text>
          {item.medicines?.length > 0 && (
            <View style={s.medSection}>
              <Text style={s.medSectionTitle}>💊 Available in MediLink:</Text>
              {item.medicines.map((med, i) => (
                <MedicineCard key={i} med={med}
                  onSearch={name => navigation.navigate('Search', { query: name })} />
              ))}
            </View>
          )}
        </View>
        {isUser && (
          <View style={s.userAvatar}>
            <Text style={s.userAvatarText}>👤</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Header — Doctor style */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={s.doctorProfile}>
          <View style={s.doctorAvatar}>
            <Text style={s.doctorEmoji}>👨‍⚕️</Text>
          </View>
          <View>
            <Text style={s.doctorName}>Dr. MediLink AI</Text>
            <View style={s.onlineRow}>
              <View style={s.onlineDot} />
              <Text style={s.onlineText}>Online • Health & Medicine Only</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={s.messageList}
        onContentSizeChange={scrollToBottom}
        ListFooterComponent={
          showSymptoms ? (
            <View style={s.symptomsBox}>
              <Text style={s.symptomsTitle}>🩺 Common symptoms — tap to ask:</Text>
              <View style={s.symptomsGrid}>
                {QUICK_SYMPTOMS.map((sym, i) => (
                  <TouchableOpacity key={i} style={s.symptomChip}
                    onPress={() => sendMessage(sym.text)}>
                    <Text style={s.symptomChipText}>{sym.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null
        }
      />

      {loading && <TypingIndicator />}

      {/* Input row */}
      <View style={s.inputArea}>
        {!showSymptoms && (
          <TouchableOpacity style={s.symptomsToggle} onPress={() => setShowSymptoms(true)}>
            <Text style={s.symptomsToggleText}>🩺 Symptoms</Text>
          </TouchableOpacity>
        )}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Describe your symptoms..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            multiline
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDis]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}>
            <Text style={s.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.disclaimer}>⚠️ AI only — not a substitute for medical advice</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#f0f4f8' },

  // Header
  header:             { backgroundColor: '#1B4F8A', padding: 16, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:            { width: 36, height: 36, justifyContent: 'center' },
  backText:           { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  doctorProfile:      { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center' },
  doctorAvatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  doctorEmoji:        { fontSize: 26 },
  doctorName:         { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  onlineRow:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4caf50' },
  onlineText:         { color: 'rgba(255,255,255,0.8)', fontSize: 11 },

  // Messages
  messageList:        { padding: 16, paddingBottom: 8 },
  msgRow:             { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16, gap: 8 },
  msgRowUser:         { justifyContent: 'flex-end' },
  msgRowAI:           { justifyContent: 'flex-start' },
  doctorAvatarSmall:  { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e3f2fd', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  doctorEmojiSmall:   { fontSize: 18 },
  userAvatar:         { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1B4F8A', justifyContent: 'center', alignItems: 'center' },
  userAvatarText:     { fontSize: 18 },
  bubble:             { maxWidth: '75%', borderRadius: 18, padding: 13 },
  bubbleUser:         { backgroundColor: '#1B4F8A', borderBottomRightRadius: 4 },
  bubbleAI:           { backgroundColor: '#fff', borderBottomLeftRadius: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  bubbleText:         { fontSize: 14, lineHeight: 21 },
  bubbleTextUser:     { color: '#fff' },
  bubbleTextAI:       { color: '#222' },

  // Medicine cards
  medSection:         { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 8 },
  medSectionTitle:    { fontSize: 12, fontWeight: 'bold', color: '#1B4F8A', marginBottom: 6 },
  medCard:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, marginBottom: 6, gap: 10 },
  medCardLeft:        { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  medCardIcon:        { fontSize: 18 },
  medCardBody:        { flex: 1 },
  medCardName:        { fontSize: 13, fontWeight: 'bold', color: '#1B4F8A' },
  medCardSub:         { fontSize: 11, color: '#888', marginTop: 2 },

  // Typing indicator
  typingRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  typingBubble:       { backgroundColor: '#fff', borderRadius: 16, padding: 12, elevation: 1 },
  dotsRow:            { flexDirection: 'row', gap: 4, alignItems: 'center', height: 16 },
  dot:                { width: 7, height: 7, borderRadius: 4, backgroundColor: '#1B4F8A' },

  // Quick symptoms
  symptomsBox:        { margin: 8, backgroundColor: '#fff', borderRadius: 14, padding: 14, elevation: 1 },
  symptomsTitle:      { fontSize: 13, fontWeight: 'bold', color: '#1B4F8A', marginBottom: 10 },
  symptomsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomChip:        { backgroundColor: '#e3f2fd', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#bbdefb' },
  symptomChipText:    { fontSize: 12, color: '#1B4F8A', fontWeight: '600' },

  // Input area
  inputArea:          { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', padding: 10 },
  symptomsToggle:     { alignSelf: 'flex-start', backgroundColor: '#e3f2fd', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  symptomsToggleText: { fontSize: 12, color: '#1B4F8A', fontWeight: '600' },
  inputRow:           { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input:              { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: '#eee' },
  sendBtn:            { backgroundColor: '#1B4F8A', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, justifyContent: 'center' },
  sendBtnDis:         { opacity: 0.4 },
  sendBtnText:        { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  disclaimer:         { fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 6 },
});