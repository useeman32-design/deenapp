import React, { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  maintenanceFlags,
  isMasterMaintenance,
  isUnderMaintenance,
  moduleForPath,
  type MaintenanceFlags,
} from '@/lib/maintenance';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';

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
const LABEL: Record<string, string> = {
  videos: 'Videos',
  quran: "Qur'an study",
  shop: 'Shop',
  chat: 'Community',
};

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { theme, isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
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
    /* maintenanceFlags() caches for the session; re-reading it is cheap. */
  }, []);

  if (!flags) return <>{children}</>;

  if (isMasterMaintenance(flags)) return <Screen dark={!!isDark} bg={theme.background} />;

  const mod = moduleForPath(pathname);
  const blocked = mod && isUnderMaintenance(flags, mod) ? mod : null;
  if (!blocked) return <>{children}</>;

  /* children are NOT rendered while a module is down: mounting them would keep
   * a reel's audio playing behind the card and hit an API the admin just
   * switched off. The explicit "return to the feed" action is what keeps this
   * from ever trapping anyone. */
  return <Screen dark={!!isDark} bg={theme.background} title={`${LABEL[blocked] ?? 'This area'} is under maintenance`} compact router={router} />;
}

function Screen({
  dark,
  bg,
  title = 'DeenLink is under maintenance',
  compact = false,
  router,
}: {
  dark: boolean;
  bg: string;
  title?: string;
  compact?: boolean;
  router?: ReturnType<typeof useRouter>;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 28, maxWidth: 420, backgroundColor: bg, flex: compact ? 1 : undefined }}>
      <View
        style={{
          width: compact ? 62 : 78,
          height: compact ? 62 : 78,
          borderRadius: compact ? 31 : 39,
          backgroundColor: 'rgba(245,124,0,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(245,124,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <FontAwesome5 name="tools" size={compact ? 22 : 28} color="#F57C00" />
      </View>
      <T v="h3" style={{ fontSize: compact ? 16 : 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
        {title}
      </T>
      <T v="body" style={{ fontSize: 13.5, textAlign: 'center', opacity: 0.75, lineHeight: 21 }}>
        {compact
          ? 'We have switched this area off for a short while to fix or improve it. Everything else in DeenLink still works.'
          : 'We are making improvements right now. Please check back in a little while — everything will be exactly where you left it.'}
      </T>
      {compact && router ? (
        <Pressable
          onPress={() => router.replace('/(tabs)' as never)}
          style={{
            marginTop: 18,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: dark ? '#4AE38F' : '#1D6F42',
          }}
        >
          <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: dark ? '#04170F' : '#FFFFFF' }}>
            Return to the feed
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}
