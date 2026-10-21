import { AppState, Platform, type AppStateStatus } from 'react-native';
import { syncAdhanSchedule } from '@/lib/adhanNotify';

/**
 * pass 107 — actually reschedule the adhan on every app start.
 *
 * THE DEFECT THIS FIXES. `adhanNotify.ts` documents itself as "Rescheduled on
 * every app start and whenever prayer settings change", but the only caller of
 * `syncAdhanSchedule()` in the whole app was `tools/prayer.tsx:124`, inside the
 * `if (granted)` branch that runs when the user taps to enable the adhan on the
 * Prayer screen. So:
 *
 *   · A user who enabled the adhan and then never opened the Prayer screen
 *     again got notifications for the scheduled window and then SILENCE. The
 *     schedule is built 3 days ahead (`for dd = 0..2`), so prayer alerts simply
 *     stopped on day 4, with nothing in the UI to say why.
 *   · The comment said otherwise, so the bug was invisible to anyone reading
 *     the code — including me, until I grepped for callers.
 *
 * This module makes the comment true. It is deliberately tiny and defensive:
 * `syncAdhanSchedule()` already returns early when the platform is web, when
 * `settings.adhan` is off, or when permission is not granted, so calling it
 * eagerly costs nothing for users who never turned the adhan on. It cancels the
 * old schedule and rebuilds it, so it is idempotent.
 *
 * Foreground resync matters too: an app left open for days (very common for a
 * Qur'an app kept on a tablet) would otherwise let its 3-day window lapse while
 * it was still running. The 10-minute throttle keeps that cheap.
 */

const THROTTLE_MS = 10 * 60 * 1000;
let lastSync = 0;
let started = false;

async function resync(reason: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const now = Date.now();
  if (now - lastSync < THROTTLE_MS) return;
  lastSync = now;
  try {
    await syncAdhanSchedule();
  } catch {
    /* Notifications must never take the app down. `syncAdhanSchedule` already
     * swallows its own errors; this is the belt to its braces, because a throw
     * here would surface as an unhandled rejection at boot. */
  }
}

/**
 * Call once from the root layout. Safe to call more than once — the `started`
 * guard means only the first call installs the AppState listener.
 * Returns an unsubscribe function so a caller can tear it down if it wants to.
 */
export function startAdhanBootSync(): () => void {
  if (Platform.OS === 'web') return () => {};
  if (started) return () => {};
  started = true;

  /* Boot resync. Not awaited — the app must not wait on notification scheduling
   * to become interactive, and location resolution can be slow on a cold start. */
  void resync('boot');

  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') void resync('foreground');
  });

  return () => {
    sub.remove();
    started = false;
  };
}
