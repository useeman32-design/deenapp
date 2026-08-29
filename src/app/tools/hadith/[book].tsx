import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HADITH_BOOKS } from '@/data/hadithBooks';
import { loadBook, loadBookMeta, type ContentHadith, type MetaChapter } from '@/lib/content';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/** english is {narrator, text} in some books — always flatten to a string */
const enOf = (e: unknown): string => {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const o = e as { text?: unknown; narrator?: unknown };
    const t = typeof o.text === 'string' ? o.text : typeof o.text === 'object' && o.text ? enOf(o.text) : '';
    return t || '';
  }
  return '';
};
import { ContentShareSheet } from '@/components/ContentShareSheet';

/**
 * A hadith book (pass 18): REAL chapters from the user's dataset, and the
 * reader streams the book's full text file (filtered by chapter).
 */
export default function HadithBookScreen() {
  const { book: bookId, chapter: chapterParam } = useLocalSearchParams<{ book: string; chapter?: string }>();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const book = HADITH_BOOKS.find((b) => b.id === bookId) ?? HADITH_BOOKS[0];

  const [chapter, setChapter] = useState<string | null>(chapterParam ? `c${chapterParam}` : null);
  const [meta, setMeta] = useState<MetaChapter[] | null>(null);
  const [hadiths, setHadiths] = useState<ContentHadith[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(25);
  const [shareH, setShareH] = useState<{ arabic: string; meaning: string; ref: string } | null>(null);

  useEffect(() => {
    if (chapterParam) storage.setItem('dl.hadith.last', JSON.stringify({ book: book.id, chapter: `c${chapterParam}`, at: new Date().toISOString() }));
    loadBookMeta(book.id)
      .then((m) => setMeta(m.chapters?.length ? m.chapters : null) ?? Promise.reject(new Error('empty')))
      .catch(async () => {
        /* no chapters meta (e.g. Nawawi 40 — one big chapter) → derive it
         * from the book data itself by grouping chapter names */
        try {
          const all = await loadBook(book.id);
          const byName = new Map<string, MetaChapter>();
          for (const h of all) {
            const name = h.chapter_name?.english ?? `Chapter ${h.chapter_number ?? 1}`;
            const e = byName.get(name);
            if (e) e.hadith_count += 1;
            else byName.set(name, { chapter_number: byName.size + 1, arabic: h.chapter_name?.arabic ?? '', english: name, hadith_count: 1 });
          }
          setMeta([...byName.values()]);
        } catch {
          setMeta([]);
        }
      });
    /* pass 23: do NOT auto-restore the last chapter — opening a book always
     * shows its CHAPTER LIST first (continue via the hero button) */
    storage.getItem(`dl.hadith.marks.${book.id}`).then((r) => {
      if (r)
        try {
          setMarks(new Set(JSON.parse(r)));
        } catch {}
    });
  }, [book.id]);

  const openChapter = (id: string) => {
    haptic.light();
    setChapter(id);
    setLimit(25);
    storage.setItem(`dl.hadith.last.${book.id}`, id);
    /* global pointer powers the Continue-reading hero on the collections screen */
    storage.setItem('dl.hadith.last', JSON.stringify({ book: book.id, chapter: id, at: new Date().toISOString() }));
  };

  /* stream the full book file on first reader open */
  useEffect(() => {
    if (!chapter) return;
    if (hadiths) return;
    setLoading(true);
    const t0 = Date.now();
    loadBook(book.id)
      .then((all) => {
        /* books without chapter numbers (nawawi40) → all in chapter 1 */
        setHadiths(all.map((h) => (h.chapter_number == null ? { ...h, chapter_number: 1 } : h)));
      })
      .catch(() => setHadiths([]))
      .finally(() => {
        /* large books (bukhari 25MB) — keep the spinner honest */
        const wait = Math.max(0, 600 - (Date.now() - t0));
        setTimeout(() => setLoading(false), wait);
      });
  }, [chapter, hadiths, book.id]);

  const chNum = chapter ? Number(chapter.slice(1)) : null;
  const chapterMeta = meta?.find((c) => c.chapter_number === chNum) ?? null;
  const list = useMemo(() => (chapter && hadiths ? hadiths.filter((h) => h.chapter_number === chNum) : []), [chapter, hadiths, chNum]);

  const toggleMark = (id: string) => {
    haptic.light();
    setMarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      storage.setItem(`dl.hadith.marks.${book.id}`, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => (chapter ? setChapter(null) : router.back())} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={chapter ? 'chevron-left' : 'arrow-left'} size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 17 }} numberOfLines={1}>
              {chapter ? chapterMeta?.english ?? `Chapter ${chNum}` : book.name}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>
              {chapter ? `${chapterMeta?.arabic ?? ''} · ${list.length} hadiths` : `${book.total.toLocaleString()} hadiths · ${book.chapters} chapters`}
            </T>
          </View>
        </View>
      </View>

      {!chapter ? (
        /* ── chapters (from chapters_meta — arabic + english + counts) ── */
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
          {meta == null ? (
            <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginTop: 30 }} />
          ) : (
            meta.map((c, i) => (
              <Pressable
                key={c.chapter_number}
                onPress={() => openChapter(`c${c.chapter_number}`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  marginBottom: 9,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: d.card,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)' }}>
                  <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 12 }}>
                    {c.chapter_number}
                  </T>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 13.5 }} numberOfLines={1}>
                    {c.english}
                  </T>
                  <T v="arabic" style={{ color: d.faint, fontSize: 14, marginTop: 1 }} numberOfLines={1}>
                    {c.arabic}
                  </T>
                </View>
                <T v="caption" style={{ color: d.faint, fontSize: 10.5 }}>
                  {c.hadith_count}
                </T>
                <FontAwesome5 name="chevron-right" size={12} color={d.faint} />
              </Pressable>
            ))
          )}
        </ScrollView>
      ) : (
        /* ── reader: full texts ── */
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginTop: 30 }} />
          ) : list.length === 0 ? (
            <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>
              No hadiths in this chapter.
            </T>
          ) : (
            <>
              {list.slice(0, limit).map((h, i) => {
                const hid = `${book.id}-${h.chapter_number}-${i}`;
                return (
                  <View key={hid} style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 17, padding: 16, marginBottom: 11 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ borderRadius: 8, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', paddingHorizontal: 8, paddingVertical: 3 }}>
                        <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 9.5 }}>
                          {h.hadith_number ?? i + 1}
                        </T>
                      </View>
                      <View style={{ flex: 1 }} />
                      <Pressable onPress={() => toggleMark(hid)} hitSlop={8} style={{ padding: 4 }}>
                        <FontAwesome5 name="bookmark" size={14} solid={marks.has(hid)} color={marks.has(hid) ? '#E8C96A' : d.faint} />
                      </Pressable>
                    </View>
                    <T v="arabic" style={{ color: d.text, fontSize: 19, textAlign: 'right', lineHeight: 34 }}>
                      {h.arabic}
                    </T>
                    {enOf(h.english) ? (
                      <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, marginTop: 10, lineHeight: 19 }}>
                        {enOf(h.english)}
                      </T>
                    ) : null}
                    {h.grade ? (
                      <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontSize: 10, marginTop: 8, fontWeight: '700' }}>
                        {h.grade}
                      </T>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        haptic.selection();
                        setShareH({
                          arabic: h.arabic,
                          meaning: enOf(h.english) || h.chapter_name?.english || '',
                          ref: `${book.name ?? book.id} ${h.hadith_number ?? ''}${h.grade ? ` · ${h.grade}` : ''}`,
                        });
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: d.cardBorder }}
                    >
                      <FontAwesome5 name="share-alt" size={10} color={d.faint} />
                      <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 10.5 }}>Share this hadith</T>
                    </Pressable>
                  </View>
                );
              })}
              {limit < list.length ? (
                <Pressable onPress={() => setLimit((l) => l + 25)} style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, marginTop: 4 }}>
                  <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 12 }}>
                    Load more ({list.length - limit} left)
                  </T>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
      <ContentShareSheet
        visible={shareH != null}
        onClose={() => setShareH(null)}
        card={shareH ? { kind: 'hadith', ...shareH } : null}
        link="https://deenlink.org/tools/hadith"
      />
    </View>
  );
}
