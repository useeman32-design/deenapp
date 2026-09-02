import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
import { haptic } from '@/lib/haptics';
import { loadSurah, type ContentAyah } from '@/lib/content';
import { QURAN } from '@/data/quran';
import { TAFSIR_BOOKS, fetchTafsir, tafsirBlocks, type TafsirAuthor } from '@/lib/tafsir';
import { BookIcon } from '@/components/Icons';
import { storage } from '@/lib/storage';
import { useRouter } from 'expo-router';

/**
 * pass 42 — Tafsir reader (Ibn Kathir · Ma'arif al-Qur'an · Tazkirul Quran).
 * Surah picker → ayah grid → the selected book's passage for that ayah,
 * with arabic + translation from our own bundled corpus.
 */

const BOOK_KEY = 'dl.tafsir.book';

type SurahData = { surah: number; hasBasmallah: boolean; basmallah: string; verses: ContentAyah[] } | null;

export default function Tafsir() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [book, setBook] = useState<TafsirAuthor>('Ibn Kathir');
  const [surahN, setSurahN] = useState(1);
  const [ayahN, setAyahN] = useState(1);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [content, setContent] = useState<SurahData>(null);
  const [passage, setPassage] = useState<{ loading: boolean; err?: boolean; text?: string; group?: string | null }>({ loading: false });
  const meta = QURAN.find((s) => s.number === surahN) ?? QURAN[0];

  useEffect(() => {
    storage.getItem(BOOK_KEY).then((v) => {
      if (v && TAFSIR_BOOKS.some((b) => b.id === v)) setBook(v as TafsirAuthor);
    }).catch(() => {});
    /* warm surah 1 */
    loadSurah(1).then((c) => setContent(c)).catch(() => setContent(null));
  }, []);

  useEffect(() => {
    setContent(null);
    loadSurah(surahN).then((c) => setContent(c)).catch(() => setContent(null));
  }, [surahN]);

  useEffect(() => {
    setPassage({ loading: true });
    fetchTafsir(surahN, ayahN)
      .then((j) => {
        const p = j.tafsirs.find((t) => t.author === book) ?? j.tafsirs[0];
        setPassage({ loading: false, text: p?.content, group: p?.groupVerse ?? null });
      })
      .catch(() => setPassage({ loading: false, err: true }));
  }, [surahN, ayahN, book]);

  const pickBook = (b: TafsirAuthor) => {
    haptic.selection();
    setBook(b);
    storage.setItem(BOOK_KEY, b).catch(() => {});
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return QURAN;
    return QURAN.filter((s) => s.english.toLowerCase().includes(needle) || s.name.includes(needle) || String(s.number) === needle);
  }, [q]);

  const ayah = content?.verses?.find((a) => a.ayah === ayahN);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <PageHero title="Tafsir" heading="Tafsir Library" sub="Ibn Kathir · Ma'arif al-Qur'an · Tazkirul Quran" icon={BookIcon} height={210}>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 10 }}>
          {TAFSIR_BOOKS.map((b) => {
            const on = book === b.id;
            return (
              <Pressable
                key={b.id}
                accessibilityLabel={`tafsir book ${b.label}`}
                onPress={() => pickBook(b.id)}
                style={{ borderRadius: 11, borderWidth: 1.5, borderColor: on ? (isDark ? 'rgba(74,227,143,0.55)' : 'rgba(29,111,66,0.45)') : 'rgba(255,255,255,0.16)', backgroundColor: on ? 'rgba(46,204,113,0.16)' : 'rgba(0,0,0,0.18)', paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#7DFFB2') : 'rgba(255,255,255,0.75)' }}>{b.label}</T>
              </Pressable>
            );
          })}
        </View>
      </PageHero>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* surah selector */}
        <Pressable
          accessibilityLabel="tafsir surah picker"
          onPress={() => { haptic.selection(); setOpen(true); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13 }}
        >
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <T v="bodyS" style={{ fontWeight: '900', fontSize: 14, color: '#E8C96A' }}>{meta.number}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyS" style={{ fontWeight: '800', fontSize: 13.5, color: d.text }}>{meta.english}</T>
            <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{meta.name} · {meta.ayahs} ayahs · {meta.revelation}</T>
          </View>
          <FontAwesome5 name="chevron-down" size={12} color={d.faint} />
        </Pressable>

        {/* ayah strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12, gap: 6 }}>
          {Array.from({ length: meta.ayahs }, (_, i) => i + 1).map((n) => {
            const on = n === ayahN;
            return (
              <Pressable
                key={n}
                accessibilityLabel={`tafsir ayah ${n}`}
                onPress={() => { haptic.selection(); setAyahN(n); }}
                style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? (isDark ? 'rgba(74,227,143,0.55)' : 'rgba(29,111,66,0.45)') : d.cardBorder, backgroundColor: on ? 'rgba(46,204,113,0.13)' : d.card }}
              >
                <T v="bodyS" style={{ fontWeight: on ? '900' : '600', fontSize: 12.5, color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{n}</T>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* the ayah */}
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: isDark ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.04)', padding: 15 }}>
          <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: '#E8C96A', marginBottom: 7 }}>{meta.english.toUpperCase()} {surahN}:{ayahN}</T>
          <T v="arabic" style={{ fontSize: 21, lineHeight: 40, color: d.text, textAlign: 'right' }}>{ayah?.arabic ?? '…'}</T>
          {ayah?.english ? (
            <T v="bodyS" style={{ fontSize: 12, lineHeight: 19, color: d.subtext, fontStyle: 'italic', marginTop: 9 }}>{ayah.english}</T>
          ) : null}
        </View>

        {/* the tafsir */}
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <FontAwesome5 name="book-reader" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8, color: isDark ? '#4AE38F' : '#1D6F42' }}>
            {TAFSIR_BOOKS.find((b) => b.id === book)?.label.toUpperCase()} · {TAFSIR_BOOKS.find((b) => b.id === book)?.author.toUpperCase()}
          </T>
        </View>
        {passage.loading ? (
          <View style={{ alignItems: 'center', padding: 26 }}><ActivityIndicator color="#E8C96A" /></View>
        ) : passage.err || !passage.text ? (
          <T v="caption" style={{ textAlign: 'center', color: d.faint, padding: 18 }}>Could not load the tafsir for this ayah — check your connection and try again.</T>
        ) : (
          <View style={{ gap: 9 }}>
            {passage.group ? (
              <T v="caption" style={{ fontSize: 10, fontStyle: 'italic', color: d.faint }}>{passage.group}</T>
            ) : null}
            {tafsirBlocks(passage.text).map((b, i) => (
              <View key={i} style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13 }}>
                {b.h ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: 'rgba(212,175,55,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="bookmark" size={8} color="#E8C96A" />
                    </View>
                    <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '900', color: d.text }}>{b.h}</T>
                  </View>
                ) : null}
                <T v="bodyS" style={{ fontSize: 12, lineHeight: 19.5, color: d.subtext }}>{b.t}</T>
              </View>
            ))}
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 4, lineHeight: 14 }}>
              Tafsir texts via quranapi.pages.dev (from quran.com). For rulings, confirm with a qualified scholar.
            </T>
          </View>
        )}

        <Pressable onPress={() => router.push('/tools/ai' as never)} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(91,200,245,0.4)', backgroundColor: 'rgba(91,200,245,0.07)', paddingHorizontal: 13, paddingVertical: 12 }}>
          <FontAwesome5 name="robot" size={13} color="#5BC8F5" />
          <T v="bodyS" style={{ flex: 1, fontSize: 12, fontWeight: '700', color: d.text }}>Ask DeenLink AI about this ayah</T>
          <FontAwesome5 name="arrow-right" size={11} color="#5BC8F5" />
        </Pressable>
      </ScrollView>

      {/* surah picker */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <Pressable onStartShouldSetResponder={() => true} style={{ maxHeight: '74%', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: isDark ? '#07140D' : '#FFFFFF', borderWidth: 1, borderColor: d.cardBorder, padding: 16 }}>
            <T v="h3" style={{ fontWeight: '800', marginBottom: 10 }}>Select a surah</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 11, height: 40, marginBottom: 10 }}>
              <FontAwesome5 name="search" size={11} color={d.faint} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search surah…" placeholderTextColor={d.faint} style={{ flex: 1, fontSize: 13, color: d.text, fontFamily: 'Poppins-Medium' }} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 22, gap: 4 }}>
              {filtered.map((s) => {
                const on = s.number === surahN;
                return (
                  <Pressable key={s.number} onPress={() => { haptic.selection(); setSurahN(s.number); setAyahN(1); setOpen(false); setQ(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent' }}>
                    <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                      <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#E8C96A' }}>{s.number}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyS" style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: d.text }}>{s.english}</T>
                      <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{s.name} · {s.ayahs} ayahs</T>
                    </View>
                    {on ? <FontAwesome5 name="check" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
