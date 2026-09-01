import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
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

export function DPIcon({ size = 13, color = '#E8C96A' }: { size?: number; color?: string }) {
  return <FontAwesome5 name="coins" size={size} color={color} solid />;
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
  const [phase, setPhase] = useState<'pick' | 'paying' | 'done'>('pick');
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) { setPhase('pick'); Animated.spring(pop, { toValue: 1, friction: 7, useNativeDriver: false }).start(); }
    else pop.setValue(0);
  }, [visible, pop]);

  const pay = () => {
    if (phase !== 'pick') return;
    haptic.medium();
    setPhase('paying');
    setTimeout(() => {
      add(pack.pts + pack.bonus);
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
                {PACKS.map((p) => {
                  const on = pack.pts === p.pts;
                  return (
                    <Pressable key={p.pts} onPress={() => { haptic.selection(); setPack(p); }} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1.5, borderColor: on ? '#D4AF37' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20,36,28,0.1)'), backgroundColor: on ? 'rgba(212,175,55,0.1)' : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(20,36,28,0.02)'), paddingHorizontal: 13, paddingVertical: 11 }}>
                      <DPIcon size={15} color={on ? '#D4AF37' : theme.subtext} />
                      <T v="body" style={{ flex: 1, marginLeft: 9, fontWeight: '700', fontSize: 13.5, color: theme.text }}>
                        {p.pts.toLocaleString()} points{p.bonus ? ` +${p.bonus} bonus` : ''}
                      </T>
                      <T v="caption" style={{ fontWeight: '800', fontSize: 12, color: on ? '#B8860B' : theme.subtext }}>{naira(p.pts)}</T>
                    </Pressable>
                  );
                })}
                <Pressable onPress={pay} style={{ marginTop: 4, borderRadius: 15, height: 50, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}>
                  <T v="button" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Pay {naira(pack.pts)} · Get {(pack.pts + pack.bonus).toLocaleString()}</T>
                </Pressable>
                <T v="caption" style={{ textAlign: 'center', fontSize: 9.5, color: theme.subtext, marginTop: 2 }}>Simulated payment — no real charge. DeenPoints never buy fatwas.</T>
              </View>
            ) : phase === 'paying' ? (
              <View style={{ alignItems: 'center', paddingVertical: 38, gap: 12 }}>
                <ActivityIndicator size="large" color="#D4AF37" />
                <T v="caption" style={{ fontSize: 12, color: theme.subtext }}>Processing payment…</T>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 30, gap: 10 }}>
                <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(74,227,143,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="check" size={26} color="#4AE38F" />
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

/* ── +N reward modal (check-in etc.) ── */
export function RewardModal({ visible, onClose, amount = 5, title = 'Daily check-in complete!' }: { visible: boolean; onClose: () => void; amount?: number; title?: string }) {
  const { isDark } = useTheme();
  const box = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const coins = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      box.setValue(0); shine.setValue(0); coins.setValue(0);
      Animated.sequence([
        Animated.timing(box, { toValue: 1, duration: 420, easing: Easing.back(1.6) as never, useNativeDriver: false }),
        Animated.parallel([
          Animated.timing(shine, { toValue: 1, duration: 650, useNativeDriver: false }),
          Animated.timing(coins, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad) as never, useNativeDriver: false }),
        ]),
      ]).start();
      haptic.success();
    }
  }, [visible, box, shine, coins]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(2,8,5,0.72)', alignItems: 'center', justifyContent: 'center', padding: 26 }} onPress={onClose}>
        <Animated.View style={{ alignItems: 'center', paddingVertical: 30, paddingHorizontal: 30, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? '#0A1A11' : '#FFFFFF', width: '100%', maxWidth: 330, transform: [{ scale: box.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }], opacity: box }}>
          {/* glow rays */}
          <Animated.View style={{ position: 'absolute', top: -26, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(212,175,55,0.25)', opacity: shine.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }), transform: [{ scale: shine.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.25] }) }] }} />
          {/* the reward box */}
          <View style={{ width: 84, height: 84, borderRadius: 24, borderWidth: 2, borderColor: '#D4AF37', backgroundColor: 'rgba(212,175,55,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="gift" size={34} color="#D4AF37" />
          </View>
          {/* +N coins flying up */}
          <Animated.View style={{ position: 'absolute', top: 96, flexDirection: 'row', gap: 6, opacity: coins, transform: [{ translateY: coins.interpolate({ inputRange: [0, 1], outputRange: [10, -34] }) }] }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#F5E6B8' }}>
                <FontAwesome5 name="coins" size={11} color="#5B3E00" solid />
              </View>
            ))}
          </Animated.View>
          <T v="h2" style={{ marginTop: 18, fontSize: 17, fontWeight: '800', color: isDark ? '#F2F7F3' : '#14241C', textAlign: 'center' }}>{title}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }}>
            <DPIcon size={20} />
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#D4AF37' }}>+{amount}</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? 'rgba(242,247,243,0.6)' : 'rgba(20,36,28,0.6)', marginTop: 5 }}>DeenPoints</Text>
          </View>
          <Pressable onPress={onClose} style={{ marginTop: 20, borderRadius: 14, paddingHorizontal: 30, height: 44, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}>
            <T v="button" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Alhamdulillah — Collect</T>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
