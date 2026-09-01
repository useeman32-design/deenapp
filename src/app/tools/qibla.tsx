import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
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
import { QiblaLeaflet } from '@/components/QiblaLeaflet';
import { QiblaNativeSat } from '@/components/QiblaNativeSat';
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
  /* pass 39 — designs live behind a "Change compass" button → modal */
  const [designPicker, setDesignPicker] = useState(false);

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

        {/* pass 39 — one button opens the compass-style modal */}
        <Pressable
          accessibilityLabel="change compass"
          onPress={() => { haptic.selection(); setDesignPicker(true); }}
          style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1.5, borderColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.45)', backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.07)', paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <FontAwesome5 name="palette" size={11} color="#E8C96A" />
          <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#E8C96A' : '#8C6D1F' }}>Change compass</T>
          <FontAwesome5 name="chevron-right" size={9} color={isDark ? '#E8C96A' : '#8C6D1F'} />
        </Pressable>

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

      {/* pass 39 — the SAVED satellite map: first visit downloads it, every
       * visit after shows it instantly. No more offline fallback. */}
      <View style={{ paddingHorizontal: 18, marginTop: 18, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <KaabaIcon size={16} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5 }}>Direction to Makkah</T>
        </View>
        {Platform.OS === 'web' ? (
          <QiblaLeaflet userLoc={{ lat: loc.latitude, lon: loc.longitude }} userName={loc.name} distanceKm={km} height={196} />
        ) : (
          <QiblaNativeSat userLoc={{ lat: loc.latitude, lon: loc.longitude }} userName={loc.name} distanceKm={km} height={196} />
        )}
        <T v="caption" style={{ marginTop: 8, fontSize: 10, color: theme.subtext }}>
          {km.toFixed(0)} km from Makkah · satellite map saved on first view for offline use.
        </T>
      </View>
      </ScrollView>

      {/* pass 39 — compass designs, chosen in a modal */}
      <Modal visible={designPicker} transparent animationType="slide" onRequestClose={() => setDesignPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setDesignPicker(false)} />
          <View style={{ backgroundColor: theme.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: theme.border, padding: 18, paddingBottom: 28 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="palette" size={14} color="#E8C96A" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="h3" style={{ fontWeight: '900', fontSize: 16, color: theme.text }}>Compass style</T>
                <T v="caption" style={{ fontSize: 10, color: theme.subtext, marginTop: 1 }}>Pick a design — it is saved for next time</T>
              </View>
              <Pressable onPress={() => setDesignPicker(false)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.cardSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={theme.subtext} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {QIBLA_DESIGNS.map((ds) => {
                const on = design === ds.id;
                return (
                  <Pressable
                    key={ds.id}
                    accessibilityLabel={`compass design ${ds.label}`}
                    onPress={() => { pickDesign(ds.id); setDesignPicker(false); }}
                    style={{ width: '31%', aspectRatio: 1, borderRadius: 16, borderWidth: 1.5, borderColor: on ? (isDark ? '#4AE38F' : '#1D6F42') : theme.border, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.05)') : theme.background, alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ds.dot[0], borderWidth: 2.5, borderColor: ds.dot[1], alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <FontAwesome5 name="check" size={13} color="#FFFFFF" /> : null}
                    </View>
                    <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : theme.subtext }}>{ds.label}</T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
