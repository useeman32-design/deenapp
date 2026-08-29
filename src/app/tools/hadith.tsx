import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HADITH_BOOKS } from '@/data/hadithBooks';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { ContentSearchOverlay } from '@/components/ContentSearchOverlay';
import { loadBook, loadBookMeta } from '@/lib/content';
import { storage } from '@/lib/storage';

const enOf = (e: unknown): string => {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const o = e as { text?: unknown };
    return typeof o.text === 'string' ? o.text : '';
  }
  return '';
};

const TINTS = ['#4AE38F', '#E8C96A', '#5BC8F5', '#F0A8C0', '#7FD8A8', '#C9A0F0', '#F09A5B', '#8FB8F0', '#66E0C4', '#D8C87A', '#A8E06A', '#7AC8D8', '#F0B26A', '#B0A8F0', '#8C6D1F'];

/** Hadith collections (pass 18) — the REAL library: 15 books, full texts on demand. */
export default function HadithCollections() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [last, setLast] = useState<{ book: string; chapter: string; at: string } | null>(null);

  useEffect(() => {
    storage.getItem('dl.hadith.last').then((r) => {
      if (r)
        try {
          setLast(JSON.parse(r));
        } catch {}
    });
  }, []);

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
          <Pressable onPress={() => { haptic.selection(); setSearchOpen(true); }} style={{ width: 38, height: 38, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="search" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(b) => b.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View>
          {last ? (
            <Pressable
              onPress={() => {
                haptic.light();
                const b = HADITH_BOOKS.find((x) => x.id === last.book);
                if (!b) return;
                const num = last.chapter.startsWith('c') ? last.chapter.slice(1) : last.chapter;
                router.push({ pathname: '/tools/hadith/[book]', params: { book: b.id, chapter: num } });
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginHorizontal: 16,
                marginTop: 14,
                paddingVertical: 12,
                borderRadius: 13,
                backgroundColor: isDark ? '#1F8F5C' : '#1D6F42',
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <FontAwesome5 name="book-open" size={13} color="#FFFFFF" />
              <T v="body" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                Continue Reading — {HADITH_BOOKS.find((x) => x.id === last.book)?.name ?? 'Book'} {last.chapter.replace(/^c/, 'Ch ')}
              </T>
              <FontAwesome5 name="arrow-right" size={11} color="rgba(255,255,255,0.85)" />
            </Pressable>
          ) : null}
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

      {/* search: books & chapters instantly; hadith texts scanned on demand */}
      <ContentSearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder="Search hadith — book, chapter or text…"
        metaSearch={(qq) => {
          const needle = qq.toLowerCase();
          const bookHits = HADITH_BOOKS.filter((b) => b.name.toLowerCase().includes(needle) || b.author.toLowerCase().includes(needle))
            .map((b) => ({ key: `b-${b.id}`, title: b.name, subtitle: `${b.total.toLocaleString()} narrations · ${b.author}`, onPress: () => router.push(`/tools/hadith/${b.id}` as never) }));
          return bookHits;
        }}
        contentSearch={async (qq) => {
          const needle = qq.toLowerCase().trim();
          const hits: Array<{ key: string; title: string; subtitle?: string; arabic?: string; onPress: () => void }> = [];
          // 1) chapter names across all books (meta files are small)
          for (const b of HADITH_BOOKS) {
            try {
              const m = await loadBookMeta(b.id);
              for (const c of m.chapters ?? []) {
                if ((c.english ?? '').toLowerCase().includes(needle) || (c.arabic ?? '').includes(qq.trim())) {
                  hits.push({ key: `c-${b.id}-${c.chapter_number}`, title: `${b.name} · Chapter ${c.chapter_number}`, subtitle: c.english, arabic: c.arabic, onPress: () => router.push(`/tools/hadith/${b.id}?chapter=${c.chapter_number}` as never) });
                  if (hits.length >= 15) return hits;
                }
              }
            } catch {}
          }
          // 2) hadith text scan (small books first, capped)
          for (const bid of ['nawawi40', 'shamail_muhammadiyah', 'riyad_assalihin', 'malik']) {
            try {
              const list = await loadBook(bid);
              const b = HADITH_BOOKS.find((x) => x.id === bid);
              for (const h of list) {
                if (h.arabic.includes(qq.trim()) || enOf(h.english).toLowerCase().includes(needle)) {
                  hits.push({
                    key: `h-${bid}-${h.chapter_number}-${h.hadith_number ?? Math.random()}`,
                    title: `${b?.name ?? bid} · ${h.hadith_number ?? ''}`,
                    subtitle: (enOf(h.english) || h.chapter_name?.english || '').slice(0, 90),
                    arabic: h.arabic.slice(0, 44),
                    onPress: () => router.push(`/tools/hadith/${bid}?chapter=${h.chapter_number}` as never),
                  });
                  if (hits.length >= 40) return hits;
                }
              }
            } catch {}
          }
          return hits;
        }}
        contentLabel="In chapters & texts"
      />
    </View>
  );
}
