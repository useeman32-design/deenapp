import { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Share, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { RIDDLES } from '@/data/learn';
import { addUserPost } from '@/lib/userPosts';

/**
 * Learning — Islamic riddles (pass 32 redesign): one riddle in focus on a
 * premium card — number badge, progress dots, hint, springy reveal, prev/next,
 * shuffle, and SHARE (as a community post or to friends).
 */
export default function Riddles() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [seed, setSeed] = useState(0);
  const [shown, setShown] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const pop = useRef(new Animated.Value(0.85)).current;

  const list = useMemo(() => {
    const arr = [...RIDDLES];
    let s = seed || 1;
    for (let k = arr.length - 1; k > 0; k--) {
      s = (s * 1103515245 + 12345) % 2147483648;
      const j = s % (k + 1);
      [arr[k], arr[j]] = [arr[j], arr[k]];
    }
    return seed === 0 ? RIDDLES : arr;
  }, [seed]);

  const r = list[i % list.length];
  const reveal = () => {
    haptic.selection();
    setShown(true);
    pop.setValue(0.7);
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: false }).start();
  };
  const go = (dir: 1 | -1) => {
    haptic.light();
    setShown(false);
    setHintOn(false);
    setI((v) => (v + dir + list.length) % list.length);
  };
  const sharePost = async () => {
    haptic.success();
    await addUserPost(`🧠 Riddle: ${r.q}${shown ? `\n\n✅ ${r.a}` : '\n\n(can you solve it?)'}`, 'riddle');
    setToast('Posted to your feed ✓');
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title="Islamic Riddles" subtitle={`${list.length} riddles · train your mind`} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: insets.bottom + 30, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* focus card */}
        <View style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 22, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
          {/* number + dots */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 16 }}>
            {list.slice(0, 12).map((_, k) => (
              <View key={k} style={{ width: k === i % list.length ? 16 : 5, height: 5, borderRadius: 3, backgroundColor: k === i % list.length ? (isDark ? '#4AE38F' : '#1D6F42') : d.cardBorder }} />
            ))}
          </View>

          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(123,31,162,0.1)', borderWidth: 1.5, borderColor: 'rgba(123,31,162,0.35)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="brain" size={22} color="#9C27B0" />
            </View>
            <View style={{ position: 'absolute', right: 0, top: 0, borderRadius: 9, backgroundColor: 'rgba(123,31,162,0.12)', borderWidth: 1, borderColor: 'rgba(123,31,162,0.3)', paddingHorizontal: 8, paddingVertical: 3 }}>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: '#9C27B0' }}>RIDDLE {(i % list.length) + 1}/{list.length}</T>
            </View>
          </View>

          <T v="body" style={{ fontSize: 15.5, fontWeight: '700', lineHeight: 23, textAlign: 'center', color: d.text }}>{r.q}</T>

          {hintOn && !shown && r.hint ? (
            <View style={{ marginTop: 13, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(212,175,55,0.07)', padding: 10, alignItems: 'center' }}>
              <T v="caption" style={{ fontSize: 10.5, color: '#B8870B', fontStyle: 'italic' }}>💡 {r.hint}</T>
            </View>
          ) : null}

          {shown ? (
            <Animated.View style={{ marginTop: 15, borderRadius: 14, backgroundColor: isDark ? 'rgba(46,204,113,0.09)' : 'rgba(29,111,66,0.05)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', padding: 13, alignItems: 'center', transform: [{ scale: pop }] }}>
              <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: isDark ? '#4AE38F' : '#1D6F42', marginBottom: 4 }}>ANSWER</T>
              <T v="bodyS" style={{ fontSize: 13.5, lineHeight: 20, textAlign: 'center', color: d.text, fontWeight: '700' }}>{r.a}</T>
            </Animated.View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
              <Pressable onPress={reveal} style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 13, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}>
                <T v="button" style={{ fontSize: 12.5, fontWeight: '800' }}>REVEAL ANSWER</T>
              </Pressable>
              {r.hint ? (
                <Pressable onPress={() => { haptic.selection(); setHintOn(true); }} style={({ pressed }) => ({ alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)', opacity: pressed ? 0.8 : 1 })}>
                  <FontAwesome5 name="lightbulb" size={13} color="#B8870B" />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        {toast ? <T v="caption" style={{ fontSize: 10.5, color: '#4AE38F', textAlign: 'center', marginTop: 10 }}>{toast}</T> : null}

        {/* share + nav */}
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}>
          <Pressable onPress={() => go(-1)} style={({ pressed }) => ({ width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, opacity: pressed ? 0.8 : 1 })}>
            <FontAwesome5 name="chevron-left" size={13} color={d.subtext} />
          </Pressable>
          <Pressable onPress={sharePost} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', opacity: pressed ? 0.8 : 1 })}>
            <FontAwesome5 name="edit" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>SHARE AS POST</T>
          </Pressable>
          <Pressable onPress={() => Share.share({ message: `🧠 Riddle: ${r.q}${shown ? `\n\n✅ ${r.a}` : ''}\n\n— DeenLink` }).catch(() => {})} style={({ pressed }) => ({ width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(91,200,245,0.4)', backgroundColor: 'rgba(91,200,245,0.08)', opacity: pressed ? 0.8 : 1 })}>
            <FontAwesome5 name="paper-plane" size={12} color="#5BC8F5" />
          </Pressable>
          <Pressable onPress={() => go(1)} style={({ pressed }) => ({ width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}>
            <FontAwesome5 name="chevron-right" size={13} color="#fff" />
          </Pressable>
        </View>

        <Pressable onPress={() => { haptic.selection(); setSeed((s) => s + 7); setShown(false); setHintOn(false); setI(0); }} style={({ pressed }) => ({ marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, alignItems: 'center', opacity: pressed ? 0.8 : 1 })}>
          <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>🔀 SHUFFLE RIDDLES</T>
        </Pressable>
      </ScrollView>
    </View>
  );
}
