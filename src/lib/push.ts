import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { registerPushToken } from '@/api/client';

/**
 * pass 49 — Expo mobile push.
 *  • initPushNotifications(): ask permission, fetch this device's Expo push
 *    token and register it with the backend (so push_notification() can deliver).
 *  • registerPushResponseHandler(): when a notification is tapped (from the
 *    status bar or in-app), deep-link into the right surface.
 * Push delivery only works in a dev/production build — not Expo Go.
 */

// Show the alert even when the app is in the foreground (native only).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function initPushNotifications(): Promise<void> {
  // Remote push needs a real device (emulators/Expo Go can't receive it).
  if (!Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1D6F42',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: projectId as string });
    const token = tokenData?.data;
    if (token) await registerPushToken(token, Platform.OS);
  } catch {
    /* push is best-effort — never block the app on it */
  }
}

/** Map a notification's payload to an in-app route and navigate there. */
function routeFromData(data: Record<string, unknown> | undefined): string {
  const type = (data?.type as string) ?? '';
  const entityType = (data?.entityType as string) ?? '';
  const entityId = data?.entityId as string | number | undefined;
  if (type === 'video' || entityType === 'video') return '/videos';
  if (type === 'article' || entityType === 'article') return entityId ? `/tools/article/${entityId}` : '/tools/articles';
  if (entityType === 'post' || type === 'post' || type === 'comment') return '/community';
  const url = data?.url as string | undefined;
  if (url) {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    if (path && path !== '/') return path;
  }
  return '/tools/notifications';
}

export function registerPushResponseHandler(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const target = routeFromData(data);
    try {
      router.push(target as never);
    } catch {
      try { router.push('/tools/notifications' as never); } catch { /* noop */ }
    }
  });
  return () => sub.remove();
}
