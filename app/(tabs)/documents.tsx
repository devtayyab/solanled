import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, TextInput, Image, Linking, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors } from '../../constants/Colors';
import { Document } from '../../types';
import { Search, FileText, ExternalLink, Plus } from 'lucide-react-native';
import { withCache } from '../../lib/offlineCache';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'datasheet', label: 'Datasheets' },
  { key: 'spec_sheet', label: 'Specs' },
  { key: 'installation_guide', label: 'Guides' },
  { key: 'certificate', label: 'Certs' },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  datasheet: { bg: Colors.primary[50], text: Colors.primary[700] },
  spec_sheet: { bg: '#F0F4FF', text: '#3730A3' },
  installation_guide: { bg: Colors.accent[50], text: Colors.accent[700] },
  certificate: { bg: Colors.success[50], text: Colors.success[700] },
  general: { bg: Colors.neutral[100], text: Colors.neutral[700] },
};

export default function DocumentsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [filtered, setFiltered] = useState<Document[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const loadDocs = async (force = false) => {
    const { data, fromCache: cached } = await withCache(
      'documents_list',
      async () => {
        const { data } = await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false });
        return data || [];
      },
      force ? 0 : undefined
    );
    setDocs(data);
    setFromCache(cached && !force);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    loadDocs();
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocs(true);
    setRefreshing(false);
  };

  useEffect(() => {
    let result = docs;
    if (activeCategory !== 'all') result = result.filter(d => d.category === activeCategory);
    if (search) result = result.filter(d =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [search, activeCategory, docs]);

  const openDocument = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Cannot open this document');
    }
  };

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      datasheet: 'Datasheet', spec_sheet: 'Spec Sheet',
      installation_guide: 'Install Guide', certificate: 'Certificate', general: 'General',
    };
    return map[cat] || cat;
  };

  const renderDoc = ({ item }: { item: Document }) => {
    const cc = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general;
    return (
      <View style={styles.docCard}>
        <View style={styles.docLeft}>
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.docThumb} />
          ) : (
            <View style={[styles.docThumb, styles.docThumbPlaceholder]}>
              <FileText size={24} color={Colors.neutral[400]} />
            </View>
          )}
        </View>
        <View style={styles.docBody}>
          <Text style={styles.docTitle} numberOfLines={2}>{item.title}</Text>
          {item.description ? <Text style={styles.docDesc} numberOfLines={1}>{item.description}</Text> : null}
          <View style={styles.docMeta}>
            <View style={[styles.catBadge, { backgroundColor: cc.bg }]}>
              <Text style={[styles.catText, { color: cc.text }]}>{getCategoryLabel(item.category)}</Text>
            </View>
            {item.language && item.language !== 'en' && (
              <View style={styles.langBadge}>
                <Text style={styles.langText}>{item.language.toUpperCase()}</Text>
              </View>
            )}
          </View>
          {item.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.slice(0, 3).map(tag => (
                <Text key={tag} style={styles.tag}>#{tag}</Text>
              ))}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={() => openDocument(item.file_url)}
        >
          <ExternalLink size={16} color={Colors.primary[600]} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('documents')}</Text>
          <Text style={styles.headerSub}>
            {filtered.length} documents{fromCache ? ' (cached)' : ''}
          </Text>
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => router.push('/documents/upload')}
          >
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color={Colors.neutral[400]} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_documents')}
          placeholderTextColor={Colors.neutral[400]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={i => i.key}
        style={styles.filterList}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 4 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, activeCategory === item.key && styles.filterChipActive]}
            onPress={() => setActiveCategory(item.key)}
          >
            <Text style={[styles.filterText, activeCategory === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderDoc}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary[500]]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FileText size={48} color={Colors.neutral[300]} />
            <Text style={styles.emptyTitle}>{t('no_documents')}</Text>
            <Text style={styles.emptyText}>
              {isAdmin ? 'Tap + to upload a document or sync from WordPress' : 'Documents will appear here when available'}
            </Text>
            {isAdmin && (
              <TouchableOpacity
                style={styles.emptyUploadBtn}
                onPress={() => router.push('/documents/upload')}
              >
                <Plus size={14} color={Colors.primary[600]} />
                <Text style={styles.emptyUploadText}>Upload Document</Text>
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
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 22, color: Colors.neutral[900] },
  headerSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500], marginTop: 2 },
  uploadBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.neutral[200],
  },
  searchInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900] },
  filterList: { marginTop: 10, maxHeight: 40 },
  filterChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: Colors.neutral[100], borderWidth: 1, borderColor: Colors.neutral[200],
  },
  filterChipActive: { backgroundColor: Colors.primary[600], borderColor: Colors.primary[600] },
  filterText: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.neutral[600] },
  filterTextActive: { color: '#fff' },
  docCard: {
    backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row',
    padding: 12, borderWidth: 1, borderColor: Colors.neutral[100],
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    alignItems: 'flex-start',
  },
  docLeft: { marginRight: 12 },
  docThumb: { width: 56, height: 56, borderRadius: 10 },
  docThumbPlaceholder: { backgroundColor: Colors.neutral[100], justifyContent: 'center', alignItems: 'center' },
  docBody: { flex: 1, gap: 4 },
  docTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[900], lineHeight: 18 },
  docDesc: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500] },
  docMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  catBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  catText: { fontFamily: 'Inter-SemiBold', fontSize: 10 },
  langBadge: { backgroundColor: Colors.neutral[100], borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  langText: { fontFamily: 'Inter-Bold', fontSize: 10, color: Colors.neutral[600] },
  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  tag: { fontFamily: 'Inter-Regular', fontSize: 10, color: Colors.neutral[400] },
  downloadBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 8,
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: Colors.neutral[700] },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[500], textAlign: 'center', paddingHorizontal: 32 },
  emptyUploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.primary[200], borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.primary[50],
    marginTop: 8,
  },
  emptyUploadText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.primary[600] },
});
