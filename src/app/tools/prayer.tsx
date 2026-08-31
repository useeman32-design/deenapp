import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View } from 'react-native';
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
import { SunPath } from '@/components/SunPath';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '@/lib/haptics';
import { ADHAN_VOICES, isAdhanPlaying, playAdhan, stopAdhan } from '@/lib/adhanPlayer';

/**
 * Prayer times (pass 23 — full redesign):
 *  · hero: next prayer + live countdown + progress arc + hijri/gregorian date
 *  · REAL device location (geolocation → IP fallback)
 *  · calculation method (12), madhab, per-prayer ±min adjustments, adhan
 *  · 7-day strip; live "prayer is in" banner when a time passes while open
 */
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ICONS: Record<string, string> = { Fajr: 'cloud-moon', Sunrise: 'sun', Dhuhr: 'sun', Asr: 'sun', Maghrib: 'moon', Isha: 'moon' };
const AR_NAMES: Record<string, string> = { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };

export default function PrayerTimes() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [settings, setSettings] = useState<PrayerSettings>(DEFAULT_SETTINGS);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(new Date());
  const [sheet, setSheet] = useState(false);
  /* pass 33: adhan — plays when a prayer time arrives while the app is open */
  const [adhanFor, setAdhanFor] = useState<string | null>(null);
  const playedRef = useRef<string | null>(null);
  useEffect(() => {
    /* computed here (not from render scope) so hook order is stable even
     * before the location resolves */
    if (!loc || !settings.adhan || offset !== 0) return;
    const dd = new Date();
    dd.setHours(12, 0, 0, 0);
    const t = computePrayerTimesWith(dd, loc, settings);
    for (let i = 0; i < t.length; i++) {
      if (i === 1) continue; /* no adhan at sunrise */
      const key = `${dd.toDateString()}:${i}`;
      if (now >= t[i] && now.getTime() - t[i].getTime() < 90_000 && playedRef.current !== key) {
        playedRef.current = key;
        if (playAdhan(settings.adhanVoice)) setAdhanFor(`${PRAYER_NAMES[i]}·${key}`);
        break;
      }
    }
  }, [now, loc, settings.adhan, settings.adhanVoice, offset]);

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
  /* pass 33: CURRENT prayer — the window we are in right now (the last
   * prayer whose time has arrived; before Fajr that is yesterday's Isha).
   * Plain computation (NOT useMemo) — this line sits after the early return,
   * and a hook here breaks hook order once the location resolves. */
  let curIdx = -1;
  if (isToday) {
    curIdx = 5;
    for (let i = 0; i < times.length; i++) if (times[i] <= now) curIdx = i;
  }

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

        {/* hero — next prayer (pass 29: same background + sun-walk arc as the home hero) */}
        <View style={{ marginHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: '#0E241A', padding: 18, overflow: 'hidden' }}>
          <Image source={require('../../../assets/img/mecca.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="cover" />
          <LinearGradient colors={['rgba(8,26,17,0.88)', 'rgba(8,26,17,0.7)']} start={{ x: 0, y: 0 }} end={{ x: 0.55, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: '#4AE38F' }}>
              {isToday ? 'NEXT PRAYER' : PRAYER_NAMES[2].toUpperCase()}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 8, paddingVertical: 3 }}>
              <FontAwesome5 name={settings.adhan ? 'volume-up' : 'volume-mute'} size={8} color="#E8C96A" />
              <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: '#E8C96A' }}>{settings.adhan ? 'ADHAN ON' : 'ADHAN OFF'}</T>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
            <T v="display" style={{ fontSize: 34, fontWeight: '800', color: '#F2F7F3' }}>
              {isToday ? np?.name : 'Dhuhr'}
            </T>
            <T v="h3" style={{ fontSize: 19, fontWeight: '800', color: '#4AE38F', marginBottom: 4 }}>
              {isToday ? fmt(np?.time ?? times[0]) : fmt(times[2])}
            </T>
          </View>

          {/* progress bar */}
          <View style={{ marginTop: 12 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', overflow: 'hidden' }}>
              <View style={{ width: `${ring * 100}%`, height: 6, borderRadius: 3, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <T v="caption" style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{isToday ? `in ${countdownTo(now, np?.time ?? times[0])}` : '—'}</T>
              <T v="caption" style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{Math.round(ring * 100)}%</T>
            </View>
          </View>

          {/* dates */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 8 }}>
              <T v="caption" style={{ fontSize: 8, fontWeight: '800', letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)' }}>HIJRI</T>
              <T v="bodyS" style={{ fontSize: 11.5, fontWeight: '700', color: '#F2F7F3', marginTop: 1 }}>{formatHijri(selDate)}</T>
            </View>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 8 }}>
              <T v="caption" style={{ fontSize: 8, fontWeight: '800', letterSpacing: 0.5, color: 'rgba(255,255,255,0.5)' }}>GREGORIAN</T>
              <T v="bodyS" style={{ fontSize: 11.5, fontWeight: '700', color: '#F2F7F3', marginTop: 1 }}>{formatGregorian(selDate)}</T>
            </View>
          </View>

          {/* sun path — real time-based day arc (same as home) */}
          <View style={{ marginTop: 14 }}>
            <SunPath times={times} now={now} nextIndex={np?.index ?? null} />
          </View>
        </View>

        {/* six prayers — pass 33 timeline: vertical rail, CURRENT prayer gold, NEXT green */}
        <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingVertical: 6 }}>
          {PRAYER_NAMES.map((name, i) => {
            const active = isToday && np?.index === i;
            const current = isToday && curIdx === i;
            const passed = isToday && times[i] < now && !current;
            const adj = settings.adjustments[i] ?? 0;
            return (
              <View
                key={name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  backgroundColor: current ? (isDark ? 'rgba(212,175,55,0.10)' : 'rgba(212,175,55,0.08)') : active ? (isDark ? 'rgba(46,204,113,0.10)' : 'rgba(14,122,70,0.06)') : 'transparent',
                }}
              >
                {/* timeline node + rail */}
                <View style={{ width: 34, alignItems: 'center' }}>
                  {i > 0 ? <View style={{ position: 'absolute', top: -21, width: 2, height: 22, backgroundColor: times[i - 1] < now && isToday ? (isDark ? 'rgba(212,175,55,0.5)' : 'rgba(140,109,31,0.35)') : d.cardBorder }} /> : null}
                  {current ? (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(212,175,55,0.25)', borderWidth: 1.5, borderColor: '#E8C96A', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#E8C96A' }} />
                    </View>
                  ) : (
                    <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: active ? (isDark ? '#4AE38F' : '#1D6F42') : passed ? d.cardBorder : isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.3)', backgroundColor: active ? (isDark ? '#4AE38F' : '#1D6F42') : 'transparent' }} />
                  )}
                  {i < PRAYER_NAMES.length - 1 ? <View style={{ position: 'absolute', bottom: -21, width: 2, height: 22, backgroundColor: passed || current ? (isDark ? 'rgba(212,175,55,0.5)' : 'rgba(140,109,31,0.35)') : d.cardBorder }} /> : null}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <FontAwesome5 name={(ICONS[name] ?? 'clock') as never} size={11} color={current ? '#E8C96A' : active ? (isDark ? '#4AE38F' : '#1D6F42') : passed ? d.faint : d.subtext} />
                    <T v="body" style={{ fontSize: 13.5, fontWeight: '800', color: current ? '#E8C96A' : passed && !active ? d.faint : d.text }}>{name}</T>
                    <T style={{ fontFamily: 'Amiri', fontSize: 13, color: current ? 'rgba(232,201,106,0.8)' : passed ? d.faint : d.subtext }}>{AR_NAMES[name] ?? ''}</T>
                  </View>
                  {adj !== 0 ? (
                    <T v="caption" style={{ fontSize: 9, color: '#E8C96A', marginTop: 1 }}>{adj > 0 ? `+${adj}` : adj} min adjusted</T>
                  ) : null}
                </View>

                {current ? (
                  <View style={{ borderRadius: 999, backgroundColor: 'rgba(212,175,55,0.16)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.55)', paddingHorizontal: 9, paddingVertical: 3 }}>
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', color: '#E8C96A', letterSpacing: 0.4 }}>NOW</T>
                  </View>
                ) : active ? (
                  <View style={{ borderRadius: 999, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', paddingHorizontal: 9, paddingVertical: 3 }}>
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.4 }}>NEXT</T>
                  </View>
                ) : null}
                <T v="body" style={{ fontSize: 14.5, fontWeight: '800', color: current ? '#E8C96A' : passed && !active ? d.faint : d.text, fontVariant: ['tabular-nums'] }}>
                  {fmt(times[i])}
                </T>
              </View>
            );
          })}
        </View>

        {/* adhan banner */}
        {adhanFor ? (
          <View style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: isDark ? 'rgba(212,175,55,0.10)' : 'rgba(212,175,55,0.08)', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(212,175,55,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="volume-up" size={13} color="#E8C96A" />
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>It{'\u2019'}s time for {adhanFor.split('·')[0]}</T>
              <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>Adhan playing — {ADHAN_VOICES.find((v) => v.id === settings.adhanVoice)?.label}</T>
            </View>
            <Pressable accessibilityLabel="stop adhan" onPress={() => { haptic.selection(); stopAdhan(); setAdhanFor(null); }} style={{ borderRadius: 999, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', paddingHorizontal: 12, paddingVertical: 7 }}>
              <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Stop</T>
            </Pressable>
          </View>
        ) : null}

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

              {/* pass 33: adhan voice picker with preview */}
              {settings.adhan ? (
                <View>
                  <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, marginBottom: 8 }}>ADHAN RECITATION</T>
                  {ADHAN_VOICES.map((v) => {
                    const on = settings.adhanVoice === v.id;
                    return (
                      <Pressable
                        key={v.id}
                        accessibilityLabel={`adhan ${v.label}`}
                        onPress={() => { haptic.selection(); const nx = { ...settings, adhanVoice: v.id }; setSettings(nx); savePrayerSettings(nx); }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 11, borderRadius: 12, marginBottom: 5, borderWidth: 1, borderColor: on ? 'rgba(212,175,55,0.5)' : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(212,175,55,0.10)' : 'rgba(212,175,55,0.06)') : 'transparent' }}
                      >
                        <FontAwesome5 name="speaker" size={12} color={on ? '#E8C96A' : d.faint} />
                        <T v="bodyS" style={{ flex: 1, fontWeight: '700', fontSize: 12.5, color: d.text }}>{v.label}</T>
                        <Pressable
                          onPress={(e) => { e.stopPropagation(); haptic.selection(); if (isAdhanPlaying()) { stopAdhan(); setAdhanFor(null); } else playAdhan(v.id); }}
                          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? 'rgba(242,247,243,0.08)' : 'rgba(20,36,28,0.05)', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <FontAwesome5 name="play" size={9} color={d.subtext} />
                        </Pressable>
                        {on ? <FontAwesome5 name="check-circle" size={15} color="#E8C96A" /> : null}
                      </Pressable>
                    );
                  })}
                  <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 2 }}>The adhan plays from your device when a prayer time enters while the app is open.</T>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
