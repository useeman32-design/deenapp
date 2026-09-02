import { useEffect, useRef, useState } from 'react';
import { Image, TextInput, ActivityIndicator, Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * pass 35 — DeenPoints system.
 *  · <DPIcon size color/> — the coin icon used EVERYWHERE points appear
 *  · useDeenPoints() — balance + add/spend (persisted at dl.deenpoints)
 *  · <DeenPointsBuyModal visible onClose/> — purchase modal: ₦1.5 per point,
 *    packs, simulated payment, animated top-up
 *  · <RewardModal visible onClose amount text/> — the +5 check-in reward box
 *    animation (chest/glow pop + coins)
 */

export const DP_KEY = 'dl.deenpoints';
export const DP_DEFAULT = 1250;
export const DP_PRICE = 1.5; /* naira per point */

/* pass 41 — the REAL DeenPoints coin image (assets/img/deenpoints.png, same as
   the profile balance) everywhere points appear; was a generic FontAwesome coin */
const DP_IMAGE = require('../../assets/img/deenpoints.png');
export function DPIcon({ size = 13 }: { size?: number; color?: string }) {
  return <Image source={DP_IMAGE} style={{ width: size, height: size, borderRadius: (size * 0.2) }} resizeMode="contain" />;
}

export function useDeenPoints() {
  const [points, setPoints] = useState(DP_DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.getItem(DP_KEY).then((r) => {
      const n = r ? parseInt(r, 10) : DP_DEFAULT;
      if (Number.isFinite(n)) setPoints(n);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const add = (n: number) => setPoints((p) => {
    const next = p + n;
    storage.setItem(DP_KEY, String(next)).catch(() => {});
    return next;
  });
  const spend = (n: number) => setPoints((p) => {
    const next = Math.max(0, p - n);
    storage.setItem(DP_KEY, String(next)).catch(() => {});
    return next;
  });

  return { points, ready, add, spend };
}

/* ── purchase modal ── */
const PACKS = [
  { pts: 100, bonus: 0 },
  { pts: 500, bonus: 25 },
  { pts: 1000, bonus: 100 },
  { pts: 5000, bonus: 750 },
];

export function DeenPointsBuyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme, isDark } = useTheme();
  const { points, add } = useDeenPoints();
  const [pack, setPack] = useState(PACKS[1]);
  /* pass 38 — custom amount entry */
  const [custom, setCustom] = useState('');
  const customPts = Math.max(0, Math.min(100000, parseInt(custom, 10) || 0));
  const customOn = customPts >= 10;
  const [phase, setPhase] = useState<'pick' | 'paying' | 'done'>('pick');
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) { setPhase('pick'); Animated.spring(pop, { toValue: 1, friction: 7, useNativeDriver: false }).start(); }
    else pop.setValue(0);
  }, [visible, pop]);

  const pay = () => {
    if (phase !== 'pick') return;
    haptic.medium();
    const total = customOn ? customPts : pack.pts + pack.bonus;
    setPhase('paying');
    setTimeout(() => {
      add(total);
      haptic.success();
      setPhase('done');
    }, 1600);
  };

  const naira = (n: number) => `₦${(n * DP_PRICE).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(2,8,5,0.66)', alignItems: 'center', justifyContent: 'center', padding: 22 }} onPress={onClose}>
        <Animated.View style={{ width: '100%', maxWidth: 360, borderRadius: 24, borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.35)' : 'rgba(184,134,11,0.3)', backgroundColor: isDark ? '#0A1A11' : '#FFFFFF', padding: 20, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }} onStartShouldSetResponder={() => true}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(212,175,55,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <DPIcon size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="h3" style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Get DeenPoints</T>
                <T v="caption" style={{ fontSize: 10.5, color: theme.subtext, marginTop: 1 }}>₦1.5 per point · balance {points.toLocaleString()}</T>
              </View>
              <Pressable onPress={onClose} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={11} color={theme.subtext} />
              </Pressable>
            </View>

            {phase === 'pick' ? (
              <View style={{ marginTop: 16, gap: 9 }}>
                {/* pass 41 — packs as a 2×2 grid of cards with the real coin art, bonus ribbons + best-value tag */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 9 }}>
                  {PACKS.map((p) => {
                    const on = pack.pts === p.pts;
                    const best = p.pts === 5000;
                    return (
                      <Pressable
                        key={p.pts}
                        onPress={() => { haptic.selection(); setPack(p); setCustom(''); }}
                        style={({ pressed }) => ({
                          width: '48.5%',
                          borderRadius: 18,
                          borderWidth: 1.5,
                          borderColor: on ? '#D4AF37' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20,36,28,0.1)'),
                          backgroundColor: on ? 'rgba(212,175,55,0.1)' : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(20,36,28,0.02)'),
                          paddingTop: 20,
                          paddingBottom: 13,
                          paddingHorizontal: 10,
                          alignItems: 'center',
                          gap: 5,
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        {best ? (
                          <View style={{ position: 'absolute', top: -1, right: -1, borderTopRightRadius: 16, borderBottomLeftRadius: 10, backgroundColor: '#1F8F5C', paddingHorizontal: 7, paddingVertical: 2.5 }}>
                            <T v="caption" style={{ fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5, color: '#FFFFFF' }}>BEST VALUE</T>
                          </View>
                        ) : null}
                        {on ? (
                          <View style={{ position: 'absolute', top: 7, left: 7, width: 17, height: 17, borderRadius: 9, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' }}>
                            <FontAwesome5 name="check" size={8} color="#FFFFFF" />
                          </View>
                        ) : null}
                        <DPIcon size={30} />
                        <T v="h3" style={{ fontSize: 16, fontWeight: '900', color: on ? '#B8860B' : theme.text }}>{p.pts.toLocaleString()}</T>
                        {p.bonus ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, backgroundColor: 'rgba(74,227,143,0.14)', paddingHorizontal: 7, paddingVertical: 2 }}>
                            <FontAwesome5 name="plus" size={7} color={isDark ? '#4AE38F' : '#1D6F42'} />
                            <T v="caption" style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#4AE38F' : '#1D6F42' }}>{p.bonus.toLocaleString()} bonus</T>
                          </View>
                        ) : (
                          <T v="caption" style={{ fontSize: 9, color: theme.subtext }}>points</T>
                        )}
                        <T v="caption" style={{ fontWeight: '800', fontSize: 12, color: on ? '#B8860B' : theme.subtext, marginTop: 2 }}>{naira(p.pts)}</T>
                      </Pressable>
                    );
                  })}
                </View>
                {/* pass 38 — custom amount */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, borderWidth: 1.5, borderColor: customOn ? '#D4AF37' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20,36,28,0.1)'), backgroundColor: customOn ? 'rgba(212,175,55,0.08)' : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(20,36,28,0.02)'), paddingHorizontal: 13, paddingVertical: 6 }}>
                  <FontAwesome5 name="keyboard" size={13} color={customOn ? '#D4AF37' : theme.subtext} />
                  <TextInput
                    accessibilityLabel="custom amount"
                    value={custom}
                    onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="Custom amount…"
                    placeholderTextColor={theme.subtext}
                    keyboardType="number-pad"
                    style={{ flex: 1, fontSize: 16, fontFamily: 'Poppins-Medium', color: theme.text, paddingVertical: 6 }}
                  />
                  {customOn ? (
                    <T v="caption" style={{ fontWeight: '800', fontSize: 12, color: '#B8860B' }}>{naira(customPts)}</T>
                  ) : (
                    <T v="caption" style={{ fontSize: 9.5, color: theme.subtext }}>min 10</T>
                  )}
                </View>
                <Pressable onPress={pay} disabled={!customOn} style={({ pressed }) => ({ marginTop: 4, borderRadius: 15, height: 50, backgroundColor: customOn ? '#1F8F5C' : '#1F8F5C', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: pressed ? 0.85 : 1 })}>
                  <FontAwesome5 name="credit-card" size={12} color="#fff" />
                  <T v="button" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                    {customOn ? `Pay ${naira(customPts)} · Get ${customPts.toLocaleString()}` : `Pay ${naira(pack.pts)} · Get ${(pack.pts + pack.bonus).toLocaleString()}`}
                  </T>
                </Pressable>
                {/* pass 38 — what are DeenPoints (same clarification as Ask-Scholars) */}
                <View style={{ marginTop: 8, borderRadius: 13, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.28)' : 'rgba(29,111,66,0.22)', backgroundColor: isDark ? 'rgba(46,204,113,0.06)' : 'rgba(29,111,66,0.04)', padding: 11 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <FontAwesome5 name="info-circle" size={10} color={isDark ? '#4AE38F' : '#1D6F42'} />
                    <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 0.7, color: isDark ? '#4AE38F' : '#1D6F42' }}>WHAT ARE DEENPOINTS?</T>
                  </View>
                  <T v="caption" style={{ fontSize: 10, lineHeight: 15.5, color: theme.subtext }}>
                    DeenPoints reward your activity — daily check-ins, quizzes and lessons earn points. Use them to highlight your questions to scholars (urgency priority only). DeenPoints do not buy fatwas or Islamic opinions — rulings are free and based on the Qur'an and Sunnah.
                  </T>
                </View>
                <T v="caption" style={{ textAlign: 'center', fontSize: 9.5, color: theme.subtext, marginTop: 6 }}>Simulated payment — no real charge.</T>
              </View>
            ) : phase === 'paying' ? (
              <View style={{ alignItems: 'center', paddingVertical: 38, gap: 12 }}>
                <ActivityIndicator size="large" color="#D4AF37" />
                <T v="caption" style={{ fontSize: 12, color: theme.subtext }}>Processing payment…</T>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 30, gap: 10 }}>
                <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(74,227,143,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(74,227,143,0.5)' }}>
                  <DPIcon size={34} />
                </View>
                <T v="h3" style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{(pack.pts + pack.bonus).toLocaleString()} points added</T>
                <T v="caption" style={{ fontSize: 11, color: theme.subtext }}>New balance {points.toLocaleString()}</T>
                <Pressable onPress={onClose} style={{ marginTop: 8, borderRadius: 14, paddingHorizontal: 26, height: 44, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}>
                  <T v="button" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Done</T>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export function RewardModal({ visible, onClose, amount = 5, title = 'Daily check-in complete!' }: { visible: boolean; onClose: () => void; amount?: number; title?: string }) {
  const { isDark } = useTheme();
  /* pass 38 — present-box OPENING animation: the box pops in, the lid flies
   * open, the DeenPoints coin rises out with sparkles and the +N counter */
  const box = useRef(new Animated.Value(0)).current;
  const lid = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      box.setValue(0); lid.setValue(0); rise.setValue(0); glow.setValue(0); spark.setValue(0);
      Animated.sequence([
        /* the box drops in */
        Animated.spring(box, { toValue: 1, friction: 6, useNativeDriver: false }),
        /* lid pops open (rotate back + lift) */
        Animated.timing(lid, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(2)), useNativeDriver: false }),
      ]).start();
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          /* the DeenPoints coin rises out of the box */
          Animated.timing(rise, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          /* glow blooms behind it */
          Animated.timing(glow, { toValue: 1, duration: 650, useNativeDriver: false }),
          /* sparkles burst */
          Animated.timing(spark, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        ]),
      ]).start();
      haptic.success();
    }
  }, [visible, box, lid, rise, glow, spark]);

  const dpLogo = require('../../assets/img/deenpoints.png');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(2,8,5,0.74)', alignItems: 'center', justifyContent: 'center', padding: 26 }} onPress={onClose}>
        <Animated.View style={{ alignItems: 'center', paddingVertical: 30, paddingHorizontal: 30, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? '#0A1A11' : '#FFFFFF', width: '100%', maxWidth: 330, transform: [{ scale: box.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: box }}>
          {/* glow behind the rising coin */}
          <Animated.View style={{ position: 'absolute', top: -8, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(212,175,55,0.3)', opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.95] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.15] }) }] }} />

          {/* sparkles */}
          {[...Array(6)].map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  top: 52,
                  left: '50%',
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: i % 2 ? '#F5E6B8' : '#D4AF37',
                  opacity: spark,
                  transform: [
                    { translateX: spark.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * 74] }) },
                    { translateY: spark.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * 74] }) },
                    { scale: spark.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) },
                  ],
                }}
              />
            );
          })}

          {/* ── the present box: body + lid that swings open ── */}
          <View style={{ width: 96, height: 86, alignItems: 'center', justifyContent: 'flex-end' }}>
            {/* the DeenPoints coin rising out of the box */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                marginLeft: -27,
                width: 54,
                height: 54,
                borderRadius: 27,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(212,175,55,0.15)',
                borderWidth: 2,
                borderColor: '#D4AF37',
                opacity: rise,
                transform: [
                  { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [46, -12] }) },
                  { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                ],
              }}
            >
              <Image source={dpLogo} style={{ width: 34, height: 34 }} resizeMode="contain" />
            </Animated.View>

            {/* lid — rotates open around its back edge */}
            <Animated.View
              style={{
                width: 104,
                height: 26,
                borderRadius: 8,
                backgroundColor: '#D4AF37',
                borderWidth: 1.5,
                borderColor: '#F5E6B8',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                transform: [
                  { translateY: lid.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }) },
                  { rotate: lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-32deg'] }) },
                ],
              }}
            >
              <FontAwesome5 name="gift" size={12} color="#5B3E00" solid />
            </Animated.View>
            {/* box body */}
            <View style={{ width: 92, height: 58, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.18)', borderWidth: 2, borderColor: '#D4AF37', borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <View style={{ width: 10, height: '100%', backgroundColor: 'rgba(212,175,55,0.5)' }} />
            </View>
          </View>

          <T v="h2" style={{ marginTop: 22, fontSize: 17, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C', textAlign: 'center' }}>{title}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }}>
            <DPIcon size={22} />
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#D4AF37' }}>+{amount}</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? 'rgba(242,247,243,0.6)' : 'rgba(20,36,28,0.6)', marginTop: 6 }}>DeenPoints</Text>
          </View>
          <Pressable onPress={onClose} style={{ marginTop: 20, borderRadius: 14, paddingHorizontal: 30, height: 44, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}>
            <T v="button" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Alhamdulillah — Collect</T>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
