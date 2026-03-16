import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';
import { t } from '../../lib/i18n';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1558223108-61138822455d?auto=format&fit=crop&q=80&w=1000' }}
        style={styles.bgImage}
      >
        <LinearGradient
          colors={['rgba(15, 32, 68, 0.4)', 'rgba(15, 32, 68, 0.9)', '#0F2044']}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>S</Text>
              </View>
              <Text style={styles.brandName}>SloanLED</Text>
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.title}>Powering Performance</Text>
              <Text style={styles.subtitle}>
                Complete field project management solution for SloanLED installers and managers.
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => router.push('/(auth)/login')}
              >
                <Text style={styles.loginBtnText}>{t('sign_in')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() => router.push('/(auth)/register')}
              >
                <Text style={styles.registerBtnText}>{t('register')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2026 SloanLED. All rights reserved.</Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgImage: { flex: 1 },
  gradient: { flex: 1, justifyContent: 'flex-end', padding: 24 },
  content: { width: '100%', paddingBottom: 40 },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    gap: 12,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  logoText: { fontFamily: 'Inter-Bold', fontSize: 24, color: '#fff' },
  brandName: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#fff',
    letterSpacing: 1,
  },
  textContainer: { marginBottom: 48 },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 42,
    color: '#fff',
    lineHeight: 48,
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 24,
    maxWidth: '90%',
  },
  buttonContainer: { gap: 16, marginBottom: 40 },
  loginBtn: {
    backgroundColor: Colors.primary[600],
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  loginBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  registerBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  registerBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
  },
  footer: { alignItems: 'center' },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
});
