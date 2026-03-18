import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { Company } from '../../types';
import { ArrowLeft, Building2, MapPin, Phone, Globe, Users, FolderOpen, Copy } from 'lucide-react-native';

export default function CompanyProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ members: 0, projects: 0, installed: 0 });
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const fetchData = useCallback(async () => {
    if (!profile?.company_id) {
      console.log('No company_id found in profile:', profile);
      setLoading(false);
      return;
    }

    try {
      const [companyRes, membersRes, projectsRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', profile.company_id).maybeSingle(),
        supabase.from('profiles').select('id').eq('company_id', profile.company_id),
        supabase.from('projects').select('id, status').eq('company_id', profile.company_id),
      ]);

      if (companyRes.error) console.error('Company fetch error:', companyRes.error);
      if (membersRes.error) console.error('Members fetch error:', membersRes.error);

      if (companyRes.data) {
        const c = companyRes.data;
        setCompany(c);
        setName(c.name || '');
        setAddress(c.address || '');
        setCountry(c.country || '');
        setPhone(c.phone || '');
      } else {
        console.warn('Company row not found for ID:', profile.company_id);
      }

      setStats({
        members: membersRes.data?.length || 0,
        projects: projectsRes.data?.length || 0,
        installed: projectsRes.data?.filter(p => p.status === 'installed').length || 0,
      });
    } catch (err) {
      console.error('Error fetching company data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useFocusEffect(useCallback(() => {
    fetchData();
  }, [fetchData]));

  const saveCompany = async () => {
    if (!profile?.company_id) {
      Alert.alert('Error', 'No Company ID linked to your profile. Please contact support.');
      return;
    }
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only admins can update company details.');
      return;
    }

    setSaving(true);
    console.log('Updating company:', profile.company_id, { name, address, country, phone });

    const { error, data } = await supabase
      .from('companies')
      .update({
        name,
        address,
        country,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.company_id)
      .select();

    if (error) {
      console.error('Update failed:', error);
      Alert.alert('Update Failed', error.message);
    } else {
      console.log('Update success:', data);
      await refreshProfile();
      fetchData();
      Alert.alert('Success', 'Company profile updated successfully');
    }
    setSaving(false);
  };

  const copyCompanyId = async () => {
    if (!profile?.company_id) return;
    try {
      const { default: Clipboard } = await import('expo-clipboard');
      await Clipboard.setStringAsync(profile.company_id);
      Alert.alert('Copied', 'Company ID copied to clipboard. Share with team members to invite them.');
    } catch {
      Alert.alert('Company ID', profile.company_id);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color={Colors.primary[500]} /></View>
      </SafeAreaView>
    );
  }

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
        <View style={styles.headerIcon}>
          <Building2 size={18} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>Company Profile</Text>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={saveCompany}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatBox icon={Users} label="Members" value={stats.members} color={Colors.primary[500]} />
          <StatBox icon={FolderOpen} label="Projects" value={stats.projects} color={Colors.accent[500]} />
          <StatBox icon={Globe} label="Installed" value={stats.installed} color={Colors.success[500]} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Details</Text>
          <Field
            icon={Building2} label="Company Name"
            value={name} onChangeText={setName}
            placeholder="Acme Signs Ltd" editable={isAdmin}
          />
          <Field
            icon={MapPin} label="Address"
            value={address} onChangeText={setAddress}
            placeholder="123 Main Street, City" editable={isAdmin}
          />
          <Field
            icon={Globe} label="Country"
            value={country} onChangeText={setCountry}
            placeholder="United Kingdom" editable={isAdmin}
          />
          <Field
            icon={Phone} label="Phone"
            value={phone} onChangeText={setPhone}
            placeholder="+44 20 1234 5678" editable={isAdmin}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Access</Text>
          <View style={styles.companyIdCard}>
            <View style={styles.companyIdLeft}>
              <Text style={styles.companyIdLabel}>Company ID</Text>
              <Text style={styles.companyIdValue} numberOfLines={1}>{profile?.company_id?.slice(0, 24)}...</Text>
              <Text style={styles.companyIdHint}>Share this ID with team members to let them join</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={copyCompanyId}>
              <Copy size={16} color={Colors.primary[600]} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.teamBtn} onPress={() => router.push('/team')}>
            <Users size={16} color={Colors.primary[600]} />
            <Text style={styles.teamBtnText}>Manage Team Members</Text>
            <View style={{ marginLeft: 'auto' }}>
              <Text style={styles.memberCount}>{stats.members} members</Text>
            </View>
          </TouchableOpacity>
        </View>

        {!profile?.company_id && (
          <View style={[styles.readOnlyNote, { backgroundColor: Colors.error[50], marginBottom: 16 }]}>
            <Text style={[styles.readOnlyText, { color: Colors.error[600] }]}>
              Account Error: No company is linked to your account.
            </Text>
          </View>
        )}

        {!isAdmin && (
          <View style={styles.readOnlyNote}>
            <Text style={styles.readOnlyText}>Only company admins can edit company details.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ icon: Icon, label, value, onChangeText, placeholder, editable = true, keyboardType }: any) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabel}>
        <Icon size={14} color={Colors.neutral[500]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.neutral[400]}
        editable={editable}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function StatBox({ icon: Icon, label, value, color }: any) {
  return (
    <View style={[styles.statBox, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Icon size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.neutral[900], flex: 1 },
  saveBtn: {
    backgroundColor: Colors.primary[600], borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, marginLeft: 'auto',
  },
  saveBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  statsRow: {
    flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0,
  },
  statBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.neutral[100],
  },
  statValue: { fontFamily: 'Inter-Bold', fontSize: 22 },
  statLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[500] },
  section: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 16 },
  sectionTitle: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.neutral[800], marginBottom: 12 },
  field: { marginBottom: 12, gap: 6 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.neutral[600] },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: 10, padding: 12,
    fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900], backgroundColor: Colors.neutral[50],
  },
  inputDisabled: { backgroundColor: Colors.neutral[100], color: Colors.neutral[700] },
  companyIdCard: {
    backgroundColor: Colors.neutral[50], borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.neutral[200], marginBottom: 10,
  },
  companyIdLeft: { flex: 1 },
  companyIdLabel: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: Colors.neutral[600] },
  companyIdValue: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[800], fontVariant: ['tabular-nums'], marginTop: 2 },
  companyIdHint: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[400], marginTop: 4 },
  copyBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary[50], justifyContent: 'center', alignItems: 'center',
  },
  teamBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.primary[50], borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.primary[100],
  },
  teamBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.primary[700] },
  memberCount: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.primary[500] },
  readOnlyNote: {
    backgroundColor: Colors.neutral[100], borderRadius: 10, padding: 12, marginHorizontal: 16,
  },
  readOnlyText: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500], textAlign: 'center' },
});
