import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors } from '../../constants/Colors';
import { ChevronDown } from 'lucide-react-native';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [language, setLanguage] = useState('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signUp } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signUp(email.trim(), password, fullName, companyName || undefined, language);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedLang = languages.find(l => l.code === language);

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

          <View style={styles.card}>
            <Text style={styles.title}>{t('sign_up')}</Text>
            <Text style={styles.subtitle}>Create your SloanLED account</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('full_name')}</Text>
              <TextInput
                style={styles.input}
                placeholder="John Smith"
                placeholderTextColor={Colors.neutral[400]}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('company_name')} <Text style={styles.optional}>{t('optional')}</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Acme Signs Ltd"
                placeholderTextColor={Colors.neutral[400]}
                value={companyName}
                onChangeText={setCompanyName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('language')}</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowLangPicker(!showLangPicker)}
              >
                <Text style={styles.selectorText}>{selectedLang?.label}</Text>
                <ChevronDown size={16} color={Colors.neutral[500]} />
              </TouchableOpacity>
              {showLangPicker && (
                <View style={styles.dropdown}>
                  {languages.map(lang => (
                    <TouchableOpacity
                      key={lang.code}
                      style={[styles.dropdownItem, language === lang.code && styles.dropdownItemActive]}
                      onPress={() => { setLanguage(lang.code); setShowLangPicker(false); }}
                    >
                      <Text style={[styles.dropdownText, language === lang.code && styles.dropdownTextActive]}>
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('sign_up')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('have_account')} </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.link}>{t('sign_in')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
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
  },
  title: { fontFamily: 'Inter-Bold', fontSize: 24, color: Colors.neutral[900], marginBottom: 4 },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[500], marginBottom: 20 },
  errorBox: {
    backgroundColor: Colors.error[50], borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: Colors.error[500],
  },
  errorText: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.error[600] },
  inputGroup: { marginBottom: 14 },
  label: { fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.neutral[700], marginBottom: 6 },
  optional: { color: Colors.neutral[400], fontFamily: 'Inter-Regular' },
  input: {
    borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: 12, padding: 14,
    fontFamily: 'Inter-Regular', fontSize: 15,
    color: Colors.neutral[900], backgroundColor: Colors.neutral[50],
  },
  selector: {
    borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.neutral[50],
  },
  selectorText: { fontFamily: 'Inter-Regular', fontSize: 15, color: Colors.neutral[900] },
  dropdown: {
    borderWidth: 1, borderColor: Colors.neutral[200],
    borderRadius: 12, marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: { padding: 12, backgroundColor: '#fff' },
  dropdownItemActive: { backgroundColor: Colors.primary[50] },
  dropdownText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[700] },
  dropdownTextActive: { fontFamily: 'Inter-SemiBold', color: Colors.primary[600] },
  button: {
    backgroundColor: Colors.primary[600], borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#fff' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[600] },
  link: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.primary[600] },
});
