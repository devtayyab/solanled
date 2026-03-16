import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)');
      }
    }
  }, [user, loading]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.dark.bg }}>
      <ActivityIndicator size="large" color={Colors.primary[400]} />
    </View>
  );
}
