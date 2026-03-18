import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors } from '../../constants/Colors';
import { X, MapPin, Camera, Plus, ArrowLeft } from 'lucide-react-native';

export default function CreateProjectScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');

  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission denied'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsLat(loc.coords.latitude);
      setGpsLng(loc.coords.longitude);
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo) {
        const parts = [geo.street, geo.city, geo.region, geo.country].filter(Boolean);
        setAddress(parts.join(', '));
      }
    } catch {
      setError('Failed to get GPS location');
    } finally {
      setGpsLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Photo library permission denied'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setError('Camera permission denied'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const removePhoto = (uri: string) => setPhotos(prev => prev.filter(p => p !== uri));

  const handleCreate = async () => {
    if (!title.trim()) { setError('Project title is required'); return; }
    if (!profile?.company_id) { setError('You must be part of a company'); return; }
    setLoading(true);
    setError('');
    try {
      const { data: project, error: err } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          description: description.trim(),
          notes: notes.trim(),
          location_address: address.trim(),
          gps_lat: gpsLat,
          gps_lng: gpsLng,
          company_id: profile.company_id,
          created_by: profile.id,
          status: 'pending',
        })
        .select()
        .single();

      if (err) throw err;

      if (photos.length > 0 && project) {
        for (const uri of photos) {
          await supabase.from('project_photos').insert({
            project_id: project.id,
            uploaded_by: profile.id,
            url: uri,
            caption: '',
          });
        }
      }

      await supabase.from('project_status_history').insert({
        project_id: project.id,
        changed_by: profile.id,
        old_status: null,
        new_status: 'pending',
        notes: 'Project created',
      });

      router.replace(`/project/${project.id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }} style={styles.backBtn}>
            <X size={20} color={Colors.neutral[600]} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{t('create_project')}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('project_title')} *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. City Center LED Install"
                placeholderTextColor={Colors.neutral[400]}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('project_description')}</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Describe the project..."
                placeholderTextColor={Colors.neutral[400]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('location')}</Text>
              <View style={styles.locationRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Address or site location"
                  placeholderTextColor={Colors.neutral[400]}
                  value={address}
                  onChangeText={setAddress}
                />
                <TouchableOpacity
                  style={[styles.gpsBtn, gpsLat !== null && styles.gpsBtnActive]}
                  onPress={captureGPS}
                  disabled={gpsLoading}
                >
                  {gpsLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MapPin size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              {gpsLat !== null && (
                <Text style={styles.gpsCoords}>
                  GPS: {gpsLat.toFixed(5)}, {gpsLng?.toFixed(5)}
                </Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('project_notes')}</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Additional notes..."
                placeholderTextColor={Colors.neutral[400]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('photos')}</Text>
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                  <Camera size={18} color={Colors.primary[600]} />
                  <Text style={styles.photoBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                  <Plus size={18} color={Colors.primary[600]} />
                  <Text style={styles.photoBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
              {photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                  {photos.map(uri => (
                    <View key={uri} style={styles.photoThumb}>
                      <Image source={{ uri }} style={styles.photoImg} />
                      <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(uri)}>
                        <X size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{t('create_project')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { fontFamily: 'Inter-SemiBold', fontSize: 17, color: Colors.neutral[900] },
  scroll: { flex: 1 },
  errorBox: {
    backgroundColor: Colors.error[50], borderRadius: 10,
    padding: 12, margin: 16,
    borderLeftWidth: 3, borderLeftColor: Colors.error[500],
  },
  errorText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.error[600] },
  form: { padding: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.neutral[700] },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: 12, padding: 13,
    fontFamily: 'Inter-Regular', fontSize: 14,
    color: Colors.neutral[900], backgroundColor: Colors.neutral[50],
  },
  textarea: { minHeight: 80 },
  locationRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  gpsBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  gpsBtnActive: { backgroundColor: Colors.success[600] },
  gpsCoords: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.success[600], marginTop: 4 },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderColor: Colors.primary[200],
    borderRadius: 12, padding: 12, backgroundColor: Colors.primary[50],
    borderStyle: 'dashed',
  },
  photoBtnText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.primary[600] },
  photoRow: { marginTop: 8 },
  photoThumb: { position: 'relative', marginRight: 8 },
  photoImg: { width: 72, height: 72, borderRadius: 10 },
  removePhoto: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    width: 20, height: 20, justifyContent: 'center', alignItems: 'center',
  },
  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: Colors.neutral[100],
    backgroundColor: '#fff',
  },
  submitBtn: {
    backgroundColor: Colors.primary[600], borderRadius: 14,
    padding: 16, alignItems: 'center',
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#fff' },
});
