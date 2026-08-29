import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { loadDuas, type ContentDua } from '@/lib/content';
import { markGoal } from '@/lib/routine';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { DUA_SECTIONS, groupBySection, type DuaSectionId } from '@/lib/duaSections';
import { ContentSearchOverlay, type SearchHit } from '@/components/ContentSearchOverlay';

/**
 * Duas (pass 20) — sections list (from the user's dua pack): each section
 * opens /tools/dua/[id] listing its duas. Plus full-text search.
 */
export default function Duas() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pack, setPack] = useState<Record<string, ContentDua[]> | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    markGoal('dua');
    loadDuas()
      .then((p) => setPack(p))
      .catch(() => setPack({}));
  }, []);

  const english = useMemo(() => (pack ? (pack['English'] ?? []) : []), [pack]);
  const grouped = useMemo(() => groupBySection(english), [english]);

  const metaSearch = (q: string): SearchHit[] => {
    const needle = q.toLowerCase();
    return english
      .filter((c) => c.TITLE.toLowerCase().includes(needle))
      .slice(0, 15)
      .map((c) => ({
        key: `d${c.ID}`,
        title: c.TITLE,
        subtitle: `${c.TEXT.length} part${c.TEXT.length > 1 ? 's' : ''} · ${c.AUDIO_URL ? 'audio' : 'text'}`,
        arabic: c.TEXT[0]?.ARABIC_TEXT?.slice(0, 40),
        onPress: () => router.push(`/tools/dua/${sectionIdOf(grouped, c.ID)}?open=${c.ID}` as never),
      }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>
              Duas & Adhkar
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              {english.length} duas from the Hisn al-Muslim collection
            </T>
          </View>
          <Pressable onPress={() => { haptic.selection(); setSearchOpen(true); }} style={{ width: 38, height: 38, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="search" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 10, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {!pack ? <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>Loading duas…</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {DUA_SECTIONS.filter((s) => grouped[s.id]?.length).map((s) => {
            const count = grouped[s.id].length;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  haptic.selection();
                  router.push(`/tools/dua/${s.id}` as never);
                }}
                style={({ pressed }) => ({
                  width: '47.5%',
                  flexGrow: 1,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  backgroundColor: d.card,
                  padding: 13,
                  gap: 7,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={s.icon as never} size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                <T v="body" style={{ color: d.text, fontWeight: '800', fontSize: 12.5, lineHeight: 17 }}>{s.label}</T>
                <T v="caption" style={{ color: d.faint, fontSize: 10 }}>{count} dua{count > 1 ? 's' : ''}</T>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ContentSearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder="Search duas — title or text…"
        metaSearch={metaSearch}
        contentSearch={async (q) => {
          const needle = q.toLowerCase();
          return english
            .flatMap((c) =>
              c.TEXT.map((t, i) => ({ c, t, i }))
                .filter(({ t }) => (t.ARABIC_TEXT || '').includes(q.trim()) || (t.ENGLISH_TEXT || '').toLowerCase().includes(needle))
                .slice(0, 2),
            )
            .slice(0, 40)
            .map(({ c, t }) => ({
              key: `c${t.ID}`,
              title: c.TITLE,
              subtitle: (t.ENGLISH_TEXT || '').slice(0, 90),
              arabic: (t.ARABIC_TEXT || '').slice(0, 44),
              onPress: () => router.push(`/tools/dua/${sectionIdOf(grouped, c.ID)}?open=${c.ID}` as never),
            }));
        }}
        contentLabel="In dua texts"
      />
    </View>
  );
}

function sectionIdOf(grouped: Record<DuaSectionId, ContentDua[]>, id: number): DuaSectionId {
  for (const s of DUA_SECTIONS) if (grouped[s.id]?.some((c) => c.ID === id)) return s.id;
  return 'other';
}
