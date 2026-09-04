import { markGoal } from '@/lib/routine';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { loadSurah, type ContentAyah } from '@/lib/content';
import { QURAN } from '@/data/quran';
import { TAFSIR_BOOKS, fetchTafsir, tafsirBlocks, type TafsirAuthor } from '@/lib/tafsir';
import { storage } from '@/lib/storage';
import { useRouter } from 'expo-router';

/**
 * Tafsir library — three-step flow (user request):
 *   1. BOOKS  → pick a book of tafsir
 *   2. SURAHS → all 114 surahs in that book (searchable)
 *   3. READ   → the surah opened ayah-by-ayah: every ayah with its Arabic +
 *               translation; tap an ayah to read its tafsir; jump/search to an ayah.
 * The "Ask DeenLink AI about this ayah" action now appears on EVERY ayah
 * (inside the opened ayah) so it is consistent, not on some ayahs only.
 */

const BOOK_KEY = 'dl.tafsir.book';
type SurahData = { surah: number; hasBasmallah: boolean; basmallah: string; verses: ContentAyah[] } | null;

export default function Tafsir() {
  useEffect(() => { markGoal('tafsir').catch(() => {}); }, []);
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [view, setView] = useState<'books' | 'surahs' | 'read'>('books');
  const [book, setBook] = useState<TafsirAuthor>('Ibn Kathir');
  const [surahN, setSurahN] = useState(1);
  const [ayahN, setAyahN] = useState<number | null>(1);
  const [q, setQ] = useState('');
  const [jump, setJump] = useState('');
  const [content, setContent] = useState<SurahData>(null);
  const [passage, setPassage] = useState<{ loading: boolean; err?: boolean; text?: string; group?: string | null }>({ loading: false });

  const meta = QURAN.find((s) => s.number === surahN) ?? QURAN[0];
  const bookMeta = TAFSIR_BOOKS.find((b) => b.id === book) ?? TAFSIR_BOOKS[0];

  useEffect(() => {
    storage.getItem(BOOK_KEY).then((v) => {
      if (v && TAFSIR_BOOKS.some((b) => b.id === v)) setBook(v as TafsirAuthor);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== 'read') return;
    setContent(null);
    loadSurah(surahN).then((c) => setContent(c)).catch(() => setContent(null));
  }, [surahN, view]);

  useEffect(() => {
    if (view !== 'read' || ayahN == null) return;
    setPassage({ loading: true });
    fetchTafsir(surahN, ayahN)
      .then((j) => {
        const p = j.tafsirs.find((t) => t.author === book) ?? j.tafsirs[0];
        setPassage({ loading: false, text: p?.content, group: p?.groupVerse ?? null });
      })
      .catch(() => setPassage({ loading: false, err: true }));
  }, [surahN, ayahN, book, view]);

  const pickBook = (b: TafsirAuthor) => {
    haptic.selection();
    setBook(b);
    storage.setItem(BOOK_KEY, b).catch(() => {});
    setSurahN(1); setAyahN(1); setQ('');
    setView('surahs');
  };
  const openSurah = (n: number) => {
    haptic.selection();
    setSurahN(n); setAyahN(1); setJump('');
    setView('read');
  };
  const doJump = () => {
    const n = parseInt(jump, 10);
    if (n >= 1 && n <= meta.ayahs) { haptic.selection(); setAyahN(n); }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return QURAN;
    return QURAN.filter((s) => s.english.toLowerCase().includes(needle) || s.name.includes(needle) || String(s.number) === needle);
  }, [q]);

  const Header = ({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: d.cardBorder, backgroundColor: d.bg }}>
      <Pressable accessibilityLabel="back" accessibilityRole="button" hitSlop={10} onPress={() => { haptic.light(); onBack(); }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name="chevron-left" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }} numberOfLines={1}>{title}</T>
        {sub ? <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }} numberOfLines={1}>{sub}</T> : null}
      </View>
    </View>
  );

  /* ── 1 · BOOKS ─────────────────────────────────────────── */
  if (view === 'books') {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <Header title="Tafsir Library" sub="Choose a book of tafsir" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as never))} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
          {TAFSIR_BOOKS.map((b) => (
            <Pressable
              key={b.id}
              accessibilityLabel={`tafsir book ${b.label}`}
              onPress={() => pickBook(b.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 15 }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="book" size={18} color="#E8C96A" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="body" style={{ fontWeight: '800', fontSize: 15, color: d.text }}>{b.label}</T>
                <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 2 }}>by {b.author}</T>
              </View>
              <FontAwesome5 name="chevron-right" size={12} color={d.faint} />
            </Pressable>
          ))}
          <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 6, lineHeight: 14 }}>
            Tafsir texts via quranapi.pages.dev (from quran.com). For rulings, confirm with a qualified scholar.
          </T>
        </ScrollView>
      </View>
    );
  }

  /* ── 2 · SURAH LIST ────────────────────────────────────── */
  if (view === 'surahs') {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <Header title={bookMeta.label} sub={`by ${bookMeta.author} · choose a surah`} onBack={() => setView('books')} />
        <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 11, height: 42 }}>
            <FontAwesome5 name="search" size={12} color={d.faint} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search surah…" placeholderTextColor={d.faint} style={{ flex: 1, fontSize: 13.5, color: d.text, fontFamily: 'Poppins-Medium' }} />
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30, gap: 6 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.map((s) => (
            <Pressable
              key={s.number}
              accessibilityLabel={`surah ${s.english}`}
              onPress={() => openSurah(s.number)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 12, paddingVertical: 11 }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: '#E8C96A' }}>{s.number}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontSize: 13.5, fontWeight: '700', color: d.text }}>{s.english}</T>
                <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{s.name} · {s.ayahs} ayahs · {s.revelation}</T>
              </View>
              <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  /* ── 3 · READ (ayah by ayah) ───────────────────────────── */
  const verses = content?.verses ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <Header title={`${meta.number}. ${meta.english}`} sub={`${bookMeta.label} · ${meta.ayahs} ayahs`} onBack={() => setView('surahs')} />

      {/* jump to an ayah */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 11, height: 40 }}>
          <FontAwesome5 name="search" size={11} color={d.faint} />
          <TextInput
            value={jump}
            onChangeText={(t) => setJump(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            returnKeyType="go"
            onSubmitEditing={doJump}
            placeholder={`Jump to ayah (1–${meta.ayahs})`}
            placeholderTextColor={d.faint}
            style={{ flex: 1, fontSize: 13, color: d.text, fontFamily: 'Poppins-Medium' }}
          />
        </View>
        <Pressable onPress={doJump} style={{ height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', alignItems: 'center', justifyContent: 'center' }}>
          <T v="button" style={{ fontSize: 12 }}>Go</T>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40, gap: 10 }} showsVerticalScrollIndicator={false}>
        {content === null ? (
          <View style={{ alignItems: 'center', padding: 30 }}><ActivityIndicator color="#E8C96A" /></View>
        ) : (
          <>
            {content.hasBasmallah && content.basmallah ? (
              <T v="arabic" style={{ fontSize: 20, lineHeight: 38, color: d.text, textAlign: 'center', marginBottom: 4 }}>{content.basmallah}</T>
            ) : null}
            {verses.map((a) => {
              const on = a.ayah === ayahN;
              return (
                <View key={a.ayah} style={{ borderRadius: 15, borderWidth: 1, borderColor: on ? 'rgba(212,175,55,0.5)' : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.04)') : d.card, overflow: 'hidden' }}>
                  <Pressable accessibilityLabel={`ayah ${a.ayah}`} onPress={() => { haptic.selection(); setAyahN(on ? null : a.ayah); }} style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: 'rgba(212,175,55,0.14)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                        <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#E8C96A' }}>{a.ayah}</T>
                      </View>
                      <T v="caption" style={{ flex: 1, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, color: d.faint }}>{meta.english.toUpperCase()} {surahN}:{a.ayah}</T>
                      {on
                        ? <FontAwesome5 name="chevron-up" size={11} color="#E8C96A" />
                        : <FontAwesome5 name="book-reader" size={11} color={d.faint} />}
                    </View>
                    <T v="arabic" style={{ fontSize: 19, lineHeight: 36, color: d.text, textAlign: 'right' }}>{a.arabic}</T>
                    {a.english ? <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.subtext, fontStyle: 'italic', marginTop: 8 }}>{a.english}</T> : null}
                  </Pressable>

                  {on ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: d.cardBorder, padding: 14, backgroundColor: isDark ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.02)' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                        <FontAwesome5 name="book-reader" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
                        <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6, color: isDark ? '#4AE38F' : '#1D6F42' }}>
                          {bookMeta.label.toUpperCase()} · {bookMeta.author.toUpperCase()}
                        </T>
                      </View>
                      {passage.loading ? (
                        <View style={{ alignItems: 'center', padding: 20 }}><ActivityIndicator color="#E8C96A" /></View>
                      ) : passage.err || !passage.text ? (
                        <T v="caption" style={{ textAlign: 'center', color: d.faint, padding: 12 }}>Could not load the tafsir for this ayah — check your connection and try again.</T>
                      ) : (
                        <View style={{ gap: 9 }}>
                          {passage.group ? <T v="caption" style={{ fontSize: 10, fontStyle: 'italic', color: d.faint }}>{passage.group}</T> : null}
                          {tafsirBlocks(passage.text).map((b, i) => (
                            <View key={i}>
                              {b.h ? <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '900', color: d.text, marginBottom: 3 }}>{b.h}</T> : null}
                              <T v="bodyS" style={{ fontSize: 12, lineHeight: 19.5, color: d.subtext }}>{b.t}</T>
                            </View>
                          ))}
                        </View>
                      )}
                      {/* consistent per-ayah AI action — present on every ayah */}
                      <Pressable
                        accessibilityLabel="ask DeenLink AI about this ayah"
                        onPress={() => router.push('/tools/ai' as never)}
                        style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(91,200,245,0.4)', backgroundColor: 'rgba(91,200,245,0.07)', paddingHorizontal: 12, paddingVertical: 10 }}
                      >
                        <FontAwesome5 name="robot" size={12} color="#5BC8F5" />
                        <T v="bodyS" style={{ flex: 1, fontSize: 11.5, fontWeight: '700', color: d.text }}>Ask DeenLink AI about this ayah</T>
                        <FontAwesome5 name="arrow-right" size={10} color="#5BC8F5" />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}
