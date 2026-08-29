import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OFFLINE_TEXT, QURAN, type Ayah } from '@/data/quran';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { useQuranAudio, RECITERS } from '@/context/QuranAudioContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

type Mode = 'reading' | 'mushaf';

/** Reader (pass 16) — root-level route (no tab bar). Global audio w/ reciters, ayah highlight + smooth tracking, mushaf pages. */
export default function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const startAyah = Number(useLocalSearchParams<{ ayah?: string }>().ayah ?? 0) || 1;
  const router = useRouter();
  const n = Number(id);
  const meta = QURAN.find((s) => s.number === n);
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const audio = useQuranAudio();

  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [online, setOnline] = useState(false);
  const [marks, setMarks] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>('reading');
  const [reciterOpen, setReciterOpen] = useState(false);
  const [barOpen, setBarOpen] = useState(true);

  /* mushaf page state */
  const [page, setPage] = useState<number | null>(null);
  const [pageAyahs, setPageAyahs] = useState<Array<{ numberInSurah: number; text: string; surahNumber: number; surahName: string }>>([]);
  const [pageLoading, setPageLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const rowY = useRef<Record<number, number>>({});
  const activeAyah = audio.surah === n ? audio.ayah : null;

  /* text (offline first, live when online) */
  useEffect(() => {
    setAyahs(OFFLINE_TEXT[n] ?? null);
    setOnline(false);
    storage.setItem('dl.quran.last', JSON.stringify({ surah: n, ayah: startAyah, at: new Date().toISOString() })).catch(() => {});
    fetch(`https://api.alquran.cloud/v1/surah/${n}/editions/quran-simple,en.asad`)
      .then((r) => r.json())
      .then((dd: { data?: { ayahs?: { numberInSurah: number; text: string }[] }[] }) => {
        const editions = Array.isArray(dd?.data) ? dd.data : [];
        const ar = editions[0]?.ayahs;
        const en = editions[1]?.ayahs;
        if (Array.isArray(ar) && ar.length > 0) {
          setAyahs(ar.map((a, i) => ({ numberInSurah: a.numberInSurah, arabic: a.text, english: en?.[i]?.text ?? '' })));
          setOnline(true);
        }
      })
      .catch(() => {});
    storage.getItem('dl.quran.ayahMarks').then((r) => {
      if (r)
        try {
          const all: Record<string, number[]> = JSON.parse(r);
          setMarks(new Set(all[n] ?? []));
        } catch {}
    });
  }, [n, startAyah]);

  /* smooth tracking: scroll the active ayah into view */
  useEffect(() => {
    if (activeAyah == null || mode !== 'reading') return;
    const y = rowY.current[activeAyah];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 130), animated: true });
  }, [activeAyah, mode]);

  /* mushaf page fetch */
  const loadPage = async (p: number) => {
    setPageLoading(true);
    try {
      const r = await fetch(`https://api.alquran.cloud/v1/page/${p}/quran-uthmani`);
      const dd = await r.json();
      const list = (dd?.data?.ayahs ?? []) as Array<{ numberInSurah: number; text: string; number: number; surah?: { number: number; englishName?: string; name?: string } }>;
      setPageAyahs(list.map((a) => ({ numberInSurah: a.numberInSurah, text: a.text, surahNumber: a.surah?.number ?? n, surahName: a.surah?.englishName ?? a.surah?.name ?? '' })));
      setPage(p);
    } catch {}
    setPageLoading(false);
  };

  const enterMushaf = async () => {
    haptic.selection();
    setMode('mushaf');
    if (page == null) {
      try {
        const r = await fetch(`https://api.alquran.cloud/v1/ayah/${n}:${activeAyah ?? startAyah ?? 1}/quran-uthmani`);
        const dd = await r.json();
        const p = dd?.data?.page;
        if (p) await loadPage(p);
      } catch {}
    }
  };

  const toggleAyahMark = (num: number) => {
    haptic.light();
    setMarks((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      storage.getItem('dl.quran.ayahMarks').then((r) => {
        let all: Record<string, number[]> = {};
        try {
          all = r ? JSON.parse(r) : {};
        } catch {}
        all[n] = Array.from(next);
        storage.setItem('dl.quran.ayahMarks', JSON.stringify(all));
      });
      return next;
    });
  };

  const reciterName = RECITERS.find((r) => r.id === audio.reciter)?.name ?? RECITERS[0].name;

  if (!meta) return null;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* sticky header — stays put on long pages */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: d.cardBorder, backgroundColor: d.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 17 }} numberOfLines={1}>
              {mode === 'mushaf' ? `Mushaf · Page ${page ?? '…'}` : meta.english}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 10, marginTop: 1 }} numberOfLines={1}>
              {mode === 'mushaf' ? 'Uthmani script · original page layout' : `${meta.name} · ${meta.ayahs} verses · ${online ? 'live text' : 'offline copy'}`}
            </T>
          </View>
          {/* mode switch */}
          <Pressable
            onPress={() => (mode === 'reading' ? enterMushaf() : (haptic.selection(), setMode('reading')))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.45)' : 'rgba(184,134,11,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.07)' }}
          >
            <FontAwesome5 name={mode === 'reading' ? 'book-open' : 'list-ul'} size={10} color={isDark ? '#E8C96A' : '#8C6D1F'} />
            <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10.5 }}>
              {mode === 'reading' ? 'Mushaf' : 'Reading'}
            </T>
          </Pressable>
        </View>
      </View>

      {mode === 'reading' ? (
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
          {/* opener */}
          <View style={{ alignItems: 'center', marginBottom: 16, paddingVertical: 18, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 1.5, backgroundColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.5)' }} />
              <T v="arabic" style={{ color: d.text, fontSize: 30 }}>
                {meta.name}
              </T>
              <View style={{ width: 40, height: 1.5, backgroundColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.5)' }} />
            </View>
            <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 8, letterSpacing: 0.5 }}>
              SURAH {meta.number} · {meta.revelation.toUpperCase()}
            </T>
          </View>

          {ayahs?.map((a) => {
            const isActive = activeAyah === a.numberInSurah;
            return (
              <Pressable
                key={a.numberInSurah}
                onLayout={(e) => {
                  rowY.current[a.numberInSurah] = e.nativeEvent.layout.y;
                }}
                onPress={() => {
                  haptic.selection();
                  audio.playSurah(n, a.numberInSurah);
                }}
                style={{
                  backgroundColor: isActive ? (isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.08)') : d.card,
                  borderWidth: 1,
                  borderColor: isActive ? (isDark ? 'rgba(74,227,143,0.55)' : 'rgba(29,111,66,0.4)') : d.cardBorder,
                  borderRadius: 16,
                  padding: 15,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isActive ? 'rgba(46,204,113,0.25)' : isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontSize: 11, fontWeight: '800' }}>{a.numberInSurah}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => toggleAyahMark(a.numberInSurah)} hitSlop={8} style={{ padding: 4 }}>
                    <FontAwesome5 name="bookmark" size={14} solid={marks.has(a.numberInSurah)} color={marks.has(a.numberInSurah) ? '#E8C96A' : d.faint} />
                  </Pressable>
                </View>
                <Text style={{ fontSize: 25, fontFamily: 'Amiri', color: d.text, textAlign: 'right', lineHeight: 46 }}>{a.arabic}</Text>
                {a.english ? <Text style={{ color: d.subtext, fontSize: 13.5, marginTop: 10, lineHeight: 20 }}>{a.english}</Text> : null}
              </Pressable>
            );
          })}

          {!ayahs ? <Text style={{ color: d.subtext, textAlign: 'center', marginTop: 30, fontSize: 13 }}>Connect to the internet to read this surah.</Text> : null}
        </ScrollView>
      ) : (
        /* ── mushaf page ── */
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
          <View style={{ borderRadius: 14, borderWidth: 2, borderColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.5)', backgroundColor: isDark ? '#0A130E' : '#FFFCF2', padding: 14, minHeight: 540 }}>
            {/* ornate header */}
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.5)', width: 46 }} />
                <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>
                  {page ? `PAGE ${page} · JUZ ${pageAyahs.length ? '' : ''}` : 'LOADING…'}
                </T>
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.5)', width: 46 }} />
              </View>
            </View>

            {/* flowing uthmani text — surah headers inline, ayah markers ۝ */}
            <Text style={{ fontSize: 23, fontFamily: 'Amiri', color: d.text, textAlign: 'right', lineHeight: 48, writingDirection: 'rtl' }}>
              {pageAyahs.map((a, i) => {
                const isNewSurah = i === 0 || pageAyahs[i - 1].surahNumber !== a.surahNumber;
                const marker = ` ﴿${a.numberInSurah}﴾ `;
                return (isNewSurah ? `\n${a.surahName}\n` : '') + a.text + marker;
              })}
            </Text>

            {pageLoading || pageAyahs.length === 0 ? (
              <Text style={{ color: d.faint, textAlign: 'center', marginTop: 40, fontSize: 12 }}>{pageLoading ? 'Loading page…' : 'Mushaf pages need an internet connection.'}</Text>
            ) : null}
          </View>

          {/* page nav */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
            <Pressable onPress={() => page && page > 1 && loadPage(page - 1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card }}>
              <FontAwesome5 name="chevron-left" size={10} color={d.subtext} />
              <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 11 }}>
                Prev
              </T>
            </Pressable>
            <T v="caption" style={{ color: d.faint, fontSize: 11, fontWeight: '700' }}>
              {page ?? '—'} / 604
            </T>
            <Pressable onPress={() => page && page < 604 && loadPage(page + 1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card }}>
              <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 11 }}>
                Next
              </T>
              <FontAwesome5 name="chevron-right" size={10} color={d.subtext} />
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* audio bar */}
      <View
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 16,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.25)',
          backgroundColor: isDark ? 'rgba(8,20,13,0.95)' : 'rgba(255,255,255,0.97)',
          paddingHorizontal: 14,
          paddingVertical: 10,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Pressable
            onPress={() => {
              haptic.light();
              if (audio.surah === n) audio.toggle();
              else audio.playSurah(n, startAyah);
            }}
            style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
          >
            <FontAwesome5 name={audio.surah === n && audio.playing ? 'pause' : 'play'} size={15} color="#FFFFFF" />
          </Pressable>
          {barOpen ? (
            <View style={{ flex: 1 }}>
              <T v="caption" numberOfLines={1} style={{ color: d.text, fontWeight: '700', fontSize: 11 }}>
                {meta.english} · Ayah {activeAyah ?? startAyah} · {reciterName}
              </T>
              <T v="caption" style={{ color: d.faint, fontSize: 10, marginTop: 2 }}>
                Tap any ayah to recite from it — plays app-wide
              </T>
            </View>
          ) : (
            <Pressable onPress={() => { haptic.selection(); setBarOpen(true); }} style={{ flex: 1 }}>
              <T v="caption" numberOfLines={1} style={{ color: d.faint, fontWeight: '700', fontSize: 11 }}>
                {meta.english} · Ayah {activeAyah ?? startAyah}
              </T>
            </Pressable>
          )}
          {barOpen ? (
            <>
              {/* speed */}
              <Pressable onPress={() => { haptic.selection(); audio.cycleRate(); }} hitSlop={6} style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.45)' : 'rgba(184,134,11,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.07)' }}>
                <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 11 }}>
                  {audio.rate}x
                </T>
              </Pressable>
              {/* reciter */}
              <Pressable onPress={() => { haptic.selection(); setReciterOpen(true); }} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="user-headphones" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
              </Pressable>
            </>
          ) : null}
          {/* expand / collapse */}
          <Pressable onPress={() => { haptic.selection(); setBarOpen((v) => !v); }} hitSlop={8} style={{ width: 30, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={barOpen ? 'chevron-down' : 'chevron-up'} size={12} color={d.faint} />
          </Pressable>
        </View>
      </View>

      {/* reciter sheet */}
      {reciterOpen ? (
        <View style={{ position: 'absolute', inset: 0, zIndex: 90, backgroundColor: 'rgba(4,8,6,0.7)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setReciterOpen(false)} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 16 }}>
            <T v="body" style={{ color: d.text, fontWeight: '800', fontSize: 15, marginBottom: 12 }}>
              Choose a reciter
            </T>
            {RECITERS.map((r) => {
              const on = audio.reciter === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    haptic.light();
                    audio.setReciter(r.id);
                    setReciterOpen(false);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent' }}
                >
                  <FontAwesome5 name="user-headphones" size={13} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                  <T v="body" style={{ flex: 1, color: d.text, fontWeight: '700', fontSize: 13 }}>
                    {r.name}
                  </T>
                  {on ? <FontAwesome5 name="check" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
