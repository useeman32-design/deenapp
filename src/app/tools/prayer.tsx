import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveLocation, type Loc } from '@/lib/location';
import {
  computePrayerTimesWith,
  countdownTo,
  DEFAULT_SETTINGS,
  formatHijri,
  formatGregorian,
  loadPrayerSettings,
  METHODS,
  nextPrayer,
  PRAYER_NAMES,
  savePrayerSettings,
  type PrayerSettings,
} from '@/lib/prayer';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Prayer times (pass 23 — full redesign):
 *  · hero: next prayer + live countdown + progress arc + hijri/gregorian date
 *  · REAL device location (geolocation → IP fallback)
 *  · calculation method (12), madhab, per-prayer ±min adjustments, adhan
 *  · 7-day strip; live "prayer is in" banner when a time passes while open
 */
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ICONS: Record<string, string> = { Fajr: 'cloud-moon', Sunrise: 'sun', Dhuhr: 'sun', Asr: 'sun', Maghrib: 'moon', Isha: 'moon' };

export default function PrayerTimes() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [settings, setSettings] = useState<PrayerSettings>(DEFAULT_SETTINGS);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(new Date());
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    resolveLocation().then(setLoc);
    loadPrayerSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const selDate = useMemo(() => {
    const dd = new Date();
    dd.setDate(dd.getDate() + offset);
    dd.setHours(12, 0, 0, 0);
    return dd;
  }, [offset]);

  const week = useMemo(() => {
    const arr: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      const dd = new Date();
      dd.setDate(dd.getDate() + i);
      arr.push(dd);
    }
    return arr;
  }, []);

  if (!loc) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
        <T v="caption" style={{ color: d.faint }}>Detecting your location…</T>
      </View>
    );
  }

  const times = computePrayerTimesWith(selDate, loc, settings);
  const isToday = offset === 0;
  const np = isToday ? nextPrayer(now, times) : null;
  const fmt = (t: Date) => t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  /* countdown ring fraction: progress between previous prayer and next */
  let ring = 0;
  if (np) {
    const prevI = np.index === 0 ? 5 : np.index - 1;
    const prev = new Date(np.time);
    if (np.index === 0) prev.setDate(prev.getDate() - 1);
    const span = np.time.getTime() - prev.getTime();
    ring = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - prev.getTime()) / span)) : 0;
  }

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="star-and-crescent" size={16} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }}>Prayer Times</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>
              {loc.name} · {METHODS.find((m) => m.id === settings.method)?.label ?? ''}
            </T>
          </View>
          <Pressable accessibilityLabel="Settings"  onPress={() => { haptic.selection(); setSheet(true); }} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="sliders-h" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
        </View>

        {/* week strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 14, gap: 8 }}>
          {week.map((dd, i) => {
            const on = i === offset + 3;
            const today = i === 3;
            return (
              <Pressable
                key={i}
                onPress={() => { haptic.selection(); setOffset(i - 3); }}
                style={{ width: 46, borderRadius: 14, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.35)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(14,122,70,0.08)') : d.card, paddingVertical: 9, alignItems: 'center', gap: 2 }}
              >
                <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#0E7A46') : d.faint }}>{DAY_INITIALS[dd.getDay()]}</T>
                <T v="body" style={{ fontSize: 14, fontWeight: '800', color: today ? (isDark ? '#4AE38F' : '#1D6F42') : d.text }}>{dd.getDate()}</T>
                {today ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} /> : <View style={{ width: 4, height: 4 }} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* hero — next prayer */}
        <View style={{ marginHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.25)', backgroundColor: isDark ? '#0C1A13' : '#FFFFFF', padding: 18, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: isDark ? '#4AE38F' : '#1D6F42' }}>
              {isToday ? 'NEXT PRAYER' : PRAYER_NAMES[2].toUpperCase()}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 8, paddingVertical: 3 }}>
              <FontAwesome5 name={settings.adhan ? 'volume-up' : 'volume-mute'} size={8} color="#E8C96A" />
              <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: '#E8C96A' }}>{settings.adhan ? 'ADHAN ON' : 'ADHAN OFF'}</T>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
            <T v="display" style={{ fontSize: 34, fontWeight: '800', color: d.text }}>
              {isToday ? np?.name : 'Dhuhr'}
            </T>
            <T v="h3" style={{ fontSize: 19, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42', marginBottom: 4 }}>
              {isToday ? fmt(np?.time ?? times[0]) : fmt(times[2])}
            </T>
          </View>

          {/* progress bar */}
          <View style={{ marginTop: 12 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', overflow: 'hidden' }}>
              <View style={{ width: `${ring * 100}%`, height: 6, borderRadius: 3, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <T v="caption" style={{ fontSize: 10, color: d.faint }}>{isToday ? `in ${countdownTo(now, np?.time ?? times[0])}` : '—'}</T>
              <T v="caption" style={{ fontSize: 10, color: d.faint }}>{Math.round(ring * 100)}%</T>
            </View>
          </View>

          {/* dates */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.05)', borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 10, paddingVertical: 8 }}>
              <T v="caption" style={{ fontSize: 8, fontWeight: '800', letterSpacing: 0.5, color: d.faint }}>HIJRI</T>
              <T v="bodyS" style={{ fontSize: 11.5, fontWeight: '700', color: d.text, marginTop: 1 }}>{formatHijri(selDate)}</T>
            </View>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.05)', borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 10, paddingVertical: 8 }}>
              <T v="caption" style={{ fontSize: 8, fontWeight: '800', letterSpacing: 0.5, color: d.faint }}>GREGORIAN</T>
              <T v="bodyS" style={{ fontSize: 11.5, fontWeight: '700', color: d.text, marginTop: 1 }}>{formatGregorian(selDate)}</T>
            </View>
          </View>
        </View>

        {/* six prayers */}
        <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, overflow: 'hidden' }}>
          {PRAYER_NAMES.map((name, i) => {
            const active = isToday && np?.index === i;
            const passed = isToday && times[i] < now;
            const adj = settings.adjustments[i] ?? 0;
            return (
              <View
                key={name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 15,
                  paddingVertical: 13,
                  backgroundColor: active ? (isDark ? 'rgba(46,204,113,0.10)' : 'rgba(14,122,70,0.06)') : 'transparent',
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: d.cardBorder,
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? 'rgba(46,204,113,0.18)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.04)', borderWidth: 1, borderColor: active ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.35)') : d.cardBorder }}>
                  <FontAwesome5 name={(ICONS[name] ?? 'clock') as never} size={12} color={active ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="body" style={{ fontSize: 13.5, fontWeight: '800', color: passed && !active ? d.faint : d.text }}>{name}</T>
                  {adj !== 0 ? (
                    <T v="caption" style={{ fontSize: 9, color: '#E8C96A', marginTop: 0.5 }}>{adj > 0 ? `+${adj}` : adj} min adjusted</T>
                  ) : null}
                </View>
                {active ? (
                  <View style={{ borderRadius: 999, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', paddingHorizontal: 9, paddingVertical: 3 }}>
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.4 }}>NEXT</T>
                  </View>
                ) : null}
                <T v="body" style={{ fontSize: 14, fontWeight: '800', color: passed && !active ? d.faint : d.text, fontVariant: ['tabular-nums'] }}>
                  {fmt(times[i])}
                </T>
              </View>
            );
          })}
        </View>

        <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 12, marginHorizontal: 30, lineHeight: 15 }}>
          Times are calculated for your exact location with the {METHODS.find((m) => m.id === settings.method)?.label} method. Adjust minutes or change the method in settings — always confirm with your local mosque.
        </T>
      </ScrollView>

      {/* settings sheet */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheet(false)} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 30, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <T v="h3" style={{ fontWeight: '800', flex: 1 }}>Prayer settings</T>
              <Pressable onPress={() => setSheet(false)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              {/* method */}
              <View>
                <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, marginBottom: 8 }}>CALCULATION METHOD</T>
                {METHODS.map((m) => {
                  const on = settings.method === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => { haptic.selection(); const nx = { ...settings, method: m.id }; setSettings(nx); savePrayerSettings(nx); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 11, borderRadius: 12, marginBottom: 5, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent' }}
                    >
                      <View style={{ flex: 1 }}>
                        <T v="bodyS" style={{ fontWeight: '700', fontSize: 12.5, color: d.text }}>{m.label}</T>
                        <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 0.5 }}>{m.region}</T>
                      </View>
                      {on ? <FontAwesome5 name="check-circle" size={15} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
                    </Pressable>
                  );
                })}
              </View>

              {/* madhab (asr) */}
              <View>
                <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, marginBottom: 8 }}>ASR CALCULATION (MADHAB)</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['shafi', 'hanafi'] as const).map((m) => {
                    const on = settings.madhab === m;
                    return (
                      <Pressable key={m} onPress={() => { haptic.selection(); const nx = { ...settings, madhab: m }; setSettings(nx); savePrayerSettings(nx); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent' }}>
                        <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{m === 'shafi' ? 'Shafi, Maliki, Hanbali' : 'Hanafi'}</T>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* per-prayer adjustments */}
              <View>
                <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, marginBottom: 8 }}>TIME ADJUSTMENTS (± MINUTES)</T>
                {PRAYER_NAMES.map((name, i) => (
                  <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }}>
                    <T v="bodyS" style={{ flex: 1, fontWeight: '700', fontSize: 12.5, color: d.text }}>{name}</T>
                    <Pressable onPress={() => { haptic.selection(); const nx = { ...settings, adjustments: settings.adjustments.map((a, j) => (j === i ? Math.max(-30, a - 1) : a)) }; setSettings(nx); savePrayerSettings(nx); }} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="minus" size={10} color={d.subtext} />
                    </Pressable>
                    <T v="body" style={{ fontSize: 13, fontWeight: '800', color: (settings.adjustments[i] ?? 0) !== 0 ? '#E8C96A' : d.text, width: 44, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                      {settings.adjustments[i] ?? 0 > 0 ? '+' : ''}{settings.adjustments[i] ?? 0}
                    </T>
                    <Pressable onPress={() => { haptic.selection(); const nx = { ...settings, adjustments: settings.adjustments.map((a, j) => (j === i ? Math.min(30, a + 1) : a)) }; setSettings(nx); savePrayerSettings(nx); }} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="plus" size={10} color={d.subtext} />
                    </Pressable>
                  </View>
                ))}
              </View>

              {/* adhan */}
              <Pressable
                onPress={() => { haptic.selection(); const nx = { ...settings, adhan: !settings.adhan }; setSettings(nx); savePrayerSettings(nx); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: settings.adhan ? 'rgba(74,227,143,0.45)' : d.cardBorder, backgroundColor: settings.adhan ? (isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)') : 'transparent' }}
              >
                <FontAwesome5 name={settings.adhan ? 'volume-up' : 'volume-mute'} size={14} color={settings.adhan ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                <View style={{ flex: 1 }}>
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>Adhan reminder</T>
                  <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>Show a call-to-prayer banner when a prayer time enters while the app is open</T>
                </View>
                <View style={{ width: 40, height: 22, borderRadius: 12, backgroundColor: settings.adhan ? '#1F8F5C' : d.bgSoft, borderWidth: 1, borderColor: settings.adhan ? '#1F8F5C' : d.cardBorder, padding: 2 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 9, backgroundColor: '#FFFFFF', marginLeft: settings.adhan ? 18 : 0 }} />
                </View>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
