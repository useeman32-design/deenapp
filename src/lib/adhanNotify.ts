import { Platform } from 'react-native';
import { storage } from '@/lib/storage';
import { resolveLocation } from '@/lib/location';
import { computePrayerTimesWith, loadPrayerSettings, PRAYER_NAMES } from '@/lib/prayer';

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

const CHANNEL = 'adhan';
const SCHED_KEY = 'dl.adhan.sched.v1';
const SKIP = 1; /* index of Sunrise — no adhan there (same rule as in-app) */

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
export async function disableAdhanSchedule(): Promise<void> {
  if (Platform.OS === 'web') return;
  try { await cancelScheduled(); } catch { /* ignore */ }
}

/**
 * Rebuild the schedule from the saved prayer settings + location.
 * Call after permission is granted and whenever settings.adhan flips.
 */
export async function syncAdhanSchedule(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    const settings = await loadPrayerSettings();
    await cancelScheduled();
    if (!settings.adhan) return;

    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: 'Adhan / prayer alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 400, 200, 400],
          lightColor: '#1D6F42',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      } catch { /* channel is optional */ }
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
              data: { type: 'adhan', prayer: name },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t, channelId: CHANNEL },
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
