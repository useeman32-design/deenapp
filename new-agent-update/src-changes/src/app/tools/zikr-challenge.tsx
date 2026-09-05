import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { BackButton } from '@/components/BackButton';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { markActive, markGoal } from '@/lib/routine';
import { RewardModal } from '@/components/DeenPoints';
import { LinearGradient } from 'expo-linear-gradient';
import { useAllAthkar } from '@/lib/liveAthkar';
import { type Athar } from '@/data/athkar';
import { readDhikrCount, writeDhikrCount, getStreak, recordFullDay } from '@/lib/zikrChallenge';
import { useFocusEffect, useRouter } from 'expo-router';
import { Card } from '@/components/Card';
import { ContentSearchOverlay } from '@/components/ContentSearchOverlay';

/**
 * PASS 53 — DAILY ZIKR CHALLENGE REBUILD
 * This is the REAL daily dhikr screen. It replaces /tools/athkar entirely.
 * 
 * What changed:
 * - Counter + circular beads are PERFECTLY CENTERED (balanced layout)
 * - All text is balanced and centered where appropriate
 * - Athkar challenge content (Morning/Evening/After Prayer/General) moved INTO this screen
 * - Streak hero, progress, and completion are centered and symmetrical
 * - Athkar detail is now an in-screen modal (no separate route needed)
 */

type Mode = 'tasbeeh' | 'istighfar' | 'salawat';

const CHALLENGES: Array<{
  id: Mode;
  label: string;
  arabic: string;
  sub: string;
  target: number;
  tint: string;
  grad: [string, string];
  icon: string;
}> = [
  { id: 'tasbeeh', label: 'After-Prayer Tasbeeh', arabic: 'سُبْحَانَ ٱللَّهِ · ٱلْحَمْدُ لِلَّهِ · ٱللَّهُ أَكْبَرُ', sub: '33 · 33 · 34 — the Prophet’s ﷺ way after every prayer', target: 99, tint: '#4AE38F', grad: ['#0E5E3C', '#127A4C'], icon: 'circle-notch' },
  { id: 'istighfar', label: 'Istighfar — 100×', arabic: 'أَسْتَغْفِرُ ٱللَّهَ وَأَتُوبُ إِلَيْهِ', sub: 'Seek forgiveness 100 times — wipe the day clean', target: 100, tint: '#5BC8F5', grad: ['#15527A', '#1B77A8'], icon: 'hands-helping' },
  { id: 'salawat', label: 'Salawat — 100×', arabic: 'ٱللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', sub: '100 salawat on the Prophet ﷺ — ten mercies for each one', target: 100, tint: '#E8C96A', grad: ['#7A6215', '#96781D'], icon: 'star-and-crescent' },
];

const DAY = () => new Date().toISOString().slice(0, 10);
type Rec = Record<Mode, number> & { rewarded?: string };
const KEY = () => `dl.zikr.${DAY()}`;

const GROUPS = ['Morning', 'Evening', 'After Prayer', 'General'] as const;
const GROUP_LABEL: Record<(typeof GROUPS)[number], string> = {
  Morning: '🌅 Morning',
  Evening: '🌇 Evening',
  'After Prayer': '🕌 After Prayer',
  General: '📿 General',
};
const isChallenge = (a: Athar) => a.group === 'Morning' || a.group === 'Evening';
const isDone = (a: Athar, count: number) => (a.count > 0 ? count >= a.count : count > 0);

const tasbeehStage = (n: number) => (n < 33 ? { name: 'SubhanAllah', left: 33 - n } : n < 66 ? { name: 'Alhamdulillah', left: 66 - n } : { name: 'Allahu Akbar', left: 99 - n });

export default function ZikrChallenge() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('tasbeeh');
  const [rec, setRec] = useState<Rec>({ tasbeeh: 0, istighfar: 0, salawat: 0 });
  const [reward, setReward] = useState<{ open: boolean; amount: number }>({ open: false, amount: 0 });

  // Athkar state
  const list = useAllAthkar();
  const [athkarCounts, setAthkarCounts] = useState<Record<string, number>>({});
  const [athkarStreak, setAthkarStreak] = useState(0);
  const [selectedAthkar, setSelectedAthkar] = useState<Athar | null>(null);
  const [athkarCount, setAthkarCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  const ch = CHALLENGES.find((c) => c.id === mode)!;
  const count = Math.min(rec[mode], ch.target);
  const done = count >= ch.target;
  const allDone = CHALLENGES.every((c) => rec[c.id] >= c.target);

  const load = useCallback(() => {
    storage.getItem(KEY()).then((r) => {
      try { if (r) setRec({ tasbeeh: 0, istighfar: 0, salawat: 0, ...(JSON.parse(r) as Partial<Rec>) }); } catch {}
    }).catch(() => {});
  }, []);

  const refreshAthkar = useCallback(async () => {
    const map: Record<string, number> = {};
    await Promise.all(list.map(async (a) => { map[a.id] = await readDhikrCount(a.id); }));
    setAthkarCounts(map);
    const chList = list.filter(isChallenge);
    const doneList = chList.filter((a) => isDone(a, map[a.id] ?? 0));
    if (chList.length > 0 && doneList.length === chList.length) {
      const s = await recordFullDay();
      setAthkarStreak(s.streak);
      markGoal('athkar').catch(() => {});
    } else {
      const s = await getStreak();
      setAthkarStreak(s.streak);
    }
  }, [list]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { void refreshAthkar(); }, [refreshAthkar]));

  const persist = (next: Rec) => {
    setRec(next);
    storage.setItem(KEY(), JSON.stringify(next)).catch(() => {});
  };

  const pulse = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;

  const bump = () => {
    if (done) return;
    haptic.light();
    const n = count + 1;
    persist({ ...rec, [mode]: n, rewarded: rec.rewarded });
    float.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    Animated.timing(float, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    if (n >= ch.target) {
      haptic.success();
      const nextAll = CHALLENGES.every((c) => (c.id === mode ? n : rec[c.id]) >= c.target);
      markGoal('dhikr').catch(() => {});
      markActive().catch(() => {});
      if (nextAll && rec.rewarded !== DAY()) {
        persist({ ...rec, [mode]: n, rewarded: DAY() });
        setTimeout(() => setReward({ open: true, amount: 25 }), 500);
      }
    }
  };

  const stage = mode === 'tasbeeh' ? tasbeehStage(count) : null;
  const ringFrac = count / ch.target;

  // Athkar helpers
  const challengeAthkar = list.filter(isChallenge);
  const challengeDone = challengeAthkar.filter((a) => isDone(a, athkarCounts[a.id] ?? 0)).length;
  const challengeTotal = challengeAthkar.length || 1;
  const challengePct = Math.round((challengeDone / challengeTotal) * 100);
  const challengeComplete = challengeAthkar.length > 0 && challengeDone === challengeAthkar.length;

  const openAthkar = async (a: Athar) => {
    haptic.selection();
    setSelectedAthkar(a);
    const c = await readDhikrCount(a.id);
    setAthkarCount(c);
  };

  const bumpAthkar = async () => {
    if (!selectedAthkar) return;
    const next = athkarCount + 1;
    setAthkarCount(next);
    setAthkarCounts((m) => ({ ...m, [selectedAthkar.id]: next }));
    await writeDhikrCount(selectedAthkar.id, next);
    haptic.light();
    if (selectedAthkar.count > 0 && next >= selectedAthkar.count) {
      haptic.success();
      void refreshAthkar();
    }
  };

  const resetAthkar = async () => {
    if (!selectedAthkar) return;
    setAthkarCount(0);
    setAthkarCounts((m) => ({ ...m, [selectedAthkar.id]: 0 }));
    await writeDhikrCount(selectedAthkar.id, 0);
    haptic.selection();
  };

  const resetCurrent = () => {
    haptic.selection();
    persist({ ...rec, [mode]: 0 });
  };

  const BEAD_COUNT = 40;
  const RING_SIZE = 232;
  const RING_RADIUS = 104;
  const DOT_SIZE = 8;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#06110C' : '#F2F6F3' }}>
      <LinearGradient colors={[isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.08)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280 }} pointerEvents="none" />

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ── HEADER — perfectly centered ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, justifyContent: 'space-between' }}>
          <BackButton />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 }}>
            <T v="h2" style={{ fontWeight: '900', fontSize: 19, color: d.text, textAlign: 'center' }}>Daily Zikr Challenge</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 2, textAlign: 'center' }}>Tasbeeh · Istighfar · Salawat · Athkar</T>
          </View>
          <Pressable onPress={() => { haptic.selection(); setSearchOpen(true); }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="search" size={12} color={d.text} />
          </Pressable>
        </View>

        {/* ── TODAY'S CHALLENGE HERO — centered & balanced ── */}
        <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: isDark ? 'rgba(232,201,106,0.12)' : 'rgba(232,201,106,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="fire" size={12} color={athkarStreak > 0 || rec.rewarded === DAY() ? '#E8873A' : d.faint} />
            </View>
            <T v="caption" style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1, color: d.faint, textAlign: 'center' }}>TODAY'S CHALLENGE</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(232,201,106,0.1)' : 'rgba(232,201,106,0.12)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
              <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: '#E8C96A' }}>{athkarStreak} day streak</T>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6, marginTop: 14 }}>
            <T v="display" style={{ fontSize: 36, fontWeight: '900', color: d.text, textAlign: 'center', lineHeight: 40 }}>{CHALLENGES.filter((c) => rec[c.id] >= c.target).length + challengeDone}</T>
            <T v="bodyS" style={{ fontSize: 15, fontWeight: '700', color: d.faint, marginBottom: 5, textAlign: 'center' }}>/ {3 + challengeTotal} completed</T>
          </View>

          <View style={{ width: '100%', height: 8, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', overflow: 'hidden', marginTop: 14 }}>
            <View style={{ width: `${Math.round(((CHALLENGES.filter((c) => rec[c.id] >= c.target).length + challengeDone) / (3 + challengeTotal)) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: '#2ECC71' }} />
          </View>

          <T v="caption" style={{ fontSize: 12, color: d.subtext, marginTop: 12, textAlign: 'center', lineHeight: 18, fontWeight: '500' }}>
            {allDone && challengeComplete ? '🎉 All challenges complete — may Allah accept it. Keep your streak alive tomorrow!' : 'Complete your daily adhkar and zikr to finish today’s challenge and earn rewards.'}
          </T>

          {/* dual progress */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, width: '100%' }}>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(20,36,28,0.04)', padding: 10, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: d.faint, letterSpacing: 0.6, textAlign: 'center' }}>ZIKR COUNTERS</T>
              <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: d.text, marginTop: 2, textAlign: 'center' }}>{CHALLENGES.filter((c) => rec[c.id] >= c.target).length}/3</T>
              <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', marginTop: 6, overflow: 'hidden' }}>
                <View style={{ width: `${(CHALLENGES.filter((c) => rec[c.id] >= c.target).length / 3) * 100}%`, height: 4, backgroundColor: '#4AE38F' }} />
              </View>
            </View>
            <View style={{ flex: 1, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(20,36,28,0.04)', padding: 10, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: d.faint, letterSpacing: 0.6, textAlign: 'center' }}>MORNING & EVENING</T>
              <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: d.text, marginTop: 2, textAlign: 'center' }}>{challengeDone}/{challengeTotal}</T>
              <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', marginTop: 6, overflow: 'hidden' }}>
                <View style={{ width: `${challengePct}%`, height: 4, backgroundColor: challengeComplete ? '#2ECC71' : '#E8C96A' }} />
              </View>
            </View>
          </View>
        </View>

        {/* ── CHALLENGE SELECTOR — centered, equal, balanced ── */}
        <View style={{ marginTop: 18, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
            <FontAwesome5 name="bullseye" size={11} color={d.faint} />
            <T v="caption" style={{ fontWeight: '900', fontSize: 10, letterSpacing: 1, color: d.faint, textAlign: 'center' }}>CHOOSE YOUR ZIKR</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            {CHALLENGES.map((c) => {
              const on = mode === c.id;
              const cdone = rec[c.id] >= c.target;
              const frac = Math.min(1, rec[c.id] / c.target);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => { haptic.selection(); setMode(c.id); }}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: on ? c.tint : d.cardBorder,
                    backgroundColor: on ? `${c.tint}14` : d.card,
                    padding: 12,
                    alignItems: 'center',
                  }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${c.tint}1E`, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={cdone ? 'check' : c.icon} size={12} color={c.tint} />
                  </View>
                  <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', color: c.tint, letterSpacing: 0.5, marginTop: 8, textAlign: 'center' }}>{c.id.toUpperCase()}</T>
                  <T v="bodyS" style={{ fontSize: 11, fontWeight: '800', color: d.text, marginTop: 4, textAlign: 'center', lineHeight: 14 }} numberOfLines={2}>{c.label}</T>
                  <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', marginTop: 8, overflow: 'hidden' }}>
                    <View style={{ width: `${frac * 100}%`, height: 4, borderRadius: 2, backgroundColor: c.tint }} />
                  </View>
                  <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 5, textAlign: 'center' }}>{Math.min(rec[c.id], c.target)}/{c.target}{cdone ? ' ✓' : ''}</T>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── THE COUNTER — PERFECTLY CENTERED ── */}
        <View style={{ marginHorizontal: 16, marginTop: 18, alignItems: 'center' }}>
          <Pressable
            accessibilityLabel="zikr counter"
            onPress={bump}
            style={{
              width: '100%',
              borderRadius: 28,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: `${ch.tint}55`,
              alignItems: 'center',
            }}
          >
            <LinearGradient colors={ch.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 16, alignItems: 'center' }}>
              {/* label */}
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>{ch.label.toUpperCase()}</T>

              {/* arabic — centered & balanced */}
              <View style={{ marginTop: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}>
                <T v="arabic" style={{ fontSize: 21, lineHeight: 38, color: '#FFFFFF', textAlign: 'center' }}>{ch.arabic}</T>
              </View>

              <T v="caption" style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginTop: 6, lineHeight: 16, paddingHorizontal: 16, fontWeight: '500' }}>
                {stage ? `${stage.name} — ${stage.left} to go` : ch.sub}
              </T>

              {/* ── centered bead ring + count ── */}
              <View style={{ marginTop: 22, width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                {/* outer faint ring */}
                <View style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderWidth: 10, borderColor: 'rgba(255,255,255,0.10)' }} />
                <View style={{ position: 'absolute', width: RING_SIZE - 20, height: RING_SIZE - 20, borderRadius: (RING_SIZE - 20) / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

                {/* 40 dots — perfectly centered around center */}
                {Array.from({ length: BEAD_COUNT }).map((_, i) => {
                  const angle = (i / BEAD_COUNT) * Math.PI * 2 - Math.PI / 2;
                  const lit = i / BEAD_COUNT < ringFrac;
                  const cx = RING_SIZE / 2 + Math.cos(angle) * RING_RADIUS - DOT_SIZE / 2;
                  const cy = RING_SIZE / 2 + Math.sin(angle) * RING_RADIUS - DOT_SIZE / 2;
                  return (
                    <View
                      key={i}
                      style={{
                        position: 'absolute',
                        left: cx,
                        top: cy,
                        width: DOT_SIZE,
                        height: DOT_SIZE,
                        borderRadius: DOT_SIZE / 2,
                        backgroundColor: lit ? '#FFFFFF' : 'rgba(255,255,255,0.18)',
                        shadowColor: '#FFFFFF',
                        shadowOpacity: lit ? 0.7 : 0,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 0 },
                      }}
                    />
                  );
                })}

                {/* center count — perfectly centered */}
                <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ scale: pulse }] }}>
                  <T v="display" style={{ fontSize: 56, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 62 }}>{count}</T>
                  <T v="caption" style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginTop: -2, textAlign: 'center' }}>/ {ch.target}</T>
                  <View style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <T v="caption" style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5, fontWeight: '700', textAlign: 'center' }}>{done ? 'COMPLETE — MASHAALLAH 🤍' : 'TAP TO COUNT'}</T>
                  </View>
                </Animated.View>

                {/* +1 float */}
                <Animated.Text
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    right: 18,
                    top: 20,
                    fontFamily: 'Poppins-ExtraBold',
                    fontSize: 20,
                    color: '#FFFFFF',
                    opacity: float.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                    transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [8, -36] }) }],
                  }}
                >
                  +1
                </Animated.Text>
              </View>

              {/* reset — centered */}
              <Pressable
                onPress={resetCurrent}
                style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 7 }}
              >
                <FontAwesome5 name="undo" size={9} color="rgba(255,255,255,0.85)" />
                <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>Reset {ch.id}</T>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── TODAY'S ROUTINE — centered ── */}
        <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <FontAwesome5 name="calendar-check" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: d.text, textAlign: 'center' }}>Today’s Routine</T>
            <View style={{ backgroundColor: isDark ? 'rgba(74,227,143,0.12)' : 'rgba(29,111,66,0.08)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <T v="caption" style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#4AE38F' : '#1D6F42', textAlign: 'center' }}>{CHALLENGES.filter((c) => rec[c.id] >= c.target).length}/3 done</T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, width: '100%' }}>
            {CHALLENGES.map((c) => (
              <View key={c.id} style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)' }}>
                <View style={{ width: `${Math.min(1, rec[c.id] / c.target) * 100}%`, height: 6, backgroundColor: c.tint }} />
              </View>
            ))}
          </View>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 10, lineHeight: 15, textAlign: 'center' }}>
            {allDone ? 'All three zikr challenges complete — this counts as your Dhikr goal for today, and 25 DeenPoints are yours. Alhamdulillah!' : 'Finish all three to complete the Dhikr goal in Today’s Goals — and earn 25 DeenPoints once a day.'}
          </T>
        </View>

        {/* ── ATHKAR CHALLENGE CONTENT — moved into this screen, balanced ── */}
        <View style={{ marginHorizontal: 16, marginTop: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? 'rgba(232,201,106,0.12)' : 'rgba(232,201,106,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="book-reader" size={13} color="#E8C96A" />
            </View>
            <View style={{ alignItems: 'center' }}>
              <T v="bodyS" style={{ fontSize: 15, fontWeight: '900', color: d.text, textAlign: 'center' }}>Daily Athkar</T>
              <T v="caption" style={{ fontSize: 10, color: d.faint, textAlign: 'center' }}>Morning & evening remembrances</T>
            </View>
          </View>

          {GROUPS.map((g) => {
            const items = list.filter((a) => a.group === g);
            if (!items.length) return null;
            const doneCount = items.filter((a) => isDone(a, athkarCounts[a.id] ?? 0)).length;
            return (
              <View key={g} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 }}>
                  <T v="bodyS" style={{ fontSize: 14, fontWeight: '800', color: d.text }}>{GROUP_LABEL[g]}</T>
                  <View style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <T v="caption" style={{ fontSize: 11, fontWeight: '700', color: d.faint }}>{doneCount}/{items.length}</T>
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  {items.map((a) => {
                    const cnt = athkarCounts[a.id] ?? 0;
                    const finished = isDone(a, cnt);
                    return (
                      <Card
                        key={a.id}
                        onPress={() => openAthkar(a)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 13,
                          paddingHorizontal: 14,
                          borderWidth: finished ? 1.5 : 1,
                          borderColor: finished ? 'rgba(47,168,102,0.35)' : d.cardBorder,
                          backgroundColor: finished ? (isDark ? 'rgba(47,168,102,0.08)' : 'rgba(47,168,102,0.06)') : d.card,
                        }}
                      >
                        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: finished ? 'rgba(47,168,102,0.14)' : d.bg, borderWidth: 1, borderColor: finished ? 'rgba(47,168,102,0.25)' : d.cardBorder, alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
                          <FontAwesome5 name={finished ? 'check' : 'circle'} size={14} color={finished ? '#2FA866' : d.faint} solid={finished} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <T v="bodyS" style={{ color: d.text, fontWeight: '700', fontSize: 13.5, lineHeight: 18 }}>{a.name}</T>
                          <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 2, lineHeight: 14 }} numberOfLines={1}>{a.transliteration}</T>
                        </View>
                        <View style={{ alignItems: 'center', marginLeft: 10 }}>
                          <View style={{ backgroundColor: finished ? 'rgba(47,168,102,0.14)' : theme.primarySoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }}>
                            <T v="caption" style={{ color: finished ? '#2FA866' : theme.primary, fontWeight: '800', fontSize: 11, textAlign: 'center' }}>{a.count === 0 ? '∞' : `×${a.count}`}</T>
                          </View>
                          {cnt > 0 ? <T v="caption" style={{ fontSize: 9, color: finished ? '#2FA866' : d.faint, marginTop: 3, fontWeight: '700', textAlign: 'center' }}>{Math.min(cnt, a.count || cnt)}/{a.count || '∞'}</T> : null}
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <View style={{ borderRadius: 14, backgroundColor: isDark ? 'rgba(232,201,106,0.06)' : 'rgba(232,201,106,0.08)', borderWidth: 1, borderColor: 'rgba(232,201,106,0.22)', padding: 13, alignItems: 'center', marginTop: 4 }}>
            <T v="caption" style={{ fontSize: 11, color: d.subtext, textAlign: 'center', lineHeight: 17 }}>
              “Whoever says these remembrances in the morning and evening, Allah will protect him.” — Complete your morning & evening athkar daily to keep your streak alive.
            </T>
          </View>
        </View>
      </ScrollView>

      <ContentSearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder="Search athkar — name or text…"
        metaSearch={(q) =>
          list.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.transliteration.toLowerCase().includes(q.toLowerCase()))
            .map((a) => ({ key: a.id, title: a.name, subtitle: `${a.group} · ×${a.count || '∞'}`, onPress: () => { setSearchOpen(false); openAthkar(a); } }))
        }
        contentSearch={async (q) =>
          list.filter((a) => a.arabic.includes(q.trim()) || (a.note ?? '').toLowerCase().includes(q.toLowerCase()))
            .map((a) => ({ key: `c-${a.id}`, title: a.name, arabic: a.arabic.slice(0, 44), subtitle: (a.note ?? '').slice(0, 80), onPress: () => { setSearchOpen(false); openAthkar(a); } }))
        }
        contentLabel="In athkar texts"
      />

      {/* ── Athkar detail sheet — replaces separate route ── */}
      <Modal visible={!!selectedAthkar} transparent animationType="slide" onRequestClose={() => setSelectedAthkar(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelectedAthkar(null)} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: d.cardBorder, maxHeight: '88%', paddingBottom: insets.bottom + 16 }}>
            <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: d.cardBorder }} />
            </View>
            {selectedAthkar ? (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <FontAwesome5 name="book-reader" size={20} color={theme.primary} />
                </View>
                <T v="h2" style={{ fontSize: 18, fontWeight: '900', color: d.text, textAlign: 'center' }}>{selectedAthkar.name}</T>
                <T v="caption" style={{ fontSize: 11, color: d.faint, marginTop: 4, textAlign: 'center' }}>{selectedAthkar.group} · {selectedAthkar.count === 0 ? 'unlimited' : `${selectedAthkar.count}×`}</T>

                <View style={{ marginTop: 18, borderRadius: 16, backgroundColor: d.bg, borderWidth: 1, borderColor: d.cardBorder, padding: 16, width: '100%', alignItems: 'center' }}>
                  <T v="arabic" style={{ fontSize: 22, color: d.text, textAlign: 'center', lineHeight: 36 }}>{selectedAthkar.arabic}</T>
                  <T v="bodyS" style={{ fontSize: 12.5, color: d.subtext, marginTop: 10, textAlign: 'center', lineHeight: 18 }}>{selectedAthkar.transliteration}</T>
                  {selectedAthkar.note ? <T v="caption" style={{ fontSize: 11, color: d.faint, marginTop: 12, textAlign: 'center', lineHeight: 16 }}>{selectedAthkar.note}</T> : null}
                </View>

                {/* centered counter */}
                <View style={{ marginTop: 20, alignItems: 'center' }}>
                  <Pressable
                    onPress={bumpAthkar}
                    style={({ pressed }) => ({
                      width: 160,
                      height: 160,
                      borderRadius: 80,
                      backgroundColor: theme.primarySoft,
                      borderWidth: 3,
                      borderColor: theme.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    })}
                  >
                    <T v="display" style={{ fontSize: 42, fontWeight: '900', color: theme.primary, textAlign: 'center' }}>{athkarCount}</T>
                    <T v="caption" style={{ fontSize: 11, color: d.faint, marginTop: 2, textAlign: 'center' }}>{selectedAthkar.count > 0 ? `of ${selectedAthkar.count}` : 'unlimited'}</T>
                    <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 6, textAlign: 'center' }}>TAP TO COUNT</T>
                  </Pressable>

                  {selectedAthkar.count > 0 ? (
                    <View style={{ width: 180, height: 6, borderRadius: 3, backgroundColor: d.bg, marginTop: 14, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder }}>
                      <View style={{ width: `${Math.min(100, (athkarCount / selectedAthkar.count) * 100)}%`, height: 6, backgroundColor: athkarCount >= selectedAthkar.count ? '#2FA866' : theme.primary }} />
                    </View>
                  ) : null}

                  {selectedAthkar.count > 0 && athkarCount >= selectedAthkar.count ? (
                    <T v="bodyS" style={{ color: '#2FA866', fontWeight: '800', marginTop: 12, fontSize: 13, textAlign: 'center' }}>MashaAllah! Completed 🎉</T>
                  ) : null}

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <Pressable onPress={resetAthkar} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: d.bg, borderWidth: 1, borderColor: d.cardBorder }}>
                      <T v="caption" style={{ color: d.text, fontWeight: '700', fontSize: 12, textAlign: 'center' }}>Reset</T>
                    </Pressable>
                    <Pressable onPress={() => setSelectedAthkar(null)} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.primary }}>
                      <T v="caption" style={{ color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' }}>Done</T>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <RewardModal visible={reward.open} onClose={() => setReward({ open: false, amount: 0 })} amount={reward.amount} title="Zikr challenge complete!" />
    </View>
  );
}
