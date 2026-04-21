import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors } from '../../constants/Colors';
import { AiMessage } from '../../types';
import { Send, Bot, Sparkles, Volume2, VolumeX } from 'lucide-react-native';

const QUICK_PROMPTS = [
  'How do I install SloanLED modules?',
  'Where can I find datasheets?',
  'How to capture GPS on installation?',
  'What LED products are available?',
];

const AI_FALLBACK_RESPONSES: Record<string, string> = {
  install: "For installation support, check the Installation Guides in the Documents section. SloanLED products include step-by-step instructions. Contact support@sloanled.eu for further help.",
  datasheet: "Find all technical datasheets and spec sheets in the Documents section. Available in English, German, and French.",
  project: "Manage all your projects in the Projects tab. Create projects, update status, capture GPS, and upload installation photos.",
  gps: "GPS coordinates are automatically captured when you tap 'Mark as Installed' on a project. The app records your current location at the time of installation.",
  photo: "Upload photos directly from your camera or gallery. Open any project, go to the Photos tab, and tap 'Take Photo'.",
  hello: "Hello! I'm the SloanLED AI Assistant. I can help with product information, installation guidance, and project management. What can I help you with?",
  led: "SloanLED offers a comprehensive range of LED solutions including Pro Series modules, Flex LEDs, and LED Neon products for signage applications.",
  default: "Thank you for your question. I'm the SloanLED AI Assistant here to help with product information, installation guidance, and project management. For specific technical questions, please check our Documents section or contact support@sloanled.eu.",
};

function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase();
  
  // App-specific context check
  const isAppRelated = 
    lower.includes('install') || lower.includes('hello') || lower.includes('hi') ||
    lower.includes('datasheet') || lower.includes('project') || lower.includes('gps') ||
    lower.includes('photo') || lower.includes('led') || lower.includes('sloan') ||
    lower.includes('upload') || lower.includes('report') || lower.includes('status');

  if (!isAppRelated && lower.length > 3) {
    return "I am the SloanLED AI Assistant. I am designed specifically to help with signage projects, product installation, and technical datasheets. I cannot assist with general off-topic questions. How can I help you with your work today?";
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) return AI_FALLBACK_RESPONSES.hello;
  if (lower.includes('install')) return AI_FALLBACK_RESPONSES.install;
  if (lower.includes('datasheet') || lower.includes('spec')) return AI_FALLBACK_RESPONSES.datasheet;
  if (lower.includes('project') || lower.includes('status')) return AI_FALLBACK_RESPONSES.project;
  if (lower.includes('gps') || lower.includes('location')) return AI_FALLBACK_RESPONSES.gps;
  if (lower.includes('photo') || lower.includes('image') || lower.includes('picture')) return AI_FALLBACK_RESPONSES.photo;
  if (lower.includes('led') || lower.includes('product') || lower.includes('sloan')) return AI_FALLBACK_RESPONSES.led;
  
  return AI_FALLBACK_RESPONSES.default;
}

export default function ChatScreen() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    initSession();
    return () => { Speech.stop(); };
  }, [profile?.id]);

  const initSession = async () => {
    if (!profile?.id) return;
    const { data: session } = await supabase
      .from('ai_sessions')
      .insert({ user_id: profile.id, voiceflow_session_id: `vf_${Date.now()}` })
      .select().single();
    if (session) setSessionId(session.id);
  };

  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || !sessionId || !profile) return;

    setInput('');
    setSending(true);

    const userMsg: AiMessage = {
      id: `temp_${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    await supabase.from('ai_messages').insert({ session_id: sessionId, role: 'user', content: messageText });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/api/v1/ai/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ message: messageText })
      });

      const data = await response.json();
      
      if (data.message) {
        setMessages(prev => [
          ...prev.filter(m => m.id !== userMsg.id),
          { ...userMsg, id: `user_${Date.now()}` },
          data.message,
        ]);
      }
    } catch (error) {
      console.error("AI Error:", error);
      const reply = getFallbackResponse(messageText);
      const { data: savedMsg } = await supabase.from('ai_messages').insert({
        session_id: sessionId, role: 'assistant', content: reply,
      }).select().single();

      if (savedMsg) {
        setMessages(prev => [
          ...prev.filter(m => m.id !== userMsg.id),
          { ...userMsg, id: `user_${Date.now()}` },
          savedMsg,
        ]);
      }
    }

    setSending(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSpeak = async (msg: AiMessage) => {
    if (speakingId === msg.id) {
      await Speech.stop();
      setSpeakingId(null);
      return;
    }
    await Speech.stop();
    setSpeakingId(msg.id);
    Speech.speak(msg.content, {
      language: profile?.language || 'en',
      rate: 0.95,
      onDone: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
    });
  };

  const renderMessage = ({ item }: { item: AiMessage }) => {
    const isUser = item.role === 'user';
    const isSpeaking = speakingId === item.id;
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Bot size={14} color="#fff" />
          </View>
        )}
        <View style={styles.bubbleWrapper}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
            <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}>
              {item.content}
            </Text>
          </View>
          {!isUser && (
            <TouchableOpacity style={styles.speakBtn} onPress={() => handleSpeak(item)}>
              {isSpeaking
                ? <VolumeX size={13} color={Colors.primary[500]} />
                : <Volume2 size={13} color={Colors.neutral[400]} />
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Sparkles size={18} color="#fff" />
        </View>
        <View>
          <Text style={styles.headerTitle}>{t('chat')}</Text>
          <Text style={styles.headerSub}>Powered by SloanLED AI</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {messages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeIcon}>
              <Bot size={36} color={Colors.primary[500]} />
            </View>
            <Text style={styles.welcomeTitle}>SloanLED AI Assistant</Text>
            <Text style={styles.welcomeText}>Ask me anything about products, installation, or project management.</Text>
            <View style={styles.promptsGrid}>
              {QUICK_PROMPTS.map(prompt => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.promptBtn}
                  onPress={() => sendMessage(prompt)}
                >
                  <Text style={styles.promptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={i => i.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {sending && (
          <View style={styles.typingIndicator}>
            <View style={styles.botAvatar}>
              <Bot size={12} color="#fff" />
            </View>
            <View style={[styles.bubble, styles.bubbleBot, { paddingVertical: 10 }]}>
              <ActivityIndicator size="small" color={Colors.primary[500]} />
            </View>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder={t('ask_assistant')}
            placeholderTextColor={Colors.neutral[400]}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || sending}
          >
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  headerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 17, color: Colors.neutral[900] },
  headerSub: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[500], marginTop: 1 },
  welcomeContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  welcomeIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  welcomeTitle: { fontFamily: 'Inter-Bold', fontSize: 20, color: Colors.neutral[900], marginBottom: 8 },
  welcomeText: {
    fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[500],
    textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  promptsGrid: { width: '100%', gap: 8 },
  promptBtn: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.neutral[200],
  },
  promptText: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[700] },
  messageList: { padding: 16, gap: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  bubbleWrapper: { maxWidth: '78%', gap: 4 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: {
    backgroundColor: Colors.primary[600],
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.neutral[100],
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { fontFamily: 'Inter-Regular', color: '#fff' },
  bubbleTextBot: { fontFamily: 'Inter-Regular', color: Colors.neutral[800] },
  speakBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 4,
  },
  typingIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 4,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: Colors.neutral[100],
  },
  textInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900],
    maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.neutral[300] },
});
