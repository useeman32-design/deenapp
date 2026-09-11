import { Platform } from 'react-native';
import { router } from 'expo-router';
import { registerPushToken } from '@/api/client';

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
  /* pass 83-30 — the lock-screen adhan notification opens the prayer screen
   * with the adhan modal up (?ring=<Prayer>), where it can be turned off. */
  if (type === 'adhan') return `/tools/prayer?ring=${encodeURIComponent(String(data?.prayer ?? ''))}`;
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

function openTarget(data: Record<string, unknown> | undefined): void {
  try {
    router.push(routeFromData(data) as never);
  } catch {
    try { router.push('/tools/notifications' as never); } catch { /* noop */ }
  }
}

/**
 * Ask permission, fetch this device's Expo push token and register it with the
 * backend. Safe to call on every sign-in; no-ops on web/emulators and on any
 * error.
 */
export async function initPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') { await initWebPush(); return; }
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

/* pass 83-30 — BROWSER PUSH. The server already sends VAPID web-push for
 * every event notification; this subscribes the browser so they actually
 * arrive. The service worker (public/sw.js) displays them and routes taps.
 * Permission is requested on the next user gesture (browser requirement). */
export async function initWebPush(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const { webPushPublicKey, webPushSubscribe, isLive } = await import('@/api/client');
    if (!isLive()) return;
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const ensureSub = async () => {
      if (Notification.permission !== 'granted') return;
      const key = await webPushPublicKey();
      if (!key) return;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await webPushSubscribe(sub.toJSON()).catch(() => {});
    };
    if (Notification.permission === 'granted') { await ensureSub(); return; }
    if (Notification.permission === 'denied') return;
    const ask = () => {
      window.removeEventListener('pointerdown', ask);
      void Notification.requestPermission().then((p) => { if (p === 'granted') void ensureSub(); }).catch(() => {});
    };
    window.addEventListener('pointerdown', ask, { once: true });
  } catch { /* web push is best-effort */ }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
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
        /* pass 83-30 — COLD START: app killed, adhan rang, user tapped it —
         * the tap listener below never fires for that launch, so replay the
         * last notification response once. */
        void Notifications.getLastNotificationResponseAsync().then((resp) => {
          const data = resp?.notification.request.content.data as Record<string, unknown> | undefined;
          if (data && (data.type === 'adhan' || data.entityType || data.type)) openTarget(data);
        }).catch(() => {});
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
