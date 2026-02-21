import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { ArrowLeft, Globe, RefreshCw, CheckCircle2, XCircle, Info, FileText, Users, ExternalLink } from 'lucide-react-native';

interface WPConfig {
  id?: string;
  wp_url: string;
  wp_username: string;
  wp_app_password: string;
  last_synced_at: string | null;
  last_sync_status: string;
  last_sync_message: string;
  enabled: boolean;
  sync_documents: boolean;
  sync_users: boolean;
}

const DEFAULT_CONFIG: WPConfig = {
  wp_url: '', wp_username: '', wp_app_password: '',
  last_synced_at: null, last_sync_status: 'never',
  last_sync_message: '', enabled: true,
  sync_documents: true, sync_users: false,
};

export default function WordPressSyncScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<WPConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ count: number; type: string } | null>(null);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  useFocusEffect(useCallback(() => {
    if (!profile?.company_id) { setLoading(false); return; }
    supabase
      .from('wordpress_sync_config')
      .select('*')
      .eq('company_id', profile.company_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setConfig(data);
        setLoading(false);
      });
  }, [profile?.company_id]));

  const saveConfig = async () => {
    if (!profile?.company_id) return;
    setSaving(true);
    const payload = {
      company_id: profile.company_id,
      wp_url: config.wp_url.trim().replace(/\/$/, ''),
      wp_username: config.wp_username.trim(),
      wp_app_password: config.wp_app_password.trim(),
      enabled: config.enabled,
      sync_documents: config.sync_documents,
      sync_users: config.sync_users,
      updated_at: new Date().toISOString(),
    };

    const { error } = config.id
      ? await supabase.from('wordpress_sync_config').update(payload).eq('id', config.id)
      : await supabase.from('wordpress_sync_config').insert(payload);

    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved', 'WordPress settings saved successfully');
    setSaving(false);
  };

  const runSync = async () => {
    if (!config.wp_url) { Alert.alert('Error', 'WordPress URL is required'); return; }
    setSyncing(true);
    setSyncResult(null);

    try {
      const baseUrl = config.wp_url.trim().replace(/\/$/, '');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (config.wp_username && config.wp_app_password) {
        const creds = btoa(`${config.wp_username}:${config.wp_app_password}`);
        headers['Authorization'] = `Basic ${creds}`;
      }

      let syncedCount = 0;
      let syncedType = '';

      if (config.sync_documents) {
        const response = await fetch(`${baseUrl}/wp-json/wp/v2/media?mime_type=application/pdf&per_page=20`, { headers });
        if (response.ok) {
          const media = await response.json();
          for (const item of media) {
            const title = item.title?.rendered || item.slug;
            const slug = item.slug || '';
            const combined = `${title} ${slug}`.toLowerCase();
            let category = 'general';
            if (combined.includes('datasheet') || combined.includes('datenblatt')) category = 'datasheet';
            else if (combined.includes('spec') || combined.includes('spezif')) category = 'spec_sheet';
            else if (combined.includes('install') || combined.includes('montage')) category = 'installation_guide';
            else if (combined.includes('certificate') || combined.includes('zertifikat')) category = 'certificate';
            let language = 'en';
            if (combined.includes('-de') || combined.includes('_de') || combined.includes('deutsch')) language = 'de';
            else if (combined.includes('-fr') || combined.includes('_fr') || combined.includes('francais')) language = 'fr';
            await supabase.from('documents').upsert({
              title,
              description: item.description?.rendered?.replace(/<[^>]*>/g, '') || '',
              category,
              file_url: item.source_url,
              thumbnail_url: item.media_details?.sizes?.thumbnail?.source_url || '',
              language,
              tags: [],
            }, { onConflict: 'file_url', ignoreDuplicates: false });
          }
          syncedCount += media.length;
          syncedType = 'documents';
        }
      }

      if (config.sync_users && profile?.company_id) {
        try {
          const usersResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users?per_page=50`, { headers });
          if (usersResponse.ok) {
            const wpUsers = await usersResponse.json();
            let inviteCount = 0;
            for (const wpUser of wpUsers) {
              const email = wpUser.email;
              if (!email || !email.includes('@')) continue;
              const isAdmin = Array.isArray(wpUser.roles) && wpUser.roles.includes('administrator');
              const { error: inviteError } = await supabase.from('company_invitations').upsert({
                company_id: profile.company_id,
                invited_by: profile.id,
                email: email.toLowerCase(),
                role: isAdmin ? 'admin' : 'employee',
              }, { onConflict: 'company_id,email', ignoreDuplicates: true });
              if (!inviteError) inviteCount++;
            }
            if (inviteCount > 0) {
              syncedCount += inviteCount;
              syncedType = syncedType ? `${syncedType} & ${inviteCount} user invitations` : `${inviteCount} user invitations`;
            }
          }
        } catch {}
      }

      const updateData: any = {
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_message: `Synced ${syncedCount} ${syncedType} from WordPress`,
      };

      if (config.id) {
        await supabase.from('wordpress_sync_config').update(updateData).eq('id', config.id);
      }

      setConfig(prev => ({ ...prev, ...updateData }));
      setSyncResult({ count: syncedCount, type: syncedType });
    } catch (e: any) {
      const errorMsg = e.message || 'Sync failed';
      if (config.id) {
        await supabase.from('wordpress_sync_config').update({
          last_sync_status: 'failed',
          last_sync_message: errorMsg,
        }).eq('id', config.id);
      }
      setConfig(prev => ({ ...prev, last_sync_status: 'failed', last_sync_message: errorMsg }));
    } finally {
      setSyncing(false);
    }
  };

  const getStatusInfo = () => {
    switch (config.last_sync_status) {
      case 'success': return { color: Colors.success[600], icon: CheckCircle2, label: 'Last sync successful' };
      case 'failed': return { color: Colors.error[600], icon: XCircle, label: 'Last sync failed' };
      case 'syncing': return { color: Colors.primary[600], icon: RefreshCw, label: 'Syncing...' };
      default: return { color: Colors.neutral[400], icon: Info, label: 'Never synced' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color={Colors.primary[500]} /></View>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.neutral[700]} />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          <Globe size={18} color="#fff" />
        </View>
        <View>
          <Text style={styles.headerTitle}>WordPress Sync</Text>
          <Text style={styles.headerSub}>Sync documents & users</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {config.last_sync_status !== 'never' && (
          <View style={[styles.statusBanner, { backgroundColor: statusInfo.color + '18', borderColor: statusInfo.color + '44' }]}>
            <StatusIcon size={16} color={statusInfo.color} />
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
              {config.last_sync_message ? (
                <Text style={styles.statusMessage}>{config.last_sync_message}</Text>
              ) : null}
              {config.last_synced_at ? (
                <Text style={styles.statusTime}>{new Date(config.last_synced_at).toLocaleString()}</Text>
              ) : null}
            </View>
          </View>
        )}

        {syncResult && (
          <View style={styles.syncResultBanner}>
            <CheckCircle2 size={16} color={Colors.success[600]} />
            <Text style={styles.syncResultText}>
              Successfully synced {syncResult.count} {syncResult.type} from WordPress
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Settings</Text>

          <View style={styles.field}>
            <Text style={styles.label}>WordPress Site URL</Text>
            <TextInput
              style={[styles.input, !isAdmin && styles.inputDisabled]}
              placeholder="https://www.sloanled.eu"
              placeholderTextColor={Colors.neutral[400]}
              value={config.wp_url}
              onChangeText={v => setConfig(prev => ({ ...prev, wp_url: v }))}
              editable={isAdmin}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>WordPress Username</Text>
            <TextInput
              style={[styles.input, !isAdmin && styles.inputDisabled]}
              placeholder="admin"
              placeholderTextColor={Colors.neutral[400]}
              value={config.wp_username}
              onChangeText={v => setConfig(prev => ({ ...prev, wp_username: v }))}
              editable={isAdmin}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Application Password</Text>
            <TextInput
              style={[styles.input, !isAdmin && styles.inputDisabled]}
              placeholder="xxxx xxxx xxxx xxxx"
              placeholderTextColor={Colors.neutral[400]}
              value={config.wp_app_password}
              onChangeText={v => setConfig(prev => ({ ...prev, wp_app_password: v }))}
              editable={isAdmin}
              secureTextEntry
            />
            <Text style={styles.hint}>Generate from WordPress → Users → Profile → Application Passwords</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Settings</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <FileText size={18} color={Colors.primary[500]} />
              <View>
                <Text style={styles.toggleLabel}>Sync Documents</Text>
                <Text style={styles.toggleDesc}>Import PDF files from WordPress media library</Text>
              </View>
            </View>
            <Switch
              value={config.sync_documents}
              onValueChange={v => setConfig(prev => ({ ...prev, sync_documents: v }))}
              trackColor={{ false: Colors.neutral[200], true: Colors.primary[400] }}
              thumbColor={config.sync_documents ? Colors.primary[600] : Colors.neutral[400]}
              disabled={!isAdmin}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Users size={18} color={Colors.secondary[500]} />
              <View>
                <Text style={styles.toggleLabel}>Sync Users</Text>
                <Text style={styles.toggleDesc}>Sync WordPress users as team members</Text>
              </View>
            </View>
            <Switch
              value={config.sync_users}
              onValueChange={v => setConfig(prev => ({ ...prev, sync_users: v }))}
              trackColor={{ false: Colors.neutral[200], true: Colors.primary[400] }}
              thumbColor={config.sync_users ? Colors.primary[600] : Colors.neutral[400]}
              disabled={!isAdmin}
            />
          </View>
        </View>

        {isAdmin && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={saveConfig}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Settings</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.syncBtn, (syncing || !config.wp_url) && styles.btnDisabled]}
              onPress={runSync}
              disabled={syncing || !config.wp_url}
            >
              {syncing ? (
                <ActivityIndicator color={Colors.primary[600]} size="small" />
              ) : (
                <>
                  <RefreshCw size={16} color={Colors.primary[600]} />
                  <Text style={styles.syncBtnText}>Sync Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoBox}>
          <Info size={16} color={Colors.neutral[500]} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>WordPress REST API</Text>
            <Text style={styles.infoText}>
              This integration uses the WordPress REST API to sync documents (PDF files from the media library). Make sure your WordPress site has REST API enabled. For authenticated requests, create an Application Password in WordPress admin.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  statusBanner: {
    flexDirection: 'row', gap: 10, margin: 16, padding: 12,
    borderRadius: 12, borderWidth: 1,
  },
  statusInfo: { flex: 1 },
  statusLabel: { fontFamily: 'Inter-SemiBold', fontSize: 13 },
  statusMessage: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[600], marginTop: 2 },
  statusTime: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[400], marginTop: 2 },
  syncResultBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: Colors.success[50], borderRadius: 12, padding: 12,
    marginHorizontal: 16, marginBottom: 4,
    borderWidth: 1, borderColor: Colors.success[100],
  },
  syncResultText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.success[700] },
  section: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16 },
  sectionTitle: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.neutral[800], marginBottom: 14 },
  field: { marginBottom: 14, gap: 6 },
  label: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.neutral[700] },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: 12, padding: 13,
    fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900], backgroundColor: Colors.neutral[50],
  },
  inputDisabled: { backgroundColor: Colors.neutral[100], color: Colors.neutral[500] },
  hint: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[400] },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toggleLabel: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.neutral[800] },
  toggleDesc: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[500], marginTop: 1 },
  actions: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  saveBtn: {
    backgroundColor: Colors.primary[600], borderRadius: 12, padding: 15,
    alignItems: 'center',
  },
  saveBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
  syncBtn: {
    backgroundColor: Colors.primary[50], borderRadius: 12, padding: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.primary[200],
  },
  syncBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.primary[600] },
  btnDisabled: { opacity: 0.6 },
  infoBox: {
    flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16,
    backgroundColor: Colors.neutral[100], borderRadius: 12, padding: 14,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: Colors.neutral[700], marginBottom: 4 },
  infoText: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[600], lineHeight: 18 },
});
