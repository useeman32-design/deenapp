import { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HADITH_BOOKS } from '@/data/hadithBooks';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

const TINTS = ['#4AE38F', '#E8C96A', '#5BC8F5', '#F0A8C0', '#7FD8A8', '#C9A0F0', '#F09A5B', '#8FB8F0', '#66E0C4', '#D8C87A', '#A8E06A', '#7AC8D8', '#F0B26A', '#B0A8F0', '#8C6D1F'];

/** Hadith collections (pass 18) — the REAL library: 15 books, full texts on demand. */
export default function HadithCollections() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return HADITH_BOOKS;
    return HADITH_BOOKS.filter((b) => b.name.toLowerCase().includes(query) || b.author.toLowerCase().includes(query));
  }, [q]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* fixed header */}
      <View style={{ paddingHorizontal: 18, paddingTop: insets.top + 12, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>
              Hadith Collections
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              15 books · full texts · {HADITH_BOOKS.reduce((a, b) => a + b.total, 0).toLocaleString()} narrations
            </T>
          </View>
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(b) => b.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: d.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: d.cardBorder,
              marginTop: 14,
              marginHorizontal: 16,
              marginBottom: 6,
              paddingHorizontal: 13,
            }}
          >
            <FontAwesome5 name="search" size={13} color={d.faint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search collections…"
              placeholderTextColor={d.faint}
              style={{ flex: 1, fontFamily: 'Poppins-Medium', fontSize: 16, color: d.text, paddingVertical: 10, paddingLeft: 9 }}
            />
          </View>
        }
        renderItem={({ item: b, index }) => {
          const tint = TINTS[index % TINTS.length];
          return (
            <Pressable
              onPress={() => {
                haptic.light();
                router.push(`/tools/hadith/${b.id}` as never);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 13,
                marginHorizontal: 16,
                marginTop: 10,
                padding: 14,
                borderRadius: 17,
                backgroundColor: d.card,
                borderWidth: 1,
                borderColor: d.cardBorder,
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint}22`, borderWidth: 1, borderColor: `${tint}55` }}>
                <FontAwesome5 name="book" size={17} color={tint} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 14, flexShrink: 1 }} numberOfLines={1}>
                    {b.name}
                  </T>
                  <T v="arabic" style={{ color: d.faint, fontSize: 13 }}>
                    {b.arabic}
                  </T>
                </View>
                <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 2 }} numberOfLines={1}>
                  {b.author} · {b.chapters} chapters
                </T>
                <T v="caption" style={{ color: tint, fontSize: 10, fontWeight: '800', marginTop: 2 }}>
                  {b.total.toLocaleString()} hadiths
                </T>
              </View>
              <FontAwesome5 name="chevron-right" size={13} color={d.faint} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
