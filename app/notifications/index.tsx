import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { markAllNotificationsRead } from '../../lib/notifications';
import { Colors } from '../../constants/Colors';
import {
  ArrowLeft, Bell, CheckCheck, FolderOpen,
  Users, FileText, RefreshCw, Info
} from 'lucide-react-native';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  project_update: { icon: FolderOpen, color: Colors.primary[600], bg: Colors.primary[50] },
  status_change: { icon: RefreshCw, color: Colors.accent[600], bg: Colors.accent[50] },
  team_invite: { icon: Users, color: Colors.secondary[600], bg: Colors.secondary[50] },
  document_update: { icon: FileText, color: Colors.warning[600], bg: Colors.warning[50] },
  system: { icon: Info, color: Colors.neutral[500], bg: Colors.neutral[100] },
  info: { icon: Bell, color: Colors.neutral[500], bg: Colors.neutral[100] },
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchNotifications(); }, [user?.id]));

  const handleMarkRead = async (notifId: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    setMarkingAll(true);
    await markAllNotificationsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setMarkingAll(false);
  };

  const handlePress = async (notif: Notification) => {
    if (!notif.read) await handleMarkRead(notif.id);
    if (notif.data?.project_id) {
      router.push(`/project/${notif.data.project_id}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
    const IconComponent = config.icon;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.read && styles.notifCardUnread]}
        onPress={() => handlePress(item)}
      >
        <View style={[styles.notifIcon, { backgroundColor: config.bg }]}>
          <IconComponent size={18} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifRow}>
            <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>{item.title}</Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage}>{item.message}</Text>
          <Text style={styles.notifTime}>{formatTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }}>
          <ArrowLeft size={20} color={Colors.neutral[700]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.headerSub}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={Colors.primary[600]} />
            ) : (
              <>
                <CheckCheck size={14} color={Colors.primary[600]} />
                <Text style={styles.markAllText}>Mark all read</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={i => i.id}
          renderItem={renderNotification}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Bell size={48} color={Colors.neutral[300]} />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyText}>You'll see project updates and team activity here</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.neutral[900] },
  headerSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.accent[600], marginTop: 1 },
  markAllBtn: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary[50], borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  markAllText: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.primary[600] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notifCard: {
    backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row',
    gap: 12, padding: 14, borderWidth: 1, borderColor: Colors.neutral[100],
  },
  notifCardUnread: {
    backgroundColor: Colors.primary[50],
    borderColor: Colors.primary[100],
  },
  notifIcon: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  notifContent: { flex: 1 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  notifTitle: { fontFamily: 'Inter-Medium', fontSize: 14, color: Colors.neutral[800], flex: 1 },
  notifTitleUnread: { fontFamily: 'Inter-SemiBold', color: Colors.neutral[900] },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary[500] },
  notifMessage: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[600], lineHeight: 18 },
  notifTime: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[400], marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: Colors.neutral[700] },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[500], textAlign: 'center' },
});
