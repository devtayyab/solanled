import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, TextInput, Image, Linking, Alert, RefreshControl, Modal, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors } from '../../constants/Colors';
import { TrainingVideo } from '../../types';
import { Search, Play, X, Plus, FileVideo } from 'lucide-react-native';
import { withCache } from '../../lib/offlineCache';

export default function VideosScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [filtered, setFiltered] = useState<TrainingVideo[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const loadVideos = async (force = false) => {
    const { data, fromCache: cached } = await withCache(
      'training_videos_list',
      async () => {
        const { data } = await supabase
          .from('training_videos')
          .select('*')
          .order('created_at', { ascending: false });
        return data || [];
      },
      force ? 0 : undefined
    );

    setVideos(data || []);
    setFromCache(cached && !force);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    loadVideos();
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVideos(true);
    setRefreshing(false);
  };

  useEffect(() => {
    let result = videos;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(v =>
        v.title.toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, videos]);

  const playVideo = async (url: string) => {
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const isVimeo = url.includes('vimeo.com');

    if (isYouTube || isVimeo) {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open video link');
      }
    } else {
      setActiveVideoUrl(url);
    }
  };

  const renderVideo = ({ item }: { item: TrainingVideo }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => playVideo(item.video_url)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLeft}>
        {item.thumbnail_url ? (
          <View style={styles.thumbContainer}>
            <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
            <View style={styles.playIconOverlay}>
              <Play size={16} color="#fff" fill="#fff" />
            </View>
          </View>
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <FileVideo size={24} color={Colors.primary[600]} />
            <View style={styles.playIconOverlay}>
              <Play size={16} color="#fff" fill="#fff" />
            </View>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
        {item.language && item.language !== 'en' && (
          <View style={styles.langBadge}>
            <Text style={styles.langText}>{item.language.toUpperCase()}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={styles.playBtn}
        onPress={() => playVideo(item.video_url)}
      >
        <Play size={14} color={Colors.primary[600]} fill={Colors.primary[600]} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Training Videos</Text>
          <Text style={styles.headerSub}>
            {filtered.length} training video(s){fromCache ? ' (cached)' : ''}
          </Text>
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => router.push('/documents/upload?mode=video')}
          >
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.neutral[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search training videos..."
            placeholderTextColor={Colors.neutral[400]}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderVideo}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary[500]]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FileVideo size={48} color={Colors.neutral[300]} />
              <Text style={styles.emptyTitle}>No Training Videos</Text>
              <Text style={styles.emptyText}>
                {isAdmin ? 'Tap + to upload a training video' : 'Training videos will appear here when uploaded'}
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  style={styles.emptyUploadBtn}
                  onPress={() => router.push('/documents/upload?mode=video')}
                >
                  <Plus size={14} color={Colors.primary[600]} />
                  <Text style={styles.emptyUploadText}>Upload Video</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <Modal
        visible={activeVideoUrl !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveVideoUrl(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setActiveVideoUrl(null)}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>

            {activeVideoUrl && (
              <Video
                source={{ uri: activeVideoUrl }}
                rate={1.0}
                volume={1.0}
                isMuted={false}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                useNativeControls
                style={styles.videoPlayer}
              />
            )}
          </View>
        </View>
      </Modal>
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
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.neutral[50],
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.neutral[200],
  },
  searchInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row',
    padding: 12, borderWidth: 1, borderColor: Colors.neutral[100],
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    alignItems: 'flex-start',
  },
  cardLeft: { marginRight: 12 },
  thumbContainer: { position: 'relative' },
  thumb: { width: 80, height: 60, borderRadius: 10 },
  thumbPlaceholder: { backgroundColor: Colors.neutral[100], justifyContent: 'center', alignItems: 'center', position: 'relative' },
  playIconOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[900], lineHeight: 18 },
  cardDesc: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500], lineHeight: 16 },
  langBadge: { backgroundColor: Colors.neutral[100], borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  langText: { fontFamily: 'Inter-Bold', fontSize: 9, color: Colors.neutral[600] },
  playBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 8, flexShrink: 0, alignSelf: 'center',
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  closeModalBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  videoPlayer: {
    width: '100%',
    height: '70%',
  },
});
