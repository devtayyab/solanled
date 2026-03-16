import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { LayoutDashboard, FolderOpen, FileText, MessageCircle, Settings } from 'lucide-react-native';
import { View, ActivityIndicator } from 'react-native';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.dark.bg }}>
        <ActivityIndicator size="large" color={Colors.primary[400]} />
      </View>
    );
  }

  if (!user) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: Colors.neutral[100],
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: 8,
          height: 64,
        },
        tabBarActiveTintColor: Colors.primary[600],
        tabBarInactiveTintColor: Colors.neutral[400],
        tabBarLabelStyle: {
          fontFamily: 'Inter-Medium',
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, size }) => <FolderOpen size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Documents',
          tabBarIcon: ({ color, size }) => <FileText size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'AI Chat',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
