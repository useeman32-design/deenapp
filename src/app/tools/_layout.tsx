import { Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { isUnderMaintenance, maintenanceFlags, ROUTE_MODULE } from '@/lib/maintenance';

/* pass 83-39 — module on/off gate (owner: off = module under maintenance,
 * inaccessible in the app). ONE gate here covers every /tools/* screen; the
 * admin controls each module from System Settings → App Modules. */
export default function ToolsLayout() {
  const pathname = usePathname();
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    maintenanceFlags().then((flags) => {
      if (!alive) return;
      const seg = (pathname || '').split('/').filter(Boolean); // ['tools','quiz']
      const mod = ROUTE_MODULE[seg[1] ?? ''];
      setBlocked(mod && isUnderMaintenance(flags, mod) ? mod : null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <Stack screenOptions={{ headerShown: false }} />
      {blocked ? (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <TopBar showBack title="Under maintenance" />
          <View style={{ alignItems: 'center', marginTop: -40 }}>
            <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(245,124,0,0.12)', borderWidth: 1, borderColor: 'rgba(245,124,0,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <FontAwesome5 name="tools" size={26} color="#F57C00" />
            </View>
            <T v="h3" style={{ fontSize: 17, fontWeight: '800', textAlign: 'center' }}>Under maintenance</T>
            <T v="bodyS" style={{ fontSize: 13, lineHeight: 20, textAlign: 'center', opacity: 0.7, marginTop: 8 }}>
              This section is temporarily unavailable while we work on improvements. Please check back soon, in shaa Allah.
            </T>
          </View>
        </View>
      ) : null}
    </View>
  );
}
