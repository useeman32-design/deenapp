import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { MaintenanceNotice } from '@/components/MaintenanceNotice';
import {
  maintenanceFlags,
  moduleLabel,
  isMasterMaintenance,
  isUnderMaintenance,
  moduleForPath,
  type MaintenanceFlags,
} from '@/lib/maintenance';

/**
 * pass 117/118 — the Admin panel's "App Modules" switches now reach the app.
 *
 * Before this, maintenance.* was only consulted inside /tools routes, so
 * switching a module off in Admin → System Settings left a signed-in user
 * staring at a working feed, reels or shop. This gate reads the same
 * settings/public.php document the web app uses and covers two cases:
 *
 *   · master on -> full-screen "under maintenance", the app UI never mounts
 *   · a module on -> that surface is replaced by a maintenance card with a
 *     "return to the feed" action, so the rest of the app keeps working
 *
 * Deliberate safety properties:
 *   · FAILS OPEN. maintenanceFlags() swallows network errors and returns {}, so
 *     a flaky connection can never lock a user out of their own account.
 *   · Home, profile and settings are not in the gateable map, so the gate can
 *     never remove the way back in.
 *   · Re-checked on foreground and every 60s: an admin flips a switch and the
 *     app follows without a reinstall.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [flags, setFlags] = useState<MaintenanceFlags | null>(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      maintenanceFlags()
        .then((f) => {
          if (alive) setFlags(f || {});
        })
        .catch(() => {});
    void check();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void check();
    });
    const iv = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(iv);
      sub.remove();
    };
    /* pass 121: maintenanceFlags() now honours a 60s TTL, so this poll can
     * actually observe an Admin change (it previously returned a pinned cache). */
  }, []);

  /* pass 122 — "Try again" must bypass the TTL, or it re-reads the cache and can
   * never report a change. Returns true while the block still applies so the
   * card can say so instead of silently doing nothing. */
  const retry = useCallback(async () => {
    const f = await maintenanceFlags({ force: true });
    setFlags(f || {});
    if (isMasterMaintenance(f)) return true;
    const mod = moduleForPath(pathname);
    return !!(mod && isUnderMaintenance(f, mod));
  }, [pathname]);

  if (!flags) return <>{children}</>;

  if (isMasterMaintenance(flags)) return <MaintenanceNotice variant="master" onRetry={retry} />;

  const mod = moduleForPath(pathname);
  const blocked = mod && isUnderMaintenance(flags, mod) ? mod : null;
  if (!blocked) return <>{children}</>;

  /* children are NOT rendered while a module is down: mounting them would keep
   * a reel's audio playing behind the card and hit an API the admin just
   * switched off. The explicit "return to the feed" action is what keeps this
   * from ever trapping anyone. */
  return <MaintenanceNotice variant="module" moduleName={moduleLabel(blocked)} onRetry={retry} />;
}
