import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Image, TextInput, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { 
  ArrowLeft, Search, User, Shield, 
  Crown, Mail, Building2, UserX, UserCheck, RefreshCw
} from 'lucide-react-native';

const ALL_ROLES = [
  { id: 'installer', label: 'Installer', color: '#6B7280', requiresCompany: true },
  { id: 'signmaker', label: 'Signmaker', color: '#2563EB', requiresCompany: true },
  { id: 'admin', label: 'Company Admin', color: '#4F46E5', requiresCompany: true },
  { id: 'employee', label: 'Employee', color: '#6B7280', requiresCompany: true },
  { id: 'customer', label: 'Customer', color: '#10B981', requiresCompany: false },
  { id: 'superadmin', label: 'Super Admin', color: '#DC2626', requiresCompany: false },
];

interface PlatformUser {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  company_id: string | null;
  companies?: { name: string };
  is_active?: boolean;
}

export default function AdminUsersScreen() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [companies, setCompanies] = useState<{id: string, name: string}[]>([]);
  const [step, setStep] = useState<'role' | 'company'>('role');
  const [pendingRole, setPendingRole] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === 'superadmin';

  const fetchUsers = async () => {
    if (authLoading || !isSuperAdmin) return;
    setLoading(true);
    
    // Fetch all profiles and their associated company names
    const [profilesRes, companiesRes] = await Promise.all([
      supabase.from('profiles').select('*, companies(name)').order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name').order('name')
    ]);

    if (profilesRes.error) {
      Alert.alert('Error', profilesRes.error.message);
    } else {
      setUsers(profilesRes.data || []);
      setFilteredUsers(profilesRes.data || []);
    }

    if (companiesRes.error) {
      console.error('Error fetching companies:', companiesRes.error.message);
    } else {
      setCompanies(companiesRes.data || []);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    fetchUsers();
  }, []));

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setFilteredUsers(users);
      return;
    }
    const query = text.toLowerCase();
    const filtered = users.filter(u => 
      u.full_name?.toLowerCase().includes(query) || 
      (u.companies?.name || '').toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    // Note: We are assuming an 'is_active' column exists. 
    // If it doesn't, this will fail gracefully.
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !currentStatus })
      .eq('id', userId);

    if (error) {
      if (error.message.includes('is_active')) {
        Alert.alert(
          'Missing Database Field', 
          'The "is_active" column is missing in the profiles table. Please add it via SQL to use this feature.'
        );
      } else {
        Alert.alert('Error', error.message);
      }
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
      setFilteredUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers().finally(() => setRefreshing(false));
  }, []);

  const handleUpdateRole = async (newRole: string, companyId: string | null = null) => {
    if (!selectedUser) return;
    
    // Check if role requires company but none provided
    const roleInfo = ALL_ROLES.find(r => r.id === newRole);
    if (roleInfo?.requiresCompany && !companyId) {
      setPendingRole(newRole);
      setStep('company');
      return;
    }

    setUpdatingRole(true);
    
    const updates: any = { role: newRole };
    if (companyId !== undefined) {
      updates.company_id = companyId;
    } else if (!roleInfo?.requiresCompany) {
      updates.company_id = null; // Clear company for global roles
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', selectedUser.id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      // Re-fetch to get updated company names, or manually update
      await fetchUsers();
      setSelectedUser(null);
      setStep('role');
      setPendingRole(null);
    }
    setUpdatingRole(false);
  };

  const getRoleIcon = (role: string) => {
    if (role === 'superadmin') return Crown;
    if (role === 'signmaker' || role === 'admin') return Shield;
    return User;
  };

  const getRoleColor = (role: string) => {
    if (role === 'superadmin') return Colors.error[600];
    if (role === 'signmaker' || role === 'admin') return Colors.primary[600];
    return Colors.neutral[500];
  };

  const renderUser = ({ item }: { item: PlatformUser }) => {
    const RoleIcon = getRoleIcon(item.role);
    const isActive = item.is_active !== false;

    return (
      <View style={[styles.card, !isActive && styles.cardInactive]}>
        <View style={styles.cardMain}>
          <TouchableOpacity style={styles.avatarSection} onPress={() => setSelectedUser(item)}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: getRoleColor(item.role) }]}>
                <Text style={styles.avatarText}>{(item.full_name || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.info}>
            <TouchableOpacity onPress={() => setSelectedUser(item)}>
              <Text style={styles.userName}>{item.full_name || 'Unknown User'}</Text>
            </TouchableOpacity>
            <View style={styles.tagRow}>
              <TouchableOpacity 
                style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '15' }]}
                onPress={() => setSelectedUser(item)}
              >
                <RoleIcon size={10} color={getRoleColor(item.role)} />
                <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
                  {item.role.toUpperCase()}
                </Text>
              </TouchableOpacity>
              {!!item.companies?.name && (
                <View style={styles.companyBadge}>
                  <Building2 size={10} color={Colors.neutral[500]} />
                  <Text style={styles.companyText}>{item.companies.name}</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.statusBtn, isActive ? styles.deactivateBtn : styles.activateBtn]}
            onPress={() => toggleUserStatus(item.id, isActive)}
          >
            {isActive ? (
              <UserX size={18} color={Colors.error[600]} />
            ) : (
              <UserCheck size={18} color={Colors.success[600]} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </View>
    );
  }

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Access Denied</Text>
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
        <Text style={styles.title}>User Management</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.neutral[400]} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search by name, company, or role..."
            value={search}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          ) : null
        }
        ListFooterComponent={loading ? <ActivityIndicator color={Colors.primary[600]} style={{ margin: 20 }} /> : null}
      />
      <Modal 
        visible={!!selectedUser} 
        transparent 
        animationType="fade" 
        onRequestClose={() => {
          setSelectedUser(null);
          setStep('role');
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => {
            setSelectedUser(null);
            setStep('role');
          }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {step === 'role' ? (
              <>
                <Text style={styles.modalTitle}>Change User Role</Text>
                <Text style={styles.modalSubtitle}>Select new role for {selectedUser?.full_name}</Text>
                
                <View style={styles.roleGrid}>
                  {ALL_ROLES.map(role => (
                    <TouchableOpacity 
                      key={role.id} 
                      style={[styles.roleOption, selectedUser?.role === role.id && styles.selectedRole]}
                      onPress={() => handleUpdateRole(role.id)}
                      disabled={updatingRole}
                    >
                      <Text style={[styles.roleOptionText, { color: role.color }, selectedUser?.role === role.id && { color: '#fff' }]}>
                        {role.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Select Company</Text>
                <Text style={styles.modalSubtitle}>Assign {selectedUser?.full_name} to a company</Text>
                
                <FlatList
                  data={companies}
                  keyExtractor={item => item.id}
                  style={{ maxHeight: 300 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.companyOption}
                      onPress={() => handleUpdateRole(pendingRole!, item.id)}
                    >
                      <Text style={styles.companyOptionText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
                
                <TouchableOpacity style={[styles.cancelBtn, { marginTop: 10 }]} onPress={() => setStep('role')}>
                  <Text style={styles.cancelBtnText}>Back to Roles</Text>
                </TouchableOpacity>
              </>
            )}
            
            {updatingRole && (
              <ActivityIndicator style={{ marginTop: 15 }} color={Colors.primary[600]} />
            )}

            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => {
                setSelectedUser(null);
                setStep('role');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  title: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.neutral[900] },
  searchSection: { padding: 16, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.neutral[50], borderRadius: 12,
    paddingHorizontal: 15, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.neutral[200],
  },
  searchInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900] },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: Colors.neutral[100],
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardInactive: { opacity: 0.6, backgroundColor: Colors.neutral[100] },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatarSection: { marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 16 },
  avatarPlaceholder: { 
    width: 48, height: 48, borderRadius: 16, 
    justifyContent: 'center', alignItems: 'center' 
  },
  avatarText: { fontFamily: 'Inter-Bold', fontSize: 18, color: '#fff' },
  info: { flex: 1, gap: 4 },
  userName: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.neutral[900] },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  roleBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 4, 
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 
  },
  roleText: { fontFamily: 'Inter-Bold', fontSize: 10 },
  companyBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 4, 
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: Colors.neutral[100]
  },
  companyText: { fontFamily: 'Inter-Medium', fontSize: 10, color: Colors.neutral[600] },
  statusBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  deactivateBtn: { backgroundColor: Colors.error[50] },
  activateBtn: { backgroundColor: Colors.success[50] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: Colors.neutral[400], fontFamily: 'Inter-Regular' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  modalTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.neutral[900], marginBottom: 4 },
  modalSubtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[500], marginBottom: 20 },
  roleGrid: { gap: 8 },
  roleOption: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.neutral[200] },
  selectedRole: { backgroundColor: Colors.primary[600], borderColor: Colors.primary[600] },
  roleOptionText: { fontFamily: 'Inter-SemiBold', fontSize: 14, textAlign: 'center' },
  cancelBtn: { marginTop: 12, padding: 12, alignItems: 'center' },
  cancelBtnText: { fontFamily: 'Inter-Medium', fontSize: 14, color: Colors.neutral[500] },
  companyOption: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  companyOptionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.neutral[800],
  },
});
