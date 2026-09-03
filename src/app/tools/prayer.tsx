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
  formatTime,
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
import { BackButton } from '@/components/BackButton';
import { SunPath } from '@/components/SunPath';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '@/lib/haptics';
import { ADHAN_VOICES, playAdhan, stopAdhan } from '@/lib/adhanPlayer';
import { CrescentLoader } from '@/components/CrescentLoader';
import { fetchPrayerDay, PRAYER_METHODS } from '@/lib/islamicApi';
import { useRouter } from 'expo-router';
import { stopBubble } from '@/lib/press';
import { storage } from '@/lib/storage';

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

/* pass 41 — FIVE selectable adhan alert designs (like the compass picker), each with its own image */
type AdhanDesign = 'praying' | 'mecca' | 'kaabah' | 'medina' | 'mosque';
const ADHAN_DESIGNS: Array<{ id: AdhanDesign; label: string; img: number; accent: string }> = [
  { id: 'praying', label: 'Praying', img: require('../../../assets/img/praying.png'), accent: '#E8C96A' },
  { id: 'mecca', label: 'Makkah', img: require('../../../assets/img/mecca.jpg'), accent: '#4AE38F' },
  { id: 'kaabah', label: 'Ka’bah', img: require('../../../assets/img/kaabah.jpg'), accent: '#E8C96A' },
  { id: 'medina', label: 'Madinah', img: require('../../../assets/img/medina.jpg'), accent: '#5BC8F5' },
  { id: 'mosque', label: 'Mosque', img: require('../../../assets/img/post-mosque.jpg'), accent: '#E8A96A' },
];
const ADHAN_DESIGN_KEY = 'dl.adhan.design';

export default function PrayerTimes() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [settings, setSettings] = useState<PrayerSettings>(DEFAULT_SETTINGS);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(new Date());
  const [sheet, setSheet] = useState(false);
  const [methodPicker, setMethodPicker] = useState(false);
  const [adhanLoading, setAdhanLoading] = useState(false);
  /* pass 36 — exclusive preview: only the voice actually playing shows
   * "playing" (before, every button lit because isAdhanPlaying() is global) */
  const [preview, setPreview] = useState<'v1' | 'v2' | 'v3' | null>(null);
  /* pass 33: adhan — plays when a prayer time arrives while the app is open */
  const [adhanFor, setAdhanFor] = useState<string | null>(null);
  /* pass 41 — adhan alert design (5 selectable, persisted) + picker */
  const [adhanDesign, setAdhanDesign] = useState<AdhanDesign>('praying');
  const [adhanPicker, setAdhanPicker] = useState(false);
  useEffect(() => {
    storage.getItem(ADHAN_DESIGN_KEY).then((v) => {
      if (v && ADHAN_DESIGNS.some((x) => x.id === v)) setAdhanDesign(v as AdhanDesign);
    }).catch(() => {});
  }, []);
  const pickAdhanDesign = (id: AdhanDesign) => {
    setAdhanDesign(id);
    storage.setItem(ADHAN_DESIGN_KEY, id).catch(() => {});
  };
  const playedRef = useRef<string | null>(null);
  const scroller = useRef<ScrollView>(null);
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
        if (playAdhan(settings.adhanVoice)) { setPreview(null); setAdhanFor(`${PRAYER_NAMES[i]}·${key}`); }
        break;
      }
    }
  }, [now, loc, settings.adhan, settings.adhanVoice, offset]);

  useEffect(() => {
    /* Use the shared location already resolved on the Home screen —
     * resolveLocation() returns the cached one (no second GPS fix), so this
     * screen never "loads another location". */
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

  /* pass 35 — IslamicAPI times (primary). Falls back to the built-in
   * offline engine whenever the API is unreachable (revoked key, offline). */
  const [apiTimes, setApiTimes] = useState<Date[] | null>(null);
  const [apiSrc, setApiSrc] = useState<'loading' | 'live' | 'off'>('loading');
  const apiMethodId = settings.apiMethod ?? 3;
  useEffect(() => {
    if (!loc) return;
    let dead = false;
    setApiSrc('loading');
    fetchPrayerDay({
      lat: loc.latitude, lon: loc.longitude, method: apiMethodId,
      school: settings.madhab === 'hanafi' ? 2 : 1,
      date: selDate.toISOString().slice(0, 10),
    })
      .then((r) => {
        if (dead) return;
        const t = r.times;
        const arr = [t.Fajr, t.Sunrise, t.Dhuhr, t.Asr, t.Maghrib, t.Isha].map((hh, i) => {
          const [H, M] = hh.split(':').map((x) => parseInt(x, 10));
          const dd = new Date(selDate);
          dd.setHours(H, M + (settings.adjustments[i] ?? 0), 0, 0);
          return dd;
        });
        setApiTimes(arr);
        setApiSrc('live');
      })
      .catch(() => { if (!dead) { setApiTimes(null); setApiSrc('off'); } });
    return () => { dead = true; };
  }, [loc, selDate, apiMethodId, settings.madhab, settings.adjustments]);

  if (!loc) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
        <T v="caption" style={{ color: d.faint }}>Detecting your location…</T>
      </View>
    );
  }

  const times = apiTimes ?? computePrayerTimesWith(selDate, loc, settings);
  const isToday = offset === 0;
  const np = isToday ? nextPrayer(now, times) : null;
  const fmt = (t: Date) => formatTime(t); /* pass 38: 12h AM/PM always */
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
      <ScrollView ref={scroller} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* header · pass 41 — back button added (page had none) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
          <BackButton />
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="star-and-crescent" size={16} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }}>Prayer Times</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginTop: 3, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(91,200,245,0.45)', backgroundColor: isDark ? 'rgba(91,200,245,0.1)' : 'rgba(91,200,245,0.08)', paddingHorizontal: 9, paddingVertical: 4 }}>
              <FontAwesome5 name="map-marker-alt" size={9} color="#5BC8F5" />
              <T v="caption" numberOfLines={1} style={{ fontSize: 10, fontWeight: '700', color: d.text, maxWidth: 155 }}>{loc.name.split(',').slice(0, 2).join(',')}</T>
            </View>
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

        {/* pass 35 — full month table entry */}
        <Pressable
          accessibilityLabel="month prayer table"
          onPress={() => { haptic.selection(); router.push('/tools/prayer-month'); }}
          style={{ marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.35)' : 'rgba(184,134,11,0.28)', backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.05)', paddingHorizontal: 13, paddingVertical: 10 }}
        >
          <FontAwesome5 name="table" size={13} color="#E8C96A" />
          <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: d.text }}>Full month timetable</T>
          <T v="caption" style={{ fontSize: 9, fontWeight: '700', color: d.faint }}>{apiSrc === 'live' ? 'ISLAMICAPI' : 'OFFLINE CALC'} · SAVE / SHARE</T>
          <FontAwesome5 name="chevron-right" size={10} color={d.faint} />
        </Pressable>

        {/* pass 38 — adhan popup preview, one tap from the main screen */}
        <Pressable
          accessibilityLabel="preview adhan popup"
          onPress={() => { haptic.medium(); setAdhanFor('Dhuhr·preview'); }}
          style={{ marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(91,200,245,0.4)', backgroundColor: isDark ? 'rgba(91,200,245,0.08)' : 'rgba(91,200,245,0.05)', paddingHorizontal: 13, paddingVertical: 10 }}
        >
          <FontAwesome5 name="bell" size={13} color="#5BC8F5" />
          <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: d.text }}>Preview the adhan alert</T>
          <T v="caption" style={{ fontSize: 9, fontWeight: '700', color: d.faint }}>SEE POPUP</T>
        </Pressable>

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

        {/* pass 40 — ADHAN MODAL (was an inline banner). Plays the adhan and
         * offers Go to Prayer / Cancel. praying.png is a generated illustration. */}
        {/* pass 42 — FIVE genuinely DIFFERENT adhan alert designs (unique layout per design, all bigger) */}
        <Modal visible={!!adhanFor} transparent animationType="fade" onRequestClose={() => { stopAdhan(); setAdhanFor(null); }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(4,10,7,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            {(() => {
              const D = ADHAN_DESIGNS.find((x) => x.id === adhanDesign) ?? ADHAN_DESIGNS[0];
              const name = adhanFor ? adhanFor.split('·')[0] : '';
              const arName = adhanFor ? AR_NAMES[name] : '';
              const reciter = ADHAN_VOICES.find((v) => v.id === settings.adhanVoice)?.label;
              const cancel = () => { haptic.light(); stopAdhan(); setAdhanFor(null); };
              const go = () => { haptic.medium(); stopAdhan(); setAdhanFor(null); scroller.current?.scrollTo({ y: 0, animated: true }); };
              const StyleBtns = ({ tint }: { tint: string }) => (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable accessibilityLabel="go to prayer" onPress={go} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#1F8F5C' }}>
                    <T v="button" style={{ fontSize: 13 }}>Go to Prayer</T>
                  </Pressable>
                  <Pressable accessibilityLabel="cancel adhan" onPress={cancel} style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}>
                    <T v="button" style={{ fontSize: 13, color: 'rgba(245,248,245,0.8)' }}>Cancel</T>
                  </Pressable>
                </View>
              );
              const StyleSwitch = ({ dark = true }: { dark?: boolean }) => (
                <Pressable accessibilityLabel="change adhan style" onPress={() => { haptic.selection(); setAdhanPicker(true); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}>
                  <FontAwesome5 name="palette" size={10} color={D.accent} />
                  <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: dark ? D.accent : D.accent }}>Style: {D.label} · change</T>
                </Pressable>
              );

              /* 1 ── PRAYING: classic card — photo header, gold accents, content below */
              if (D.id === 'praying') {
                return (
                  <View style={{ width: '100%', maxWidth: 396, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0B1811', borderWidth: 1.5, borderColor: `${D.accent}66` }}>
                    <View style={{ height: 232, justifyContent: 'flex-end' }}>
                      <Image source={D.img} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="cover" />
                      <LinearGradient colors={['rgba(11,24,17,0.1)', 'rgba(11,24,17,0.94)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 14 }}>
                        <CrescentLoader size={38} color={D.accent} />
                        <View style={{ flex: 1, marginLeft: 11 }}>
                          <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.8, color: D.accent }}>THE ADHAN IS BEING CALLED</T>
                          <T v="h2" style={{ fontSize: 24, fontWeight: '800', color: '#F5F8F5', marginTop: 2 }}>It’s time for {name}</T>
                          <T v="arabic" style={{ fontSize: 18, color: 'rgba(245,248,245,0.75)', marginTop: 1 }}>{arName}</T>
                        </View>
                      </View>
                    </View>
                    <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20 }}>
                      <T v="caption" style={{ fontSize: 11, color: 'rgba(245,248,245,0.65)', lineHeight: 16.5, marginBottom: 16 }}>
                        حَيَّ عَلَى الصَّلَاةِ · حَيَّ عَلَى الْفَلَاحِ — Come to prayer, come to success. Reciter: {reciter}
                      </T>
                      <StyleBtns tint={D.accent} />
                      <StyleSwitch />
                    </View>
                  </View>
                );
              }

              /* 2 ── MAKKAH: full-bleed immersive — the WHOLE modal is the photo, centered text */
              if (D.id === 'mecca') {
                return (
                  <View style={{ width: '100%', maxWidth: 396, height: 560, borderRadius: 30, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)' }}>
                    <Image source={D.img} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="cover" />
                    <LinearGradient colors={['rgba(4,10,7,0.35)', 'rgba(4,10,7,0.55)', 'rgba(4,10,7,0.92)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                    <View style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
                      <View style={{ alignItems: 'center', marginTop: 10 }}>
                        <CrescentLoader size={30} color={D.accent} />
                        <T v="caption" style={{ fontSize: 10, fontWeight: '900', letterSpacing: 2.2, color: D.accent, marginTop: 10 }}>THE ADHAN IS BEING CALLED</T>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <T v="arabic" style={{ fontSize: 30, color: 'rgba(245,248,245,0.9)' }}>{arName}</T>
                        <T v="display" style={{ fontSize: 40, fontWeight: '900', color: '#FFFFFF', marginTop: 4, textAlign: 'center' }}>{name}</T>
                        <T v="caption" style={{ fontSize: 11.5, color: 'rgba(245,248,245,0.7)', textAlign: 'center', marginTop: 8, lineHeight: 17 }}>
                          حَيَّ عَلَى الصَّلَاةِ · حَيَّ عَلَى الْفَلَاحِ{'\n'}Come to prayer, come to success · {reciter}
                        </T>
                      </View>
                      <View>
                        <Pressable accessibilityLabel="go to prayer" onPress={go} style={{ alignItems: 'center', paddingVertical: 15, borderRadius: 16, backgroundColor: '#FFFFFF' }}>
                          <T v="button" style={{ fontSize: 13.5, color: '#0B1811' }}>Go to Prayer</T>
                        </Pressable>
                        <Pressable accessibilityLabel="cancel adhan" onPress={cancel} style={{ alignItems: 'center', paddingVertical: 13 }}>
                          <T v="button" style={{ fontSize: 12.5, color: 'rgba(245,248,245,0.75)' }}>Not now</T>
                        </Pressable>
                        <StyleSwitch />
                      </View>
                    </View>
                  </View>
                );
              }

              /* 3 ── KA'BAH: split layout — image column LEFT, content right, black & gold */
              if (D.id === 'kaabah') {
                return (
                  <View style={{ width: '100%', maxWidth: 396, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0D0D0D', borderWidth: 1.5, borderColor: `${D.accent}77`, flexDirection: 'row' }}>
                    <View style={{ width: 148 }}>
                      <Image source={D.img} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <LinearGradient colors={['rgba(13,13,13,0)', 'rgba(13,13,13,0.9)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, alignItems: 'center' }}>
                        <CrescentLoader size={26} color={D.accent} />
                      </View>
                    </View>
                    <View style={{ flex: 1, padding: 18 }}>
                      <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1.6, color: D.accent }}>ADHAN · {D.label.toUpperCase()}</T>
                      <T v="h2" style={{ fontSize: 23, fontWeight: '900', color: '#FFFFFF', marginTop: 4 }}>{name}</T>
                      <T v="arabic" style={{ fontSize: 17, color: 'rgba(245,248,245,0.7)', marginTop: 1 }}>{arName}</T>
                      <View style={{ height: 1, backgroundColor: `${D.accent}44`, marginVertical: 12 }} />
                      <T v="caption" style={{ fontSize: 10.5, color: 'rgba(245,248,245,0.6)', lineHeight: 16 }}>
                        حَيَّ عَلَى الصَّلَاةِ — come to prayer, come to success.{'\n'}Reciter: {reciter}
                      </T>
                      <View style={{ marginTop: 16, gap: 8 }}>
                        <Pressable accessibilityLabel="go to prayer" onPress={go} style={{ alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: D.accent }}>
                          <T v="button" style={{ fontSize: 12.5, color: '#0D0D0D' }}>Go to Prayer</T>
                        </Pressable>
                        <Pressable accessibilityLabel="cancel adhan" onPress={cancel} style={{ alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
                          <T v="button" style={{ fontSize: 12, color: 'rgba(245,248,245,0.8)' }}>Cancel</T>
                        </Pressable>
                      </View>
                      <StyleSwitch />
                    </View>
                  </View>
                );
              }

              /* 4 ── MADINAH: stacked strip header + content card, cool blue-green */
              if (D.id === 'medina') {
                return (
                  <View style={{ width: '100%', maxWidth: 396, borderRadius: 26, backgroundColor: '#08130E', borderWidth: 1.5, borderColor: `${D.accent}55`, overflow: 'hidden' }}>
                    <Image source={D.img} style={{ width: '100%', height: 150 }} resizeMode="cover" />
                    <LinearGradient colors={['rgba(8,19,14,0.1)', 'rgba(8,19,14,0.96)']} style={{ position: 'absolute', top: 94, left: 0, right: 0, height: 56 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -34, paddingHorizontal: 18 }}>
                      <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: '#08130E', borderWidth: 1.5, borderColor: `${D.accent}88`, alignItems: 'center', justifyContent: 'center' }}>
                        <CrescentLoader size={30} color={D.accent} />
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <T v="h2" style={{ fontSize: 22, fontWeight: '900', color: '#F5F8F5' }}>{name}</T>
                        <T v="arabic" style={{ fontSize: 15, color: 'rgba(245,248,245,0.7)' }}>{arName}</T>
                      </View>
                      <View style={{ borderRadius: 999, borderWidth: 1, borderColor: `${D.accent}66`, backgroundColor: `${D.accent}14`, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1, color: D.accent }}>ADHAN</T>
                      </View>
                    </View>
                    <View style={{ padding: 18, paddingTop: 14 }}>
                      <T v="caption" style={{ fontSize: 10.5, color: 'rgba(245,248,245,0.62)', lineHeight: 16, marginBottom: 14 }}>
                        Come to prayer, come to success — حَيَّ عَلَى الْفَلَاحِ · Reciter: {reciter}
                      </T>
                      <StyleBtns tint={D.accent} />
                      <StyleSwitch />
                    </View>
                  </View>
                );
              }

              /* 5 ── MOSQUE: ornamental double-frame, centered, warm lantern tones */
              return (
                <View style={{ width: '100%', maxWidth: 396, borderRadius: 24, backgroundColor: '#141008', borderWidth: 2, borderColor: `${D.accent}99`, padding: 7 }}>
                  <View style={{ borderRadius: 18, borderWidth: 1, borderColor: `${D.accent}55`, overflow: 'hidden' }}>
                    <View style={{ height: 190 }}>
                      <Image source={D.img} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <LinearGradient colors={['rgba(20,16,8,0.2)', 'rgba(20,16,8,0.95)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <CrescentLoader size={34} color={D.accent} />
                        <T v="arabic" style={{ fontSize: 24, color: '#F5F2E8' }}>{arName}</T>
                        <T v="h1" style={{ fontSize: 28, fontWeight: '900', color: '#FFFFFF' }}>{name}</T>
                        <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 2, color: D.accent }}>THE ADHAN IS BEING CALLED</T>
                      </View>
                    </View>
                    <View style={{ padding: 18, alignItems: 'center' }}>
                      <T v="caption" style={{ fontSize: 10.5, color: 'rgba(245,248,245,0.62)', textAlign: 'center', lineHeight: 16, marginBottom: 14 }}>
                        حَيَّ عَلَى الصَّلَاةِ · حَيَّ عَلَى الْفَلَاحِ{'\n'}Come to prayer, come to success · {reciter}
                      </T>
                      <StyleBtns tint={D.accent} />
                      <StyleSwitch />
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        </Modal>

        {/* pass 41 — adhan design picker (like the compass picker): 5 image designs */}
        <Modal visible={adhanPicker} transparent animationType="fade" onRequestClose={() => setAdhanPicker(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', alignItems: 'center', justifyContent: 'center', padding: 22 }} onPress={() => setAdhanPicker(false)}>
            <Pressable onPress={(e) => stopBubble(e)} style={{ width: '100%', maxWidth: 360, borderRadius: 22, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 18 }} onStartShouldSetResponder={() => true}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <T v="h3" style={{ fontWeight: '900', fontSize: 16, color: d.text }}>Adhan alert style</T>
                  <T v="caption" style={{ fontSize: 10, color: d.subtext, marginTop: 1 }}>Pick a design — it is saved for next time</T>
                </View>
                <Pressable onPress={() => setAdhanPicker(false)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="times" size={12} color={d.subtext} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {ADHAN_DESIGNS.map((ds) => {
                  const on = adhanDesign === ds.id;
                  return (
                    <Pressable
                      key={ds.id}
                      accessibilityLabel={`adhan design ${ds.label}`}
                      onPress={() => { haptic.selection(); pickAdhanDesign(ds.id); }}
                      style={{ width: '30.5%', borderRadius: 14, borderWidth: 1.5, borderColor: on ? ds.accent : d.cardBorder, overflow: 'hidden', backgroundColor: '#0B1811' }}
                    >
                      <View style={{ height: 62 }}>
                        <Image source={ds.img} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        {on ? (
                          <View style={{ position: 'absolute', top: 5, right: 5, width: 17, height: 17, borderRadius: 9, backgroundColor: ds.accent, alignItems: 'center', justifyContent: 'center' }}>
                            <FontAwesome5 name="check" size={8} color="#0B1811" />
                          </View>
                        ) : null}
                      </View>
                      <T v="caption" style={{ textAlign: 'center', fontSize: 9.5, fontWeight: '800', color: on ? ds.accent : d.subtext, paddingVertical: 6 }}>{ds.label}</T>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => { haptic.medium(); setAdhanPicker(false); setAdhanFor('Dhuhr·preview'); }}
                style={{ marginTop: 14, borderRadius: 13, height: 44, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}
              >
                <T v="button" style={{ fontSize: 12.5 }}>Preview with this style</T>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

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
              {/* method — pass 35: select row → full 23-method picker (IslamicAPI) */}
              <View>
                <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, marginBottom: 8 }}>CALCULATION METHOD</T>
                <Pressable
                  accessibilityLabel="calculation method select"
                  onPress={() => { haptic.selection(); setMethodPicker(true); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.05)' }}
                >
                  <FontAwesome5 name="list-ul" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyS" style={{ fontWeight: '700', fontSize: 12.5, color: d.text }}>{PRAYER_METHODS.find((m) => m.id === apiMethodId)?.label ?? 'Muslim World League'}</T>
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>Tap to change · 23 methods (IslamicAPI)</T>
                  </View>
                  <FontAwesome5 name="chevron-down" size={11} color={d.faint} />
                </Pressable>
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

              {/* pass 38 — SEE the adhan popup before it ever fires */}
              <Pressable
                accessibilityLabel="preview adhan popup"
                onPress={() => { haptic.medium(); setAdhanFor('Dhuhr·preview'); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(91,200,245,0.4)', backgroundColor: isDark ? 'rgba(91,200,245,0.07)' : 'rgba(91,200,245,0.05)', marginBottom: 8 }}
              >
                <FontAwesome5 name="eye" size={14} color="#5BC8F5" />
                <View style={{ flex: 1 }}>
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>Preview the adhan alert</T>
                  <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>See how the call-to-prayer popup will appear</T>
                </View>
                <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
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
                          accessibilityLabel={`preview adhan ${v.label}`}
                          onPress={(e) => {
                            stopBubble(e); haptic.selection();
                            if (preview === v.id) { stopAdhan(); setPreview(null); setAdhanFor(null); return; }
                            setAdhanLoading(true);
                            if (playAdhan(v.id)) { setPreview(v.id); setAdhanFor(null); }
                            setTimeout(() => setAdhanLoading(false), 900);
                          }}
                          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: preview === v.id ? 'rgba(212,175,55,0.18)' : (isDark ? 'rgba(242,247,243,0.08)' : 'rgba(20,36,28,0.05)'), alignItems: 'center', justifyContent: 'center' }}
                        >
                          {adhanLoading && preview !== v.id && !preview ? (
                            <ActivityIndicator size="small" color="#E8C96A" />
                          ) : preview === v.id ? (
                            <FontAwesome5 name="pause" size={9} color="#E8C96A" />
                          ) : (
                            <FontAwesome5 name="play" size={9} color={d.subtext} />
                          )}
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

      {/* pass 35 — calculation method picker (23 methods, IslamicAPI) */}
      <Modal visible={methodPicker} transparent animationType="slide" onRequestClose={() => setMethodPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setMethodPicker(false)} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 30, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <T v="h3" style={{ fontWeight: '800', flex: 1 }}>Calculation method</T>
              <Pressable onPress={() => setMethodPicker(false)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {PRAYER_METHODS.map((m) => {
                const on = apiMethodId === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      haptic.selection();
                      /* keep the closest local method for offline fallback */
                      const localMap: Record<number, string> = { 1: 'Karachi', 2: 'NorthAmerica', 3: 'MWL', 4: 'UmmAlQura', 5: 'Egyptian', 7: 'Tehran', 8: 'Dubai', 9: 'Kuwait', 10: 'Qatar', 11: 'Singapore', 13: 'Turkey', 15: 'Moonsighting' };
                      const nx = { ...settings, apiMethod: m.id, method: (localMap[m.id] ?? 'MWL') as typeof settings.method };
                      setSettings(nx); savePrayerSettings(nx); setMethodPicker(false);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, marginBottom: 5, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent' }}
                  >
                    <T v="bodyS" style={{ flex: 1, fontWeight: '700', fontSize: 12.5, color: d.text }}>{m.label}</T>
                    {on ? <FontAwesome5 name="check-circle" size={15} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
