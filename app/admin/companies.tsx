import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { ArrowLeft, Check, X, Building2, Clock, ShieldCheck, ShieldAlert, Plus, RefreshCw } from 'lucide-react-native';

interface CompanyApproval {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  phone?: string;
}

export default function AdminCompaniesScreen() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === 'sloan_admin' || profile?.role === 'superadmin';

  const fetchCompanies = async () => {
    if (authLoading || !isAdmin) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setCompanies(data || []);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    fetchCompanies();
  }, []));

  const handleUpdateStatus = async (companyId: string, newStatus: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('companies')
      .update({ status: newStatus })
      .eq('id', companyId);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCompanies().finally(() => setRefreshing(false));
  }, []);

  const renderCompany = ({ item }: { item: CompanyApproval }) => {
    const statusColor = 
      item.status === 'approved' ? Colors.success[600] :
      item.status === 'rejected' ? Colors.error[600] :
      Colors.warning[600];

    const toggleActive = async (companyId: string, currentStatus: string) => {
      const newStatus = currentStatus === 'approved' ? 'rejected' : 'approved';
      const { error } = await supabase.from('companies').update({ status: newStatus }).eq('id', companyId);
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
      }
    };

    const handleDeleteCompany = async (companyId: string, companyName: string) => {
      Alert.alert(
        'Delete Company',
        `Are you sure you want to permanently delete ${companyName}? This will delete all associated projects and members.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive', 
            onPress: async () => {
              const { error } = await supabase.from('companies').delete().eq('id', companyId);
              if (error) {
                Alert.alert('Error', error.message);
              } else {
                setCompanies(prev => prev.filter(c => c.id !== companyId));
              }
            }
          }
        ]
      );
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Building2 size={24} color={Colors.primary[600]} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.companyName}>{item.name}</Text>
            <View style={styles.statusRow}>
              {item.status === 'pending' ? (
                <Clock size={12} color={statusColor} />
              ) : item.status === 'approved' ? (
                <ShieldCheck size={12} color={statusColor} />
              ) : (
                <ShieldAlert size={12} color={statusColor} />
              )}
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status === 'approved' ? 'Active' : item.status === 'rejected' ? 'Deactivated' : 'Pending'}
              </Text>
            </View>
          </View>
          {profile?.role === 'superadmin' && (
            <TouchableOpacity 
              style={styles.deleteCardBtn}
              onPress={() => handleDeleteCompany(item.id, item.name)}
            >
              <X size={16} color={Colors.error[500]} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.details}>
          <Text style={styles.dateText}>Registered: {new Date(item.created_at).toLocaleDateString()}</Text>
          {!!item.phone && <Text style={styles.dateText}>Phone: {item.phone}</Text>}
        </View>

        <View style={styles.actions}>
          {item.status === 'pending' ? (
            <View style={{flexDirection: 'row', gap: 8}}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleUpdateStatus(item.id, 'approved')}
              >
                <Check size={18} color="#fff" />
                <Text style={styles.btnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleUpdateStatus(item.id, 'rejected')}
              >
                <X size={18} color="#fff" />
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.actionBtn, item.status === 'approved' ? styles.deactivateBtn : styles.approveBtn]}
              onPress={() => toggleActive(item.id, item.status)}
            >
              <RefreshCw size={16} color="#fff" />
              <Text style={styles.btnText}>
                {item.status === 'approved' ? 'Deactivate' : 'Activate'}
              </Text>
            </TouchableOpacity>
          )}
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

  if (!isAdmin) {
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
        <Text style={[styles.title, { flex: 1 }]}>Company Approvals</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/admin/companies/create' as any)}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={companies}
        keyExtractor={item => item.id}
        renderItem={renderCompany}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No companies found</Text>
            </View>
          ) : null
        }
        ListFooterComponent={loading ? <ActivityIndicator color={Colors.primary[600]} style={{ margin: 20 }} /> : null}
      />
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
  createBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.neutral[900] },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.neutral[100],
  },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBox: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1 },
  companyName: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: Colors.neutral[900] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusText: { fontFamily: 'Inter-Medium', fontSize: 12 },
  details: { marginTop: 12, gap: 4 },
  dateText: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500] },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', 
    justifyContent: 'center', gap: 6, paddingVertical: 10, 
    borderRadius: 10,
  },
  approveBtn: { backgroundColor: Colors.success[600] },
  rejectBtn: { backgroundColor: Colors.error[600] },
  deactivateBtn: { backgroundColor: Colors.warning[600] },
  btnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: Colors.neutral[400], fontFamily: 'Inter-Regular' },
  deleteCardBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.neutral[50],
  },
});
