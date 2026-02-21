import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { Profile } from '../../types';
import {
  ArrowLeft, UserPlus, Users, Mail, ChevronDown,
  Trash2, Crown, Shield, User, X, Send, Clock, Check
} from 'lucide-react-native';

interface Invitation {
  id: string;
  email: string;
  role: string;
  accepted: boolean;
  expires_at: string;
  created_at: string;
}

const ROLES = [
  { value: 'admin', label: 'Admin', desc: 'Full access to all company resources', icon: Crown },
  { value: 'employee', label: 'Employee', desc: 'Can view and manage projects', icon: User },
];

export default function TeamManagementScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const fetchData = async () => {
    if (!profile?.company_id) { setLoading(false); return; }

    const [membersRes, invitesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('company_id', profile.company_id).order('created_at'),
      supabase.from('company_invitations').select('*').eq('company_id', profile.company_id).eq('accepted', false).order('created_at', { ascending: false }),
    ]);

    if (membersRes.data) setMembers(membersRes.data);
    if (invitesRes.data) setInvitations(invitesRes.data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [profile?.company_id]));

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { setInviteError('Email is required'); return; }
    if (!inviteEmail.includes('@')) { setInviteError('Enter a valid email address'); return; }
    setInviting(true);
    setInviteError('');

    const { error } = await supabase.from('company_invitations').insert({
      company_id: profile?.company_id,
      invited_by: profile?.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
    });

    if (error) {
      setInviteError(error.message);
    } else {
      await supabase.from('notifications').insert({
        user_id: profile?.id,
        type: 'team_invite',
        title: 'Invitation Sent',
        message: `Invitation sent to ${inviteEmail.trim()}`,
        data: { email: inviteEmail.trim(), role: inviteRole },
      });
      setInviteEmail('');
      setInviteRole('employee');
      setShowInviteModal(false);
      await fetchData();
    }
    setInviting(false);
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    if (!isAdmin) return;
    await supabase.from('profiles').update({ role: newRole }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole as any } : m));
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!isAdmin) return;
    Alert.alert('Remove Member', `Remove ${memberName} from the company?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await supabase.from('profiles').update({ company_id: null, role: 'employee' }).eq('id', memberId);
          setMembers(prev => prev.filter(m => m.id !== memberId));
        }
      }
    ]);
  };

  const handleCancelInvite = async (inviteId: string) => {
    await supabase.from('company_invitations').delete().eq('id', inviteId);
    setInvitations(prev => prev.filter(i => i.id !== inviteId));
  };

  const getRoleIcon = (role: string) => {
    if (role === 'admin' || role === 'superadmin') return Crown;
    return User;
  };

  const getRoleColor = (role: string) => {
    if (role === 'superadmin') return Colors.accent[600];
    if (role === 'admin') return Colors.primary[600];
    return Colors.neutral[500];
  };

  const renderMember = ({ item }: { item: Profile }) => {
    const isSelf = item.id === profile?.id;
    const RoleIcon = getRoleIcon(item.role);
    return (
      <View style={styles.memberCard}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>{(item.full_name || 'U').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName}>{item.full_name || 'Unknown'}</Text>
            {isSelf && <View style={styles.selfBadge}><Text style={styles.selfBadgeText}>You</Text></View>}
          </View>
          <View style={styles.roleRow}>
            <RoleIcon size={12} color={getRoleColor(item.role)} />
            <Text style={[styles.memberRole, { color: getRoleColor(item.role) }]}>
              {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
            </Text>
          </View>
        </View>
        {isAdmin && !isSelf && item.role !== 'superadmin' && (
          <View style={styles.memberActions}>
            <TouchableOpacity
              style={styles.roleToggle}
              onPress={() => handleChangeRole(item.id, item.role === 'admin' ? 'employee' : 'admin')}
            >
              <Text style={styles.roleToggleText}>
                {item.role === 'admin' ? 'Demote' : 'Make Admin'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemoveMember(item.id, item.full_name)}
            >
              <Trash2 size={14} color={Colors.error[500]} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.neutral[700]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Team Management</Text>
          <Text style={styles.headerSub}>{members.length} members</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInviteModal(true)}>
            <UserPlus size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={Colors.primary[500]} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Users size={16} color={Colors.neutral[500]} />
                <Text style={styles.sectionTitle}>Members ({members.length})</Text>
              </View>
              {members.map(m => renderMember({ item: m }))}
            </View>

            {invitations.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Clock size={16} color={Colors.warning[500]} />
                  <Text style={styles.sectionTitle}>Pending Invitations ({invitations.length})</Text>
                </View>
                {invitations.map(inv => (
                  <View key={inv.id} style={styles.inviteCard}>
                    <View style={styles.inviteIcon}>
                      <Mail size={16} color={Colors.warning[600]} />
                    </View>
                    <View style={styles.inviteInfo}>
                      <Text style={styles.inviteEmail}>{inv.email}</Text>
                      <Text style={styles.inviteRole}>{inv.role} • Expires {new Date(inv.expires_at).toLocaleDateString()}</Text>
                    </View>
                    {isAdmin && (
                      <TouchableOpacity onPress={() => handleCancelInvite(inv.id)} style={styles.cancelInviteBtn}>
                        <X size={14} color={Colors.error[500]} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {isAdmin && (
              <View style={styles.section}>
                <View style={styles.tipCard}>
                  <Shield size={18} color={Colors.primary[500]} />
                  <View style={styles.tipContent}>
                    <Text style={styles.tipTitle}>Team Access Control</Text>
                    <Text style={styles.tipText}>Admins can manage all projects, invite members, and edit company settings. Employees can view and manage their own projects.</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showInviteModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowInviteModal(false); setInviteEmail(''); setInviteError(''); }}>
              <X size={22} color={Colors.neutral[600]} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Invite Team Member</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.modalBody}>
            {inviteError ? (
              <View style={styles.errorBox}><Text style={styles.errorText}>{inviteError}</Text></View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="colleague@company.com"
                placeholderTextColor={Colors.neutral[400]}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Role</Text>
              {ROLES.map(role => (
                <TouchableOpacity
                  key={role.value}
                  style={[styles.roleOption, inviteRole === role.value && styles.roleOptionActive]}
                  onPress={() => setInviteRole(role.value)}
                >
                  <View style={[styles.roleOptionIcon, inviteRole === role.value && { backgroundColor: Colors.primary[600] }]}>
                    <role.icon size={16} color={inviteRole === role.value ? '#fff' : Colors.neutral[500]} />
                  </View>
                  <View style={styles.roleOptionText}>
                    <Text style={[styles.roleOptionLabel, inviteRole === role.value && styles.roleOptionLabelActive]}>{role.label}</Text>
                    <Text style={styles.roleOptionDesc}>{role.desc}</Text>
                  </View>
                  {inviteRole === role.value && <Check size={16} color={Colors.primary[600]} />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.sendInviteBtn, inviting && styles.btnDisabled]}
              onPress={handleInvite}
              disabled={inviting}
            >
              {inviting ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Send size={16} color="#fff" />
                  <Text style={styles.sendInviteBtnText}>Send Invitation</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
  headerSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500], marginTop: 1 },
  inviteBtn: {
    marginLeft: 'auto', width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  sectionTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[700] },
  memberCard: {
    backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row',
    alignItems: 'center', padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.neutral[100],
  },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  memberAvatarText: { fontFamily: 'Inter-Bold', fontSize: 18, color: '#fff' },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[900] },
  selfBadge: { backgroundColor: Colors.primary[50], borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  selfBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: 10, color: Colors.primary[600] },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  memberRole: { fontFamily: 'Inter-Medium', fontSize: 12 },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleToggle: {
    borderWidth: 1, borderColor: Colors.primary[200], borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.primary[50],
  },
  roleToggleText: { fontFamily: 'Inter-Medium', fontSize: 11, color: Colors.primary[600] },
  removeBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.error[50], justifyContent: 'center', alignItems: 'center',
  },
  inviteCard: {
    backgroundColor: Colors.warning[50], borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.warning[100],
  },
  inviteIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.warning[100],
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  inviteInfo: { flex: 1 },
  inviteEmail: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.neutral[800] },
  inviteRole: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[500], marginTop: 2 },
  cancelInviteBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.error[50], justifyContent: 'center', alignItems: 'center',
  },
  tipCard: {
    flexDirection: 'row', gap: 12, backgroundColor: Colors.primary[50],
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.primary[100],
  },
  tipContent: { flex: 1 },
  tipTitle: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.primary[800], marginBottom: 4 },
  tipText: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.primary[700], lineHeight: 18 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  modalTitle: { fontFamily: 'Inter-SemiBold', fontSize: 17, color: Colors.neutral[900] },
  modalBody: { padding: 20, gap: 16 },
  errorBox: {
    backgroundColor: Colors.error[50], borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.error[500],
  },
  errorText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.error[600] },
  field: { gap: 8 },
  label: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.neutral[700] },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: 12,
    padding: 13, fontFamily: 'Inter-Regular', fontSize: 14,
    color: Colors.neutral[900], backgroundColor: Colors.neutral[50],
  },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  roleOptionActive: { borderColor: Colors.primary[400], backgroundColor: Colors.primary[50] },
  roleOptionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center', alignItems: 'center',
  },
  roleOptionText: { flex: 1 },
  roleOptionLabel: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[800] },
  roleOptionLabelActive: { color: Colors.primary[700] },
  roleOptionDesc: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[500], marginTop: 2 },
  sendInviteBtn: {
    backgroundColor: Colors.primary[600], borderRadius: 12, padding: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.7 },
  sendInviteBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
});
