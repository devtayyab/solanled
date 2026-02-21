import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import {
  ArrowLeft, FileText, Link, ChevronDown, Check, Tag, Upload
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [category, setCategory] = useState('general');
  const [language, setLanguage] = useState('en');
  const [tagsInput, setTagsInput] = useState('');
  const [showCategory, setShowCategory] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!fileUrl.trim()) { setError('File URL is required'); return; }
    setSaving(true);
    setError('');
    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const { error: err } = await supabase.from('documents').insert({
        title: title.trim(),
        description: description.trim(),
        file_url: fileUrl.trim(),
        thumbnail_url: thumbnailUrl.trim() || null,
        category,
        language,
        tags,
        uploaded_by: profile?.id,
        company_id: profile?.company_id,
      });

      if (err) throw err;
      router.back();
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
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
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
          <Text style={styles.sectionTitle}>Document Info</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. SloanLED SL Series Datasheet"
              placeholderTextColor={Colors.neutral[400]}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Brief description of the document..."
              placeholderTextColor={Colors.neutral[400]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

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

          <View style={styles.field}>
            <Text style={styles.label}>Thumbnail URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com/thumb.jpg"
              placeholderTextColor={Colors.neutral[400]}
              value={thumbnailUrl}
              onChangeText={setThumbnailUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={styles.hint}>Optional preview image URL</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Classification</Text>

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
                <Text style={styles.saveBtnText}>Upload Document</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
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
});
