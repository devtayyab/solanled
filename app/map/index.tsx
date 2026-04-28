import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors, StatusColors } from '../../constants/Colors';
import { Project } from '../../types';
import { ArrowLeft, MapPin, Navigation } from 'lucide-react-native';

const buildLeafletHtml = (projects: Project[]) => {
  const markers = projects
    .filter(p => p.gps_lat && p.gps_lng)
    .map(p => `
      L.marker([${p.gps_lat}, ${p.gps_lng}], {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:${StatusColors[p.status]?.dot || '#3B82F6'};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
          iconSize:[14,14],iconAnchor:[7,7]
        })
      }).addTo(map).bindPopup('<b>${p.title.replace(/'/g, "\\'")}</b><br/>${p.status}<br/>${p.location_address || ''}')`
    ).join(';\n');

  const lats = projects.filter(p => p.gps_lat).map(p => p.gps_lat!);
  const lngs = projects.filter(p => p.gps_lng).map(p => p.gps_lng!);
  const centerLat = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 51.5;
  const centerLng = lngs.length ? lngs.reduce((a, b) => a + b, 0) / lngs.length : 0;

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>body{margin:0;padding:0;}#map{width:100vw;height:100vh;}</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map').setView([${centerLat},${centerLng}], ${lats.length > 1 ? 10 : 12});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; OpenStreetMap contributors',maxZoom:19
}).addTo(map);
${markers};
${lats.length > 1 ? `var group=new L.featureGroup([...map.eachLayer(l=>l)]);` : ''}
</script></body></html>`;
};

export default function MapViewScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const isGlobalAdmin = profile?.role === 'superadmin' || profile?.role === 'sloan_admin';

  useFocusEffect(useCallback(() => {
    if (!profile?.company_id && !isGlobalAdmin) { setLoading(false); return; }
    
    let query = supabase
      .from('projects')
      .select('*');
    
    if (!isGlobalAdmin) {
      query = query.eq('company_id', profile!.company_id);
    }
    
    query
      .not('gps_lat', 'is', null)
      .then(({ data }) => {
        if (data) setProjects(data as Project[]);
        setLoading(false);
      });
  }, [profile?.company_id, profile?.role]));

  const projectsWithGPS = projects.filter(p => p.gps_lat && p.gps_lng);

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: 'Pending', in_progress: 'In Progress',
      installed: 'Installed', completed: 'Completed', cancelled: 'Cancelled',
    };
    return map[status] || status;
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
          <Text style={styles.headerTitle}>Project Map</Text>
          <Text style={styles.headerSub}>{projectsWithGPS.length} locations</Text>
        </View>
        <Navigation size={18} color={Colors.primary[600]} style={{ marginLeft: 'auto' }} />
      </View>

      {projectsWithGPS.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MapPin size={56} color={Colors.neutral[300]} />
          <Text style={styles.emptyTitle}>No GPS Data Yet</Text>
          <Text style={styles.emptyText}>Projects with GPS coordinates captured during installation will appear here.</Text>
          <TouchableOpacity style={styles.goToProjectsBtn} onPress={() => router.push('/(tabs)/projects')}>
            <Text style={styles.goToProjectsBtnText}>View Projects</Text>
          </TouchableOpacity>
        </View>
      ) : Platform.OS === 'web' ? (
        <View style={styles.webMapContainer}>
          <iframe
            srcDoc={buildLeafletHtml(projectsWithGPS)}
            style={{ width: '100%', height: '65%', border: 'none' } as any}
            title="Project Map"
          />
          <ScrollView style={styles.projectList} showsVerticalScrollIndicator={false}>
            <Text style={styles.listTitle}>Mapped Projects</Text>
            {projectsWithGPS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.listItem}
                onPress={() => router.push(`/project/${p.id}`)}
              >
                <View style={[styles.listDot, { backgroundColor: StatusColors[p.status]?.dot }]} />
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle2}>{p.title}</Text>
                  <Text style={styles.listCoords}>{p.gps_lat?.toFixed(4)}, {p.gps_lng?.toFixed(4)}</Text>
                </View>
                <View style={[styles.listBadge, { backgroundColor: StatusColors[p.status]?.bg }]}>
                  <Text style={[styles.listBadgeText, { color: StatusColors[p.status]?.text }]}>
                    {getStatusLabel(p.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.nativeMapContainer}>
          <ScrollView>
            <Text style={styles.listTitle}>Projects with GPS</Text>
            {projectsWithGPS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.listItem}
                onPress={() => router.push(`/project/${p.id}`)}
              >
                <View style={styles.coordsBox}>
                  <MapPin size={14} color={Colors.primary[500]} />
                  <Text style={styles.listCoords}>{p.gps_lat?.toFixed(4)}, {p.gps_lng?.toFixed(4)}</Text>
                </View>
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle2}>{p.title}</Text>
                  {p.location_address ? <Text style={styles.listAddress}>{p.location_address}</Text> : null}
                </View>
                <View style={[styles.listBadge, { backgroundColor: StatusColors[p.status]?.bg }]}>
                  <Text style={[styles.listBadgeText, { color: StatusColors[p.status]?.text }]}>
                    {getStatusLabel(p.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
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
  headerSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500] },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: Colors.neutral[700] },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[500], textAlign: 'center', lineHeight: 20 },
  goToProjectsBtn: {
    backgroundColor: Colors.primary[600], borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  goToProjectsBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' },
  webMapContainer: { flex: 1 },
  projectList: { flex: 1, padding: 8 },
  nativeMapContainer: { flex: 1, padding: 16 },
  listTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[700], padding: 12, paddingBottom: 6 },
  listTitle2: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.neutral[900] },
  listItem: {
    backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', padding: 12, marginBottom: 8, gap: 10,
    borderWidth: 1, borderColor: Colors.neutral[100],
  },
  listDot: { width: 10, height: 10, borderRadius: 5 },
  listInfo: { flex: 1 },
  listCoords: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[400], marginTop: 2 },
  listAddress: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[500], marginTop: 2 },
  coordsBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listBadge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  listBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: 10 },
});
