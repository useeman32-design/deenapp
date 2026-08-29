import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { QURAN } from '@/data/quran';
import { useQuranAudio, globalAyahOf, surahOfGlobal } from '@/context/QuranAudioContext';
import { loadSurah, type SurahContent } from '@/lib/content';

/**
 * Mushaf page (pass 22 rewrite):
 *  · the page FILLS the screen — no prev/next row (swipe ⇄ or tap edges)
 *  · basmallah ONLY at a real surah start (ayah 1, never surah 9), centred,
 *    BOLD, in a compact header with the surah name in an ornamented pill
 *  · text size: continuous 13–26pt drag bar, NO auto-shrink — if the text is
 *    taller than the page it scrolls INSIDE the page
 *  · dark app theme defaults the page skin to Night
 *  · browsing pages never hijacks audio; if audio is PLAYING, the page
 *    auto-turns to follow the recitation (reader ⇄ mushaf always agree)
 */

const BASMALLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export const arNum = (x: number | string) => String(x).replace(/\d/g, (d) => AR_DIGITS[+d]);

const MIN_FS = 13;
const MAX_FS = 26;
const DEFAULT_FS = 20;

const THEMES = [
  { id: 'cream', label: 'Cream', bg: '#FFFCF2', text: '#12241A', border: 'rgba(184,134,11,0.55)', accent: '#8C6D1F', basm: '#1D6F42' },
  { id: 'white', label: 'White', bg: '#FFFFFF', text: '#0E1F16', border: 'rgba(29,111,66,0.35)', accent: '#1D6F42', basm: '#1D6F42' },
  { id: 'sepia', label: 'Sepia', bg: '#F3E7D0', text: '#3A2E1B', border: 'rgba(122,90,42,0.55)', accent: '#7A5A2A', basm: '#6B4E1F' },
  { id: 'madina', label: 'Madina', bg: '#E9F1EA', text: '#0F2417', border: 'rgba(29,111,66,0.5)', accent: '#1D6F42', basm: '#1D6F42' },
  { id: 'night', label: 'Night', bg: '#0A130E', text: '#E9F3EC', border: 'rgba(212,175,55,0.5)', accent: '#E8C96A', basm: '#4AE38F' },
] as const;

type PageAyah = { key: string; global: number; numberInSurah: number; text: string; surahNo: number; surahNameAr: string; isStart: boolean };
type PageInfo = { pageNo: number | null; label: string; ayahs: PageAyah[]; offline: boolean };
type Segment = { start?: PageAyah; ayahs: PageAyah[] };

export function MushafPage({
  n,
  englishName,
  local,
  startAyah,
  onSurahChange,
}: {
  n: number;
  englishName: string;
  local: SurahContent | null;
  startAyah: number;
  onSurahChange?: (surahNo: number) => void;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const audio = useQuranAudio();

  const [pg, setPg] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrollable, setScrollable] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [fs, setFs] = useState(DEFAULT_FS);
  const [followingAudio, setFollowingAudio] = useState(false);
  const boxH = useRef(0);
  const slide = useRef(new Animated.Value(0)).current;
  const loadingPage = useRef<number | null>(null);

  /* persisted prefs; theme default follows the app theme (Night in dark) */
  useEffect(() => {
    storage.getItem('dl.mushaf.prefs2').then((r) => {
      try {
        const p = JSON.parse(r ?? '{}');
        if (p.themeId && THEMES.some((t) => t.id === p.themeId)) setThemeId(p.themeId);
        if (typeof p.fs === 'number') setFs(Math.max(MIN_FS, Math.min(MAX_FS, p.fs)));
      } catch {}
      setThemeId((t) => t ?? (isDark ? 'night' : 'cream'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const savePrefs = (t: string, f: number) => storage.setItem('dl.mushaf.prefs2', JSON.stringify({ themeId: t, fs: f })).catch(() => {});
  const skin = THEMES.find((t) => t.id === (themeId ?? (isDark ? 'night' : 'cream'))) ?? THEMES[0];
  const lh = Math.round(fs * 1.9);

  const stripBasmallah = (text: string, surahNo: number, numberInSurah: number) =>
    numberInSurah === 1 && surahNo !== 1 && text.startsWith('بِسْمِ') ? text.slice(BASMALLAH.length).trim() : text;

  const pageFromApi = useCallback(async (p: number): Promise<PageInfo> => {
    const r = await fetch(`https://api.alquran.cloud/v1/page/${p}/quran-uthmani`);
    if (!r.ok) throw new Error('page api');
    const dd = await r.json();
    const list = (dd?.data?.ayahs ?? []) as Array<{ numberInSurah: number; number: number; text: string; surah?: { number: number; name: string } }>;
    const ayahs: PageAyah[] = list.map((a) => {
      const surahNo = a.surah?.number ?? 0;
      return {
        key: `${a.number}`,
        global: a.number,
        numberInSurah: a.numberInSurah,
        text: stripBasmallah(a.text, surahNo, a.numberInSurah),
        surahNo,
        surahNameAr: a.surah?.name ?? '',
        /* a REAL surah start — never just "first ayah on this page" (that put a
         * basmallah on every page) */
        isStart: a.numberInSurah === 1,
      };
    });
    return { pageNo: p, label: `${p} / 604`, ayahs, offline: false };
  }, []);

  const localFallback = useCallback(async (): Promise<PageInfo> => {
    const surah = local ?? (await loadSurah(n).catch(() => null));
    if (!surah) throw new Error('no local');
    let g = 0;
    for (let i = 1; i < n; i++) g += QURAN[i - 1]?.ayahs ?? 0;
    const ayahs: PageAyah[] = surah.verses.map((v) => ({
      key: `${n}:${v.ayah}`,
      global: g + v.ayah,
      numberInSurah: v.ayah,
      text: v.ayah === 1 && n !== 1 && n !== 9 && v.arabic.startsWith('بِسْمِ') ? v.arabic.slice(BASMALLAH.length).trim() || v.arabic : v.arabic,
      surahNo: n,
      surahNameAr: QURAN.find((q) => q.number === n)?.name ?? '',
      isStart: v.ayah === 1,
    }));
    return { pageNo: null, label: englishName, ayahs, offline: true };
  }, [englishName, local, n]);

  const load = useCallback(
    async (p: number, userNav = false) => {
      if (loadingPage.current === p) return;
      loadingPage.current = p;
      setLoading(true);
      try {
        const info = await pageFromApi(p);
        setPg(info);
        setScrollable(false);
        if (userNav) {
          haptic.selection();
          const first = info.ayahs[0];
          if (first) onSurahChange?.(first.surahNo);
          /* pass 22: browsing pages NEVER starts/changes audio */
        }
      } catch {
        try {
          setPg(await localFallback());
        } catch {}
      }
      setLoading(false);
      loadingPage.current = null;
    },
    [pageFromApi, localFallback, onSurahChange],
  );

  /* initial page for the surah:ayah we entered with */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`https://api.alquran.cloud/v1/ayah/${n}:${startAyah}/quran-uthmani`);
        if (!r.ok) throw new Error('ayah api');
        const dd = await r.json();
        const p = dd?.data?.page;
        if (!alive) return;
        if (p) await load(p);
        else throw new Error('no page');
      } catch {
        if (!alive) return;
        try {
          setPg(await localFallback());
        } catch {}
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, startAyah]);

  /* follow the recitation: while audio PLAYS, auto-turn to its page */
  const activeGlobal = audio.surah != null ? globalAyahOf(audio.surah, audio.ayah) : -1;
  useEffect(() => {
    if (!audio.playing || pg == null || pg.offline || pg.pageNo == null) return;
    const inPage = activeGlobal >= (pg.ayahs[0]?.global ?? 0) && activeGlobal <= (pg.ayahs[pg.ayahs.length - 1]?.global ?? 0);
    if (!inPage && loadingPage.current == null) {
      setFollowingAudio(true);
      fetch(`https://api.alquran.cloud/v1/ayah/${activeGlobal}/quran-uthmani`)
        .then((r) => r.json())
        .then((dd) => {
          const p = dd?.data?.page;
          if (p && p !== pg.pageNo) load(p);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGlobal, audio.playing]);

  /* swipe paging */
  const go = useCallback(
    (dir: 1 | -1) => {
      if (!pg?.pageNo) return;
      const next = pg.pageNo + dir;
      if (next < 1 || next > 604) return;
      setFollowingAudio(false);
      slide.setValue(dir === 1 ? -40 : 40);
      Animated.timing(slide, { toValue: 0, duration: 240, easing: Easing.out(Easing.poly(4)), useNativeDriver: false }).start();
      load(next, true);
    },
    [pg, load, slide],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        /* CAPTURE phase — children (text/scroll) otherwise eat the gesture on
         * iOS Safari and the page stops being swippable (pass 23 fix) */
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dy) < 42,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dy) < 42,
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -40) go(1);
          else if (g.dx > 40) go(-1);
        },
      }),
    [go],
  );

  /* segments between real surah starts — header block + justified text each */
  const segments = useMemo<Segment[]>(() => {
    const segs: Segment[] = [];
    for (const a of pg?.ayahs ?? []) {
      if (a.isStart) segs.push({ start: a, ayahs: [a] });
      else if (segs.length) segs[segs.length - 1].ayahs.push(a);
      else segs.push({ ayahs: [a] });
    }
    return segs;
  }, [pg]);

  /* overflow → scroll INSIDE the page (no shrinking) */
  const onContentLayout = (h: number) => {
    const avail = boxH.current - 58; /* header strip + page-number vignette */
    if (h > avail + 4 && !scrollable) setScrollable(true);
    else if (h <= avail - 20 && scrollable) setScrollable(false);
  };

  const settingsSheet = (
    <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={() => setSettingsOpen(false)} />
        <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 34, gap: 16 }}>
          <T v="h3" style={{ fontWeight: '800' }}>Mushaf settings</T>

          <View>
            <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, marginBottom: 8 }}>PAGE THEME</T>
            <View style={{ flexDirection: 'row', gap: 9 }}>
              {THEMES.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    haptic.selection();
                    setThemeId(t.id);
                    savePrefs(t.id, fs);
                  }}
                  style={{ flex: 1, alignItems: 'center', gap: 5 }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: t.bg, borderWidth: skin.id === t.id ? 2.5 : 1, borderColor: skin.id === t.id ? '#1F8F5C' : t.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Amiri', fontSize: 15, color: t.text }}>ا</Text>
                  </View>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '700', color: skin.id === t.id ? '#1F8F5C' : d.faint }}>{t.label.toUpperCase()}</T>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6 }}>TEXT SIZE</T>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, borderRadius: 9, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Text style={{ fontFamily: 'Amiri-Bold', fontSize: 15, color: d.text }}>{fs.toFixed(0)}</Text>
                <T v="caption" style={{ fontSize: 9, color: d.faint, fontWeight: '700' }}>pt</T>
              </View>
            </View>
            <SizeBar value={fs} min={MIN_FS} max={MAX_FS} onValue={(v) => { setFs(v); savePrefs(themeId ?? (isDark ? 'night' : 'cream'), v); }} />
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 7, textAlign: 'center' }}>Drag to resize — long pages scroll inside the page</T>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={{ flex: 1 }}>
      <Animated.View {...pan.panHandlers} style={{ flex: 1, transform: [{ translateX: slide }] }}>
        <View
          onLayout={(e) => {
            boxH.current = e.nativeEvent.layout.height;
          }}
          style={{ flex: 1, borderRadius: 12, borderWidth: 2, borderColor: skin.border, backgroundColor: skin.bg, paddingHorizontal: 14, paddingTop: 4, overflow: 'hidden' }}
        >
          {/* settings gear — inside the page, top-left */}
          <Pressable
            onPress={() => {
              haptic.selection();
              setSettingsOpen(true);
            }}
            style={{ position: 'absolute', top: 7, left: 7, zIndex: 5, width: 30, height: 30, borderRadius: 10, borderWidth: 1, borderColor: skin.border, backgroundColor: `${skin.accent}14`, alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="sliders-h" size={11} color={skin.accent} />
          </Pressable>

          {/* thin meta strip: page · juz (tiny, keeps the top clean) */}
          <View style={{ alignItems: 'center', marginBottom: 2, marginLeft: 30, marginRight: 30 }}>
            <T v="caption" numberOfLines={1} style={{ color: `${skin.accent}CC`, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.6 }}>
              {followingAudio ? 'FOLLOWING RECITATION' : pg ? (pg.offline ? 'OFFLINE MUSHAF' : `PAGE ${pg.pageNo ?? '—'} · JUZ ${pg.pageNo ? juzOf(pg.pageNo) : '—'}`) : 'LOADING…'}
            </T>
          </View>

          {scrollable ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
              {renderContent()}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>{renderContent()}</View>
          )}

          {/* page number — bottom-centre vignette (content keeps clear of it) */}
          <View style={{ position: 'absolute', bottom: 2, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 16, height: 1, backgroundColor: `${skin.accent}66` }} />
              <View style={{ minWidth: 30, height: 19, borderRadius: 10, borderWidth: 1, borderColor: `${skin.accent}88`, backgroundColor: `${skin.accent}12`, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 }}>
                <Text style={{ fontFamily: 'Amiri-Bold', fontSize: 11, color: skin.accent }}>{pg?.pageNo != null ? arNum(pg.pageNo) : '—'}</Text>
              </View>
              <View style={{ width: 16, height: 1, backgroundColor: `${skin.accent}66` }} />
            </View>
          </View>

          {loading && !pg ? <T v="bodyS" style={{ color: skin.accent, textAlign: 'center', marginTop: 40 }}>Loading page…</T> : null}
          {!loading && !pg ? <T v="bodyS" style={{ color: skin.accent, textAlign: 'center', marginTop: 40 }}>Mushaf page unavailable — check your connection.</T> : null}
        </View>
      </Animated.View>

      {settingsSheet}
    </View>
  );

  function renderContent() {
    return (
      <View onLayout={(e) => onContentLayout(e.nativeEvent.layout.height)} style={{ flex: scrollable ? undefined : 1 }}>
        {segments.map((seg, si) => (
          <View key={seg.start?.key ?? `${pg?.pageNo}-${si}`} style={{ flex: 0 }}>
            {/* compact surah header — centred, raised, minimal space */}
            {seg.start && seg.start.surahNo !== 9 ? (
              <View style={{ alignItems: 'center', marginTop: si === 0 ? 2 : 10, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View style={{ width: 14, height: 1.5, backgroundColor: `${skin.accent}99` }} />
                  {/* surah name in a fresh ornamented pill (NEW border: double-line gold frame) */}
                  <View style={{ paddingVertical: 2, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: `${skin.accent}BB`, backgroundColor: `${skin.accent}0D` }}>
                    <View style={{ borderRadius: 9, borderWidth: 0.75, borderColor: `${skin.accent}55`, paddingVertical: 1, paddingHorizontal: 8 }}>
                      <Text style={{ fontFamily: 'Amiri-Bold', fontSize: Math.max(12, fs * 0.62), color: skin.accent, lineHeight: Math.max(18, fs * 0.62 * 1.5) }}>
                        {seg.start.surahNameAr ? (seg.start.surahNameAr.startsWith('سُورَةُ') || seg.start.surahNameAr.startsWith('سورة') ? seg.start.surahNameAr : `سُورَةُ ${seg.start.surahNameAr}`) : `سُورَةُ ${englishName}`}
                      </Text>
                    </View>
                  </View>
                  <View style={{ width: 14, height: 1.5, backgroundColor: `${skin.accent}99` }} />
                </View>
                {/* bold basmallah — ONLY at a true surah start (never 1: it IS ayah 1, never 9) */}
                {seg.start.surahNo !== 1 ? (
                  <Text style={{ fontFamily: 'Amiri-Bold', fontSize: Math.max(15, fs * 0.78), color: skin.basm, lineHeight: Math.max(24, fs * 0.78 * 1.7), marginTop: 2 }}>
                    {BASMALLAH}
                  </Text>
                ) : null}
              </View>
            ) : seg.start ? (
              /* surah 9 starts with no basmallah — just the name pill */
              <View style={{ alignItems: 'center', marginTop: si === 0 ? 2 : 10, marginBottom: 4 }}>
                <View style={{ paddingVertical: 2, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: `${skin.accent}BB`, backgroundColor: `${skin.accent}0D` }}>
                  <Text style={{ fontFamily: 'Amiri-Bold', fontSize: Math.max(12, fs * 0.62), color: skin.accent }}>{seg.start.surahNameAr ? (seg.start.surahNameAr.startsWith('سُورَةُ') || seg.start.surahNameAr.startsWith('سورة') ? seg.start.surahNameAr : `سُورَةُ ${seg.start.surahNameAr}`) : 'سُورَةُ التَّوْبَة'}</Text>
                </View>
              </View>
            ) : null}

            <Text style={{ fontFamily: 'Amiri', fontSize: fs, lineHeight: lh, color: skin.text, textAlign: 'justify', writingDirection: 'rtl', paddingBottom: 6 }}>
              {seg.ayahs.map((a) => {
                const active = a.global === activeGlobal && audio.surah != null;
                return (
                  <React.Fragment key={a.key}>
                    <Text style={active ? { backgroundColor: 'rgba(46,204,113,0.30)', color: skin.id === 'night' ? '#B9F6D3' : '#0E7A46' } : undefined}>{a.text} </Text>
                    <Text style={{ color: skin.accent, fontFamily: 'Amiri-Bold' }}>﴿{arNum(a.numberInSurah)}﴾ </Text>
                  </React.Fragment>
                );
              })}
            </Text>
          </View>
        ))}
      </View>
    );
  }
}

/** rough juz number from a Madani page (1..604). */
function juzOf(page: number): number {
  const bounds = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
  let j = 1;
  for (let i = 0; i < bounds.length; i++) if (page >= bounds[i]) j = i + 1;
  return j;
}

/* Continuous drag slider (0.5pt steps) — professional resize feel. */
function SizeBar({ value, min, max, onValue }: { value: number; min: number; max: number; onValue: (v: number) => void }) {
  const { theme } = useTheme();
  const d = theme.dash;
  const trackW = useRef(1);
  const [dragging, setDragging] = useState(false);
  const frac = (value - min) / (max - min);

  const posToSize = (x: number) => {
    const f = Math.max(0, Math.min(1, x / (trackW.current || 1)));
    return Math.round((min + f * (max - min)) * 2) / 2;
  };
  const latest = useRef(onValue);
  latest.current = onValue;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          setDragging(true);
          haptic.selection();
          latest.current(posToSize(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => latest.current(posToSize(e.nativeEvent.locationX)),
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View {...pan.panHandlers} onLayout={(e) => (trackW.current = e.nativeEvent.layout.width)} style={{ height: 30, justifyContent: 'center' }}>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: d.bgSoft, overflow: 'hidden' }}>
        <View style={{ width: `${frac * 100}%`, height: 5, borderRadius: 3, backgroundColor: 'rgba(46,204,113,0.75)' }} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: `${frac * 100}%`,
          marginLeft: -10,
          width: 20,
          height: 20,
          borderRadius: 11,
          backgroundColor: '#FFFFFF',
          borderWidth: 2.25,
          borderColor: dragging ? '#1F8F5C' : 'rgba(31,143,92,0.75)',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      />
      <Text style={{ position: 'absolute', left: 0, bottom: -14, fontFamily: 'Amiri', fontSize: 11, color: d.faint }}>ا</Text>
      <Text style={{ position: 'absolute', right: 0, bottom: -14, fontFamily: 'Amiri', fontSize: 16, color: d.faint }}>ا</Text>
    </View>
  );
}
