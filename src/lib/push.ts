import { Platform } from 'react-native';
import { router } from 'expo-router';
import { registerPushToken, registerWebPushSubscription, webPushPublicKey } from '@/api/client';

/**
 * pass 51 — Expo mobile push, FULLY ISOLATED.
 *
 * The previous version imported `expo-notifications` at module scope and called
 * setNotificationHandler() during import. That meant any problem with the
 * notifications native module (missing config plugin, missing FCM setup) threw
 * while the root layout was loading — the app showed the splash logo and then
 * terminated. Notifications are a nice-to-have; they must never be able to take
 * down startup. So every access is now:
 *   · lazily imported INSIDE a try/catch (nothing runs at import time), and
 *   · best-effort: failures are swallowed, the app keeps running.
 */

/** Map a notification's payload to an in-app route. */
function routeFromData(data: Record<string, unknown> | undefined): string {
  const type = (data?.type as string) ?? '';
  const entityType = (data?.entityType as string) ?? '';
  const entityId = data?.entityId as string | number | undefined;
  if (type === 'question_received') return entityId ? `/tools/scholar-inbox?id=${entityId}` : '/tools/scholar-inbox';
  if (type === 'question_answered' || type === 'question_rejected' || type === 'question_message') return entityId ? `/tools/scholars?tab=mine&question_id=${entityId}` : '/tools/scholars?tab=mine';
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

function openTarget(data: Record<string, unknown> | undefined): void {
  try {
    router.push(routeFromData(data) as never);
  } catch {
    try { router.push('/tools/notifications' as never); } catch { /* noop */ }
  }
}

/** Convert the URL-safe base64 VAPID key returned by the API to the bytes
 * required by PushManager.subscribe(). */
function vapidBytes(raw: string): Uint8Array {
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function initWebPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  const key = await webPushPublicKey();
  if (!key) return; // The server explicitly reports web push as unconfigured.

  const path = window.location.pathname;
  const scope = path.startsWith('/deenapp/') || path === '/deenapp' ? '/deenapp/' : '/';
  const registration = await navigator.serviceWorker.register(`${scope}sw.js`, { scope });
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidBytes(key) as unknown as BufferSource,
    });
  }
  await registerWebPushSubscription(subscription.toJSON());
}

/**
 * Ask permission, fetch this device's push token and register it with the
 * backend. On the PWA this registers the service worker and the authenticated
 * Web Push subscription; on native it registers the Expo token. Safe to call on
 * every sign-in and never blocks app startup on a push failure.
 */
export async function initPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    try { await initWebPush(); } catch { /* push remains optional */ }
    return;
  }
  try {
    const [{ default: Device }, Notifications, Constants] = await Promise.all([
      import('expo-device'),
      import('expo-notifications'),
      import('expo-constants'),
    ]);
    if (!Device.isDevice) return; // remote push needs a real device

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch { /* handler is optional */ }

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1D6F42',
        });
      }
    } catch { /* channel setup is optional */ }

    let status = 'denied';
    try {
      const existing = await Notifications.getPermissionsAsync();
      status = existing.status;
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
    } catch { return; }
    if (status !== 'granted') return;

    const projectId =
      (Constants.default.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    if (token) await registerPushToken(token, Platform.OS);
  } catch {
    /* push is best-effort — never block or crash the app on it */
  }
}

/**
 * Subscribe to notification taps (status bar or in-app). Returns a cleanup
 * function synchronously so it can be used directly as a useEffect cleanup;
 * the subscription itself is established asynchronously and torn down safely.
 */
export function registerPushResponseHandler(): () => void {
  let remove: (() => void) | null = null;
  let cancelled = false;

  if (Platform.OS !== 'web') {
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
          openTarget(response.notification.request.content.data as Record<string, unknown> | undefined);
        });
        if (cancelled) { try { sub.remove(); } catch { /* noop */ } } else { remove = () => { try { sub.remove(); } catch { /* noop */ } }; }
      } catch { /* notifications unavailable — ignore */ }
    })();
  }

  return () => {
    cancelled = true;
    try { remove?.(); } catch { /* noop */ }
  };
}
