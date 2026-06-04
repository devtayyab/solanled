import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Image, ActivityIndicator, ImageBackground
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors } from '../../constants/Colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1558223108-61138822455d?auto=format&fit=crop&q=80&w=1000' }}
        style={styles.bgImage}
      >
        <LinearGradient colors={['rgba(15, 32, 68, 0.4)', 'rgba(15, 32, 68, 0.9)', '#0F2044']} style={styles.gradient}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/images/solanlogo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandSubtitle}>{t('welcome_subtitle')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{t('sign_in')}</Text>
            <Text style={styles.subtitle}>Welcome back to SloanLED</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('email')}</Text>
              <TextInput
                style={styles.input}
                placeholder="you@company.com"
                placeholderTextColor={Colors.neutral[400]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('password')}</Text>
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
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('sign_in')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('no_account')} </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.link}>{t('register')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </ImageBackground>
  </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgImage: { flex: 1 },
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoWrapper: {
    width: 260,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandSubtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', marginTop: 4 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 24,
    padding: 28, shadowColor: '#0A1628',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08, shadowRadius: 24, elevation: 6,
  },
  title: { fontFamily: 'Inter-Bold', fontSize: 26, color: Colors.neutral[900], marginBottom: 4 },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[500], marginBottom: 24 },
  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: Colors.error[500],
  },
  errorText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.error[600] },
  inputGroup: { marginBottom: 16 },
  label: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.neutral[700], marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: 12, padding: 14,
    fontFamily: 'Inter-Regular', fontSize: 15,
    color: Colors.neutral[900], backgroundColor: Colors.neutral[50],
  },
  button: {
    backgroundColor: Colors.primary[600], borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#fff' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[600] },
  link: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.primary[600] },
});
