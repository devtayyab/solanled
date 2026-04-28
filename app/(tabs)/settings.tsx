import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { t } from '../../lib/i18n';
import { Colors } from '../../constants/Colors';
import {
  User, Building2, Globe, LogOut, ChevronRight,
  Check, Users, Bell, RefreshCw, MapPin, Shield, Camera
} from 'lucide-react-native';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export default function SettingsScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { language, changeLanguage } = useLanguage();
  const router = useRouter();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
  }, [profile]));

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName, phone, language,
      updated_at: new Date().toISOString(),
    }).eq('id', user?.id);
    if (error) Alert.alert(t('error'), error.message);
    else await refreshProfile();
    setSaving(false);
  };

  const handleLanguageChange = (code: string) => {
    changeLanguage(code);
    supabase.from('profiles').update({ language: code }).eq('id', user?.id);
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await signOut();
  };

  const toggleSection = (section: string) => setActiveSection(prev => prev === section ? null : section);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const uri = asset.uri;
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;

      // Convert URI to Blob for reliable upload
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      if (urlData?.publicUrl) {
        const { error: updateError } = await supabase.from('profiles').update({ 
          avatar_url: urlData.publicUrl 
        }).eq('id', user?.id);
        
        if (updateError) throw updateError;
        await refreshProfile();
      }
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      Alert.alert(t('error'), 'Failed to upload image. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.role === 'signmaker' || profile?.role === 'sloan_admin';
  const isSloanAdmin = profile?.role === 'sloan_admin' || profile?.role === 'superadmin';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={pickAvatar} disabled={uploadingAvatar}>
            {profile?.avatar_url && !profile.avatar_url.startsWith('file://') ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.displayName}>{profile?.full_name || 'User'}</Text>
          <Text style={styles.displayEmail}>{user?.email}</Text>
          {profile?.role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}</Text>
            </View>
          )}
        </View>

        <View style={styles.sections}>
          <SettingRow
            icon={User} iconBg={Colors.primary[50]} iconColor={Colors.primary[600]}
            title={t('account_settings')}
            onPress={() => toggleSection('profile')}
            expanded={activeSection === 'profile'}
          />
          {activeSection === 'profile' && (
            <View style={styles.sectionBody}>
              <View style={styles.field}>
                <Text style={styles.label}>{t('full_name')}</Text>
                <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={Colors.neutral[400]} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+44 20 1234 5678" placeholderTextColor={Colors.neutral[400]} keyboardType="phone-pad" />
              </View>
              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={saveProfile} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t('save')}</Text>}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />
          <SettingRow
            icon={Building2} iconBg={Colors.accent[50]} iconColor={Colors.accent[600]}
            title={t('company')} subtitle={profile?.companies?.name}
            onPress={() => router.push('/company')}
          />

          <View style={styles.divider} />
          <SettingRow
            icon={Users} iconBg="#EEF6FF" iconColor={Colors.primary[700]}
            title="Team Management"
            subtitle={isAdmin ? 'Manage members & invitations' : 'View team members'}
            onPress={() => router.push('/team')}
          />

          <View style={styles.divider} />
          <SettingRow
            icon={Bell} iconBg={Colors.warning[50]} iconColor={Colors.warning[600]}
            title="Notifications"
            subtitle="View notification history"
            onPress={() => router.push('/notifications')}
          />

          <View style={styles.divider} />
          <SettingRow
            icon={MapPin} iconBg={Colors.success[50]} iconColor={Colors.success[600]}
            title="Project Map"
            subtitle="View project GPS locations"
            onPress={() => router.push('/map')}
          />

          {isAdmin && (
            <>
              <View style={styles.divider} />
              <SettingRow
                icon={RefreshCw} iconBg="#F0FDF4" iconColor={Colors.secondary[600]}
                title="WordPress Sync"
                subtitle="Sync documents from WordPress"
                onPress={() => router.push('/wordpress')}
              />
              {isSloanAdmin && (
                <>
                  <View style={styles.divider} />
                  <SettingRow
                    icon={Shield} iconBg="#FEE2E2" iconColor={Colors.error[600]}
                    title="Company Approvals"
                    subtitle="Review pending company signups"
                    onPress={() => router.push('/admin/companies')}
                  />
                </>
              )}
            </>
          )}

          <View style={styles.divider} />
          <SettingRow
            icon={Globe} iconBg={Colors.secondary[50]} iconColor={Colors.secondary[600]}
            title={t('app_language')} subtitle={LANGUAGES.find(l => l.code === language)?.label}
            onPress={() => toggleSection('language')}
            expanded={activeSection === 'language'}
          />
          {activeSection === 'language' && (
            <View style={styles.sectionBody}>
              {LANGUAGES.map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={styles.langOption}
                  onPress={() => handleLanguageChange(lang.code)}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, language === lang.code && styles.langLabelActive]}>{lang.label}</Text>
                  {language === lang.code && <Check size={16} color={Colors.primary[600]} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isAdmin && (
            <>
              <View style={styles.divider} />
              <SettingRow
                icon={Shield} iconBg={Colors.neutral[100]} iconColor={Colors.neutral[600]}
                title="Role & Permissions"
                subtitle={`Your role: ${profile?.role || 'employee'}`}
                onPress={() => toggleSection('permissions')}
                expanded={activeSection === 'permissions'}
              />
              {activeSection === 'permissions' && (
                <View style={styles.sectionBody}>
                  <View style={styles.permissionsList}>
                    {profile?.role === 'superadmin' || profile?.role === 'sloan_admin' ? (
                      <PermissionItem text="Full platform oversight and management" />
                    ) : null}
                    {profile?.role === 'admin' || profile?.role === 'signmaker' ? (
                      <PermissionItem text="Company team and project management" />
                    ) : null}
                    {(profile?.role === 'admin' || profile?.role === 'signmaker' || profile?.role === 'installer') && (
                      <PermissionItem text="Update project statuses and capture field data" />
                    )}
                    <PermissionItem text="View company projects and documentation" />
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color={Colors.error[600]} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SloanLED Mobile App</Text>
          <Text style={styles.footerVersion}>Version 1.0.0 • NestJS + Expo + Supabase</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrapper}>
              <LogOut size={28} color={Colors.error[600]} />
            </View>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalSubtitle}>Are you sure you want to logout? You will need to sign in again to access your projects.</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={confirmLogout}
              >
                <Text style={styles.confirmBtnText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PermissionItem({ text }: { text: string }) {
  return (
    <View style={styles.permissionItem}>
      <Check size={14} color={Colors.success[600]} />
      <Text style={styles.permissionText}>{text}</Text>
    </View>
  );
}

function SettingRow({ icon: Icon, iconBg, iconColor, title, subtitle, onPress, expanded }: any) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}>
      <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
      </View>
      <ChevronRight
        size={16} color={Colors.neutral[400]}
        style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: {
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 22, color: Colors.neutral[900] },
  avatarSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff', marginBottom: 12 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarImg: {
    width: 76, height: 76, borderRadius: 24,
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 24, backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  cameraOverlay: {
    position: 'absolute', bottom: -4, right: -4,
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: Colors.neutral[800],
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarText: { fontFamily: 'Inter-Bold', fontSize: 30, color: '#fff' },
  displayName: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.neutral[900] },
  displayEmail: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[500], marginTop: 2 },
  roleBadge: {
    marginTop: 8, backgroundColor: Colors.primary[50], borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  roleText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: Colors.primary[700] },
  sections: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
  },
  settingIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  settingContent: { flex: 1 },
  settingTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[800] },
  settingSubtitle: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500], marginTop: 1 },
  divider: { height: 1, backgroundColor: Colors.neutral[100], marginHorizontal: 16 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 14 },
  field: { marginBottom: 12, gap: 6 },
  label: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.neutral[600] },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: 10, padding: 12,
    fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900], backgroundColor: Colors.neutral[50],
  },
  saveBtn: {
    backgroundColor: Colors.primary[600], borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' },
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  langFlag: { fontSize: 20 },
  langLabel: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[700] },
  langLabelActive: { fontFamily: 'Inter-SemiBold', color: Colors.primary[700] },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.error[50], borderRadius: 14, padding: 14,
    marginHorizontal: 16, marginTop: 16, borderWidth: 1, borderColor: Colors.error[100],
  },
  logoutText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.error[600] },
  footer: { alignItems: 'center', paddingVertical: 20 },
  footerText: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[400] },
  footerVersion: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[300], marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.error[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.neutral[500],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.neutral[600],
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.error[600],
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  permissionsList: { gap: 10, marginTop: 4 },
  permissionItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  permissionText: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[600] },
});
