import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { RIDDLES } from '@/data/learn';

/** Learning — Islamic riddles (pass 29): reveal to check, shuffle, no scoring pressure. */
export default function Riddles() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [hints, setHints] = useState<Set<number>>(new Set());
  const [seed, setSeed] = useState(0);
  const list = useMemo(() => {
    const arr = [...RIDDLES];
    let s = seed || 1;
    for (let i = arr.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) % 2147483648;
      const j = s % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return seed === 0 ? RIDDLES : arr;
  }, [seed]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar title="Islamic Riddles" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {list.map((r, i) => {
          const shown = open.has(i);
          return (
            <View key={i} style={{ backgroundColor: d.card, borderWidth: 1, borderColor: shown ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)') : d.cardBorder, borderRadius: 16, padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(123,31,162,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="brain" size={12} color="#9C27B0" />
                </View>
                <T v="bodyS" style={{ flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 19 }}>{r.q}</T>
              </View>
              {!shown ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 11 }}>
                  <Pressable onPress={() => { haptic.selection(); setOpen((o) => new Set([...o, i])); }} style={{ borderRadius: 11, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', paddingHorizontal: 13, paddingVertical: 8 }}>
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#fff' }}>REVEAL</T>
                  </Pressable>
                  {r.hint ? (
                    <Pressable onPress={() => { haptic.selection(); setHints((h) => new Set([...h, i])); }} style={{ borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: 'rgba(212,175,55,0.08)', paddingHorizontal: 13, paddingVertical: 8 }}>
                      <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#B8870B' }}>HINT</T>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View style={{ marginTop: 11, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.05)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.2)', padding: 11 }}>
                  <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: isDark ? '#4AE38F' : '#1D6F42', marginBottom: 3 }}>ANSWER</T>
                  <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18 }}>{r.a}</T>
                </View>
              )}
              {hints.has(i) && !shown && r.hint ? (
                <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 8, fontStyle: 'italic' }}>Hint: {r.hint}</T>
              ) : null}
            </View>
          );
        })}
        <Pressable onPress={() => { haptic.selection(); setOpen(new Set()); setHints(new Set()); setSeed((s) => s + 7); }} style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, alignItems: 'center' }}>
          <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>SHUFFLE & RESET</T>
        </Pressable>
      </ScrollView>
    </View>
  );
}
