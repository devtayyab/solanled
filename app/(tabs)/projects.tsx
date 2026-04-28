import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl, Image, Dimensions, ActivityIndicator, Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors, StatusColors } from '../../constants/Colors';
import { Project } from '../../types';
import { Search, Plus, MapPin, Clock, ChevronRight, CircleDot, Building2 } from 'lucide-react-native';
import { withCache } from '../../lib/offlineCache';

const { width } = Dimensions.get('window');
const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'in_progress', label: 'Progress' },
  { id: 'completed', label: 'Done' }
];

export default function ProjectsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filtered, setFiltered] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isGlobalAdmin = profile?.role === 'superadmin' || profile?.role === 'sloan_admin';

  const fetchProjects = async (force = false) => {
    if (!profile?.company_id && !isGlobalAdmin) { setLoading(false); return; }
    const cacheKey = isGlobalAdmin ? 'projects_list_global' : `projects_list_${profile?.company_id}`;
    const { data } = await withCache(
      cacheKey,
      async () => {
        let query = supabase.from('projects').select('*, project_photos(id, url), companies(name)');
        if (!isGlobalAdmin) { query = query.eq('company_id', profile!.company_id); }
        const { data: res } = await query.order('created_at', { ascending: false });
        return res || [];
      },
      force ? 0 : undefined
    );
    setProjects(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchProjects(); }, [profile?.company_id, profile?.role]));

  useEffect(() => {
    let result = projects;
    if (activeTab === 'pending') {
      result = result.filter(p => p.status === 'pending');
    } else if (activeTab === 'in_progress') {
      result = result.filter(p => p.status === 'installed');
    } else if (activeTab === 'completed') {
      result = result.filter(p => p.status === 'completed');
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(q) || 
        p.location_address?.toLowerCase().includes(q) ||
        (p as any).companies?.name?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, activeTab, projects]);

  const onRefresh = async () => { setRefreshing(true); await fetchProjects(true); setRefreshing(false); };

  const getStatusLabel = (status: string) => ({
    pending: t('status_pending'), in_progress: t('status_in_progress'),
    installed: t('status_installed'), completed: t('status_completed'), cancelled: t('status_cancelled'),
  }[status] || status);

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  const renderProject = ({ item }: { item: Project }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/project/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        {item.project_photos?.[0] && !(Platform.OS === 'web' && item.project_photos[0].url.startsWith('file://')) ? (
          <Image source={{ uri: item.project_photos[0].url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.imagePlaceholder]}>
            <CircleDot size={32} color={Colors.neutral[300]} />
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: StatusColors[item.status]?.bg }]}>
          <Text style={[styles.statusText, { color: StatusColors[item.status]?.text }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.titleRow}>
          <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>
          <ChevronRight size={18} color={Colors.neutral[400]} />
        </View>

        {isGlobalAdmin && (item as any).companies?.name && (
          <View style={styles.companyRow}>
            <Building2 size={12} color={Colors.primary[500]} />
            <Text style={styles.companyName}>{(item as any).companies.name}</Text>
          </View>
        )}

        <View style={styles.metaGrid}>
          {!!item.location_address && (
            <View style={styles.metaItem}>
              <MapPin size={12} color={Colors.neutral[400]} />
              <Text style={styles.metaText} numberOfLines={1}>{item.location_address}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Clock size={12} color={Colors.neutral[400]} />
            <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Projects</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/project/create')}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.neutral[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects or companies..."
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View style={styles.tabsOuter}>
        <View style={styles.tabBar}>
          {STATUS_TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabItem, activeTab === tab.id && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderProject}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <CircleDot size={48} color={Colors.neutral[200]} />
              <Text style={styles.emptyTitle}>No Projects Found</Text>
              <Text style={styles.emptySubtitle}>Try changing your filter or search query</Text>
            </View>
          ) : (
            <ActivityIndicator style={{ marginTop: 50 }} color={Colors.primary[600]} />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff' 
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 24, color: Colors.neutral[900] },
  addBtn: { 
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: Colors.primary[600],
    shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }
  },
  searchBox: { paddingHorizontal: 20, paddingBottom: 10, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12,
    backgroundColor: Colors.neutral[50], paddingHorizontal: 15, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.neutral[100]
  },
  createBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' },
  searchInput: { flex: 1, fontFamily: 'Inter-Medium', fontSize: 14, color: Colors.neutral[900] },
  tabsOuter: { backgroundColor: '#fff', paddingBottom: 5 },
  tabBar: { 
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 10, backgroundColor: Colors.neutral[50],
    borderRadius: 12, padding: 4 
  },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  tabText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.neutral[500] },
  tabTextActive: { color: Colors.primary[600], fontFamily: 'Inter-Bold' },
  list: { padding: 20, gap: 20 },
  card: { 
    backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.neutral[100], elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
  },
  cardHeader: { height: 160, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  imagePlaceholder: { backgroundColor: Colors.neutral[50], justifyContent: 'center', alignItems: 'center' },
  statusBadge: { 
    position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.9)'
  },
  statusText: { fontFamily: 'Inter-Bold', fontSize: 10 },
  cardContent: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  projectTitle: { fontFamily: 'Inter-Bold', fontSize: 17, color: Colors.neutral[900], flex: 1, marginRight: 10 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  companyName: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: Colors.primary[600] },
  metaGrid: { gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.neutral[500], flex: 1 },
  empty: { padding: 60, alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.neutral[800] },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[400], textAlign: 'center' }
});
