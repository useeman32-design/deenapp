import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { KAABA, distanceKm, qiblaDirection } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { angleDelta, useHeading } from '@/lib/useHeading';
import { Compass, QIBLA_DESIGNS, type QiblaDesign } from '@/components/Compass';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { RouteMap } from '@/components/RouteMap';
import { KaabaIcon } from '@/components/Icons';
import { QiblaMap } from '@/components/QiblaMap';
import { QiblaLeaflet } from '@/components/QiblaLeaflet';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { ScrollView } from 'react-native';

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
  /* pass 38 — selectable compass design (persisted) + offline map toggle */
  const [design, setDesign] = useState<QiblaDesign>('classic');
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    resolveLocation().then(setLoc);
    storage.getItem('dl.qibla.design').then((r) => {
      const v = r as QiblaDesign | null;
      if (v && QIBLA_DESIGNS.some((x) => x.id === v)) setDesign(v);
    }).catch(() => {});
  }, []);
  const pickDesign = (id: QiblaDesign) => {
    haptic.selection();
    setDesign(id);
    storage.setItem('dl.qibla.design', id).catch(() => {});
  };

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
      <TopBar title="Qibla finder" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: 'center', padding: 18, paddingTop: 10 }}>
        <T v="display" style={{ fontSize: 34, color: aligned ? theme.primary : theme.text }}>
          {h == null ? `${Math.round(bearing)}°` : `${Math.round((bearing + 360) % 360)}°`}
        </T>
        <T v="caption" style={{ marginTop: 3 }}>
          {h == null ? 'Qibla bearing from true North' : aligned ? 'You are facing the Qibla' : `Qibla · ${turn}`}
        </T>

        {/* pass 38 — user location pill */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, borderRadius: 999, backgroundColor: isDark ? 'rgba(74,227,143,0.1)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.22)', paddingHorizontal: 12, paddingVertical: 6 }}>
          <FontAwesome5 name="map-marker-alt" size={10} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{loc.name || 'Your location'} · {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°</T>
        </View>

        <View style={{ marginTop: 12 }}>
          <Compass bearing={bearing} heading={h} delta={delta} size={252} design={design} />
        </View>

        {/* pass 38 — compass design picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 14, paddingHorizontal: 2 }}>
          {QIBLA_DESIGNS.map((ds) => {
            const on = design === ds.id;
            return (
              <Pressable
                key={ds.id}
                accessibilityLabel={`compass design ${ds.label}`}
                onPress={() => pickDesign(ds.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1.5, borderColor: on ? (isDark ? '#4AE38F' : '#1D6F42') : theme.border, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.06)') : theme.card, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: ds.dot[0], borderWidth: 1.5, borderColor: ds.dot[1] }} />
                <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : theme.subtext }}>{ds.label}</T>
              </Pressable>
            );
          })}
        </ScrollView>

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

      {/* pass 38 — map raised & compact; offline world view behind a chip */}
      <View style={{ paddingHorizontal: 18, marginTop: 18, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <KaabaIcon size={16} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5 }}>Direction to Makkah</T>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => { haptic.selection(); setShowOffline((v) => !v); }} style={{ borderRadius: 999, borderWidth: 1, borderColor: showOffline ? 'rgba(212,175,55,0.5)' : theme.border, backgroundColor: showOffline ? 'rgba(212,175,55,0.1)' : theme.card, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: showOffline ? '#B8870B' : theme.subtext }}>{showOffline ? 'Live map' : 'Offline map'}</T>
          </Pressable>
        </View>
        {showOffline ? (
          <QiblaMap userLoc={{ lat: loc.latitude, lon: loc.longitude }} userName={loc.name} distanceKm={km} bearing={bearing} />
        ) : (
          /* pass 33: live Leaflet map — your location → the Kaaba, great-circle line */
          <QiblaLeaflet userLoc={{ lat: loc.latitude, lon: loc.longitude }} userName={loc.name} distanceKm={km} height={168} />
        )}
        <T v="caption" style={{ marginTop: 8, fontSize: 10, color: theme.subtext }}>
          {km.toFixed(0)} km from Makkah · keep the phone flat, away from metal, then figure-8 it once.
        </T>
      </View>
      </ScrollView>
    </View>
  );
}
