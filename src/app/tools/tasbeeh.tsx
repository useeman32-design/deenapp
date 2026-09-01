import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, PanResponder, Pressable, ScrollView, Switch, TextInput, View, Image } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { storage } from '@/lib/storage';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { stopBubble } from '@/lib/press';

/**
 * Tasbeeh / Dhikr (pass 30 — full premium rebuild):
 *  · always-dark, near-black focused dhikr screen with neon-green accent
 *  · HERO: a photoreal misbaha render (33 polished beads + gold-collared silk
 *    tassel) — the bead you are on glows; passed beads keep a faint green dot
 *  · tap the beads or swipe along them to count; +1 floats up on every tap
 *  · mood, target number (33/66/99/100/custom), tours counter
 *  · stats: today's hasanat · this week · best streak (persisted history)
 *  · settings gear: switch dhikr, vibration, reset today
 */

const BG = '#050D09';
const NEON = '#4AE38F';
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

const MOODS = [
  { id: 'grateful', emoji: '😊', label: 'Grateful' },
  { id: 'peaceful', emoji: '💧', label: 'Peaceful' },
  { id: 'hopeful', emoji: '🙂', label: 'Hopeful' },
  { id: 'stressed', emoji: '😣', label: 'Stressed' },
  { id: 'sad', emoji: '😔', label: 'Sad' },
];

/* ── misbaha glow geometry — pass 33: re-traced from the ACTUAL render.
 *   The strand is an oval loop (tassel at the top): 33 points sampled
 *   evenly by arc length from the detected bead centres, bead 0 = top. */
const MISBAHA_AR = 1.662;
const BEADS = 33;
const BEAD_W = 0.025;
const BEAD_PATH: Array<{ x: number; y: number }> = [
  { x: 0.5008, y: 0.2029 },
  { x: 0.5768, y: 0.2061 },
  { x: 0.6522, y: 0.2166 },
  { x: 0.7257, y: 0.2366 },
  { x: 0.7955, y: 0.2668 },
  { x: 0.8568, y: 0.3115 },
  { x: 0.8997, y: 0.3739 },
  { x: 0.9246, y: 0.4457 },
  { x: 0.9353, y: 0.5210 },
  { x: 0.9296, y: 0.5967 },
  { x: 0.9057, y: 0.6688 },
  { x: 0.8681, y: 0.7349 },
  { x: 0.8164, y: 0.7905 },
  { x: 0.7520, y: 0.8309 },
  { x: 0.6819, y: 0.8606 },
  { x: 0.6089, y: 0.8818 },
  { x: 0.5337, y: 0.8936 },
  { x: 0.4576, y: 0.8951 },
  { x: 0.3819, y: 0.8874 },
  { x: 0.3079, y: 0.8698 },
  { x: 0.2383, y: 0.8393 },
  { x: 0.1780, y: 0.7930 },
  { x: 0.1284, y: 0.7353 },
  { x: 0.0915, y: 0.6689 },
  { x: 0.0687, y: 0.5964 },
  { x: 0.0613, y: 0.5208 },
  { x: 0.0709, y: 0.4454 },
  { x: 0.0994, y: 0.3750 },
  { x: 0.1467, y: 0.3159 },
  { x: 0.2077, y: 0.2707 },
  { x: 0.2764, y: 0.2383 },
  { x: 0.3497, y: 0.2179 },
  { x: 0.4249, y: 0.2067 }
];
const beadAt = (i: number): { x: number; y: number } => BEAD_PATH[((i % BEADS) + BEADS) % BEADS];

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
  const [mood, setMood] = useState<string | null>(null);
  const [vibrate, setVibrate] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customTxt, setCustomTxt] = useState('');
  const [celebrate, setCelebrate] = useState(false);

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
      try {
        const m = JSON.parse((await storage.getItem('dl.tasbeeh.mood')) ?? '{}');
        if (m.date === todayKey()) setMood(m.mood);
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

  const pickMood = (id: string) => {
    buzz(() => haptic.selection());
    setMood(id);
    storage.setItem('dl.tasbeeh.mood', JSON.stringify({ date: todayKey(), mood: id })).catch(() => {});
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
        <Pressable onPress={() => { buzz(() => haptic.selection()); router.back(); }} accessibilityLabel="close tasbeeh" style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: GLASS_BR, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../../assets/img/logo-badge.png')} style={{ width: 26, height: 26, borderRadius: 7 }} />
        </Pressable>
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
            <T v="caption" style={{ fontSize: 10.5, color: 'rgba(242,247,243,0.38)', marginTop: 5, letterSpacing: 0.5 }}>
              {celebrate ? 'Tour complete — Alhamdulillah 🤍' : `Tours: ${tours}`}
            </T>
          </View>
        </View>

        {/* ── HERO: the physical misbaha — tap / swipe to count ── */}
        <Pressable accessibilityLabel="tasbeeh-deck" accessibilityRole="button" onPress={bump} {...deckPan.panHandlers} style={{ marginHorizontal: 12, marginTop: 10 }}>
          <View style={{ borderRadius: 26, overflow: 'hidden' }}>
            <Image source={require('../../../assets/img/misbaha.png')} style={{ width: imgW, height: imgH }} />
            {/* soft blend into the screen bg */}
            <LinearGradient colors={['rgba(5,13,9,0.55)', 'rgba(5,13,9,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54 }} pointerEvents="none" />
            <LinearGradient colors={['rgba(5,13,9,0)', 'rgba(5,13,9,0.6)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }} pointerEvents="none" />

            {/* bead glow overlay — walks the strand as you count */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: imgW, height: imgH }}>
              {Array.from({ length: BEADS }).map((_, i) =>
                i < activeBead ? (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: beadAt(i).x * imgW - BEAD_W * imgW * 0.14,
                      top: beadAt(i).y * imgH - BEAD_W * imgW * 0.14,
                      width: BEAD_W * imgW * 0.28,
                      height: BEAD_W * imgW * 0.28,
                      borderRadius: BEAD_W * imgW * 0.14,
                      backgroundColor: NEON,
                      opacity: 0.32,
                    }}
                  />
                ) : null
              )}
              <Animated.View
                style={{
                  position: 'absolute',
                  left: beadAt(activeBead).x * imgW,
                  top: beadAt(activeBead).y * imgH,
                  width: 0,
                  height: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: glowPulse }],
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    width: BEAD_W * imgW * 5.4,
                    height: BEAD_W * imgW * 5.4,
                    borderRadius: (BEAD_W * imgW * 5.4) / 2,
                    backgroundColor: 'rgba(74,227,143,0.30)',
                    shadowColor: NEON,
                    shadowOpacity: 0.9,
                    shadowRadius: 22,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 8,
                  }}
                />
                <View style={{ width: BEAD_W * imgW * 1.05, height: BEAD_W * imgW * 1.05, borderRadius: (BEAD_W * imgW * 1.05) / 2, backgroundColor: 'rgba(174,255,208,0.95)' }} />
              </Animated.View>
            </View>
          </View>

          {/* interaction hint */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 }}>
            <FontAwesome5 name="hand-pointer" size={11} color={NEON} />
            <T v="caption" style={{ fontSize: 11, color: INK_FAINT, letterSpacing: 0.3 }}>Swipe or tap on the beads to count</T>
          </View>
        </Pressable>

        {/* ── mood ── */}
        <View style={{ ...glass, marginHorizontal: 16, marginTop: 16, padding: 15 }}>
          <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1, color: 'rgba(242,247,243,0.45)', marginBottom: 11 }}>HOW ARE YOU FEELING?</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {MOODS.map((m) => {
              const on = mood === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => pickMood(m.id)}
                  style={{
                    alignItems: 'center',
                    gap: 5,
                    borderRadius: 15,
                    borderWidth: 1,
                    borderColor: on ? 'rgba(74,227,143,0.65)' : 'rgba(255,255,255,0.07)',
                    backgroundColor: on ? 'rgba(74,227,143,0.10)' : 'rgba(255,255,255,0.03)',
                    paddingHorizontal: 9,
                    paddingVertical: 9,
                    shadowColor: NEON,
                    shadowOpacity: on ? 0.35 : 0,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 0 },
                    flex: 1,
                    marginHorizontal: 2,
                  }}
                >
                  <T v="caption" style={{ fontSize: 17 }}>{m.emoji}</T>
                  <T v="caption" style={{ fontSize: 9, fontWeight: '700', color: on ? NEON : INK_FAINT }}>{m.label}</T>
                </Pressable>
              );
            })}
          </View>
        </View>

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
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(2,6,4,0.75)', justifyContent: 'flex-end' }} onPress={() => setSettingsOpen(false)}>
          <Pressable style={{ backgroundColor: '#081209', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: GLASS_BR, paddingBottom: insets.bottom + 18, paddingTop: 16 }} onPress={(e) => stopBubble(e)}>
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
    </View>
  );
}
