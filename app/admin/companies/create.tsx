import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Colors } from '../../../constants/Colors';
import { ArrowLeft } from 'lucide-react-native';

export default function CreateCompanyScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Company name is required'); return; }
    
    setLoading(true);
    setError('');
    
    try {
      const { data, error: insertError } = await supabase
        .from('companies')
        .insert({
          name: name.trim(),
          address: address.trim(),
          country: country.trim(),
          phone: phone.trim(),
          status: 'approved' // Auto approve for superadmins
        })
        .select()
        .single();
        
      if (insertError) throw insertError;

      // Assign the superadmin to this company if they don't have one
      if (profile && !profile.company_id && data) {
        await supabase
          .from('profiles')
          .update({ company_id: data.id })
          .eq('id', profile.id);
      }

      Alert.alert('Success', 'Company created successfully');
      router.back();
    } catch (e: any) {
      setError(e.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={Colors.neutral[700]} />
          </TouchableOpacity>
          <Text style={styles.title}>Add New Company</Text>
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
              <Text style={styles.label}>Company Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. SloanLED Installations"
                placeholderTextColor={Colors.neutral[400]}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Full address"
                placeholderTextColor={Colors.neutral[400]}
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Country</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Germany"
                placeholderTextColor={Colors.neutral[400]}
                value={country}
                onChangeText={setCountry}
              />
            </View>
            
            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 234 567 890"
                placeholderTextColor={Colors.neutral[400]}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>
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
              <Text style={styles.submitText}>Create Company</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontFamily: 'Inter-SemiBold', fontSize: 17, color: Colors.neutral[900] },
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
