import React, { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { FontAwesome5 } from '@expo/vector-icons';
import { maintenanceFlags, isMasterMaintenance } from '@/lib/maintenance';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';

/**
 * pass 117 — the admin panel's "App Modules" master switch now really closes
 * the app.
 *
 * Before this, maintenance.* flags were only consulted inside /tools routes, so
 * switching the whole app OFF in Admin → System Settings did nothing to a
 * signed-in user sitting on the feed. This gate reads the same public settings
 * document the web app uses, so one toggle now reflects everywhere:
 *
 *   · master on  -> full-screen "under maintenance" (no app UI, no audio)
 *   · master off -> children render untouched
 *
 * It fails OPEN: a network error never locks anyone out, matching maintenance.ts.
 * Re-checked on foreground so an admin can flip it while the app is open.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [down, setDown] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () =>
      maintenanceFlags()
        .then((f) => {
          if (alive) setDown(isMasterMaintenance(f));
        })
        .catch(() => {});
    void check();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        /* force a fresh read on resume so a toggle takes effect immediately */
        void maintenanceFlags().then((f) => alive && setDown(isMasterMaintenance(f))).catch(() => {});
      }
    });
    const iv = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(iv);
      sub.remove();
    };
  }, []);

  if (!down) return <>{children}</>;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <View
        style={{
          width: 78,
          height: 78,
          borderRadius: 39,
          backgroundColor: 'rgba(245,124,0,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(245,124,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        }}
      >
        <FontAwesome5 name="tools" size={28} color="#F57C00" />
      </View>
      <T v="h3" style={{ fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
        DeenLink is under maintenance
      </T>
      <T v="body" style={{ fontSize: 13.5, textAlign: 'center', opacity: 0.75, lineHeight: 21 }}>
        We are making improvements right now. Please check back in a little while — everything will be
        exactly where you left it.
      </T>
    </View>
  );
}
