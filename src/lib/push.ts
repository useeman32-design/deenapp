import { Platform } from 'react-native';
import { router } from 'expo-router';
import { registerPushToken, registerWebPushSubscription, webPushPublicKey } from '@/api/client';
import Constants from 'expo-constants';
import { storage } from '@/lib/storage';

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

const TOKEN_KEY = 'dl.push.token.v1';
const REGISTERED_KEY = 'dl.push.registered.v1';
const ERROR_KEY = 'dl.push.error.v1';

/**
 * pass 119 — an HONEST status surface, because "the app never notifies me" was
 * undiagnosable: every notification call is wrapped in a catch that swallows the
 * reason, and the reason (no Firebase google-services.json in the build) was
 * therefore invisible. `pushStatus()` exposes it to Settings → Notifications,
 * which now states what is and is not delivered and lets the user prove the chain
 * with a real test push.
 */
export type PushStatus = {
  /** android: google-services.json was present at build time · ios: n/a (APNs) */
  fcmConfigured: boolean;
  /** the OS-level permission for notifications */
  permission: 'granted' | 'denied' | 'undetermined' | 'unsupported' | string;
  token: string | null;
  /** the server accepted a token for this device for the signed-in user */
  registered: boolean;
  /** why the last registration failed, if it did */
  error: string | null;
  /** what the user can actually expect right now */
  delivery: 'push+in-app' | 'in-app only' | 'none';
};

let lastError: string | null = null;
let lastStatus: PushStatus = {
  fcmConfigured: false,
  permission: 'undetermined',
  token: null,
  registered: false,
  error: null,
  delivery: 'in-app only',
};

export function pushStatus(): PushStatus {
  return { ...lastStatus };
}

/** Re-read permission + stored token/error. Cheap; safe to call on every open. */
export async function refreshPushStatus(): Promise<PushStatus> {
  const cfg = (Constants.default.expoConfig ?? {}) as {
    android?: { googleServicesFile?: string };
    extra?: { push?: { fcmConfigured?: boolean } };
  };
  const fcmConfigured =
    Platform.OS === 'ios' || Platform.OS === 'web'
      ? Platform.OS !== 'web'
      : Boolean(cfg.android?.googleServicesFile || cfg.extra?.push?.fcmConfigured);
  let permission: string = 'unsupported';
  if (Platform.OS !== 'web') {
    try {
      const Notifications = await import('expo-notifications');
      const p = await Notifications.getPermissionsAsync();
      permission = p.status ?? 'undetermined';
    } catch (e) {
      permission = 'unavailable';
      lastError = String((e as { message?: string })?.message ?? e).slice(0, 300);
    }
  } else {
    try {
      permission =
        typeof window !== 'undefined' && 'Notification' in window
          ? (window as unknown as { Notification: { permission: string } }).Notification.permission
          : 'unsupported';
    } catch {
      permission = 'unsupported';
    }
  }
  const token = (await storage.getItem(TOKEN_KEY).catch(() => null)) || null;
  const registered = ((await storage.getItem(REGISTERED_KEY).catch(() => null)) === '1') && !!token;
  const storedErr = await storage.getItem(ERROR_KEY).catch(() => null);
  lastStatus = {
    fcmConfigured: Boolean(fcmConfigured),
    permission,
    token,
    registered,
    error: lastError ?? storedErr ?? null,
    delivery: permission !== 'granted' ? 'none' : fcmConfigured && registered ? 'push+in-app' : 'in-app only',
  };
  return { ...lastStatus };
}

/** Ask the OS for permission (Android 13+ POST_NOTIFICATIONS / iOS alert). */
export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      const w = window as unknown as { Notification?: { requestPermission?: () => Promise<string> } };
      const res = await w.Notification?.requestPermission?.();
      return res === 'granted';
    } catch {
      return false;
    }
  }
  try {
    const Notifications = await import('expo-notifications');
    const r = await Notifications.requestPermissionsAsync();
    await refreshPushStatus();
    return r.status === 'granted';
  } catch {
    return false;
  }
}

/** Map a notification's payload to an in-app route. */
function routeFromData(data: Record<string, unknown> | undefined): string {
  const type = (data?.type as string) ?? '';
  const entityType = (data?.entityType as string) ?? '';
  const entityId = data?.entityId as string | number | undefined;
  if (type === 'question_received') return entityId ? `/tools/scholar-inbox?id=${entityId}` : '/tools/scholar-inbox';
  if (type === 'question_answered' || type === 'question_rejected' || type === 'question_message') return entityId ? `/tools/scholars?tab=mine&question_id=${entityId}` : '/tools/scholars?tab=mine';
  if (type === 'adhan') {
    const prayer = encodeURIComponent(String(data?.prayer ?? ''));
    return `/tools/prayer?adhan=${prayer}`;
  }
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
        handleNotification: async (n) => ({
          /* pass 120 — the adhan channel now carries a real recitation, and an
           * in-app alert ALSO starts adhanPlayer. Playing both would overlap, so
           * the foreground banner is silent for adhan payloads; everything else
           * (replies, likes, messages) keeps its normal sound. */
          shouldPlaySound: (n?.request?.content?.data as { type?: string } | undefined)?.type !== 'adhan',
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
if (!projectId) {
lastError = 'No EAS projectId in the app config — Expo cannot issue a push token.';
return;
}

          const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
const token = tokenData?.data;
if (token) {
await storage.setItem(TOKEN_KEY, token).catch(() => {});
await registerPushToken(token, Platform.OS);
await storage.setItem(REGISTERED_KEY, '1').catch(() => {});
lastError = null;
}
} catch (e) {
/* pass 119 — still best-effort (never crash startup), but NO LONGER
 * silent: the reason is kept where the Settings screen can show it. The
 * usual Android reason is "Credentials are invalid / missing
 * google-services.json", i.e. Firebase was never wired into this build. */
lastError = String((e as { message?: string })?.message ?? e).slice(0, 300);
await storage.setItem(ERROR_KEY, lastError).catch(() => {});
}
}

/**
 * Subscribe to notification taps and native adhan delivery. Returns a cleanup
 * function synchronously so it can be used directly as a useEffect cleanup;
 * the subscription itself is established asynchronously and torn down safely.
 */
export function registerPushResponseHandler(): () => void {
  let remove: (() => void) | null = null;
  let removeReceived: (() => void) | null = null;
  let cancelled = false;

  if (Platform.OS !== 'web') {
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
          openTarget(response.notification.request.content.data as Record<string, unknown> | undefined);
        });
        const received = Notifications.addNotificationReceivedListener((notification) => {
          const data = notification.request.content.data as Record<string, unknown> | undefined;
          if (data?.type !== 'adhan') return;
          /* The native alert uses the platform default notification sound. When
           * the process is already alive, also start the app's default adhan
           * player so the in-app experience is not limited to a short alert. */
          import('@/lib/adhanPlayer').then(({ playAdhan }) => playAdhan('v1')).catch(() => {});
        });
        if (cancelled) {
          try { sub.remove(); } catch { /* noop */ }
          try { received.remove(); } catch { /* noop */ }
        } else {
          remove = () => { try { sub.remove(); } catch { /* noop */ } };
          removeReceived = () => { try { received.remove(); } catch { /* noop */ } };
        }
      } catch { /* notifications unavailable — ignore */ }
    })();
  }

  return () => {
    cancelled = true;
    try { remove?.(); } catch { /* noop */ }
    try { removeReceived?.(); } catch { /* noop */ }
  };
}
