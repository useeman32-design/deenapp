import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { QURAN } from '@/data/quran';
import { loadSurah, type SurahContent } from '@/lib/content';
import { MushafPage } from '@/components/MushafPage';
import { loadTranslation, TR_LANGS, type TrLang } from '@/lib/translations';
import { GlassPlayerBar } from '@/components/GlassPlayerBar';
import { ReciteMode, type ReciteItem } from '@/components/ReciteMode';
import type { LoopCfg } from '@/context/QuranAudioContext';
import { ActivityIndicator, Modal, TextInput } from 'react-native';
import { ContentShareSheet } from '@/components/ContentShareSheet';
import { Image } from 'expo-image';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { useQuranAudio, RECITERS } from '@/context/QuranAudioContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { stopBubble } from '@/lib/press';

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
  /* pass 32: keep the mushaf view when a page swipe crosses into another
   * surah — the router.replace remount would otherwise dump the reader back
   * into reading mode mid-swipe. */
  const [mode, setMode] = useState<Mode>(() =>
    (globalThis as unknown as { __dlReadMode?: Mode }).__dlReadMode === 'mushaf' ? 'mushaf' : 'reading',
  );
  useEffect(() => {
    (globalThis as unknown as { __dlReadMode?: Mode }).__dlReadMode = mode;
  }, [mode]);
  const [reciterOpen, setReciterOpen] = useState(false);
  const [barOpen, setBarOpen] = useState(true);
  const [barW, setBarW] = useState(300);
  const [lang, setLang] = useState<TrLang>('en');
  /* pass 33: extra translations (yo/fr/bn/ur) load lazily from gz packs */
  const [trMap, setTrMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (lang === 'en' || lang === 'ha') { setTrMap({}); return; }
    let alive = true;
    loadTranslation(lang).then((m) => { if (alive) setTrMap(m); }).catch(() => { if (alive) setTrMap({}); });
    return () => { alive = false; };
  }, [lang]);
  const [shareAyah, setShareAyah] = useState<{ arabic: string; meaning: string; ref: string } | null>(null);
  const [mushafSurah, setMushafSurah] = useState(n);
  const [countdown, setCountdown] = useState<number | null>(null);
  const announcedNext = useRef<number | null>(null);
  /* another surah is playing and the user opened a different one → ask */
  const [switchAsk, setSwitchAsk] = useState<number | null>(null);
  const [reciteAt, setReciteAt] = useState<number | null>(null);
  const [reciteAll, setReciteAll] = useState(false);
  const [loopOpen, setLoopOpen] = useState(false);
  const [loopFrom, setLoopFrom] = useState(startAyah || 1);
  const [loopTo, setLoopTo] = useState(Math.min((startAyah || 1) + 4, meta?.ayahs ?? 7));
  const [perAyah, setPerAyah] = useState(1);
  const [customPer, setCustomPer] = useState('');
  const [loopCycles, setLoopCycles] = useState(0);

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

  /* pass 23: "currently playing X — switch to Y?" when entering another surah */
  useEffect(() => {
    setSwitchAsk(null);
    if (audio.surah != null && audio.surah !== n && (audio.playing || audio.loading)) {
      const t = setTimeout(() => setSwitchAsk(audio.surah as number), 450);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, audio.surah]);

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
          {/* translation language — cycles EN → HA → YO → FR → BN → UR */}
          <Pressable
            accessibilityLabel="translation language"
            onPress={() => { haptic.selection(); setLang((l) => { const i = TR_LANGS.findIndex((x) => x.id === l); return TR_LANGS[(i + 1) % TR_LANGS.length].id; }); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, marginRight: 8 }}
          >
            <FontAwesome5 name="language" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="caption" style={{ color: d.subtext, fontWeight: '800', fontSize: 10.5 }}>{TR_LANGS.find((x) => x.id === lang)?.code ?? 'EN'}</T>
          </Pressable>
          <Pressable
            accessibilityLabel="toggle mushaf view"
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
            {n !== 1 && n !== 9 ? (
              <T v="arabic" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontSize: 22, marginTop: 10, textAlign: 'center', fontWeight: '700' }}>
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
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
                {lang !== 'en' && lang !== 'ha' && trMap[`${n}:${a.ayah}`] ? (
                  <T v="bodyS" style={{ color: d.subtext, marginTop: 10, writingDirection: lang === 'ur' ? 'rtl' : undefined }}>{trMap[`${n}:${a.ayah}`]}</T>
                ) : null}
                {/* per-ayah actions: play just this ayah · bookmark · share */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
                  <Pressable
                    onPress={() => {
                      haptic.light();
                      /* same ayah playing → pause/resume; otherwise play just this ayah */
                      if (audio.surah === n && audio.ayah === a.ayah && (audio.playing || audio.loading)) audio.toggle();
                      else audio.playAyah(n, a.ayah);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    {audio.surah === n && audio.ayah === a.ayah && audio.loading ? (
                      <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
                    ) : (
                      <FontAwesome5 name={audio.surah === n && audio.ayah === a.ayah && audio.playing ? 'pause' : 'play'} size={11} color={activeAyah === a.ayah && audio.playing ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                    )}
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: activeAyah === a.ayah && audio.playing ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>Ayah</T>
                  </Pressable>
                  <Pressable onPress={() => toggleAyahMark(a.ayah)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name="bookmark" size={11} solid={marks.has(a.ayah)} color={marks.has(a.ayah) ? '#E8C96A' : d.faint} />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: marks.has(a.ayah) ? '#E8C96A' : d.subtext }}>Save</T>
                  </Pressable>
                  <Pressable onPress={() => { haptic.selection(); setReciteAt(a.ayah); setReciteAll(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name="microphone-alt" size={11} color="#5EA7C9" />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: '#5EA7C9' }}>Recite</T>
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
        <MushafPage
          n={n}
          englishName={meta.english}
          local={data}
          startAyah={activeAyah ?? startAyah ?? 1}
          onSurahChange={(s) => {
            setMushafSurah(s);
            /* keep reader + mushaf on the SAME surah — swap the whole screen */
            if (s !== n) router.replace({ pathname: '/read/[id]', params: { id: String(s) } } as never);
          }}
        />
      )}

      {/* ── pass-24: repeat / memorization loop sheet ── */}
      <Modal visible={loopOpen} animationType="slide" transparent onRequestClose={() => setLoopOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={() => setLoopOpen(false)}>
          <Pressable onPress={(e) => stopBubble(e)} style={{ borderRadius: 22, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, paddingBottom: insets.bottom + 14, paddingHorizontal: 16, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="sync-alt" size={12} color="#E8C96A" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="h3" style={{ fontWeight: '800', fontSize: 14.5, color: d.text }}>Repeat for memorization</T>
                <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>Loop one ayah or a range — perfect for hifz</T>
              </View>
              {audio.loop && audio.loop.surah === n ? (
                <Pressable onPress={() => { haptic.selection(); audio.setLoop(null); }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(220,80,80,0.35)', backgroundColor: 'rgba(220,80,80,0.06)' }}>
                  <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#DC5050' }}>Stop</T>
                </Pressable>
              ) : null}
            </View>

            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>RANGE (AYAH {loopFrom} – {loopTo})</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {[['FROM', loopFrom, setLoopFrom], ['TO', loopTo, setLoopTo]].map(([lbl, val, set]: any) => (
                <View key={lbl} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 6, paddingVertical: 4 }}>
                  <Pressable onPress={() => { haptic.selection(); set(Math.max(1, val - 1)); }} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="minus" size={10} color={d.subtext} />
                  </Pressable>
                  <View style={{ alignItems: 'center' }}>
                    <T v="caption" style={{ fontSize: 8, fontWeight: '800', color: d.faint }}>{lbl}</T>
                    <T v="bodyS" style={{ fontSize: 16, fontWeight: '800', color: d.text }}>{n}:{val}</T>
                  </View>
                  <Pressable onPress={() => { haptic.selection(); set(Math.min(meta.ayahs, val + 1)); }} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="plus" size={10} color={d.subtext} />
                  </Pressable>
                </View>
              ))}
            </View>

            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>REPEAT EACH AYAH</T>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, alignItems: 'center' }}>
              {[1, 2, 3, 5, 10].map((c) => (
                <Pressable key={c} onPress={() => { haptic.selection(); setPerAyah(c); setCustomPer(''); }} style={{ width: 40, alignItems: 'center', paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: perAyah === c && !customPer ? 'rgba(212,175,55,0.55)' : d.cardBorder, backgroundColor: perAyah === c && !customPer ? 'rgba(212,175,55,0.12)' : d.bgSoft }}>
                  <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: perAyah === c && !customPer ? '#E8C96A' : d.subtext }}>{c}×</T>
                </Pressable>
              ))}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 11, borderWidth: 1, borderColor: customPer ? 'rgba(212,175,55,0.55)' : d.cardBorder, backgroundColor: customPer ? 'rgba(212,175,55,0.12)' : d.bgSoft, paddingHorizontal: 8, gap: 4 }}>
                <TextInput
                  value={customPer}
                  onChangeText={(tx) => { const nn = parseInt(tx.replace(/\D/g, ''), 10); setCustomPer(tx.replace(/\D/g, '')); if (nn && nn > 0 && nn <= 100) setPerAyah(nn); }}
                  keyboardType="numeric"
                  placeholder="custom"
                  placeholderTextColor={d.faint}
                  maxLength={3}
                  style={{ width: 44, paddingVertical: 8, fontSize: 13, fontWeight: '800', color: customPer ? '#E8C96A' : d.subtext, textAlign: 'center' }}
                />
                <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: customPer ? '#E8C96A' : d.faint }}>×</T>
              </View>
            </View>

            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>TIMES THROUGH THE RANGE</T>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {[1, 2, 3, 5, 0].map((c) => (
                <Pressable key={c} onPress={() => { haptic.selection(); setLoopCycles(c); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: loopCycles === c ? 'rgba(212,175,55,0.55)' : d.cardBorder, backgroundColor: loopCycles === c ? 'rgba(212,175,55,0.12)' : d.bgSoft }}>
                  <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: loopCycles === c ? '#E8C96A' : d.subtext }}>{c === 0 ? '∞' : `${c}×`}</T>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => {
                haptic.light();
                const from = Math.min(loopFrom, loopTo);
                const to = Math.max(loopFrom, loopTo);
                audio.playSurah(n, from);
                audio.setLoop({ surah: n, from, to, perAyah: customPer ? Math.max(1, Math.min(100, parseInt(customPer, 10) || 1)) : perAyah, cycles: loopCycles } as LoopCfg);
                setLoopOpen(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 15, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}
            >
              <FontAwesome5 name="play" size={12} color="#fff" />
              <T v="caption" style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Start loop at {n}:{Math.min(loopFrom, loopTo)}</T>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── pass-24: recite mode ── */}
      {data && reciteAt != null ? (
        <ReciteMode
          title={reciteAll ? meta.english : `${meta.english} ${n}:${reciteAt}`}
          mode={reciteAll ? 'surah' : 'ayah'}
          startAt={reciteAll ? Math.max(0, (activeAyah ?? startAyah ?? 1) - 1) : 0}
          items={(reciteAll ? data.verses : data.verses.filter((v) => v.ayah === reciteAt)).map((v) => ({ surah: n, ayah: v.ayah, arabic: v.arabic, label: `Ayah ${v.ayah}` }))}
          onClose={() => setReciteAt(null)}
        />
      ) : null}

      {/* ── player: glassy bar ⇄ cassette-only ── */}
      {barOpen ? (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 16, zIndex: 50 }}>
          <GlassPlayerBar
            player={null}
            playing={audio.surah === n && audio.playing}
            loading={audio.surah === n && audio.loading}
            title={QURAN.find((x) => x.number === (audio.surah ?? n))?.english ?? meta.english}
            arabic={QURAN.find((x) => x.number === (audio.surah ?? n))?.name ?? meta.name}
            subtitle={`Ayah ${audio.surah != null ? audio.ayah : (activeAyah ?? startAyah)} · ${reciterName}`}
            onToggle={() => {
              haptic.light();
              if (audio.surah === n) audio.toggle();
              else audio.playSurah(n, startAyah);
            }}
            frac={audio.surah === n ? audio.progress : 0}
            onSeek={(f) => audio.seekTo(f)}
            seekMargins={{ left: 46, right: 6 }}
            compact
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pressable onPress={() => { haptic.selection(); setReciteAt(activeAyah ?? startAyah ?? 1); setReciteAll(true); }} hitSlop={6} accessibilityLabel="recite whole surah" style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(44,110,143,0.5)', backgroundColor: 'rgba(44,110,143,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="microphone-alt" size={11} color="#5EA7C9" />
                </Pressable>
                <Pressable onPress={() => { haptic.selection(); setLoopOpen(true); }} hitSlop={6} accessibilityLabel="repeat loop" style={{ width: audio.loop && audio.loop.surah === n ? 38 : 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: audio.loop && audio.loop.surah === n ? 'rgba(212,175,55,0.75)' : d.cardBorder, backgroundColor: audio.loop && audio.loop.surah === n ? 'rgba(212,175,55,0.16)' : d.bgSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: audio.loop && audio.loop.surah === n ? 5 : 0 }}>
                  <FontAwesome5 name="sync-alt" size={11} color={audio.loop && audio.loop.surah === n ? '#E8C96A' : d.faint} />
                  {audio.loop && audio.loop.surah === n ? (
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: '#E8C96A' }}>{audio.loop.perAyah === 0 ? '∞' : `${audio.loop.perAyah}×`}</T>
                  ) : null}
                </Pressable>
                <Pressable onPress={() => { haptic.selection(); audio.cycleRate(); }} hitSlop={6} style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.45)' : 'rgba(184,134,11,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.07)' }}>
                  <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10.5 }}>{audio.rate}x</T>
                </Pressable>
                <Pressable onPress={() => { haptic.selection(); setReciterOpen(true); }} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.6)', overflow: 'hidden' }}>
                  <Image source={RECITERS.find((r) => r.id === audio.reciter)?.photo ?? RECITERS[0].photo} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </Pressable>
                <Pressable onPress={() => { haptic.selection(); setBarOpen(false); }} hitSlop={8} style={{ width: 22, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="chevron-down" size={12} color={d.faint} />
                </Pressable>
              </View>
            }
          />
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

      {/* switch-recitation prompt — entering a surah while another plays */}
      {switchAsk != null ? (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 118, zIndex: 70, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.55)', backgroundColor: isDark ? 'rgba(12,23,18,0.97)' : 'rgba(255,252,242,0.98)', padding: 13, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 11, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="exchange-alt" size={12} color="#E8C96A" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 9, letterSpacing: 0.5 }}>CURRENTLY PLAYING</T>
              <T v="bodyS" numberOfLines={1} style={{ color: d.text, fontWeight: '800', fontSize: 12.5, marginTop: 1 }}>
                {QURAN.find((x) => x.number === switchAsk)?.english} — switch to {meta.english}?
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable onPress={() => setSwitchAsk(null)} style={{ flex: 1, borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, paddingVertical: 9, alignItems: 'center' }}>
              <T v="caption" style={{ color: d.subtext, fontWeight: '800', fontSize: 11 }}>Keep playing</T>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic.light();
                const to = n;
                setSwitchAsk(null);
                audio.playSurah(to, 1);
              }}
              style={{ flex: 1, borderRadius: 11, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', paddingVertical: 9, alignItems: 'center' }}
            >
              <T v="caption" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>Yes, switch</T>
            </Pressable>
          </View>
        </View>
      ) : null}

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
