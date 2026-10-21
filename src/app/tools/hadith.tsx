import { useEffect, useMemo, useState } from 'react';
import { goBack } from '@/lib/navigation';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hadithNumbers } from '@/lib/hadithNum';
import { HADITH_BOOKS } from '@/data/hadithBooks';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { ContentSearchOverlay, type SearchHit } from '@/components/ContentSearchOverlay';
import { loadBook, loadBookMeta, type ContentHadith } from '@/lib/content';
import { groupSimilar, rankByScore, scoreBest, scoreMatch } from '@/lib/searchRank';
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
          <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
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

      {/* prominent search — type OR recite (pass 25) */}
      <Pressable
        onPress={() => { haptic.selection(); setSearchOpen(true); }}
        accessibilityLabel="search or recite hadith"
        style={({ pressed }) => [{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: 'rgba(212,175,55,0.5)',
          backgroundColor: pressed ? 'rgba(212,175,55,0.14)' : 'rgba(212,175,55,0.08)',
          marginHorizontal: 16,
          marginBottom: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          opacity: pressed ? 0.85 : 1,
        }]}
      >
        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: '#B8870B', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="search" size={13} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyS" style={{ fontSize: 13.5, fontWeight: '800', color: d.text }}>Search or recite a hadith</T>
          <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>Books · chapters · full text · tap 🎤 to recite</T>
        </View>
        <FontAwesome5 name="microphone-alt" size={15} color="#B8870B" />
      </Pressable>

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
          /* ── pass 102 — CROSS-BOOK RANKED HADITH SEARCH ──────────────────────
           *
           * Owner: "the hadith search is poor, the result is not that accurate
           * and it only returns from one book, if we have same hadith in
           * different books or we have different narrations that looks alike, it
           * should display their results".
           *
           * What was wrong:
           *  · chapter-name matches `return`ed at 15 hits, abandoning the text
           *    scan entirely — a chapter name that happened to contain the query
           *    hid every actual hadith.
           *  · each book stopped at 8 matches (`if (out.length >= 8) break`) and
           *    the books were then concatenated IN BOOK ORDER with no scoring.
           *    Whichever book produced 8 hits first owned the visible list, so
           *    it read as "results from one book" and everything below the first
           *    row was arbitrary.
           *  · the same matn appearing in five collections produced five
           *    unrelated rows instead of one row that names all five.
           *
           * Now: chapter names and texts are two independently ranked tiers,
           * every match in all 15 books is scored by lib/searchRank, and
           * narrations that are the same text are grouped into one row listing
           * each collection it appears in. */
          const query = qq.trim();
          if (!query) return [];

          type ScoredHit = {
            key: string;
            title: string;
            subtitle?: string;
            arabic?: string;
            books?: string[];
            score: number;
            /* original scan position — keeps the sort stable so the list does not
             * reshuffle between keystrokes */
            order: number;
            onPress: () => void;
          };

          /* tier 1 — chapter names. The meta files are small, so scanning every
           * book is cheap and no book can crowd out another. */
          const chapterScored: ScoredHit[] = [];
          await Promise.all(
            HADITH_BOOKS.map(async (b) => {
              try {
                const m = await loadBookMeta(b.id);
                for (const c of m.chapters ?? []) {
                  const score = scoreBest([c.english, c.arabic], query);
                  if (score <= 0) continue;
                  chapterScored.push({
                    order: chapterScored.length,
                    key: `c-${b.id}-${c.chapter_number}`,
                    title: `${b.name} · Chapter ${c.chapter_number}`,
                    subtitle: c.english,
                    arabic: c.arabic,
                    score: score * 0.72, /* a chapter is a weaker answer than the text itself */
                    onPress: () => router.push(`/tools/hadith/${b.id}?chapter=${c.chapter_number}` as never),
                  });
                }
              } catch { /* a missing meta file must not sink the whole search */ }
            }),
          );

          /* tier 2 — full texts, all books in parallel, no per-book cap. */
          const textScored: ScoredHit[] = [];
          const scanBook = async (bid: string) => {
            try {
              const list = await loadBook(bid);
              const b = HADITH_BOOKS.find((x) => x.id === bid);
              let nums: number[] = [];
              try { nums = await hadithNumbers(bid); } catch { /* fall back to pack order */ }
              for (let ix = 0; ix < list.length; ix++) {
                const h: ContentHadith = list[ix];
                const english = enOf(h.english);
                const chapterName = h.chapter_name?.english ?? '';
                /* Arabic matn first, then the translation, then the chapter.
                 * scoreBest rewards a verse that matches in more than one field,
                 * which is what lifts an exact wording above a loose paraphrase. */
                const score = scoreBest([h.arabic, english, chapterName], query);
                if (score <= 0) continue;
                const num = h.hadith_number != null ? Number(h.hadith_number) : (nums[ix] ?? ix + 1);
                /* PASS 105 — `num` is only a sunnah.com number when it came from
                 * the pack itself or from the canonical map. Otherwise it is this
                 * entry's POSITION in the pack, which is not the same thing, so
                 * say so instead of printing a wrong number under the word
                 * "Hadith". Navigation still works: the reader screen resolves
                 * `h` the same way. */
                const canonical = h.hadith_number != null || nums.length > 0;
                textScored.push({
                  order: textScored.length,
                  key: `h-${bid}-${num}`,
                  title: `${b?.name ?? bid}${chapterName ? ` · ${chapterName}` : ''} · ${canonical ? `Hadith ${num}` : `entry ${num}`}`,
                  subtitle: (english || chapterName).slice(0, 110),
                  arabic: h.arabic.slice(0, 48),
                  books: [b?.name ?? bid],
                  /* a bare matn match is worth more than a chapter-name-only one */
                  score: scoreMatch(query, h.arabic) > 0 || scoreMatch(query, english) > 0
                    ? score
                    : score * 0.8,
                  onPress: () => router.push(`/tools/hadith/${bid}?h=${num}` as never),
                });
              }
            } catch { /* an unavailable book pack must not sink the whole search */ }
          };
          await Promise.all(HADITH_BOOKS.map((b) => scanBook(b.id)));

          /* Group the SAME narration across collections.
           * pass 102 - the first attempt keyed this on the normalised Arabic with
           * a regex isnad strip and produced ZERO groups on the real corpus: the
           * same matn is catalogued with entirely different chains per
           * collection, so no regex can find where an unknown isnad ends.
           * groupSimilar() compares the matn FUZZILY (character-trigram Jaccard
           * inside a length band) instead, which is what actually joins
           * "Do not become angry" in al-Bukhari with the same hadith in
           * an-Nawawi's 40, Jami' at-Tirmidhi and Musnad Ahmad.
           *
           * It runs on the ranked shortlist, not on all 50,804 hadiths. */
          textScored.forEach((h, i) => { h.order = i; });
          const ordered = textScored.slice().sort((a, b) => b.score - a.score || a.order - b.order);
          const SHORTLIST = 160;
          const head = ordered.slice(0, SHORTLIST);
          const tail = ordered.slice(SHORTLIST);

          const clusters = groupSimilar(head.map((h) => ({ text: h.arabic ?? '' })), 0.55);
          const groupedHits: ScoredHit[] = [];
          for (const cluster of clusters) {
            const members = cluster.map((i) => head[i]);
            const best = members[0];
            const names = [...new Set(members.flatMap((m) => m.books ?? []))];
            if (names.length > 1) {
              /* one row that names every collection reporting it, instead of
               * five unrelated-looking rows for one hadith */
              best.books = names;
              best.title = `${names.length} collections · ${best.title.split(' · ')[0]} · Hadith ${best.title.split('Hadith ').pop()}`;
              best.subtitle = (best.subtitle ? best.subtitle + ' — ' : '')
                + `Also in ${names.slice(1, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4} more` : ''}`;
              /* a narration several collections agree on is a stronger answer */
              best.score *= 1 + Math.min(0.3, 0.09 * (names.length - 1));
            }
            groupedHits.push(best);
          }

          const chapters = rankByScore(chapterScored.map(({ score, ...rest }) => ({ score, item: rest })))
            .slice(0, 10);
          const texts = rankByScore([...groupedHits, ...tail].map(({ score, ...rest }) => ({ score, item: rest })))
            .slice(0, 70);

          return [...chapters, ...texts] as SearchHit[];
        }}
        contentLabel="In chapters & texts"
      />
    </View>
  );
}
