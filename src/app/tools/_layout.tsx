import { Stack, usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { MaintenanceNotice } from '@/components/MaintenanceNotice';
import {
  isUnderMaintenance,
  maintenanceFlags,
  moduleLabel,
  ROUTE_MODULE,
} from '@/lib/maintenance';

/* pass 83-39 — module on/off gate (owner: off = module under maintenance,
 * inaccessible in the app). ONE gate here covers every /tools/* screen; the
 * admin controls each module from System Settings → App Modules.
 *
 * pass 122 — the overlay used to render its own centered box with a <TopBar>
 * inside it, which (a) put the back button mid-screen over the copy — "the back
 * button hardly works" — and (b) had no way to re-check after an admin switched
 * the module back on. Both are now the shared MaintenanceNotice's job, and the
 * flags are re-read on foreground as well as on route change, so a user sitting
 * on a tools screen is not stuck until they navigate away. */

/** module key for the current /tools/<seg> route. */
function modFor(pathname: string | null | undefined): string | undefined {
  const seg = String(pathname || '').split('/').filter(Boolean);
  return ROUTE_MODULE[seg[1] ?? ''];
}

export default function ToolsLayout() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const d = theme.dash;
  const [blocked, setBlocked] = useState<string | null>(null);

  const check = useCallback(
    async (force = false) => {
      const flags = await maintenanceFlags({ force }).catch(() => null);
      if (!flags) return false;
      const mod = modFor(pathname);
      const down = !!(mod && isUnderMaintenance(flags, mod));
      setBlocked(down ? (mod as string) : null);
      return down;
    },
    [pathname],
  );

  useEffect(() => {
    let alive = true;
    void (async () => { if (alive) await check(); })();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check(true);
    });
    return () => { alive = false; sub.remove(); };
  }, [check]);

  const retry = useCallback(async () => check(true), [check]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <Stack screenOptions={{ headerShown: false }} />
      {blocked ? (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: d.bg }}>
          <MaintenanceNotice variant="module" palette="dash" moduleName={moduleLabel(blocked)} bg={d.bg} onRetry={retry} />
        </View>
      ) : null}
    </View>
  );
}
