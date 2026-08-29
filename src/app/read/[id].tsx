import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { QURAN } from '@/data/quran';
import { loadSurah, type SurahContent } from '@/lib/content';
import { MushafPage } from '@/components/MushafPage';
import { ContentShareSheet } from '@/components/ContentShareSheet';
import { Image } from 'expo-image';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { useQuranAudio, RECITERS } from '@/context/QuranAudioContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

type Mode = 'reading' | 'mushaf';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arNum = (n: number) => String(n).split('').map((d) => AR_DIGITS[Number(d)]).join('');

export default function Reader() {
  const { id, ayah: ayahParam } = useLocalSearchParams<{ id: string; ayah?: string }>();
  const startAyah = Number(ayahParam ?? 0) || 1;
  const router = useRouter();
  const n = Number(id);
  const meta = QURAN.find((s) => s.number === n);
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const audio = useQuranAudio();

  const [data, setData] = useState<SurahContent | null>(null);
  const [marks, setMarks] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>('reading');
  const [reciterOpen, setReciterOpen] = useState(false);
  const [barOpen, setBarOpen] = useState(true);
  const [barW, setBarW] = useState(300);
  const [lang, setLang] = useState<'en' | 'ha'>('en');
  const [shareAyah, setShareAyah] = useState<{ arabic: string; meaning: string; ref: string } | null>(null);
  const [mushafSurah, setMushafSurah] = useState(n);
  const [countdown, setCountdown] = useState<number | null>(null);
  const announcedNext = useRef<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const rowY = useRef<Record<number, number>>({});
  /* deep-linked ayah (?ayah=n) stays highlighted until audio takes over */
  const [flashAyah, setFlashAyah] = useState<number | null>(startAyah > 1 ? startAyah : null);
  const activeAyah = audio.surah === n ? audio.ayah : flashAyah;

  /* ── LOCAL dataset (the /content pack): basmallah flag + arabic/english/hausa ── */
  useEffect(() => {
    let alive = true;
    setData(null);
    loadSurah(n)
      .then((s) => {
        if (alive) setData(s);
      })
      .catch(() => {});
    storage.setItem('dl.quran.last', JSON.stringify({ surah: n, ayah: startAyah, at: new Date().toISOString() })).catch(() => {});
    storage.getItem('dl.quran.ayahMarks').then((r) => {
      if (r)
        try {
          const all: Record<string, number[]> = JSON.parse(r);
          setMarks(new Set(all[n] ?? []));
        } catch {}
    });
    return () => {
      alive = false;
    };
  }, [n, startAyah]);

  /* next-surah handoff: during the announcement count 5→1, then follow the
   * audio into the next surah — the whole reader (list/mushaf/title) swaps */
  useEffect(() => {
    if (audio.announcement) {
      announcedNext.current = audio.announcement.surah;
      setCountdown(5);
      const iv = setInterval(() => setCountdown((c) => (c != null && c > 1 ? c - 1 : null)), 1000);
      return () => clearInterval(iv);
    }
    setCountdown(null);
  }, [audio.announcement]);

  useEffect(() => {
    const target = announcedNext.current;
    if (audio.surah != null && target != null && audio.surah === target && audio.surah !== n) {
      announcedNext.current = null;
      router.replace({ pathname: '/read/[id]', params: { id: String(audio.surah), ayah: '1' } } as never);
    }
  }, [audio.surah, n, router]);

  /* deep-link flash: clear when real audio starts on this surah */
  useEffect(() => {
    if (audio.surah === n) setFlashAyah(null);
  }, [audio.surah, n]);

  /* scroll to the deep-linked ayah once the surah loads */
  useEffect(() => {
    if (!data || flashAyah == null || mode !== 'reading') return;
    const t = setTimeout(() => {
      const y = rowY.current[flashAyah];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 130), animated: false });
    }, 650);
    return () => clearTimeout(t);
  }, [data, flashAyah, mode]);

  /* smooth tracking */
  useEffect(() => {
    if (activeAyah == null || mode !== 'reading') return;
    const y = rowY.current[activeAyah];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 130), animated: true });
  }, [activeAyah, mode]);

  const enterMushaf = () => {
    haptic.selection();
    setMode('mushaf');
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
  const VH = Dimensions.get('window').height;

  if (!meta) return null;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: d.cardBorder, backgroundColor: d.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 16.5 }} numberOfLines={1}>
              {mode === 'mushaf' ? (QURAN.find((x) => x.number === mushafSurah)?.english ?? meta.english) : meta.english}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 10, marginTop: 1 }} numberOfLines={1}>
              {mode === 'mushaf' ? `${QURAN.find((x) => x.number === mushafSurah)?.name ?? meta.name} · uthmani mushaf` : `${meta.name} · ${meta.ayahs} verses · ${meta.revelation}`}
            </T>
          </View>
          {/* translation language — English ⇄ Hausa (our data has both) */}
          <Pressable
            onPress={() => { haptic.selection(); setLang((l) => (l === 'en' ? 'ha' : 'en')); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, marginRight: 8 }}
          >
            <FontAwesome5 name="language" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="caption" style={{ color: d.subtext, fontWeight: '800', fontSize: 10.5 }}>{lang === 'en' ? 'EN' : 'HA'}</T>
          </Pressable>
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
          {/* opener with basmallah (from OUR data — skipped for Taubah) */}
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
            {data?.hasBasmallah && n !== 1 ? (
              <T v="arabic" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontSize: 19, marginTop: 10, textAlign: 'center' }}>
                {data.basmallah}
              </T>
            ) : null}
          </View>

          {(data?.verses ?? []).map((a) => {
            const isActive = activeAyah === a.ayah;
            return (
              <Pressable
                key={a.ayah}
                onLayout={(e) => {
                  rowY.current[a.ayah] = e.nativeEvent.layout.y;
                }}
                onPress={() => {
                  haptic.selection();
                  audio.playAyah(n, a.ayah);
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
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isActive ? 'rgba(46,204,113,0.25)' : isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontSize: 11, fontWeight: '800', fontFamily: 'Poppins-Bold' }}>{a.ayah}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <T v="caption" style={{ color: d.faint, fontSize: 9.5, fontWeight: '700' }}>AYAH {arNum(a.ayah)}</T>
                </View>
                <Text style={{ fontSize: 25, fontFamily: 'Amiri', color: d.text, textAlign: 'right', lineHeight: 46 }}>{a.arabic}</Text>
                {lang === 'en' && a.english ? <T v="bodyS" style={{ color: d.subtext, marginTop: 10 }}>{a.english}</T> : null}
                {lang === 'ha' && a.hausa ? <T v="bodyS" style={{ color: d.subtext, marginTop: 10 }}>{a.hausa}</T> : null}
                {/* per-ayah actions: play just this ayah · bookmark · share */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
                  <Pressable onPress={() => { haptic.light(); audio.playAyah(n, a.ayah); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name="play" size={11} color={activeAyah === a.ayah && audio.playing ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: activeAyah === a.ayah && audio.playing ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>Ayah</T>
                  </Pressable>
                  <Pressable onPress={() => toggleAyahMark(a.ayah)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name="bookmark" size={11} solid={marks.has(a.ayah)} color={marks.has(a.ayah) ? '#E8C96A' : d.faint} />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: marks.has(a.ayah) ? '#E8C96A' : d.subtext }}>Save</T>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      haptic.selection();
                      setShareAyah({ arabic: a.arabic, meaning: (lang === 'ha' && a.hausa) || a.english || '', ref: `${meta.english} ${n}:${a.ayah}` });
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <FontAwesome5 name="share-alt" size={11} color={d.faint} />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: d.subtext }}>Share</T>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          {!data ? <T v="bodyS" style={{ textAlign: 'center', marginTop: 30 }}>Loading surah…</T> : null}
        </ScrollView>
      ) : (
        /* ── mushaf page — true 604-page layout, always fits (own component) ── */
        <MushafPage n={n} englishName={meta.english} local={data} startAyah={activeAyah ?? startAyah ?? 1} onSurahChange={(s) => setMushafSurah(s)} />
      )}

      {/* ── player: full bar ⇄ cassette-only ── */}
      {barOpen ? (
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
            paddingHorizontal: 11,
            paddingVertical: 5,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 5 },
            elevation: 8,
          }}
        >
          {/* title row — english + arabic + collapse */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={() => {
                haptic.light();
                if (audio.surah === n) audio.toggle();
                else audio.playSurah(n, startAyah);
              }}
              style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
            >
              <FontAwesome5 name={audio.surah === n && audio.playing ? 'pause' : 'play'} size={12} color="#FFFFFF" />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="caption" numberOfLines={1} style={{ color: d.text, fontWeight: '800', fontSize: 11 }}>
                {QURAN.find((x) => x.number === (audio.surah ?? n))?.english ?? meta.english}
                <T v="arabic" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontSize: 12.5 }}> {QURAN.find((x) => x.number === (audio.surah ?? n))?.name ?? meta.name} </T>
                <T v="caption" style={{ color: d.faint, fontSize: 9.5, fontWeight: '600' }}>· Ayah {audio.surah != null ? audio.ayah : (activeAyah ?? startAyah)} · {reciterName}</T>
              </T>
            </View>
            <Pressable onPress={() => { haptic.selection(); audio.cycleRate(); }} hitSlop={6} style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.45)' : 'rgba(184,134,11,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.07)' }}>
              <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10.5 }}>
                {audio.rate}x
              </T>
            </Pressable>
            <Pressable onPress={() => { haptic.selection(); setReciterOpen(true); }} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.6)', overflow: 'hidden' }}>
              <Image source={RECITERS.find((r) => r.id === audio.reciter)?.photo ?? RECITERS[0].photo} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            </Pressable>
            {/* collapse → cassette only */}
            <Pressable onPress={() => { haptic.selection(); setBarOpen(false); }} hitSlop={8} style={{ width: 24, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="chevron-down" size={12} color={d.faint} />
            </Pressable>
          </View>

          {/* seek bar — surah progress (drag to jump ayahs) */}
          <Pressable
            onPress={(e) => {
              const f = Math.max(0, Math.min(1, e.nativeEvent.locationX / barW));
              audio.seekTo(f);
            }}
            onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
            style={{ height: 16, justifyContent: 'center', marginTop: 0 }}
          >
            <View style={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20,36,28,0.1)' }} />
            <View style={{ position: 'absolute', left: 0, width: `${audio.progress * 100}%`, height: 4, borderRadius: 2, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
            <View style={{ position: 'absolute', left: `${audio.progress * 100}%`, marginLeft: -5, width: 11, height: 11, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: isDark ? '#4AE38F' : '#1D6F42' }} />
          </Pressable>
        </View>
      ) : (
        /* cassette-only (same design as outside the reader) */
        <Pressable
          onPress={() => {
            haptic.selection();
            setBarOpen(true);
          }}
          style={{
            position: 'absolute',
            left: 14,
            bottom: 16,
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: isDark ? 'rgba(8,20,13,0.94)' : 'rgba(255,255,255,0.97)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <FontAwesome5 name="compact-disc" size={22} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
      )}

      {/* next-surah announcement — shown ~3s while switching surahs automatically */}
      {audio.announcement ? (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 108, zIndex: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: isDark ? 'rgba(12,23,18,0.96)' : 'rgba(255,252,242,0.97)', paddingHorizontal: 13, paddingVertical: 10 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="forward" size={11} color="#E8C96A" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5 }}>UP NEXT — PLAYING IN {countdown ?? 5}…</T>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <T v="bodyS" numberOfLines={1} style={{ color: d.text, fontWeight: '800', fontSize: 12.5, flexShrink: 1 }}>{QURAN.find((x) => x.number === audio.announcement!.surah)?.english}</T>
              <T v="arabic" numberOfLines={1} style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontSize: 13, flexShrink: 1 }}>{QURAN.find((x) => x.number === audio.announcement!.surah)?.name}</T>
            </View>
          </View>
        </View>
      ) : null}

      {/* ayah share — friends / link / system / styled image */}
      <ContentShareSheet
        visible={shareAyah != null}
        onClose={() => setShareAyah(null)}
        card={shareAyah ? { kind: 'ayah', ...shareAyah } : null}
        link={`https://deenlink.org/quran/${n}`}
      />

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
                  <Image source={r.photo} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.cardBorder }} contentFit="cover" />
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
