import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, PanResponder, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Digital tasbeeh (pass 23 — full redesign, no more modal):
 *  · tasbih BEADS slide through the centre of the screen as you count
 *  · tap anywhere on the bead deck OR slide along it → +1 hasanat
 *  · counts reset every day (per-preset, stored with the date)
 *  · switch to a plain DIGITAL counter mode
 */

type Preset = { id: string; label: string; arabic: string; target: number };

const PRESETS: Preset[] = [
  { id: 'subhan', label: 'SubhanAllah', arabic: 'سُبْحَانَ ٱللَّهِ', target: 33 },
  { id: 'hamd', label: 'Alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّهِ', target: 33 },
  { id: 'akbar', label: 'Allahu Akbar', arabic: 'ٱللَّهُ أَكْبَرُ', target: 33 },
  { id: 'astghfar', label: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّهَ', target: 100 },
  { id: 'salawat', label: 'Salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', target: 11 },
  { id: 'unlimited', label: 'Unlimited dhikr', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّهُ', target: 0 },
];

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function Tasbeeh() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [presetId, setPresetId] = useState('subhan');
  const [mode, setMode] = useState<'beads' | 'digital'>('beads');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dayTotal, setDayTotal] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const W = Dimensions.get('window').width;

  /* daily state: { date, counts, total } — resets naturally each new day */
  useEffect(() => {
    storage.getItem('dl.tasbeeh.daily').then((r) => {
      try {
        const p = JSON.parse(r ?? '{}');
        if (p.date === todayKey()) {
          setCounts(p.counts ?? {});
          setDayTotal(p.total ?? 0);
        }
      } catch {}
    });
  }, []);

  const persist = (c: Record<string, number>, total: number) => {
    storage.setItem('dl.tasbeeh.daily', JSON.stringify({ date: todayKey(), counts: c, total })).catch(() => {});
  };

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const count = counts[presetId] ?? 0;
  const target = preset.target;
  const reached = target > 0 && count >= target;

  const bump = () => {
    const next = count + 1;
    const nc = { ...counts, [presetId]: next };
    const nt = dayTotal + 1;
    setCounts(nc);
    setDayTotal(nt);
    persist(nc, nt);
    pulse.setValue(1.35);
    Animated.spring(pulse, { toValue: 1, useNativeDriver: false, friction: 4, tension: 80 }).start();
    if (target > 0 && next === target) haptic.success();
    else haptic.light();
  };

  const reset = () => {
    haptic.selection();
    const nc = { ...counts, [presetId]: 0 };
    setCounts(nc);
    persist(nc, Math.max(0, dayTotal - count));
  };

  /* slide OR tap on the bead deck → count */
  const lastSlide = useRef(0);
  const deckPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const now = Date.now();
          if (now - lastSlide.current > 140) {
            lastSlide.current = now;
            bump();
          }
        },
        onPanResponderMove: (_e, g) => {
          const now = Date.now();
          const speed = Math.abs(g.dx) + Math.abs(g.dy);
          if (now - lastSlide.current > Math.max(90, 320 - speed * 2)) {
            lastSlide.current = now;
            bump();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, dayTotal, counts],
  );

  /* the bead string: target beads (or 33), progress-filled from the right */
  const beads = target > 0 ? target : 33;
  const filled = target > 0 ? Math.min(count, target) : count % 33;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="circle-notch" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }}>Digital Tasbeeh</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>Today: {dayTotal} hasanat · resets at midnight</T>
          </View>
          {/* beads ⇄ digital */}
          <Pressable onPress={() => { haptic.selection(); setMode((m) => (m === 'beads' ? 'digital' : 'beads')); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 11, paddingVertical: 8 }}>
            <FontAwesome5 name={mode === 'beads' ? 'grip-lines' : 'digit'} size={10} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <FontAwesome5 name={mode === 'beads' ? 'calculator' : 'circle'} size={10} color={d.faint} />
            <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: d.subtext }}>{mode === 'beads' ? 'Digital' : 'Beads'}</T>
          </Pressable>
        </View>

        {/* presets */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 12, gap: 7 }}>
          {PRESETS.map((p) => {
            const on = p.id === presetId;
            const c = counts[p.id] ?? 0;
            return (
              <Pressable
                key={p.id}
                onPress={() => { haptic.selection(); setPresetId(p.id); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.35)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(14,122,70,0.08)') : d.card, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext }}>{p.label}</T>
                {c > 0 ? (
                  <View style={{ borderRadius: 8, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', paddingHorizontal: 5, paddingVertical: 1 }}>
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', color: '#FFFFFF' }}>{c}</T>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── the counter deck ── */}
        <Pressable accessibilityLabel="tasbeeh-deck" accessibilityRole="button" onPress={bump} {...(mode === 'beads' ? deckPan.panHandlers : {})}>
          <View style={{ marginHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: reached ? 'rgba(212,175,55,0.55)' : d.cardBorder, backgroundColor: d.card, padding: 18, alignItems: 'center', overflow: 'hidden' }}>
            <T v="arabic" style={{ fontSize: 24, color: d.text, textAlign: 'center' }}>{preset.arabic}</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 3 }}>
              {preset.label}{target > 0 ? ` · target ${target}` : ' · unlimited'}
            </T>

            {mode === 'beads' ? (
              <View style={{ marginTop: 16, width: '100%' }}>
                {/* bead string — a groove with beads that light up from the right */}
                <View style={{ height: 58, borderRadius: 29, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.05)', borderWidth: 1, borderColor: d.cardBorder, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 }}>
                  {Array.from({ length: Math.min(beads, 19) }).map((_, i) => {
                    /* map the bead index so progress fills from the RIGHT */
                    const idx = Math.min(beads, 19) - 1 - i;
                    const lit = idx < filled;
                    return (
                      <View
                        key={i}
                        style={{
                          flex: 1,
                          maxWidth: 20,
                          aspectRatio: 1,
                          borderRadius: 10,
                          backgroundColor: lit ? (isDark ? '#4AE38F' : '#1D6F42') : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(20,36,28,0.10)',
                          borderWidth: 1,
                          borderColor: lit ? 'rgba(255,255,255,0.35)' : d.cardBorder,
                        }}
                      />
                    );
                  })}
                </View>
                {beads > 19 ? (
                  <T v="caption" style={{ fontSize: 9, color: d.faint, textAlign: 'center', marginTop: 6 }}>
                    {filled} of {beads} beads lit
                  </T>
                ) : null}
              </View>
            ) : null}

            {/* the big count */}
            <Animated.Text
              style={{
                fontFamily: 'Poppins-ExtraBold',
                fontSize: 68,
                color: reached ? '#E8C96A' : isDark ? '#4AE38F' : '#1D6F42',
                marginTop: 10,
                transform: [{ scale: pulse }],
              }}
            >
              {count}
            </Animated.Text>

            {target > 0 ? (
              <View style={{ width: '100%', marginTop: 4 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, (count / target) * 100)}%`, height: 6, backgroundColor: reached ? '#E8C96A' : isDark ? '#4AE38F' : '#1D6F42' }} />
                </View>
              </View>
            ) : null}

            <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 10 }}>
              {reached ? 'Target complete — Alhamdulillah! Continue or pick another dhikr' : mode === 'beads' ? 'Tap the card or slide along the beads' : 'Tap anywhere on the card'}
            </T>
          </View>
        </Pressable>

        {/* reset + hasanat summary */}
        <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12 }}>
          <Pressable onPress={reset} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingVertical: 11 }}>
            <FontAwesome5 name="undo" size={11} color={d.subtext} />
            <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: d.subtext }}>Reset this dhikr</T>
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.22)', paddingVertical: 11 }}>
            <FontAwesome5 name="star" size={11} color="#E8C96A" />
            <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: d.text }}>{dayTotal} hasanat today</T>
          </View>
        </View>

        <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 14, marginHorizontal: 40, lineHeight: 15 }}>
          “Whoever says SubhanAllah 33 times, Alhamdulillah 33 times, Allahu Akbar 33 times after every prayer — that is 99 — then says ‘la ilaha illallah wahdahu la sharika lah…’ completes one hundred, his sins are forgiven even if they were like the foam of the sea.” (Muslim)
        </T>
      </ScrollView>
    </View>
  );
}
