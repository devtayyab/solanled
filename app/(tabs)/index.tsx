import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors, StatusColors } from '../../constants/Colors';
import { Project } from '../../types';
import { Plus, ArrowRight, MapPin, Clock, CircleDot, Bell, Map, Users } from 'lucide-react-native';
import { withCache } from '../../lib/offlineCache';

export default function DashboardScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, installed: 0, completed: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (force = false) => {
    if (!profile?.company_id || !user?.id) { setLoading(false); return; }

    const [{ data: projectsData }, notifRes] = await Promise.all([
      withCache(
        `dashboard_projects_${profile.company_id}`,
        async () => {
          const { data } = await supabase
            .from('projects')
            .select('*, project_photos(id, url)')
            .eq('company_id', profile.company_id)
            .order('created_at', { ascending: false });
          return data || [];
        },
        force ? 0 : undefined
      ),
      supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('read', false),
    ]);

    if (projectsData) {
      setAllProjects(projectsData);
      setProjects(projectsData.slice(0, 5));
      setStats({
        total: projectsData.length,
        pending: projectsData.filter((p: Project) => p.status === 'pending').length,
        in_progress: projectsData.filter((p: Project) => p.status === 'in_progress').length,
        installed: projectsData.filter((p: Project) => p.status === 'installed').length,
        completed: projectsData.filter((p: Project) => p.status === 'completed').length,
      });
    }
    setUnreadCount(notifRes.count || 0);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [profile?.company_id, user?.id]));

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('project-updates')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'projects',
        filter: profile?.company_id ? `company_id=eq.${profile.company_id}` : undefined,
      }, () => { fetchData(); })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { setUnreadCount(prev => prev + 1); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, profile?.company_id]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(true); setRefreshing(false); };

  const getStatusLabel = (status: string) => ({
    pending: t('status_pending'), in_progress: t('status_in_progress'),
    installed: t('status_installed'), completed: t('status_completed'), cancelled: t('status_cancelled'),
  }[status] || status);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[400]} />}
      >
        <LinearGradient colors={['#0A1628', '#0F2044']} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.greetingBlock}>
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.userName}>{profile?.full_name || user?.email?.split('@')[0]}</Text>
              {profile?.companies?.name && (
                <Text style={styles.companyName}>{profile.companies.name}</Text>
              )}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/notifications')}>
                <Bell size={18} color="#fff" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push('/(tabs)/settings')}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{(profile?.full_name || 'U').charAt(0).toUpperCase()}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/map')}>
              <Map size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.quickBtnText}>Map View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/team')}>
              <Users size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.quickBtnText}>Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickBtn, styles.quickBtnPrimary]} onPress={() => router.push('/project/create')}>
              <Plus size={16} color="#fff" />
              <Text style={styles.quickBtnText}>New Project</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <StatCard label={t('total_projects')} value={stats.total} color={Colors.primary[500]} bg={Colors.primary[50]} />
          <StatCard label={t('installed')} value={stats.installed} color={Colors.success[600]} bg={Colors.success[50]} />
          <StatCard label={t('in_progress')} value={stats.in_progress} color={Colors.accent[500]} bg={Colors.accent[50]} />
          <StatCard label={t('pending')} value={stats.pending} color={Colors.warning[600]} bg={Colors.warning[50]} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Projects</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/projects')} style={styles.seeAll}>
              <Text style={styles.seeAllText}>See all</Text>
              <ArrowRight size={14} color={Colors.primary[600]} />
            </TouchableOpacity>
          </View>

          {!profile?.company_id ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No company yet</Text>
              <Text style={styles.emptyText}>Register or join a company to start managing projects</Text>
            </View>
          ) : projects.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('no_projects')}</Text>
              <Text style={styles.emptyText}>{t('create_first_project')}</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/project/create')}>
                <Plus size={16} color="#fff" />
                <Text style={styles.createBtnText}>{t('create_project')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            projects.map(project => (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() => router.push(`/project/${project.id}`)}
              >
                {project.project_photos?.[0] ? (
                  <Image source={{ uri: project.project_photos[0].url }} style={styles.projectThumb} />
                ) : (
                  <View style={[styles.projectThumb, styles.projectThumbPlaceholder]}>
                    <CircleDot size={22} color={Colors.neutral[300]} />
                  </View>
                )}
                <View style={styles.projectInfo}>
                  <Text style={styles.projectTitle} numberOfLines={1}>{project.title}</Text>
                  <View style={styles.projectMeta}>
                    {project.location_address ? (
                      <View style={styles.metaRow}>
                        <MapPin size={10} color={Colors.neutral[400]} />
                        <Text style={styles.metaText} numberOfLines={1}>{project.location_address}</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaRow}>
                      <Clock size={10} color={Colors.neutral[400]} />
                      <Text style={styles.metaText}>{formatDate(project.created_at)}</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: StatusColors[project.status]?.bg }]}>
                  <View style={[styles.dot, { backgroundColor: StatusColors[project.status]?.dot }]} />
                  <Text style={[styles.statusText, { color: StatusColors[project.status]?.text }]}>
                    {getStatusLabel(project.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greetingBlock: { flex: 1 },
  greeting: { fontFamily: 'Inter-Regular', fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  userName: { fontFamily: 'Inter-Bold', fontSize: 22, color: '#fff', marginTop: 2 },
  companyName: { fontFamily: 'Inter-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.error[500], borderRadius: 10, minWidth: 18,
    height: 18, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#0F2044',
  },
  badgeText: { fontFamily: 'Inter-Bold', fontSize: 9, color: '#fff' },
  avatarContainer: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 12 },
  avatarText: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#fff' },
  quickActions: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  quickBtnPrimary: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[400] },
  quickBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: '#fff' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, paddingTop: 16, gap: 8,
  },
  statCard: {
    width: '47%', borderRadius: 14, padding: 14, alignItems: 'center',
  },
  statValue: { fontFamily: 'Inter-Bold', fontSize: 26, marginBottom: 2 },
  statLabel: { fontFamily: 'Inter-Medium', fontSize: 11, color: Colors.neutral[600], textAlign: 'center' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter-SemiBold', fontSize: 17, color: Colors.neutral[900] },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.primary[600] },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.neutral[100],
  },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: Colors.neutral[700], marginBottom: 6 },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[500], textAlign: 'center', marginBottom: 16 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary[600], borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  createBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' },
  projectCard: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderWidth: 1, borderColor: Colors.neutral[100],
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  projectThumb: { width: 52, height: 52, borderRadius: 10, marginRight: 12 },
  projectThumbPlaceholder: { backgroundColor: Colors.neutral[100], justifyContent: 'center', alignItems: 'center' },
  projectInfo: { flex: 1 },
  projectTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[900], marginBottom: 4 },
  projectMeta: { gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[500], flex: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, marginLeft: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'Inter-SemiBold', fontSize: 10 },
});
