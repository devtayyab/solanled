import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { CheckCircle2, UserPlus, Building2, Mail, XCircle } from 'lucide-react-native';

interface InviteData {
  id: string;
  company_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted: boolean;
  companies?: { name: string };
}

type ViewState = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted' | 'success' | 'need_register';

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setViewState('invalid'); return; }
    loadInvite();
  }, [token]);

  useEffect(() => {
    if (invite && user) {
      if (user.email.toLowerCase() === invite.email.toLowerCase()) {
        acceptInvite();
      } else {
        setError(`This invitation is for ${invite.email}. You're logged in as ${user.email}.`);
      }
    }
  }, [invite, user]);

  const loadInvite = async () => {
    const { data, error } = await supabase
      .from('company_invitations')
      .select('*, companies(name)')
      .eq('token', token)
      .maybeSingle();

    if (error || !data) { setViewState('invalid'); return; }
    if (data.accepted) { setViewState('accepted'); return; }
    if (new Date(data.expires_at) < new Date()) { setViewState('expired'); return; }

    setInvite(data);
    setEmail(data.email);
    setViewState(user ? 'loading' : 'valid');
  };

  const acceptInvite = async () => {
    if (!invite || !user) return;
    setProcessing(true);
    try {
      await supabase.from('profiles').update({
        company_id: invite.company_id,
        role: invite.role,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      await supabase.from('company_invitations').update({ accepted: true }).eq('id', invite.id);

      await refreshProfile();
      setViewState('success');
    } catch (e: any) {
      setError(e.message || 'Failed to accept invitation');
    } finally {
      setProcessing(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    if (invite && email.toLowerCase() !== invite.email.toLowerCase()) {
      setError(`This invitation is for ${invite.email}`);
      return;
    }
    setProcessing(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: any) {
      setError(e.message || 'Sign in failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName || !email || !password) { setError('Please fill in all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (invite && email.toLowerCase() !== invite.email.toLowerCase()) {
      setError(`This invitation is for ${invite.email}`);
      return;
    }
    setProcessing(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;

      if (data.user && invite) {
        await supabase.from('profiles').update({
          full_name: fullName,
          company_id: invite.company_id,
          role: invite.role,
          updated_at: new Date().toISOString(),
        }).eq('id', data.user.id);

        await supabase.from('company_invitations').update({ accepted: true }).eq('id', invite.id);
        await refreshProfile();
        setViewState('success');
      }
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0A1628', '#0F2044', '#162B52']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.brandName}>SloanLED</Text>
          </View>

          {viewState === 'loading' && (
            <View style={styles.card}>
              <ActivityIndicator color={Colors.primary[500]} size="large" />
              <Text style={styles.loadingText}>Verifying invitation...</Text>
            </View>
          )}

          {viewState === 'invalid' && (
            <View style={styles.card}>
              <View style={styles.statusIcon}>
                <XCircle size={40} color={Colors.error[500]} />
              </View>
              <Text style={styles.title}>Invalid Invitation</Text>
              <Text style={styles.subtitle}>This invitation link is not valid or does not exist.</Text>
              <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)')}>
                <Text style={styles.buttonText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {viewState === 'expired' && (
            <View style={styles.card}>
              <View style={styles.statusIcon}>
                <XCircle size={40} color={Colors.warning[500]} />
              </View>
              <Text style={styles.title}>Invitation Expired</Text>
              <Text style={styles.subtitle}>This invitation has expired. Please ask your admin to send a new one.</Text>
              <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)')}>
                <Text style={styles.buttonText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {viewState === 'accepted' && (
            <View style={styles.card}>
              <View style={styles.statusIcon}>
                <CheckCircle2 size={40} color={Colors.success[500]} />
              </View>
              <Text style={styles.title}>Already Accepted</Text>
              <Text style={styles.subtitle}>This invitation has already been accepted.</Text>
              <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.buttonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

          {viewState === 'success' && (
            <View style={styles.card}>
              <View style={styles.statusIcon}>
                <CheckCircle2 size={40} color={Colors.success[500]} />
              </View>
              <Text style={styles.title}>Welcome Aboard!</Text>
              <Text style={styles.subtitle}>
                You have successfully joined{invite?.companies?.name ? ` ${invite.companies.name}` : ' the team'} as {invite?.role}.
              </Text>
              <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
                <Text style={styles.buttonText}>Open App</Text>
              </TouchableOpacity>
            </View>
          )}

          {viewState === 'valid' && invite && (
            <View style={styles.card}>
              <View style={styles.inviteBanner}>
                <Building2 size={20} color={Colors.primary[600]} />
                <View style={styles.inviteBannerText}>
                  <Text style={styles.inviteCompany}>{invite.companies?.name || 'A company'}</Text>
                  <Text style={styles.inviteRole}>Invited as {invite.role}</Text>
                </View>
              </View>

              <Text style={styles.title}>Join Team</Text>
              <Text style={styles.subtitle}>Sign in or create a new account to accept this invitation.</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, viewState === 'valid' && styles.tabBtnActive]}
                  onPress={() => setViewState('valid')}
                >
                  <Text style={[styles.tabBtnText, viewState === 'valid' && styles.tabBtnTextActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, viewState === 'need_register' && styles.tabBtnActive]}
                  onPress={() => setViewState('need_register')}
                >
                  <Text style={[styles.tabBtnText, viewState === 'need_register' && styles.tabBtnTextActive]}>New Account</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.emailDisplay}>
                  <Mail size={14} color={Colors.neutral[500]} />
                  <Text style={styles.emailText}>{invite.email}</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.neutral[400]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.button, processing && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In & Join</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.switchLink} onPress={() => setViewState('need_register')}>
                <Text style={styles.switchText}>New to SloanLED? Create account</Text>
              </TouchableOpacity>
            </View>
          )}

          {viewState === 'need_register' && invite && (
            <View style={styles.card}>
              <View style={styles.inviteBanner}>
                <UserPlus size={20} color={Colors.primary[600]} />
                <View style={styles.inviteBannerText}>
                  <Text style={styles.inviteCompany}>{invite.companies?.name || 'A company'}</Text>
                  <Text style={styles.inviteRole}>Invited as {invite.role}</Text>
                </View>
              </View>

              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Create a new SloanLED account to join the team.</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, viewState === 'valid' && styles.tabBtnActive]}
                  onPress={() => setViewState('valid')}
                >
                  <Text style={[styles.tabBtnText, viewState === 'valid' && styles.tabBtnTextActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, viewState === 'need_register' && styles.tabBtnActive]}
                  onPress={() => setViewState('need_register')}
                >
                  <Text style={[styles.tabBtnText, viewState === 'need_register' && styles.tabBtnTextActive]}>New Account</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Smith"
                  placeholderTextColor={Colors.neutral[400]}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.emailDisplay}>
                  <Mail size={14} color={Colors.neutral[500]} />
                  <Text style={styles.emailText}>{invite.email}</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.neutral[400]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.button, processing && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account & Join</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    shadowColor: Colors.primary[500], shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  logoText: { fontFamily: 'Inter-Bold', fontSize: 28, color: '#fff' },
  brandName: { fontFamily: 'Inter-Bold', fontSize: 24, color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 24,
    padding: 28, shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3, shadowRadius: 40, elevation: 20,
    alignItems: 'stretch',
  },
  statusIcon: { alignItems: 'center', marginBottom: 16 },
  loadingText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[500], textAlign: 'center', marginTop: 12 },
  inviteBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.primary[50], borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.primary[100], marginBottom: 18,
  },
  inviteBannerText: { flex: 1 },
  inviteCompany: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.primary[800] },
  inviteRole: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.primary[600], marginTop: 1 },
  title: { fontFamily: 'Inter-Bold', fontSize: 22, color: Colors.neutral[900], marginBottom: 6, textAlign: 'center' },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[500], marginBottom: 20, textAlign: 'center', lineHeight: 20 },
  errorBox: {
    backgroundColor: Colors.error[50], borderRadius: 10, padding: 12,
    marginBottom: 14, borderLeftWidth: 3, borderLeftColor: Colors.error[500],
  },
  errorText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.error[600] },
  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.neutral[100],
    borderRadius: 10, padding: 4, marginBottom: 18,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.neutral[500] },
  tabBtnTextActive: { fontFamily: 'Inter-SemiBold', color: Colors.neutral[900] },
  inputGroup: { marginBottom: 14 },
  label: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.neutral[700], marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: 12, padding: 14,
    fontFamily: 'Inter-Regular', fontSize: 15,
    color: Colors.neutral[900], backgroundColor: Colors.neutral[50],
  },
  emailDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: 12, padding: 14,
    backgroundColor: Colors.neutral[100],
  },
  emailText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[600] },
  button: {
    backgroundColor: Colors.primary[600], borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 4,
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#fff' },
  switchLink: { alignItems: 'center', marginTop: 14 },
  switchText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.primary[600] },
});
