import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { KAABA, distanceKm, qiblaDirection } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { angleDelta, useHeading } from '@/lib/useHeading';
import { Compass } from '@/components/Compass';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { RouteMap } from '@/components/RouteMap';
import { haptic } from '@/lib/haptics';

/**
 * Qibla finder (pass 18) — REAL compass:
 *  · live heading (magnetometer / device orientation, manual dial fallback)
 *  · the rose rotates with you; the gold Kaaba marker shows Makkah
 *  · aligned when you're within 3° — one success haptic per alignment
 */
export default function Qibla() {
  const { theme, isDark } = useTheme();
  const [loc, setLoc] = useState<Loc | null>(null);
  const heading = useHeading();
  const buzzedFor = useRef(false);

  useEffect(() => {
    resolveLocation().then(setLoc);
  }, []);

  if (!loc) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <T v="caption">Locating you…</T>
      </View>
    );
  }

  const bearing = qiblaDirection(loc);
  const km = distanceKm(loc, KAABA);
  const h = heading.corrected;
  const delta = h == null ? null : angleDelta(bearing, h);
  const aligned = delta != null && Math.abs(delta) <= 3;

  if (aligned && !buzzedFor.current) {
    buzzedFor.current = true;
    haptic.success();
  } else if (!aligned) {
    buzzedFor.current = false;
  }

  const turn = delta == null ? null : delta > 0 ? `Turn right ${Math.round(delta)}°` : `Turn left ${Math.round(-delta)}°`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Qibla finder" />
      <View style={{ alignItems: 'center', padding: 18, paddingTop: 10 }}>
        <T v="display" style={{ fontSize: 34, color: aligned ? theme.primary : theme.text }}>
          {h == null ? `${Math.round(bearing)}°` : `${Math.round((bearing + 360) % 360)}°`}
        </T>
        <T v="caption" style={{ marginTop: 3 }}>
          {h == null ? 'Qibla bearing from true North' : aligned ? 'You are facing the Qibla' : `Qibla · ${turn}`}
        </T>

        <View style={{ marginTop: 14 }}>
          <Compass bearing={bearing} heading={h} delta={delta} size={Math.min(280, 340)} />
        </View>

        {heading.needsPermission ? (
          <Pressable
            onPress={() => {
              haptic.selection();
              heading.requestPermission();
            }}
            style={{ marginTop: 14, borderRadius: 12, backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 10 }}
          >
            <T v="bodyS" style={{ color: '#fff', fontWeight: '800' }}>Allow motion sensors</T>
          </Pressable>
        ) : null}

        {h == null ? (
          <View style={{ marginTop: 12, alignItems: 'center', gap: 6 }}>
            <T v="caption" style={{ textAlign: 'center', lineHeight: 18, color: theme.subtext }}>
              No compass sensor detected. Align manually: point the top of your phone north (use the sun — it rises E, sets W), then dial until the phone heading matches:
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => { haptic.selection(); heading.setManualOffset(heading.manualOffset - 5); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="minus" size={13} color={theme.text} />
              </Pressable>
              <T v="h3">{((heading.manualOffset % 360) + 360) % 360}°</T>
              <Pressable onPress={() => { haptic.selection(); heading.setManualOffset(heading.manualOffset + 5); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.cardSoft, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="plus" size={13} color={theme.text} />
              </Pressable>
            </View>
            <T v="caption" style={{ fontSize: 10.5 }}>Phone heading: press − / + to swing the rose to north</T>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: aligned ? theme.primary : '#E8C96A' }} />
            <T v="caption">{aligned ? 'Aligned — face this way' : heading.source === 'magnetometer' ? 'Live compass — hold the phone flat, away from metal' : 'Live compass (browser sensors)'}</T>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 18, marginTop: 8 }}>
        <T v="h3" style={{ marginBottom: 10 }}>Direction to Makkah</T>
        <RouteMap distanceKm={km} fromName={loc.name} bearing={bearing} userLoc={{ lat: loc.latitude, lon: loc.longitude }} />
        <T v="caption" style={{ marginTop: 8, fontSize: 10.5, color: theme.subtext }}>
          {km.toFixed(0)} km from Makkah · for best accuracy keep the phone flat and away from magnets, metal and cases with magnetic clasps, then figure-8 it once.
        </T>
      </View>
    </View>
  );
}
