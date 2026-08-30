import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { ARTICLES } from '@/data/learn';

/** Learning — Articles (pass 29): short authentic reads, fully in-app. */
export default function Articles() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar title="Articles" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {ARTICLES.map((a, i) => {
          const isOpen = open === i;
          return (
            <Pressable
              key={i}
              onPress={() => { haptic.selection(); setOpen(isOpen ? null : i); }}
              style={{ backgroundColor: d.card, borderWidth: 1, borderColor: isOpen ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)') : d.cardBorder, borderRadius: 16, padding: 15, marginBottom: 10 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(48,63,143,0.1)', borderWidth: 1, borderColor: 'rgba(48,63,143,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={a.icon} size={13} color="#3F51B5" />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', lineHeight: 18 }}>{a.title}</T>
                  <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 2 }}>{a.tag} · {a.mins} min read</T>
                </View>
                <FontAwesome5 name={isOpen ? 'chevron-up' : 'chevron-down'} size={10} color={d.faint} />
              </View>
              {isOpen ? (
                <View style={{ marginTop: 11, borderTopWidth: 1, borderTopColor: d.cardBorder, paddingTop: 11 }}>
                  {a.body.map((par, k) => (
                    <T key={k} v="bodyS" style={{ fontSize: 12.5, lineHeight: 20, marginBottom: 9 }}>{par}</T>
                  ))}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
