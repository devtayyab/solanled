import { Platform } from 'react-native';
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const { default: Notifications } = await import('expo-notifications');

    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    await supabase.from('push_tokens').upsert({
      user_id: userId,
      token,
      platform: Platform.OS as 'ios' | 'android',
    }, { onConflict: 'user_id,token' });

    return token;
  } catch {
    return null;
  }
}

export async function sendPushNotification(payload: {
  user_ids?: string[];
  company_id?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {}
}

export async function scheduleLocalNotification(title: string, body: string, data?: Record<string, any>) {
  if (Platform.OS === 'web') return;
  try {
    const { default: Notifications } = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data || {} },
      trigger: null,
    });
  } catch {}
}

export async function markNotificationRead(notificationId: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}
