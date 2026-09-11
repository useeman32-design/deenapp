import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, PanResponder, Pressable, ScrollView, Switch, TextInput, View, Image } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Defs as SvgDefs, G as SvgG, LinearGradient as SvgGrad, Path as SvgPath, RadialGradient as SvgRad, Rect as SvgRect, Stop as SvgStop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { storage } from '@/lib/storage';
import { T } from '@/components/T';
import { ScoreShareSheet, type ScoreCard } from '@/components/ScoreShareSheet';
import { haptic } from '@/lib/haptics';
import { stopBubble } from '@/lib/press';
import { BackButton } from '@/components/BackButton';

/**
 * Tasbeeh / Dhikr (pass 30 — full premium rebuild):
 *  · always-dark, near-black focused dhikr screen with neon-green accent
 *  · HERO: a photoreal misbaha render (33 polished beads + gold-collared silk
 *    tassel) — the bead you are on glows; passed beads keep a faint green dot
 *  · tap the beads or swipe along them to count; +1 floats up on every tap
 *  · target number (33/66/99/100/custom), tours counter
 *  · stats: today's hasanat · this week · best streak (persisted history)
 *  · settings gear: switch dhikr, vibration, reset today
 */

const BG = '#050D09';
const NEON = '#4AE38F';
const BEADS = 33;
const NEON_DEEP = '#1F8F5C';
const GOLD = '#E8C96A';
const GLASS = 'rgba(255,255,255,0.045)';
const GLASS_BR = 'rgba(255,255,255,0.09)';
const INK = '#F2F7F3';
const INK_FAINT = 'rgba(242,247,243,0.5)';

type Preset = { id: string; label: string; arabic: string; target: number };

const PRESETS: Preset[] = [
  { id: 'tawhid', label: 'La ilaha illallah', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّهِ', target: 99 },
  { id: 'subhan', label: 'SubhanAllah', arabic: 'سُبْحَانَ ٱللَّهِ', target: 33 },
  { id: 'hamd', label: 'Alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّهِ', target: 33 },
  { id: 'akbar', label: 'Allahu Akbar', arabic: 'ٱللَّهُ أَكْبَرُ', target: 33 },
  { id: 'astghfar', label: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّهَ', target: 100 },
  { id: 'salawat', label: 'Salawat', arabic: 'ٱللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', target: 11 },
];


/* ── pass 42 — the misbaha is now DRAWN (SVG), not a photo: 33 beads on a
 *   true circle centred in the view, so the counting glow sits EXACTLY on each
 *   bead by construction (the old hand-fitted path drifted out of alignment).
 *   Bead 0 sits just right of the top; a gold tassel hangs above the ring. */
const MISBAHA_AR = 1.44;
const beadCenter = (i: number, w: number, h: number) => {
  const cx = w / 2;
  const cy = h * 0.55;
  const r = Math.min(w, h) * 0.335;
  const a = -Math.PI / 2 + (i / BEADS) * Math.PI * 2;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, r: Math.min(w, h) * 0.0315 };
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const dayOffset = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function Tasbeeh() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const W = Dimensions.get('window').width;
  const imgW = W - 24;
  const imgH = imgW / MISBAHA_AR;

  const [presetId, setPresetId] = useState('tawhid');
  const [target, setTarget] = useState(99);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Record<string, number>>({});
  const [vibrate, setVibrate] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customTxt, setCustomTxt] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  /* pass 38 — share the dhikr count as generated square art */
  const [shareCard, setShareCard] = useState<ScoreCard | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;
  const floatUp = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(1)).current;

  const today = history[todayKey()] ?? 0;
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const count = counts[presetId] ?? 0;
  const inTour = target > 0 ? (count > 0 && count % target === 0 ? target : count % target) : count;
  const tours = target > 0 ? Math.floor(count / target) : 0;
  const activeBead = count % BEADS;

  /* ── persistence: daily counts (existing key) + full history + prefs ── */
  useEffect(() => {
    (async () => {
      try {
        const d = JSON.parse((await storage.getItem('dl.tasbeeh.daily')) ?? '{}');
        if (d.date === todayKey()) {
          setCounts(d.counts ?? {});
          setHistory((h) => ({ ...h, [todayKey()]: d.total ?? 0 }));
        }
      } catch {}
      try {
        const h = JSON.parse((await storage.getItem('dl.tasbeeh.history')) ?? '{}');
        setHistory((prev) => ({ ...h, ...prev }));
      } catch {}
      try {
        const p = JSON.parse((await storage.getItem('dl.tasbeeh.prefs')) ?? '{}');
        if (p.presetId && PRESETS.some((x) => x.id === p.presetId)) setPresetId(p.presetId);
        if (typeof p.target === 'number' && p.target > 0) setTarget(p.target);
        if (typeof p.vibrate === 'boolean') setVibrate(p.vibrate);
      } catch {}
    })();
  }, []);

  const savePrefs = (patch: Record<string, unknown>) => {
    storage.setItem('dl.tasbeeh.prefs', JSON.stringify({ presetId, target, vibrate, ...patch })).catch(() => {});
  };

  const buzz = (fn: () => void) => { if (vibrate) fn(); };

  const bump = () => {
    const next = count + 1;
    const nc = { ...counts, [presetId]: next };
    const nt = today + 1;
    setCounts(nc);
    setHistory((h) => ({ ...h, [todayKey()]: nt }));
    storage.setItem('dl.tasbeeh.daily', JSON.stringify({ date: todayKey(), counts: nc, total: nt })).catch(() => {});
    storage.setItem('dl.tasbeeh.history', JSON.stringify({ ...history, [todayKey()]: nt })).catch(() => {});
    pulse.setValue(1.22);
    Animated.spring(pulse, { toValue: 1, useNativeDriver: false, friction: 5, tension: 90 }).start();
    floatUp.setValue(0);
    Animated.timing(floatUp, { toValue: 1, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (target > 0 && next % target === 0) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1600);
      buzz(() => haptic.success());
    } else buzz(() => haptic.light());
  };

  /* tap OR swipe along the beads → count */
  const lastSlide = useRef(0);
  const deckPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const now = Date.now();
          if (now - lastSlide.current > 140) { lastSlide.current = now; bump(); }
        },
        onPanResponderMove: (_e, g) => {
          const now = Date.now();
          const speed = Math.abs(g.dx) + Math.abs(g.dy);
          if (now - lastSlide.current > Math.max(90, 320 - speed * 2)) { lastSlide.current = now; bump(); }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, today, counts, history, target, vibrate],
  );

  /* breathing glow on the active bead */
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowPulse, { toValue: 1.22, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(glowPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glowPulse]);

  const pickPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    buzz(() => haptic.selection());
    setPresetId(id);
    setTarget(p.target);
    savePrefs({ presetId: id, target: p.target });
  };

  const pickTarget = (n: number) => {
    buzz(() => haptic.selection());
    setTarget(n);
    savePrefs({ target: n });
  };

  const resetToday = () => {
    buzz(() => haptic.selection());
    const nc = { ...counts, [presetId]: 0 };
    setCounts(nc);
    setHistory((h) => ({ ...h, [todayKey()]: Math.max(0, today - count) }));
    storage.setItem('dl.tasbeeh.daily', JSON.stringify({ date: todayKey(), counts: nc, total: Math.max(0, today - count) })).catch(() => {});
  };

  /* week + best streak from history */
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => history[dayOffset(i)] ?? 0).reduce((a, b) => a + b, 0), [history]);
  const bestStreak = useMemo(() => {
    const days = Object.keys(history).filter((k) => (history[k] ?? 0) > 0).sort();
    if (!days.length) return 0;
    let best = 1;
    let run = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      const cur = new Date(days[i]);
      const gap = Math.round((cur.getTime() - prev.getTime()) / 864e5);
      run = gap === 1 ? run + 1 : 1;
      best = Math.max(best, run);
    }
    return best;
  }, [history]);

  const glass = { backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BR, borderRadius: 22 };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ambient light + vignette */}
      <LinearGradient colors={['rgba(20,74,45,0.32)', 'rgba(5,13,9,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }} pointerEvents="none" />
      <LinearGradient colors={['rgba(5,13,9,0)', 'rgba(3,8,6,0.85)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180 }} pointerEvents="none" />

      {/* ── header: logo · Tasbeeh · gear ── */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
        <BackButton onDark />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 20, color: INK, letterSpacing: 0.3 }}>Tasbeeh</T>
          <T v="caption" style={{ fontSize: 10.5, color: INK_FAINT, marginTop: 2 }}>Dhikr brings peace to the heart ♡</T>
        </View>
        <Pressable onPress={() => { buzz(() => haptic.selection()); setSettingsOpen(true); }} accessibilityLabel="tasbeeh settings" style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: GLASS_BR, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="cog" size={15} color={INK_FAINT} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        {/* ── main dhikr block ── */}
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <T v="arabic" style={{ fontSize: 30, color: INK, textAlign: 'center', lineHeight: 54 }}>{preset.arabic}</T>
          <T v="caption" style={{ fontSize: 12, color: INK_FAINT, marginTop: 2, letterSpacing: 0.4 }}>{preset.label}</T>

          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <View>
              <Animated.Text
                accessibilityLabel="tasbeeh count"
                style={{
                  fontFamily: 'Poppins-ExtraBold',
                  fontSize: 66,
                  lineHeight: 84,
                  color: celebrate ? GOLD : NEON,
                  textShadowColor: celebrate ? 'rgba(232,201,106,0.55)' : 'rgba(74,227,143,0.5)',
                  textShadowRadius: 28,
                  textShadowOffset: { width: 0, height: 0 },
                  transform: [{ scale: pulse }],
                }}
              >
                {inTour}
              </Animated.Text>
              {/* floating +1 */}
              <Animated.Text
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: -34,
                  top: 8,
                  fontFamily: 'Poppins-ExtraBold',
                  fontSize: 19,
                  color: NEON,
                  opacity: floatUp.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
                  transform: [{ translateY: floatUp.interpolate({ inputRange: [0, 1], outputRange: [10, -40] }) }],
                }}
              >
                +1
              </Animated.Text>
            </View>
            <T v="caption" style={{ fontSize: 13, color: INK_FAINT, marginTop: -6, fontWeight: '700' }}>/ {target > 0 ? target : '∞'}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 }}>
              <T v="caption" style={{ fontSize: 10.5, color: 'rgba(242,247,243,0.38)', letterSpacing: 0.5 }}>
                {celebrate ? 'Tour complete — Alhamdulillah 🤍' : `Tours: ${tours}`}
              </T>
              {tours > 0 ? (
                <Pressable
                  accessibilityLabel="share dhikr art"
                  onPress={() => setShareCard({ kind: 'dhikr', metric: String(count), title: PRESETS.find((x) => x.id === presetId)?.label ?? 'Dhikr', subtitle: `${tours} tour${tours === 1 ? '' : 's'} complete · DeenLink Misbaha`, link: 'https://deenlink.org/tools/tasbeeh' })}
                  hitSlop={8}
                  style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.1)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <FontAwesome5 name="share-alt" size={9} color="#E8C96A" />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── HERO: the physical misbaha — tap / swipe to count ── */}
        <Pressable accessibilityLabel="tasbeeh-deck" accessibilityRole="button" onPress={bump} {...deckPan.panHandlers} style={{ marginHorizontal: 12, marginTop: 10 }}>
          <View style={{ borderRadius: 26, overflow: 'hidden' }}>
            {/* pass 42 — the DRAWN misbaha: beads, thread, tassel and glow in one SVG */}
            <Svg width={imgW} height={imgH} viewBox={`0 0 ${imgW} ${imgH}`}>
              <SvgDefs>
                <SvgRad id="beadG" cx="35%" cy="30%" r="80%">
                  <SvgStop offset="0%" stopColor="#7B8A78" />
                  <SvgStop offset="45%" stopColor="#33403A" />
                  <SvgStop offset="100%" stopColor="#101713" />
                </SvgRad>
                <SvgRad id="beadDoneG" cx="35%" cy="30%" r="80%">
                  <SvgStop offset="0%" stopColor="#7CE8A8" />
                  <SvgStop offset="55%" stopColor="#2FA866" />
                  <SvgStop offset="100%" stopColor="#0C4E2C" />
                </SvgRad>
                <SvgRad id="beadActiveG" cx="50%" cy="50%" r="70%">
                  <SvgStop offset="0%" stopColor="#EAFFF2" />
                  <SvgStop offset="60%" stopColor="#4AE38F" />
                  <SvgStop offset="100%" stopColor="#149052" />
                </SvgRad>
                <SvgGrad id="silk" x1="0" y1="0" x2="0" y2="1">
                  <SvgStop offset="0%" stopColor="#E8C96A" />
                  <SvgStop offset="100%" stopColor="#8C6D1F" />
                </SvgGrad>
              </SvgDefs>
              {/* silk thread ring the beads sit on */}
              <SvgCircle cx={imgW / 2} cy={imgH * 0.55} r={Math.min(imgW, imgH) * 0.335} fill="none" stroke="rgba(232,201,106,0.22)" strokeWidth={1.6} />
              {/* the 33 beads — passed ones green, the active one glowing */}
              {Array.from({ length: BEADS }).map((_, i) => {
                const b = beadCenter(i, imgW, imgH);
                const active = i === activeBead;
                const done = i < activeBead;
                return (
                  <SvgG key={i}>
                    {active ? <SvgCircle cx={b.x} cy={b.y} r={b.r * 1.9} fill="rgba(74,227,143,0.18)" /> : null}
                    <SvgCircle cx={b.x} cy={b.y} r={b.r} fill={active ? 'url(#beadActiveG)' : done ? 'url(#beadDoneG)' : 'url(#beadG)'} stroke={active ? '#4AE38F' : done ? 'rgba(74,227,143,0.55)' : 'rgba(255,255,255,0.14)'} strokeWidth={active ? 1.6 : 0.9} />
                    <SvgCircle cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.35} r={b.r * 0.3} fill={active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)'} />
                  </SvgG>
                );
              })}
              {/* gold tassel above the ring: collar + silk threads */}
              <SvgG>
                <SvgRect x={imgW / 2 - 7} y={imgH * 0.55 - Math.min(imgW, imgH) * 0.335 - 36} width={14} height={17} rx={4} fill="url(#silk)" />
                {[0, 1, 2, 3, 4].map((k) => (
                  <SvgPath
                    key={k}
                    d={`M ${imgW / 2 - 6 + k * 3} ${imgH * 0.55 - Math.min(imgW, imgH) * 0.335 - 19} q ${(k - 2) * 5} 26 ${(k - 2) * 7} 46`}
                    stroke={k % 2 ? 'rgba(232,201,106,0.6)' : '#E8C96A'}
                    strokeWidth={k === 2 ? 2.2 : 1.4}
                    fill="none"
                  />
                ))}
              </SvgG>
            </Svg>
            {/* soft blend into the screen bg */}
            <LinearGradient colors={['rgba(5,13,9,0.55)', 'rgba(5,13,9,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54 }} pointerEvents="none" />
            <LinearGradient colors={['rgba(5,13,9,0)', 'rgba(5,13,9,0.6)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }} pointerEvents="none" />

          </View>

          {/* interaction hint */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 }}>
            <FontAwesome5 name="hand-pointer" size={11} color={NEON} />
            <T v="caption" style={{ fontSize: 11, color: INK_FAINT, letterSpacing: 0.3 }}>Swipe or tap on the beads to count</T>
          </View>
        </Pressable>

        {/* ── target number ── */}
        <View style={{ ...glass, marginHorizontal: 16, marginTop: 12, padding: 15 }}>
          <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1, color: 'rgba(242,247,243,0.45)', marginBottom: 11 }}>TARGET NUMBER</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[33, 66, 99, 100].map((n) => {
              const on = target === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => pickTarget(n)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: on ? 'rgba(74,227,143,0.65)' : 'rgba(255,255,255,0.07)',
                    backgroundColor: on ? 'rgba(74,227,143,0.10)' : 'rgba(255,255,255,0.03)',
                    shadowColor: NEON,
                    shadowOpacity: on ? 0.35 : 0,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <T v="bodyS" style={{ fontSize: 14, fontWeight: '800', color: on ? NEON : INK_FAINT }}>{n}</T>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => { buzz(() => haptic.selection()); setCustomTxt(String(target)); setCustomOpen(true); }}
              style={{
                flex: 1.25,
                alignItems: 'center',
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: [33, 66, 99, 100].includes(target) ? 'rgba(255,255,255,0.07)' : 'rgba(74,227,143,0.65)',
                backgroundColor: [33, 66, 99, 100].includes(target) ? 'rgba(255,255,255,0.03)' : 'rgba(74,227,143,0.10)',
              }}
            >
              <T v="bodyS" style={{ fontSize: 14, fontWeight: '800', color: [33, 66, 99, 100].includes(target) ? INK_FAINT : NEON }}>
                {[33, 66, 99, 100].includes(target) ? 'Custom' : `${target} ✓`}
              </T>
            </Pressable>
          </View>
        </View>

        {/* ── stats ── */}
        <View style={{ ...glass, marginHorizontal: 16, marginTop: 12, padding: 15, flexDirection: 'row' }}>
          {([
            { icon: 'star-and-crescent', label: 'Today’s Hasanat', value: today.toLocaleString() },
            { icon: 'calendar-week', label: 'This Week', value: week.toLocaleString() },
            { icon: 'fire', label: 'Best Streak', value: `${bestStreak} day${bestStreak === 1 ? '' : 's'}` },
          ] as const).map((s, i) => (
            <View key={s.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: 'rgba(255,255,255,0.07)' }}>
              <FontAwesome5 name={s.icon} size={12} color={NEON} />
              <T v="bodyS" style={{ fontSize: 16, fontWeight: '800', color: INK, marginTop: 6 }}>{s.value}</T>
              <T v="caption" style={{ fontSize: 9, color: 'rgba(242,247,243,0.42)', marginTop: 2 }}>{s.label}</T>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── settings sheet ── */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(2,6,4,0.75)', alignItems: 'center', justifyContent: 'center', padding: 22 }} onPress={() => setSettingsOpen(false)}>
          <Pressable style={{ backgroundColor: '#081209', borderRadius: 22, borderWidth: 1, borderColor: GLASS_BR, paddingBottom: 18, paddingTop: 16, width: '100%', maxWidth: 360, maxHeight: '62%' }} onPress={(e) => stopBubble(e)}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', alignSelf: 'center', marginBottom: 14 }} />
            <T v="h3" style={{ fontSize: 15, fontWeight: '800', color: INK, marginHorizontal: 18, marginBottom: 4 }}>Settings</T>
            <T v="caption" style={{ fontSize: 10.5, color: INK_FAINT, marginHorizontal: 18, marginBottom: 12 }}>Choose your dhikr — counts are kept per dhikr, every day.</T>
            {PRESETS.map((p) => {
              const on = p.id === presetId;
              const c = counts[p.id] ?? 0;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => { pickPreset(p.id); setSettingsOpen(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 14, marginTop: 6, borderRadius: 15, borderWidth: 1, borderColor: on ? 'rgba(74,227,143,0.5)' : 'rgba(255,255,255,0.07)', backgroundColor: on ? 'rgba(74,227,143,0.08)' : 'rgba(255,255,255,0.03)', padding: 12 }}
                >
                  <T v="arabic" style={{ fontSize: 15, color: INK, flex: 1 }}>{p.arabic}</T>
                  <View style={{ alignItems: 'flex-end' }}>
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: on ? NEON : INK_FAINT }}>{p.label}</T>
                    <T v="caption" style={{ fontSize: 9, color: 'rgba(242,247,243,0.35)' }}>{c} today</T>
                  </View>
                  <FontAwesome5 name={on ? 'check-circle' : 'circle'} size={15} color={on ? NEON : 'rgba(255,255,255,0.2)'} />
                </Pressable>
              );
            })}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginTop: 16 }}>
              <FontAwesome5 name="vibrate" size={13} color={NEON} />
              <T v="bodyS" style={{ flex: 1, fontSize: 12.5, color: INK, marginLeft: 9 }}>Vibration on each bead</T>
              <Switch
                value={vibrate}
                onValueChange={(v) => { setVibrate(v); savePrefs({ vibrate: v }); if (v) haptic.selection(); }}
                trackColor={{ false: 'rgba(255,255,255,0.14)', true: NEON_DEEP }}
                thumbColor={vibrate ? NEON : '#9AA79E'}
              />
            </View>
            <Pressable onPress={resetToday} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 18, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,123,123,0.3)', padding: 12 }}>
              <FontAwesome5 name="undo" size={11} color='#FF7B7B' />
              <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: '#FF7B7B' }}>Reset today’s counts</T>
            </Pressable>
            <T v="caption" style={{ fontSize: 9.5, color: 'rgba(242,247,243,0.3)', textAlign: 'center', marginTop: 16, marginHorizontal: 34, lineHeight: 15 }}>
              “Whoever says SubhanAllah 33 times, Alhamdulillah 33 times, Allahu Akbar 33 times after every prayer — that is 99…” (Muslim)
            </T>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── custom target sheet ── */}
      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(2,6,4,0.75)', justifyContent: 'center', paddingHorizontal: 34 }} onPress={() => setCustomOpen(false)}>
          <Pressable style={{ backgroundColor: '#081209', borderRadius: 22, borderWidth: 1, borderColor: GLASS_BR, padding: 19 }} onPress={(e) => stopBubble(e)}>
            <T v="h3" style={{ fontSize: 15, fontWeight: '800', color: INK }}>Custom target</T>
            <T v="caption" style={{ fontSize: 10.5, color: INK_FAINT, marginTop: 3, marginBottom: 13 }}>Any number between 3 and 9,999.</T>
            <TextInput
              value={customTxt}
              onChangeText={setCustomTxt}
              keyboardType="number-pad"
              autoFocus
              accessibilityLabel="custom target input"
              style={{ borderRadius: 14, borderWidth: 1, borderColor: GLASS_BR, backgroundColor: 'rgba(255,255,255,0.04)', color: INK, fontFamily: 'Poppins-Bold', fontSize: 17, paddingVertical: 12, paddingHorizontal: 14 }}
            />
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 14 }}>
              <Pressable onPress={() => setCustomOpen(false)} style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderColor: GLASS_BR, paddingVertical: 12, alignItems: 'center' }}>
                <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: INK_FAINT }}>Cancel</T>
              </Pressable>
              <Pressable
                onPress={() => {
                  const n = parseInt(customTxt.replace(/\D/g, ''), 10);
                  if (n >= 3 && n <= 9999) { pickTarget(n); setCustomOpen(false); }
                }}
                style={{ flex: 1, borderRadius: 13, backgroundColor: NEON_DEEP, paddingVertical: 12, alignItems: 'center' }}
              >
                <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' }}>Set target</T>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <ScoreShareSheet visible={!!shareCard} onClose={() => setShareCard(null)} card={shareCard} />
    </View>
  );
}
