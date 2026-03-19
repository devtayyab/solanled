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
import { ArrowLeft, Check, X, Building2, Clock, ShieldCheck, ShieldAlert } from 'lucide-react-native';

interface CompanyApproval {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  phone?: string;
}

export default function AdminCompaniesScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === 'sloan_admin' || profile?.role === 'superadmin';

  const fetchCompanies = async () => {
    if (!isAdmin) return;
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

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Building2 size={24} color={Colors.primary[600]} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.companyName}>{item.name}</Text>
            <View style={styles.statusRow}>
              {item.status === 'pending' ? <Clock size={12} color={statusColor} /> : 
               item.status === 'approved' ? <ShieldCheck size={12} color={statusColor} /> :
               <ShieldAlert size={12} color={statusColor} />}
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.details}>
          <Text style={styles.dateText}>Registered: {new Date(item.created_at).toLocaleDateString()}</Text>
          {item.phone && <Text style={styles.dateText}>Phone: {item.phone}</Text>}
        </View>

        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => Alert.alert('Approve Company', `Are you sure you want to approve ${item.name}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Approve', onPress: () => handleUpdateStatus(item.id, 'approved') }
              ])}
            >
              <Check size={18} color="#fff" />
              <Text style={styles.btnText}>Approve</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => Alert.alert('Reject Company', `Are you sure you want to reject ${item.name}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reject', style: 'destructive', onPress: () => handleUpdateStatus(item.id, 'rejected') }
              ])}
            >
              <X size={18} color="#fff" />
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.neutral[700]} />
        </TouchableOpacity>
        <Text style={styles.title}>Company Approvals</Text>
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
  btnText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: Colors.neutral[400], fontFamily: 'Inter-Regular' },
});
