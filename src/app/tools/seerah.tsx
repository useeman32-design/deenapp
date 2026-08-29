import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SEERAH } from '@/data/seerah';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/** Seerah timeline (pass 16) — the life of the Prophet ﷺ as a dash timeline. */
export default function Seerah() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>
              Seerah Timeline
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              The life of the Prophet ﷺ · {SEERAH.length} events
            </T>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {SEERAH.map((e, i) => (
          <EventRow key={e.id} e={e} i={i} last={i >= SEERAH.length - 1} />
        ))}
      </ScrollView>
    </View>
  );
}

function EventRow({ e, i, last }: { e: (typeof SEERAH)[number]; i: number; last: boolean }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        setOpen((o) => !o);
      }}
      style={{ flexDirection: 'row', gap: 12 }}
    >
      {/* rail */}
      <View style={{ alignItems: 'center', width: 38 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name={e.icon as never} size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </View>
        {!last ? <View style={{ flex: 1, width: 2, borderRadius: 1, backgroundColor: isDark ? 'rgba(74,227,143,0.2)' : 'rgba(29,111,66,0.15)' }} /> : null}
      </View>

      <View style={{ flex: 1, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10.5, letterSpacing: 0.5 }}>
            {e.year.toUpperCase()}{e.hijri ? ` · ${e.hijri}` : ''}
          </T>
        </View>
        <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 13.5, marginTop: 3 }}>
          {e.title}
        </T>
        <T v="caption" numberOfLines={open ? undefined : 4} style={{ color: d.subtext, fontSize: 11, lineHeight: 16, marginTop: 3 }}>
          {e.desc}
        </T>
      </View>
    </Pressable>
  );
}
