import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native';
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

/**
 * pass 42 — DAILY ZIKR CHALLENGE (replaces the plain morning/evening athkar
 * row in the Learning library). Three interactive challenges — tasbeeh,
 * istighfar (zikr) and salawat — with a huge tap-to-count ring, per-day
 * persistence and completion that counts toward Today's Goals (routine.ts).
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

/* the 3 tasbeeh stages for the caption */
const tasbeehStage = (n: number) => (n < 33 ? { name: 'SubhanAllah', left: 33 - n } : n < 66 ? { name: 'Alhamdulillah', left: 66 - n } : { name: 'Allahu Akbar', left: 99 - n });

export default function ZikrChallenge() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('tasbeeh');
  const [rec, setRec] = useState<Rec>({ tasbeeh: 0, istighfar: 0, salawat: 0 });
  const [reward, setReward] = useState<{ open: boolean; amount: number }>({ open: false, amount: 0 });

  const ch = CHALLENGES.find((c) => c.id === mode)!;
  const count = Math.min(rec[mode], ch.target);
  const done = count >= ch.target;
  const allDone = CHALLENGES.every((c) => rec[c.id] >= c.target);

  const load = () => {
    storage.getItem(KEY()).then((r) => {
      try { if (r) setRec({ tasbeeh: 0, istighfar: 0, salawat: 0, ...(JSON.parse(r) as Partial<Rec>) }); } catch {}
    }).catch(() => {});
  };
  useEffect(load, []);

  const persist = (next: Rec) => {
    setRec(next);
    storage.setItem(KEY(), JSON.stringify(next)).catch(() => {});
  };

  const pulse = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const [plusAt, setPlusAt] = useState(0);

  const bump = () => {
    if (done) return;
    haptic.light();
    const n = count + 1;
    persist({ ...rec, [mode]: n, rewarded: rec.rewarded });
    setPlusAt((x) => x + 1);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
    float.setValue(0);
    Animated.timing(float, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    if (n >= ch.target) {
      haptic.success();
      const nextAll = CHALLENGES.every((c) => (c.id === mode ? n : rec[c.id]) >= c.target);
      markGoal('dhikr');
      markActive();
      if (nextAll && rec.rewarded !== DAY()) {
        persist({ ...rec, [mode]: n, rewarded: DAY() });
        setTimeout(() => setReward({ open: true, amount: 25 }), 500);
      }
    }
  };

  const stage = mode === 'tasbeeh' ? tasbeehStage(count) : null;
  const ringFrac = count / ch.target;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#06110C' : '#F2F6F3' }}>
      <LinearGradient colors={[isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.08)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 240 }} pointerEvents="none" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <BackButton />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T v="h2" style={{ fontWeight: '900', fontSize: 19, color: d.text }}>Daily Zikr Challenge</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>Tasbeeh · Zikr · Salawat — part of your daily routine</T>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* challenge selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 9 }}>
          {CHALLENGES.map((c) => {
            const on = mode === c.id;
            const cdone = rec[c.id] >= c.target;
            const frac = Math.min(1, rec[c.id] / c.target);
            return (
              <Pressable
                key={c.id}
                accessibilityLabel={`challenge ${c.label}`}
                onPress={() => { haptic.selection(); setMode(c.id); }}
                style={{ width: 148, borderRadius: 17, borderWidth: 1.5, borderColor: on ? c.tint : d.cardBorder, backgroundColor: on ? `${c.tint}14` : d.card, padding: 12 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: `${c.tint}1E`, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={cdone ? 'check' : c.icon} size={11} color={c.tint} />
                  </View>
                  <T v="caption" style={{ flex: 1, fontSize: 9.5, fontWeight: '900', color: c.tint, letterSpacing: 0.4 }}>{c.id.toUpperCase()}</T>
                </View>
                <T v="bodyS" style={{ fontSize: 11.5, fontWeight: '800', color: d.text, marginTop: 7 }}>{c.label}</T>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', marginTop: 8, overflow: 'hidden' }}>
                  <View style={{ width: `${frac * 100}%`, height: 5, borderRadius: 3, backgroundColor: c.tint }} />
                </View>
                <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 5 }}>{Math.min(rec[c.id], c.target)} / {c.target}{cdone ? ' · complete ✓' : ''}</T>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* THE counter */}
        <Pressable accessibilityLabel="zikr counter" onPress={bump} style={{ marginHorizontal: 16, marginTop: 6, borderRadius: 26, overflow: 'hidden', borderWidth: 1.5, borderColor: `${ch.tint}55` }}>
          <LinearGradient colors={ch.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22, alignItems: 'center' }}>
            <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, color: 'rgba(255,255,255,0.65)' }}>{ch.label.toUpperCase()}</T>
            <T v="arabic" style={{ fontSize: 22, lineHeight: 40, color: '#FFFFFF', textAlign: 'center', marginTop: 6 }}>{ch.arabic}</T>
            <T v="caption" style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 2, lineHeight: 15 }}>{stage ? `${stage.name} — ${stage.left} to go` : ch.sub}</T>

            {/* tap ring */}
            <View style={{ marginTop: 18, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 208, height: 208, borderRadius: 104, borderWidth: 9, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', position: 'absolute' }} />
              {/* progress arc drawn as growing overlaid rings (no svg needed) */}
              {[...Array(40)].map((_, i) => {
                const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
                const lit = i / 40 < ringFrac;
                return (
                  <View
                    key={i}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 104 + Math.cos(a) * 95 - 4,
                      top: 104 + Math.sin(a) * 95 - 4,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: lit ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
                      shadowColor: '#FFFFFF',
                      shadowOpacity: lit ? 0.6 : 0,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 0 },
                    }}
                  />
                );
              })}
              <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ scale: pulse }] }}>
                <T v="display" style={{ fontSize: 64, fontWeight: '900', color: '#FFFFFF' }}>{count}</T>
                <T v="caption" style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '800', marginTop: -4 }}>/ {ch.target}</T>
                <T v="caption" style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 10, letterSpacing: 0.4 }}>{done ? 'CHALLENGE COMPLETE — MASHAALLAH 🤍' : 'TAP ANYWHERE TO COUNT'}</T>
              </Animated.View>
              {/* +1 float */}
              <Animated.Text
                pointerEvents="none"
                style={{ position: 'absolute', right: 30, top: 24, fontFamily: 'Poppins-ExtraBold', fontSize: 21, color: '#FFFFFF', opacity: float.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [8, -44] }) }] }}
              >
                +1
              </Animated.Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* overall progress + reset */}
        <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FontAwesome5 name="calendar-check" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="bodyS" style={{ flex: 1, fontSize: 12, fontWeight: '800', color: d.text }}>Today’s routine</T>
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '900', color: isDark ? '#4AE38F' : '#1D6F42' }}>{CHALLENGES.filter((c) => rec[c.id] >= c.target).length}/3 done</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {CHALLENGES.map((c) => (
              <View key={c.id} style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)' }}>
                <View style={{ width: `${Math.min(1, rec[c.id] / c.target) * 100}%`, height: 6, backgroundColor: c.tint }} />
              </View>
            ))}
          </View>
          <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 9, lineHeight: 14 }}>
            {allDone
              ? 'All three challenges complete — this counts as your Dhikr goal for today, and 25 DeenPoints are yours. Alhamdulillah!'
              : 'Finish all three to complete the Dhikr goal in Today’s Goals — and earn 25 DeenPoints once a day.'}
          </T>
          <Pressable
            onPress={() => { haptic.selection(); persist({ ...rec, [mode]: 0 }); }}
            style={{ alignSelf: 'flex-start', marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 10, paddingVertical: 7 }}
          >
            <FontAwesome5 name="undo" size={9} color={d.faint} />
            <T v="caption" style={{ fontSize: 9.5, fontWeight: '700', color: d.faint }}>Reset {ch.id}</T>
          </Pressable>
        </View>
      </ScrollView>

      <RewardModal visible={reward.open} onClose={() => setReward({ open: false, amount: 0 })} amount={reward.amount} title="Zikr challenge complete!" />
    </View>
  );
}
