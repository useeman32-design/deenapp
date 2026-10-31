import { Platform } from 'react-native';
import { storage } from '@/lib/storage';
import { resolveLocation } from '@/lib/location';
import { computePrayerTimesWith, loadPrayerSettings, PRAYER_NAMES, type PrayerSettings } from '@/lib/prayer';

/**
 * pass 83-30 — ADHAN WHEN THE APP IS CLOSED.
 *
 * The prayer screen already rings the adhan in-app when a time enters. This
 * module extends that to the lock screen: it schedules LOCAL notifications
 * (expo-notifications date triggers, next 72h) on a MAX-importance "Adhan"
 * Android channel, so the phone rings even when DeenLink isn't open.
 *
 *  · Phone in use      → heads-up notification (MAX importance channel).
 *  · Phone idle/screen → sound + vibration; with USE_FULL_SCREEN_INTENT in the
 *    manifest Android can lift the adhan over the lock screen (full-draw-over
 *    needs the native channel tweak described in HANDOFF — the permission is
 *    already declared).
 *  · Tap               → opens the app on the prayer screen with the adhan
 *    modal up (data {type:'adhan', prayer}), where it can be turned off.
 *
 * Rescheduled on every app start and whenever prayer settings change. Never
 * throws — notifications must not take the app down.
 */

/**
 * pass 120 — one channel per recitation.
 *
 * An Android notification channel fixes its OWN sound, and it cannot be changed
 * after creation without re-creating the channel — so "which adhan plays when the
 * phone is locked" is expressed as which channel the alert is scheduled on, rather
 * than as a per-notification field Android ignores. The three channels map to
 * ADHAN_VOICES (lib/adhanPlayer), whose files the expo-notifications plugin copies
 * into the build (app.json → plugins → expo-notifications → sounds).
 */
/**
 * pass 120 — one channel per recitation.
 *
 * An Android notification channel fixes its OWN sound, and it cannot be changed
 * after creation without re-creating the channel — so "which adhan plays when the
 * phone is locked" is expressed as which channel the alert is scheduled on, rather
 * than as a per-notification field Android ignores. The three channels map to
 * ADHAN_VOICES (lib/adhanPlayer), whose files the expo-notifications plugin copies
 * into the build (app.json → plugins → expo-notifications → sounds).
 */
export const ADHAN_CHANNEL = 'adhan';
export const ADHAN_CHANNEL_BY_VOICE: Record<'v1' | 'v2' | 'v3', string> = {
  v1: 'adhan-v1',
  v2: 'adhan-v2',
  v3: 'adhan-v3',
};
/**
 * The channel sound is an Android RESOURCE NAME, not a file name.
 *
 * The plugin copies public/adhan/adhan1.mp3 to android/app/src/main/res/raw/
 * adhan1.mp3 (expo-notifications/plugin/build/withNotificationsAndroid.js:
 * writeNotificationSoundFile), and aapt then exposes it as R.raw.adhan1 — extension
 * stripped. Passing 'adhan1.mp3' would look up a resource that does not exist.
 * This is the same failure mode as the icon fonts in pass 116 (expo-font derives the
 * family from the filename minus extension): an identifier the platform computes from
 * a file name has to be written the way the platform computes it.
 */
const ADHAN_SOUND_BY_VOICE: Record<'v1' | 'v2' | 'v3', string> = {
  v1: 'adhan1',
  v2: 'adhan2',
  v3: 'adhan3',
};
const CHANNEL = ADHAN_CHANNEL;
const SCHED_KEY = 'dl.adhan.sched.v1';
const SKIP = 1; /* index of Sunrise — no adhan there (same rule as in-app) */

/*
 * pass 121 — Admin → System Settings → App Modules could hide the Prayer SCREEN
 * (maintenance.prayer, mapped in ROUTE_MODULE) and the whole app (master), but
 * the adhan kept ringing: the alerts are scheduled on the device, so they live
 * outside the React tree that the gate replaces. The owner's ask was "I can put
 * a certain module in maintenance from admin" — for a prayer app, a switch that
 * leaves the alarm firing is not control.
 *
 * Checked at schedule time, which runs on boot, on foreground and on every
 * settings change (adhanBoot, 10-minute throttle), so switching the module back
 * on restores the alerts with no reinstall. FAILS OPEN: if the flags cannot be
 * read, the adhan is scheduled anyway — muting prayer because of a network
 * failure is the worse error by a wide margin.
 */
async function adminPausedAdhan(): Promise<boolean> {
  try {
    const m = await import('@/lib/maintenance');
    const f = await m.maintenanceFlags();
    return m.isMasterMaintenance(f) || m.isUnderMaintenance(f, 'prayer');
  } catch {
    return false;
  }
}

async function cancelScheduled(): Promise<void> {
  const Notifications = await import('expo-notifications');
  try {
    const raw = await storage.getItem(SCHED_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  } catch { /* ignore */ }
  await storage.setItem(SCHED_KEY, '[]').catch(() => {});
}

/** Remove every scheduled adhan (used by the in-modal "Turn off"). */
/* pass 83-31 — "Test adhan notification": fires a REAL local notification on
 * the adhan channel a few seconds out, so the owner can watch the full
 * behaviour — heads-up in-app, draw-over/full-screen when locked or in a call
 * (with the config-plugin dev build). */
export async function scheduleAdhanTest(seconds = 5): Promise<boolean> {
  try {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      if (typeof Notification !== 'undefined') {
        try { if (Notification.permission === 'granted') new Notification("DeenLink — test adhan", { body: 'This is how the adhan alert will appear.' }); } catch {}
        return true;
      }
      return false;
    }
    const Notifications = (await import('expo-notifications')).default;
    const when = new Date(Date.now() + seconds * 1000);
    await Notifications.scheduleNotificationAsync({
      identifier: `adhan-test-${when.getTime()}`,
      content: {
        title: 'Test — adhan alert 🕌',
        body: 'This is exactly how the adhan alert will appear. Lock the screen or take a call to see draw-over.',
        sound: 'default',
        data: { type: 'adhan', prayer: 'Test' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: ADHAN_CHANNEL_BY_VOICE.v1 },
    });
    return true;
  } catch {
    return false;
  }
}

export async function requestAdhanPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const Notifications = await import('expo-notifications');
    let perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') perm = await Notifications.requestPermissionsAsync();
    return perm.status === 'granted';
  } catch {
    return false;
  }
}

export async function disableAdhanSchedule(): Promise<void> {
  if (Platform.OS === 'web') return;
  try { await cancelScheduled(); } catch { /* ignore */ }
}

/**
 * Rebuild the schedule from the saved prayer settings + location.
 * Call after permission is granted and whenever settings.adhan flips.
 */
export async function syncAdhanSchedule(settingsOverride?: PrayerSettings): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    const settings = settingsOverride ?? await loadPrayerSettings();
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
    } catch { /* foreground presentation is optional */ }
    await cancelScheduled();
    if (!settings.adhan) return;
    /* pass 121 — after the cancel, so "off" really clears the device schedule */
    if (await adminPausedAdhan()) return;

    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;

    if (Platform.OS === 'android') {
      /* pass 120 — build the channel for the SELECTED recitation and give it the
       * real adhan as its sound, so a locked phone rings the adhan instead of the
       * system chime. An Android channel fixes its own sound at creation, which is
       * why the voice is a channel choice rather than a per-notification field.
       * The legacy 'adhan' channel is deleted so an existing install cannot keep
       * routing alerts to the old soundless one. All three voice channels are
       * created so switching reciters needs no reinstall.
       *
       * If a bundled sound ever fails to resolve on a device, the fallback is the
       * single string 'default' below — the alert itself never depends on it. */
      try {
        await Notifications.deleteNotificationChannelAsync(CHANNEL).catch(() => {});
      } catch { /* ignore */ }
      for (const [id, label] of [
        ['v1', 'Adhan / prayer alerts · Adhan 1'],
        ['v2', 'Adhan / prayer alerts · Adhan 2'],
        ['v3', 'Adhan / prayer alerts · Adhan 3'],
      ] as const) {
        try {
          await Notifications.setNotificationChannelAsync(ADHAN_CHANNEL_BY_VOICE[id], {
            name: label,
            importance: Notifications.AndroidImportance.MAX,
            sound: ADHAN_SOUND_BY_VOICE[id] ?? 'default',
            vibrationPattern: [0, 400, 200, 400],
            lightColor: '#1D6F42',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        } catch { /* channel is optional — the alert still goes out */ }
      }
    }

    const loc = await resolveLocation();
    const ids: string[] = [];
    for (let dd = 0; dd < 3; dd++) {
      const day = new Date(Date.now() + dd * 86_400_000);
      const times = computePrayerTimesWith(day, loc, settings);
      for (let i = 0; i < times.length; i++) {
        if (i === SKIP) continue;
        const t = times[i];
        if (t.getTime() <= Date.now() + 30_000) continue;
        const name = PRAYER_NAMES[i];
        try {
          const id = await Notifications.scheduleNotificationAsync({
            identifier: `adhan-${name}-${t.getTime()}`,
            content: {
              title: `${name} — it's time 🕌`,
              body: `The time for ${name} has entered. ${loc.name ? `(${loc.name}) ` : ''}Tap to respond.`,
              sound: 'default',
                              data: { type: 'adhan', prayer: name, adhanVoice: settings.adhanVoice ?? 'v1' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: t,
              /* pass 120 — the channel carries the recitation the user picked */
              channelId:
                ADHAN_CHANNEL_BY_VOICE[(settings.adhanVoice ?? 'v1') as 'v1' | 'v2' | 'v3'] ?? CHANNEL,
            },
          });
          if (id) ids.push(id);
        } catch { /* one missed slot is fine */ }
      }
    }
    await storage.setItem(SCHED_KEY, JSON.stringify(ids)).catch(() => {});
  } catch {
    /* notifications are best-effort — never crash on them */
  }
}
