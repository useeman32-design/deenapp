import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { HADITH_BOOKS, chapterHadiths } from '@/data/hadithBooks';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

/**
 * A hadith collection (pass 15): chapters list → tap a chapter → reader view
 * (same screen, swaps content — no extra route needed for static export).
 * Remembers the last chapter per book (Continue where you left off).
 */
export default function HadithBookScreen() {
  const { book: bookId } = useLocalSearchParams<{ book: string }>();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const book = HADITH_BOOKS.find((b) => b.id === bookId) ?? HADITH_BOOKS[0];

  const [chapter, setChapter] = useState<string | null>(null);
  const [marks, setMarks] = useState<Set<string>>(new Set());

  useEffect(() => {
    storage.getItem(`dl.hadith.last.${book.id}`).then((r) => {
      if (r) setChapter(r);
    });
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
    storage.setItem(`dl.hadith.last.${book.id}`, id);
  };

  const hadiths = useMemo(() => (chapter ? chapterHadiths(book, chapter) : []), [book, chapter]);
  const chapterMeta = book.chapters.find((c) => c.id === chapter);

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
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => (chapter ? setChapter(null) : router.back())}
            hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name={chapter ? 'chevron-left' : 'arrow-left'} size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
          <LinearGradient
            colors={book.grad as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="book" size={14} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 17 }} numberOfLines={1}>
              {chapter ? chapterMeta?.label : book.name}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>
              {chapter ? `${book.name} · ${chapterMeta?.count.toLocaleString()} narrations` : `${book.total.toLocaleString()} narrations · ${book.chapters.length} chapters`}
            </T>
          </View>
        </View>
      </View>

      {!chapter ? (
        /* ── chapters list ── */
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
          {book.chapters.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => openChapter(c.id)}
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
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: `${book.tint}55`,
                  backgroundColor: `${book.tint}14`,
                }}
              >
                <T v="caption" style={{ color: book.tint, fontWeight: '800', fontSize: 12 }}>
                  {i + 1}
                </T>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 13.5 }} numberOfLines={1}>
                  {c.label}
                </T>
                <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 2 }}>
                  {c.count.toLocaleString()} hadiths
                </T>
              </View>
              <FontAwesome5 name="chevron-right" size={12} color={d.faint} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        /* ── reader ── */
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {hadiths.map((h: { id: string; arabic: string; translation: string; source: string; number: string; category: string }) => (
            <View
              key={h.id}
              style={{
                backgroundColor: d.card,
                borderWidth: 1,
                borderColor: d.cardBorder,
                borderRadius: 17,
                padding: 16,
                marginBottom: 11,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View
                  style={{
                    borderRadius: 8,
                    backgroundColor: `${book.tint}14`,
                    borderWidth: 1,
                    borderColor: `${book.tint}44`,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <T v="caption" style={{ color: book.tint, fontWeight: '800', fontSize: 9.5 }}>
                    {h.number}
                  </T>
                </View>
                <T v="caption" style={{ color: d.faint, fontSize: 10, marginLeft: 8 }}>
                  {h.category}
                </T>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => toggleMark(h.id)} hitSlop={8} style={{ padding: 4 }}>
                  <FontAwesome5 name="bookmark" size={14} solid={marks.has(h.id)} color={marks.has(h.id) ? '#E8C96A' : d.faint} />
                </Pressable>
              </View>
              <T v="arabic" style={{ color: d.text, fontSize: 20, textAlign: 'right', lineHeight: 36 }}>
                {h.arabic}
              </T>
              <T v="bodyS" style={{ color: d.subtext, fontSize: 13, marginTop: 10, lineHeight: 20 }}>
                "{h.translation}"
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
                <FontAwesome5 name="bookmark" size={9} color={d.faint} />
                <T v="caption" style={{ color: d.faint, fontSize: 10, marginLeft: 6, flex: 1 }}>
                  {h.source}
                </T>
                <Pressable hitSlop={6} onPress={() => haptic.selection()}>
                  <FontAwesome5 name="share-alt" size={12} color={d.faint} />
                </Pressable>
              </View>
            </View>
          ))}
          <T v="caption" style={{ color: d.faint, textAlign: 'center', fontSize: 10.5, marginTop: 6 }}>
            Showing the demo selection from {chapterMeta?.label} · {book.name}
          </T>
        </ScrollView>
      )}
    </View>
  );
}
