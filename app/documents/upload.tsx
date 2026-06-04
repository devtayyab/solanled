import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Platform, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import {
  ArrowLeft, FileText, Link, ChevronDown, Check, Tag, Upload, Play, FileVideo
} from 'lucide-react-native';

const CATEGORIES = [
  { value: 'datasheet', label: 'Datasheet' },
  { value: 'spec_sheet', label: 'Spec Sheet' },
  { value: 'installation_guide', label: 'Installation Guide' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'general', label: 'General' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

export default function UploadDocumentScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [category, setCategory] = useState('general');
  const [language, setLanguage] = useState('en');
  const [tagsInput, setTagsInput] = useState('');
  const [showCategory, setShowCategory] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Video specific states
  const [isVideo, setIsVideo] = useState(mode === 'video');
  const [videoUploadMode, setVideoUploadMode] = useState<'url' | 'file'>('url');
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [selectedVideoName, setSelectedVideoName] = useState<string | null>(null);

  // Thumbnail specific states
  const [selectedThumbUri, setSelectedThumbUri] = useState<string | null>(null);
  const [selectedThumbName, setSelectedThumbName] = useState<string | null>(null);

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access media library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const videoAsset = result.assets[0];
      setSelectedVideoUri(videoAsset.uri);
      setSelectedVideoName(videoAsset.fileName || `video-${Date.now()}.mp4`);
      setFileUrl(videoAsset.uri); 
      setError('');
    }
  };

  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access media library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedThumbUri(asset.uri);
      setSelectedThumbName(asset.fileName || `thumb-${Date.now()}.jpg`);
      setError('');
    }
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (isVideo && videoUploadMode === 'file' && !selectedVideoUri) {
      setError('Please select a video file to upload');
      return;
    }
    if (!isVideo && !fileUrl.trim()) { setError('File URL is required'); return; }
    if (isVideo && videoUploadMode === 'url' && !fileUrl.trim()) {
      setError('Video URL is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      if (isVideo && !tags.includes('video')) {
        tags.push('video');
      }

      let finalFileUrl = fileUrl.trim();

      if (isVideo && videoUploadMode === 'file' && selectedVideoUri) {
        const response = await fetch(selectedVideoUri);
        const blob = await response.blob();
        const path = `training-videos/${Date.now()}-${selectedVideoName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-photos')
          .upload(path, blob, {
            contentType: 'video/mp4',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('project-photos')
          .getPublicUrl(path);

        finalFileUrl = publicUrl;
      }

      let finalThumbnailUrl: string | null = null;

      if (selectedThumbUri) {
        const response = await fetch(selectedThumbUri);
        const blob = await response.blob();
        const path = `document-thumbnails/${Date.now()}-${selectedThumbName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-photos')
          .upload(path, blob, {
            contentType: blob.type || 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('project-photos')
          .getPublicUrl(path);

        finalThumbnailUrl = publicUrl;
      }

      const { error: err } = await supabase.from('documents').insert({
        title: title.trim(),
        description: description.trim(),
        file_url: finalFileUrl,
        thumbnail_url: finalThumbnailUrl,
        category: isVideo ? 'general' : category,
        language,
        tags,
        uploaded_by: profile?.id,
        company_id: profile?.company_id,
      });

      if (err) throw err;
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(isVideo ? '/(tabs)/videos' : '/(tabs)/documents');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to upload document');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace(mode === 'video' ? '/(tabs)/videos' : '/(tabs)/documents');
            }
          }}>
            <ArrowLeft size={20} color={Colors.neutral[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Document</Text>
        </View>
        <View style={styles.accessDenied}>
          <FileText size={48} color={Colors.neutral[300]} />
          <Text style={styles.accessDeniedTitle}>Admin Access Required</Text>
          <Text style={styles.accessDeniedText}>Only admins can upload documents to the knowledge base.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedCategory = CATEGORIES.find(c => c.value === category);
  const selectedLanguage = LANGUAGES.find(l => l.value === language);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace(isVideo ? '/(tabs)/videos' : '/(tabs)/documents');
          }
        }}>
          <ArrowLeft size={20} color={Colors.neutral[700]} />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Upload size={16} color="#fff" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Upload Document</Text>
          <Text style={styles.headerSub}>Add to knowledge base</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training Video Option</Text>
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => {
              setIsVideo(!isVideo);
              setFileUrl('');
              setSelectedVideoUri(null);
              setSelectedVideoName(null);
            }}
          >
            <View style={[styles.toggleSwitch, isVideo && styles.toggleSwitchActive]}>
              <View style={[styles.toggleCircle, isVideo && styles.toggleCircleActive]} />
            </View>
            <Text style={styles.toggleText}>This is a Training Video</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isVideo ? 'Video Info' : 'Document Info'}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={isVideo ? "e.g. SloanLED modules installation tutorial" : "e.g. SloanLED SL Series Datasheet"}
              placeholderTextColor={Colors.neutral[400]}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder={isVideo ? "Brief description of this training video..." : "Brief description of the document..."}
              placeholderTextColor={Colors.neutral[400]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {isVideo ? (
            <View style={styles.field}>
              <Text style={styles.label}>Video Upload Mode</Text>
              <View style={styles.tabGroup}>
                <TouchableOpacity 
                  style={[styles.tabBtn, videoUploadMode === 'url' && styles.tabBtnActive]} 
                  onPress={() => { setVideoUploadMode('url'); setFileUrl(''); setSelectedVideoUri(null); }}
                >
                  <Text style={[styles.tabBtnText, videoUploadMode === 'url' && styles.tabBtnTextActive]}>Paste Video URL</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tabBtn, videoUploadMode === 'file' && styles.tabBtnActive]} 
                  onPress={() => { setVideoUploadMode('file'); setFileUrl(''); }}
                >
                  <Text style={[styles.tabBtnText, videoUploadMode === 'file' && styles.tabBtnTextActive]}>Upload Video File</Text>
                </TouchableOpacity>
              </View>

              {videoUploadMode === 'url' ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.label}>Video URL <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://www.youtube.com/watch?v=..."
                    placeholderTextColor={Colors.neutral[400]}
                    value={fileUrl}
                    onChangeText={setFileUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <Text style={styles.hint}>YouTube, Vimeo, or direct MP4 link</Text>
                </View>
              ) : (
                <View style={{ marginTop: 10 }}>
                  {selectedVideoUri ? (
                    <View style={styles.selectedFileCard}>
                      <FileVideo size={24} color={Colors.primary[600]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectedFileName} numberOfLines={1}>{selectedVideoName}</Text>
                        <Text style={styles.hint}>Ready to upload</Text>
                      </View>
                      <TouchableOpacity style={styles.uploadFileBtn} onPress={pickVideo}>
                        <Text style={styles.uploadFileBtnText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.uploadFileBtnLarge} onPress={pickVideo}>
                      <Upload size={24} color={Colors.primary[600]} />
                      <Text style={styles.uploadFileBtnLargeText}>Select Video File</Text>
                      <Text style={styles.hint}>MP4 format is recommended</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>File URL <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="https://example.com/document.pdf"
                placeholderTextColor={Colors.neutral[400]}
                value={fileUrl}
                onChangeText={setFileUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={styles.hint}>Direct URL to the PDF file</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{isVideo ? 'Cover Image (Thumbnail)' : 'Document Thumbnail'}</Text>
            {selectedThumbUri ? (
              <View style={styles.selectedFileCard}>
                <Image source={{ uri: selectedThumbUri }} style={{ width: 48, height: 36, borderRadius: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedFileName} numberOfLines={1}>{selectedThumbName}</Text>
                  <Text style={styles.hint}>Thumbnail image ready</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={styles.uploadFileBtn} onPress={pickThumbnail}>
                    <Text style={styles.uploadFileBtnText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeFileBtn} onPress={() => { setSelectedThumbUri(null); setSelectedThumbName(null); }}>
                    <Text style={styles.removeFileBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadFileBtnLarge} onPress={pickThumbnail}>
                <Upload size={24} color={Colors.primary[600]} />
                <Text style={styles.uploadFileBtnLargeText}>{isVideo ? 'Select Cover Image' : 'Select Thumbnail'}</Text>
                <Text style={styles.hint}>PNG, JPG, or JPEG format</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Classification</Text>

          {!isVideo && (
            <View style={styles.field}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => { setShowCategory(!showCategory); setShowLanguage(false); }}
              >
                <Text style={styles.selectorText}>{selectedCategory?.label}</Text>
                <ChevronDown size={16} color={Colors.neutral[500]} />
              </TouchableOpacity>
              {showCategory && (
                <View style={styles.dropdown}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[styles.dropdownItem, category === cat.value && styles.dropdownItemActive]}
                      onPress={() => { setCategory(cat.value); setShowCategory(false); }}
                    >
                      <Text style={[styles.dropdownText, category === cat.value && styles.dropdownTextActive]}>{cat.label}</Text>
                      {category === cat.value && <Check size={14} color={Colors.primary[600]} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Language</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => { setShowLanguage(!showLanguage); setShowCategory(false); }}
            >
              <Text style={styles.selectorText}>{selectedLanguage?.label}</Text>
              <ChevronDown size={16} color={Colors.neutral[500]} />
            </TouchableOpacity>
            {showLanguage && (
              <View style={styles.dropdown}>
                {LANGUAGES.map(lang => (
                  <TouchableOpacity
                    key={lang.value}
                    style={[styles.dropdownItem, language === lang.value && styles.dropdownItemActive]}
                    onPress={() => { setLanguage(lang.value); setShowLanguage(false); }}
                  >
                    <Text style={[styles.dropdownText, language === lang.value && styles.dropdownTextActive]}>{lang.label}</Text>
                    {language === lang.value && <Check size={14} color={Colors.primary[600]} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tags</Text>
            <View style={styles.inputWithIcon}>
              <Tag size={14} color={Colors.neutral[400]} />
              <TextInput
                style={styles.inputInner}
                placeholder="led, datasheet, sl-series"
                placeholderTextColor={Colors.neutral[400]}
                value={tagsInput}
                onChangeText={setTagsInput}
              />
            </View>
            <Text style={styles.hint}>Comma-separated tags for searchability</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Upload size={16} color="#fff" />
                <Text style={styles.saveBtnText}>{isVideo ? 'Upload Training Video' : 'Upload Document'}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace(isVideo ? '/(tabs)/videos' : '/(tabs)/documents');
            }
          }}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  headerIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.neutral[900] },
  headerSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500] },
  errorBox: {
    backgroundColor: Colors.error[50], borderRadius: 12, padding: 14,
    margin: 16, borderLeftWidth: 3, borderLeftColor: Colors.error[500],
  },
  errorText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.error[600] },
  section: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginTop: 16, padding: 16,
  },
  sectionTitle: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.neutral[800], marginBottom: 14 },
  field: { marginBottom: 14 },
  label: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.neutral[700], marginBottom: 6 },
  required: { color: Colors.error[500] },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: 12, padding: 13,
    fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900], backgroundColor: Colors.neutral[50],
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: 12, padding: 13,
    backgroundColor: Colors.neutral[50],
  },
  inputInner: {
    flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900],
  },
  hint: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[400], marginTop: 4 },
  selector: {
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: 12, padding: 13,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.neutral[50],
  },
  selectorText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900] },
  dropdown: {
    borderWidth: 1, borderColor: Colors.neutral[200], borderRadius: 12, marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: { padding: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownItemActive: { backgroundColor: Colors.primary[50] },
  dropdownText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[700] },
  dropdownTextActive: { fontFamily: 'Inter-SemiBold', color: Colors.primary[600] },
  actions: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  saveBtn: {
    backgroundColor: Colors.primary[600], borderRadius: 12, padding: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
  cancelBtn: {
    backgroundColor: Colors.neutral[100], borderRadius: 12, padding: 15, alignItems: 'center',
  },
  cancelBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.neutral[600] },
  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  accessDeniedTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.neutral[700] },
  accessDeniedText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[500], textAlign: 'center', lineHeight: 20 },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.neutral[200],
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: Colors.primary[600],
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  toggleText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.neutral[800],
  },
  tabGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral[100],
    borderRadius: 10,
    padding: 3,
    marginTop: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[500],
  },
  tabBtnTextActive: {
    color: Colors.primary[600],
    fontFamily: 'Inter-Bold',
  },
  uploadFileBtn: {
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary[200],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  uploadFileBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primary[600],
  },
  uploadFileBtnLarge: {
    borderWidth: 1.5,
    borderColor: Colors.primary[200],
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  uploadFileBtnLargeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.primary[600],
  },
  selectedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  selectedFileName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.neutral[800],
  },
  removeFileBtn: {
    backgroundColor: Colors.error[50],
    borderWidth: 1,
    borderColor: Colors.error[100],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeFileBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.error[600],
  },
});
