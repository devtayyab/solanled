import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Linking, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors } from '../../constants/Colors';
import { AiMessage } from '../../types';
import { Send, Bot, Sparkles, Volume2, VolumeX, Phone, User, MessageSquare, CheckCircle2, ArrowLeft, Search } from 'lucide-react-native';

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
  const [activeTab, setActiveTab] = useState<'ai' | 'support'>('ai');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Support Chat states
  const [supportInput, setSupportInput] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [supportTyping, setSupportTyping] = useState(false);
  const supportFlatListRef = useRef<FlatList>(null);

  // Manager Support Chat states
  const isManager = profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.role === 'sloan_admin';
  const [inbox, setInbox] = useState<any[]>([]); 
  const [filteredInbox, setFilteredInbox] = useState<any[]>([]);
  const [inboxSearch, setInboxSearch] = useState('');
  const [activeUserChatId, setActiveUserChatId] = useState<string | null>(null); 
  const [activeUserChatName, setActiveUserChatName] = useState<string>('');
  const [activeUserChatCompany, setActiveUserChatCompany] = useState<string>('');
  const [loadingInbox, setLoadingInbox] = useState(false);

  const loadUserSupportMessages = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const filtered = (data || [])
        .filter(n => n.data && n.data.type === 'support_message')
        .map(n => {
          const isUser = n.data.sender_id === profile.id;
          return {
            id: n.id,
            role: isUser ? 'user' : 'support',
            content: n.message,
            created_at: n.created_at,
          };
        });

      if (filtered.length > 0) {
        setSupportMessages(filtered);
      } else {
        setSupportMessages([
          {
            id: '1',
            role: 'support',
            content: 'Hello! I am Macer Bridges, your SloanLED Sales Manager for Northern Europe. How can I help you today?',
            created_at: new Date().toISOString(),
          }
        ]);
      }
    } catch (err) {
      console.error('Failed to load user support messages:', err);
    }
  };

  const loadManagerInbox = async () => {
    if (!profile?.id) return;
    setLoadingInbox(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const supportMsgs = (data || []).filter(n => n.data && n.data.type === 'support_message');
      
      const threadsMap: Record<string, any> = {};
      supportMsgs.forEach(msg => {
        const otherId = msg.data.sender_id === profile.id ? msg.data.recipient_id : msg.data.sender_id;
        if (!otherId) return;

        if (!threadsMap[otherId] || new Date(msg.created_at) > new Date(threadsMap[otherId].created_at)) {
          threadsMap[otherId] = {
            userId: otherId,
            userName: msg.data.sender_id === profile.id ? (msg.data.recipient_name || 'User') : (msg.data.sender_name || 'User'),
            companyName: msg.data.sender_id === profile.id ? (msg.data.recipient_company || 'SloanLED Partner') : (msg.data.sender_company || 'SloanLED Partner'),
            lastMessage: msg.message,
            created_at: msg.created_at,
            read: msg.read || msg.data.sender_id === profile.id,
          };
        }
      });

      const inboxList = Object.values(threadsMap).sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setInbox(inboxList);
      setFilteredInbox(inboxList);
    } catch (err) {
      console.error('Failed to load manager inbox:', err);
    } finally {
      setLoadingInbox(false);
    }
  };

  const loadManagerConversation = async (userId: string) => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const conversation = (data || [])
        .filter(n => 
          n.data && 
          n.data.type === 'support_message' && 
          (n.data.sender_id === userId || n.data.recipient_id === userId)
        )
        .map(n => {
          const isMe = n.data.sender_id === profile.id;
          return {
            id: n.id,
            role: isMe ? 'user' : 'support',
            content: n.message,
            created_at: n.created_at,
          };
        });

      setSupportMessages(conversation);
    } catch (err) {
      console.error('Failed to load manager conversation:', err);
    }
  };

  const handleCall = () => {
    Linking.openURL('tel:+31207997890');
  };

  const sendSupportMessage = async () => {
    const text = supportInput.trim();
    if (!text || supportSending || !profile) return;

    setSupportInput('');
    setSupportSending(true);

    const userMsg = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setSupportMessages(prev => [...prev, userMsg]);
    setTimeout(() => supportFlatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      if (isManager && activeUserChatId) {
        const promises = [
          supabase.from('notifications').insert({
            user_id: activeUserChatId,
            type: 'info',
            title: `Support Reply: ${profile.full_name || 'Representative'}`,
            message: text,
            data: {
              type: 'support_message',
              sender_id: profile.id,
              sender_name: profile.full_name || 'SloanLED Support',
              sender_company: 'SloanLED Representative',
              recipient_id: activeUserChatId,
              recipient_name: activeUserChatName,
              recipient_company: activeUserChatCompany
            }
          }),
          supabase.from('notifications').insert({
            user_id: profile.id,
            type: 'info',
            title: `Support Reply: ${profile.full_name || 'Representative'}`,
            message: text,
            data: {
              type: 'support_message',
              sender_id: profile.id,
              sender_name: profile.full_name || 'SloanLED Support',
              sender_company: 'SloanLED Representative',
              recipient_id: activeUserChatId,
              recipient_name: activeUserChatName,
              recipient_company: activeUserChatCompany
            }
          })
        ];
        await Promise.all(promises);
        await loadManagerConversation(activeUserChatId);
      } else {
        let recipients: string[] = [];
        if (profile.company_id) {
          const { data: managers } = await supabase
            .from('profiles')
            .select('id')
            .eq('company_id', profile.company_id)
            .in('role', ['admin', 'superadmin']);
          if (managers && managers.length > 0) {
            recipients = managers.map(m => m.id);
          }
        }
        
        if (recipients.length === 0) {
          const { data: generalAdmins } = await supabase
            .from('profiles')
            .select('id')
            .in('role', ['sloan_admin', 'superadmin']);
          if (generalAdmins && generalAdmins.length > 0) {
            recipients = generalAdmins.map(m => m.id);
          }
        }

        const promises = recipients.map(recipientId => 
          supabase.from('notifications').insert({
            user_id: recipientId,
            type: 'info',
            title: `New Support Msg: ${profile.full_name || 'User'}`,
            message: text,
            data: {
              type: 'support_message',
              sender_id: profile.id,
              sender_name: profile.full_name || 'User',
              sender_company: (profile as any).companies?.name || 'SloanLED Partner',
              recipient_id: recipientId
            }
          })
        );

        promises.push(
          supabase.from('notifications').insert({
            user_id: profile.id,
            type: 'info',
            title: `New Support Msg: ${profile.full_name || 'User'}`,
            message: text,
            data: {
              type: 'support_message',
              sender_id: profile.id,
              sender_name: profile.full_name || 'User',
              sender_company: (profile as any).companies?.name || 'SloanLED Partner',
              recipient_id: recipients[0] || profile.id
            }
          })
        );

        await Promise.all(promises);
        await loadUserSupportMessages();
      }
    } catch (err) {
      console.error('Failed to send support message:', err);
    } finally {
      setSupportSending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'support') {
      if (isManager) {
        loadManagerInbox();
      } else {
        loadUserSupportMessages();
      }
    }
  }, [activeTab, isManager, profile?.id]);

  useEffect(() => {
    if (isManager && activeUserChatId) {
      loadManagerConversation(activeUserChatId);
    }
  }, [activeUserChatId]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('chat-support-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        const newNotif = payload.new;
        if (newNotif && newNotif.data && newNotif.data.type === 'support_message') {
          if (isManager) {
            loadManagerInbox();
            if (activeUserChatId && (newNotif.data.sender_id === activeUserChatId || newNotif.data.recipient_id === activeUserChatId)) {
              loadManagerConversation(activeUserChatId);
            }
          } else {
            loadUserSupportMessages();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, isManager, activeUserChatId]);

  useEffect(() => {
    if (inboxSearch.trim() === '') {
      setFilteredInbox(inbox);
    } else {
      const query = inboxSearch.toLowerCase();
      const filtered = inbox.filter(chat => 
        chat.userName.toLowerCase().includes(query) || 
        chat.companyName.toLowerCase().includes(query) ||
        chat.lastMessage.toLowerCase().includes(query)
      );
      setFilteredInbox(filtered);
    }
  }, [inboxSearch, inbox]);

  const initSession = async () => {
    if (!profile?.id) return null;
    try {
      const { data: session, error } = await supabase
        .from('ai_sessions')
        .insert({ user_id: profile.id, voiceflow_session_id: `vf_${Date.now()}` })
        .select().single();
      if (error) {
        console.error("ai_sessions insert error:", error);
      }
      if (session) {
        setSessionId(session.id);
        return session.id;
      }
    } catch (err) {
      console.error("ai_sessions init exception:", err);
    }
    return null;
  };

  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || !profile) return;

    setInput('');
    setSending(true);

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = await initSession();
      if (!currentSessionId) {
        currentSessionId = `temp_session_${Date.now()}`;
      }
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const userMsg: AiMessage = {
      id: tempId,
      session_id: currentSessionId,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    let realUserMsg: any = null;
    try {
      if (currentSessionId && !currentSessionId.startsWith('temp_session_')) {
        const { data } = await supabase.from('ai_messages').insert({ 
          session_id: currentSessionId, 
          role: 'user', 
          content: messageText 
        }).select().single();
        realUserMsg = data;
      }
    } catch (dbErr) {
      console.error("Failed to save user message to DB:", dbErr);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!backendUrl && __DEV__ && Constants.expoConfig?.hostUri) {
        const hostIp = Constants.expoConfig.hostUri.split(':')[0];
        backendUrl = `http://${hostIp}:3001`;
      } else if (!backendUrl) {
        backendUrl = 'http://localhost:3001';
      }

      const response = await fetch(`${backendUrl}/api/v1/ai/sessions/${currentSessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ message: messageText })
      });

      const data = await response.json();
      
      if (data.message) {
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId);
          const list = realUserMsg ? [...filtered, realUserMsg] : prev;
          return [...list, data.message];
        });
      } else {
        throw new Error("Invalid backend message response");
      }
    } catch (error) {
      console.error("AI Backend Error (falling back to rule-based AI):", error);
      const reply = getFallbackResponse(messageText);
      
      let finalReplyMsg = {
        id: `fallback_${Date.now()}`,
        session_id: currentSessionId,
        role: 'assistant' as const,
        content: reply,
        created_at: new Date().toISOString(),
      };

      try {
        if (currentSessionId && !currentSessionId.startsWith('temp_session_')) {
          const { data: savedMsg } = await supabase.from('ai_messages').insert({
            session_id: currentSessionId, role: 'assistant', content: reply,
          }).select().single();
          if (savedMsg) {
            finalReplyMsg = savedMsg;
          }
        }
      } catch (dbErr) {
        console.error("Failed to save fallback assistant message to DB:", dbErr);
      }

      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempId);
        const list = realUserMsg ? [...filtered, realUserMsg] : prev;
        return [...list, finalReplyMsg];
      });
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
          {activeTab === 'ai' ? (
            <Sparkles size={18} color="#fff" />
          ) : (
            <MessageSquare size={18} color="#fff" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{activeTab === 'ai' ? t('chat') : 'Support Contact'}</Text>
          <Text style={styles.headerSub}>{activeTab === 'ai' ? 'Powered by SloanLED AI' : 'Direct channel to SloanLED representative'}</Text>
        </View>
      </View>

      {/* Segment Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ai' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ai')}
        >
          <Sparkles size={14} color={activeTab === 'ai' ? Colors.primary[600] : Colors.neutral[500]} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'ai' && styles.tabTextActive]}>AI Assistant</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'support' && styles.tabButtonActive]}
          onPress={() => setActiveTab('support')}
        >
          <User size={14} color={activeTab === 'support' ? Colors.primary[600] : Colors.neutral[500]} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'support' && styles.tabTextActive]}>Support Contact</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 90}>
        {activeTab === 'ai' ? (
          <>
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
                keyExtractor={i => i.id.toString()}
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
          </>
        ) : (
          <>
            {isManager ? (
              activeUserChatId ? (
                // Manager Chat Thread Detail View
                <>
                  <View style={styles.managerHeader}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => { setActiveUserChatId(null); setSupportMessages([]); }}>
                      <ArrowLeft size={20} color={Colors.neutral[700]} />
                    </TouchableOpacity>
                    <View style={styles.managerHeaderInfo}>
                      <Text style={styles.managerHeaderName}>{activeUserChatName}</Text>
                      <Text style={styles.managerHeaderCompany}>{activeUserChatCompany}</Text>
                    </View>
                  </View>

                  <FlatList
                    ref={supportFlatListRef}
                    data={supportMessages}
                    keyExtractor={i => i.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() => supportFlatListRef.current?.scrollToEnd({ animated: false })}
                    renderItem={({ item }) => {
                      const isMe = item.role === 'user';
                      return (
                        <View style={[styles.msgRow, isMe ? styles.msgRowUser : styles.msgRowBot]}>
                          {!isMe && (
                            <View style={styles.supportIconAvatar}>
                              <View style={[styles.miniAvatar, { backgroundColor: Colors.neutral[200], width: 28, height: 28 }]}>
                                <Text style={[styles.miniAvatarText, { color: Colors.neutral[600], fontSize: 11 }]}>
                                  {activeUserChatName.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          )}
                          <View style={styles.bubbleWrapper}>
                            <View style={[styles.bubble, isMe ? styles.bubbleUser : styles.bubbleBot]}>
                              <Text style={[styles.bubbleText, isMe ? styles.bubbleTextUser : styles.bubbleTextBot]}>
                                {item.content}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    }}
                  />

                  <View style={styles.inputBar}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Type a reply..."
                      placeholderTextColor={Colors.neutral[400]}
                      value={supportInput}
                      onChangeText={setSupportInput}
                      multiline
                      maxLength={500}
                      onSubmitEditing={() => sendSupportMessage()}
                    />
                    <TouchableOpacity
                      style={[styles.sendBtn, (!supportInput.trim() || supportSending) && styles.sendBtnDisabled]}
                      onPress={() => sendSupportMessage()}
                      disabled={!supportInput.trim() || supportSending}
                    >
                      <Send size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // Manager Inbox List View
                <>
                  <View style={styles.searchBarContainer}>
                    <View style={styles.searchBar}>
                      <Search size={18} color={Colors.neutral[400]} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search conversations..."
                        placeholderTextColor={Colors.neutral[400]}
                        value={inboxSearch}
                        onChangeText={setInboxSearch}
                      />
                    </View>
                  </View>

                  {loadingInbox ? (
                    <View style={styles.center}>
                      <ActivityIndicator size="large" color={Colors.primary[500]} />
                    </View>
                  ) : filteredInbox.length === 0 ? (
                    <View style={styles.emptyInbox}>
                      <MessageSquare size={48} color={Colors.neutral[300]} />
                      <Text style={styles.emptyInboxTitle}>No conversations found</Text>
                      <Text style={styles.emptyInboxSub}>Support chats from company members will appear here.</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={filteredInbox}
                      keyExtractor={item => item.userId}
                      contentContainerStyle={styles.inboxList}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.inboxCard, !item.read && styles.inboxCardUnread]}
                          onPress={() => {
                            setActiveUserChatId(item.userId);
                            setActiveUserChatName(item.userName);
                            setActiveUserChatCompany(item.companyName);
                          }}
                        >
                          <View style={styles.inboxAvatar}>
                            <Text style={styles.inboxAvatarText}>
                              {item.userName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.inboxInfo}>
                            <View style={styles.inboxHeader}>
                              <Text style={styles.inboxName} numberOfLines={1}>{item.userName}</Text>
                              <Text style={styles.inboxTime}>
                                {new Date(item.created_at).toLocaleDateString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <Text style={styles.inboxCompany} numberOfLines={1}>{item.companyName}</Text>
                            <Text style={[styles.inboxMessage, !item.read && styles.inboxMessageUnread]} numberOfLines={1}>
                              {item.lastMessage}
                            </Text>
                          </View>
                          {!item.read && <View style={styles.unreadDot} />}
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </>
              )
            ) : (
              // Normal User Support Live Chat
              <>
                <FlatList
                  ref={supportFlatListRef}
                  data={supportMessages}
                  keyExtractor={i => i.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={[styles.messageList, { paddingTop: 8 }]}
                  onContentSizeChange={() => supportFlatListRef.current?.scrollToEnd({ animated: false })}
                  ListHeaderComponent={
                    <View style={styles.supportCard}>
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.avatarContainer}>
                          <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150' }}
                            style={styles.supportAvatar}
                          />
                          <View style={styles.onlineIndicator} />
                        </View>
                        <View style={styles.supportInfo}>
                          <Text style={styles.supportName}>Macer Bridges</Text>
                          <Text style={styles.supportRole}>Sales Manager Northern Europe</Text>
                          <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>Available Now</Text>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.cardDivider} />
                      
                      <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                        <Phone size={16} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.callButtonText}>Call Now</Text>
                      </TouchableOpacity>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isUser = item.role === 'user';
                    return (
                      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
                        {!isUser && (
                          <View style={styles.supportIconAvatar}>
                            <Image
                              source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80' }}
                              style={{ width: '100%', height: '100%', borderRadius: 9 }}
                            />
                          </View>
                        )}
                        <View style={styles.bubbleWrapper}>
                          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                            <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}>
                              {item.content}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  }}
                />

                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Direct Message..."
                    placeholderTextColor={Colors.neutral[400]}
                    value={supportInput}
                    onChangeText={setSupportInput}
                    multiline
                    maxLength={500}
                    onSubmitEditing={() => sendSupportMessage()}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!supportInput.trim() || supportSending) && styles.sendBtnDisabled]}
                    onPress={() => sendSupportMessage()}
                    disabled={!supportInput.trim() || supportSending}
                  >
                    <Send size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
    justifyContent: 'center',
    gap: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary[50],
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[500],
  },
  tabTextActive: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.primary[600],
  },
  supportCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
    shadowColor: Colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: {
    position: 'relative',
  },
  supportAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.primary[500],
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success[500],
    borderWidth: 2,
    borderColor: '#fff',
  },
  supportInfo: {
    flex: 1,
  },
  supportName: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.neutral[900],
  },
  supportRole: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.success[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  statusBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: Colors.success[700],
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.neutral[100],
    marginVertical: 14,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[600],
    paddingVertical: 12,
    borderRadius: 10,
  },
  callButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  supportIconAvatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  managerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  managerHeaderInfo: {
    flex: 1,
  },
  managerHeaderName: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.neutral[900],
  },
  managerHeaderCompany: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.neutral[50],
    marginTop: 1,
  },
  miniAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  miniAvatarText: {
    fontFamily: 'Inter-Bold',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: Colors.neutral[50],
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.neutral[900],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyInbox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyInboxTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.neutral[700],
    marginTop: 8,
  },
  emptyInboxSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.neutral[400],
    textAlign: 'center',
  },
  inboxList: {
    padding: 16,
    gap: 12,
  },
  inboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
    position: 'relative',
  },
  inboxCardUnread: {
    borderColor: Colors.primary[100],
    backgroundColor: '#F0F4FF',
  },
  inboxAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inboxAvatarText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  inboxInfo: {
    flex: 1,
  },
  inboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inboxName: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.neutral[900],
    flex: 1,
    marginRight: 8,
  },
  inboxTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.neutral[400],
  },
  inboxCompany: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.primary[600],
    marginTop: 1,
  },
  inboxMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.neutral[500],
    marginTop: 4,
  },
  inboxMessageUnread: {
    fontFamily: 'Inter-Medium',
    color: Colors.neutral[900],
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary[600],
  },
});
