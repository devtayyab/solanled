import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl, Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors, StatusColors } from '../../constants/Colors';
import { Project } from '../../types';
import { Search, Plus, MapPin, Clock, ChevronRight, CircleDot } from 'lucide-react-native';
import { withCache } from '../../lib/offlineCache';

const STATUS_FILTERS = ['all', 'pending', 'in_progress', 'installed', 'completed'];

export default function ProjectsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filtered, setFiltered] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const fetchProjects = async (force = false) => {
    if (!profile?.company_id) { setLoading(false); return; }
    const { data, fromCache: cached } = await withCache(
      `projects_list_${profile.company_id}`,
      async () => {
        const { data } = await supabase
          .from('projects')
          .select('*, project_photos(id, url)')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false });
        return data || [];
      },
      force ? 0 : undefined
    );
    setProjects(data);
    setFiltered(data);
    setFromCache(cached && !force);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchProjects(); }, [profile?.company_id]));

  useEffect(() => {
    let result = projects;
    if (activeFilter !== 'all') result = result.filter(p => p.status === activeFilter);
    if (search) result = result.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
    setFiltered(result);
  }, [search, activeFilter, projects]);

  const onRefresh = async () => { setRefreshing(true); await fetchProjects(true); setRefreshing(false); };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t('status_pending'), in_progress: t('status_in_progress'),
      installed: t('status_installed'), completed: t('status_completed'), cancelled: t('status_cancelled'),
    };
    return map[status] || status;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  const renderProject = ({ item }: { item: Project }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/project/${item.id}`)}>
      <View style={styles.cardLeft}>
        {item.project_photos?.[0] ? (
          <Image source={{ uri: item.project_photos[0].url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <CircleDot size={22} color={Colors.neutral[300]} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        {item.description ? <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text> : null}
        <View style={styles.cardMeta}>
          {item.location_address ? (
            <View style={styles.metaRow}>
              <MapPin size={10} color={Colors.neutral[400]} />
              <Text style={styles.metaText} numberOfLines={1}>{item.location_address}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Clock size={10} color={Colors.neutral[400]} />
            <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: StatusColors[item.status]?.bg }]}>
          <View style={[styles.dot, { backgroundColor: StatusColors[item.status]?.dot }]} />
          <Text style={[styles.badgeText, { color: StatusColors[item.status]?.text }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={Colors.neutral[300]} style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('projects')}</Text>
          {fromCache && <Text style={styles.cacheLabel}>{t('offline_data')}</Text>}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/project/create')}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color={Colors.neutral[400]} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_projects')}
          placeholderTextColor={Colors.neutral[400]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={i => i}
        style={styles.filterList}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 4 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === item && styles.filterChipActive]}
            onPress={() => setActiveFilter(item)}
          >
            <Text style={[styles.filterText, activeFilter === item && styles.filterTextActive]}>
              {item === 'all' ? 'All' : getStatusLabel(item)}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderProject}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[400]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('no_projects')}</Text>
            {!profile?.company_id ? (
              <Text style={styles.emptyText}>Join or create a company first</Text>
            ) : (
              <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/project/create')}>
                <Plus size={16} color="#fff" />
                <Text style={styles.createBtnText}>{t('create_project')}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 22, color: Colors.neutral[900] },
  cacheLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.warning[600], marginTop: 1 },
  addBtn: {
    backgroundColor: Colors.primary[600], width: 36, height: 36,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.neutral[200],
  },
  searchInput: {
    flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900],
  },
  filterList: { marginTop: 10, maxHeight: 40 },
  filterChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: Colors.neutral[100], borderWidth: 1, borderColor: Colors.neutral[200],
  },
  filterChipActive: { backgroundColor: Colors.primary[600], borderColor: Colors.primary[600] },
  filterText: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.neutral[600] },
  filterTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row',
    padding: 12, borderWidth: 1, borderColor: Colors.neutral[100],
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardLeft: { marginRight: 12 },
  thumb: { width: 60, height: 60, borderRadius: 10 },
  thumbPlaceholder: {
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[900], marginBottom: 2 },
  cardDesc: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500], marginBottom: 6 },
  cardMeta: { gap: 2, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: 'Inter-Regular', fontSize: 10, color: Colors.neutral[400], flex: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: 'Inter-SemiBold', fontSize: 10 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: Colors.neutral[700] },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[500] },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary[600], borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, marginTop: 8,
  },
  createBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' },
});
