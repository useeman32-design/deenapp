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
 * Mushaf page (pass 20) — real uthmani mushaf feel:
 *  · BIG page container (chrome minimised), page number in a gold vignette
 *    INSIDE the page (bottom-centre, like a printed mushaf)
 *  · swipe left/right for next/prev page (+ tap zones)
 *  · settings (left gear): page theme (cream/white/sepaj/madhina/night) and
 *    text size — persisted
 *  · ayahs highlight LIVE while audio plays (green)
 *  · swiping to a page that starts a new surah switches the audio + title
 *    (calls onSurahChange so the reader header follows)
 *  · auto-fit: font steps down until the page fits (never clipped);
 *    offline → renders from OUR local dataset
 */

const BASMALLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export const arNum = (x: number | string) => String(x).replace(/\d/g, (d) => AR_DIGITS[+d]);

const SIZES = [24, 22, 20, 18.5, 17, 15.5, 14];
const THEMES = [
  { id: 'cream', label: 'Cream', bg: '#FFFCF2', text: '#12241A', border: 'rgba(184,134,11,0.55)', accent: '#8C6D1F' },
  { id: 'white', label: 'White', bg: '#FFFFFF', text: '#0E1F16', border: 'rgba(29,111,66,0.35)', accent: '#1D6F42' },
  { id: 'sepia', label: 'Sepia', bg: '#F3E7D0', text: '#3A2E1B', border: 'rgba(122,90,42,0.55)', accent: '#7A5A2A' },
  { id: 'madina', label: 'Madina', bg: '#E9F1EA', text: '#0F2417', border: 'rgba(29,111,66,0.5)', accent: '#1D6F42' },
  { id: 'night', label: 'Night', bg: '#0A130E', text: '#E9F3EC', border: 'rgba(212,175,55,0.5)', accent: '#E8C96A' },
] as const;

type PageAyah = { key: string; global: number; numberInSurah: number; text: string; surahNo: number; surahNameAr: string; isFirst: boolean };
type PageInfo = { pageNo: number | null; label: string; ayahs: PageAyah[]; offline: boolean };

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
  const { theme } = useTheme();
  const d = theme.dash;
  const audio = useQuranAudio();

  const [pg, setPg] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fitStep, setFitStep] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<string>('cream');
  const [sizeStep, setSizeStep] = useState(1);
  const [swipeHint, setSwipeHint] = useState(true);
  const boxH = useRef(0);
  const contentH = useRef(0);
  const triedFit = useRef(0);
  const slide = useRef(new Animated.Value(0)).current;

  /* persisted mushaf prefs */
  useEffect(() => {
    storage.getItem('dl.mushaf.prefs').then((r) => {
      try {
        const p = JSON.parse(r ?? '{}');
        if (p.themeId && THEMES.some((t) => t.id === p.themeId)) setThemeId(p.themeId);
        if (typeof p.sizeStep === 'number') setSizeStep(Math.max(0, Math.min(SIZES.length - 1, p.sizeStep)));
      } catch {}
    });
  }, []);
  const savePrefs = (t: string, s: number) => storage.setItem('dl.mushaf.prefs', JSON.stringify({ themeId: t, sizeStep: s })).catch(() => {});

  const skin = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const base = SIZES[Math.min(sizeStep + fitStep, SIZES.length - 1)];
  const fs = base;
  const lh = Math.round(fs * 1.92);

  const stripBasmallah = (text: string, surahNo: number, numberInSurah: number) =>
    numberInSurah === 1 && surahNo !== 1 && text.startsWith('بِسْمِ') ? text.slice(BASMALLAH.length).trim() : text;

  const pageFromApi = useCallback(async (p: number): Promise<PageInfo> => {
    const r = await fetch(`https://api.alquran.cloud/v1/page/${p}/quran-uthmani`);
    if (!r.ok) throw new Error('page api');
    const dd = await r.json();
    const list = (dd?.data?.ayahs ?? []) as Array<{ numberInSurah: number; number: number; text: string; surah?: { number: number; name: string } }>;
    const ayahs: PageAyah[] = list.map((a, i) => {
      const surahNo = a.surah?.number ?? 0;
      const prev = list[i - 1]?.surah?.number;
      return {
        key: `${a.number}`,
        global: a.number,
        numberInSurah: a.numberInSurah,
        text: stripBasmallah(a.text, surahNo, a.numberInSurah),
        surahNo,
        surahNameAr: a.surah?.name ?? '',
        isFirst: i === 0 || prev !== surahNo,
      };
    });
    return { pageNo: p, label: `${p} / 604`, ayahs, offline: false };
  }, []);

  const localFallback = useCallback(async (): Promise<PageInfo> => {
    const surah = local ?? (await loadSurah(n).catch(() => null));
    if (!surah) throw new Error('no local');
    let g = 0;
    for (let i = 1; i < n; i++) g += (QURAN[i - 1]?.ayahs ?? 0);
    const ayahs: PageAyah[] = surah.verses.map((v) => ({
      key: `${n}:${v.ayah}`,
      global: g + v.ayah,
      numberInSurah: v.ayah,
      text: v.ayah === 1 && n !== 1 && n !== 9 && v.arabic.startsWith('بِسْمِ') ? v.arabic.slice(BASMALLAH.length).trim() || v.arabic : v.arabic,
      surahNo: n,
      surahNameAr: '',
      isFirst: v.ayah === 1,
    }));
    return { pageNo: null, label: englishName, ayahs, offline: true };
  }, [englishName, local, n]);

  const load = useCallback(
    async (p: number, userNav = false) => {
      setLoading(true);
      setFitStep(0);
      setScrollable(false);
      triedFit.current = 0;
      try {
        const info = await pageFromApi(p);
        setPg(info);
        if (userNav) {
          haptic.selection();
          const first = info.ayahs[0];
          if (first) {
            onSurahChange?.(first.surahNo);
            if (audio.surah != null) audio.playSurah(first.surahNo, first.numberInSurah);
          }
        }
      } catch {
        try {
          setPg(await localFallback());
        } catch {
          setPg(null);
        }
      }
      setLoading(false);
    },
    [pageFromApi, localFallback, onSurahChange, audio],
  );

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

  /* fit-to-page */
  const tryFit = () => {
    if (!boxH.current || !contentH.current) return;
    if (contentH.current <= boxH.current - 8) return;
    if (fitStep + sizeStep < SIZES.length - 1 && triedFit.current < SIZES.length + 2) {
      triedFit.current += 1;
      setFitStep((f) => f + 1);
    } else {
      setScrollable(true);
    }
  };

  /* swipe paging */
  const go = useCallback(
    (dir: 1 | -1) => {
      if (!pg?.pageNo) return;
      const next = pg.pageNo + dir;
      if (next < 1 || next > 604) return;
      slide.setValue(dir === 1 ? -40 : 40);
      Animated.timing(slide, { toValue: 0, duration: 240, easing: Easing.out(Easing.poly(4)), useNativeDriver: false }).start();
      setSwipeHint(false);
      load(next, true);
    },
    [pg, load, slide],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 18 && Math.abs(g.dy) < 40,
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -40) go(1);
          else if (g.dx > 40) go(-1);
        },
      }),
    [go],
  );

  /* live highlight: which page ayah is being recited */
  const activeGlobal = audio.surah != null ? globalAyahOf(audio.surah, audio.ayah) : -1;

  /* settings sheet */
  const SettingsSheet = (
    <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={() => setSettingsOpen(false)} />
        <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 30, gap: 16 }}>
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
                    savePrefs(t.id, sizeStep);
                  }}
                  style={{ flex: 1, alignItems: 'center', gap: 5 }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: t.bg, borderWidth: themeId === t.id ? 2.5 : 1, borderColor: themeId === t.id ? '#1F8F5C' : t.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Amiri', fontSize: 15, color: t.text }}>ا</Text>
                  </View>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '700', color: themeId === t.id ? (d.emerald ?? theme.primary) : d.faint }}>{t.label.toUpperCase()}</T>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, marginBottom: 8 }}>TEXT SIZE</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SIZES.map((s, i) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    haptic.selection();
                    setSizeStep(i);
                    setFitStep(0);
                    setScrollable(false);
                    triedFit.current = 0;
                    savePrefs(themeId, i);
                  }}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: sizeStep === i ? (d.emerald ?? theme.primary) : d.cardBorder, backgroundColor: sizeStep === i ? 'rgba(46,204,113,0.12)' : 'transparent' }}
                >
                  <Text style={{ fontFamily: 'Amiri', fontSize: Math.min(s, 22), color: d.text }}>{i === 0 ? 'A' : i === SIZES.length - 1 ? 'ا' : 'ا'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={{ flex: 1, paddingTop: 2 }}>
      <Animated.View {...pan.panHandlers} style={{ flex: 1, transform: [{ translateX: slide }] }}>
        <View
          onLayout={(e) => {
            boxH.current = e.nativeEvent.layout.height;
            tryFit();
          }}
          style={{
            flex: 1,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: skin.border,
            backgroundColor: skin.bg,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 26,
            overflow: 'hidden',
          }}
        >
          {/* settings — left, inside the page */}
          <Pressable
            onPress={() => {
              haptic.selection();
              setSettingsOpen(true);
            }}
            style={{ position: 'absolute', top: 8, left: 8, zIndex: 5, width: 32, height: 32, borderRadius: 11, borderWidth: 1, borderColor: skin.border, backgroundColor: `${skin.accent}14`, alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="sliders-h" size={12} color={skin.accent} />
          </Pressable>

          {/* surah label — top centre */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 2, marginLeft: 34, marginRight: 34 }}>
            <T v="caption" numberOfLines={1} style={{ color: skin.accent, fontWeight: '800', fontSize: 9.5, letterSpacing: 0.6 }}>
              {pg ? (pg.offline ? `${pg.label.toUpperCase()} · OFFLINE MUSHAF` : `PAGE ${pg.pageNo ?? '—'} · JUZ ${pg.pageNo ? juzOf(pg.pageNo) : '—'}`) : 'LOADING…'}
            </T>
          </View>

          {scrollable ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {renderContent()}
            </ScrollView>
          ) : (
            renderContent()
          )}

          {/* page number — INSIDE the page, bottom-centre vignette like a printed mushaf */}
          <View style={{ position: 'absolute', bottom: 3, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 16, height: 1, backgroundColor: `${skin.accent}66` }} />
              <View style={{ minWidth: 30, height: 20, borderRadius: 10, borderWidth: 1, borderColor: `${skin.accent}88`, backgroundColor: `${skin.accent}12`, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 }}>
                <Text style={{ fontFamily: 'Amiri-Bold', fontSize: 11.5, color: skin.accent }}>{pg?.pageNo != null ? arNum(pg.pageNo) : '—'}</Text>
              </View>
              <View style={{ width: 16, height: 1, backgroundColor: `${skin.accent}66` }} />
            </View>
          </View>

          {loading && !pg ? <T v="bodyS" style={{ color: skin.accent, textAlign: 'center', marginTop: 40 }}>Loading page…</T> : null}
          {!loading && !pg ? <T v="bodyS" style={{ color: skin.accent, textAlign: 'center', marginTop: 40 }}>Mushaf page unavailable — check your connection.</T> : null}
        </View>
      </Animated.View>

      {/* nav row: prev / swipe hint / next */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 8 }}>
        <Pressable onPress={() => go(-1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, opacity: ((pg?.pageNo ?? 2) as number) > 1 ? 1 : 0.4 }}>
          <FontAwesome5 name="chevron-left" size={10} color={d.subtext} />
          <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 11 }}>Prev</T>
        </Pressable>
        <T v="caption" style={{ color: d.faint, fontSize: 10 }}>{swipeHint ? 'Swipe the page ⇄' : `${pg?.pageNo ?? '—'} / 604`}</T>
        <Pressable onPress={() => go(1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, opacity: (pg?.pageNo ?? 0) < 604 ? 1 : 0.4 }}>
          <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 11 }}>Next</T>
          <FontAwesome5 name="chevron-right" size={10} color={d.subtext} />
        </Pressable>
      </View>

      {SettingsSheet}
    </View>
  );

  function renderContent() {
    return (
      <Text
        onLayout={(e) => {
          contentH.current = e.nativeEvent.layout.height;
          tryFit();
        }}
        style={{ fontFamily: 'Amiri', fontSize: fs, lineHeight: lh, color: skin.text, textAlign: 'right', writingDirection: 'rtl', flex: scrollable ? undefined : 1 }}
      >
        {(pg?.ayahs ?? []).map((a) => {
          const active = a.global === activeGlobal && audio.surah != null;
          return (
            <React.Fragment key={a.key}>
              {a.isFirst ? (
                <Text>
                  {a.surahNameAr ? <Text style={{ fontFamily: 'Amiri-Bold', color: skin.accent, fontSize: fs + 1 }}>{'\n'}﴾ {a.surahNameAr} ﴿{'\n'}</Text> : <Text>{'\n'}</Text>}
                  {a.surahNo !== 1 && a.surahNo !== 9 ? <Text style={{ color: '#1F8F5C' }}>{BASMALLAH}{'\n\n'}</Text> : null}
                </Text>
              ) : null}
              <Text style={active ? { backgroundColor: 'rgba(46,204,113,0.28)', color: '#0E7A46' } : undefined}>{a.text} </Text>
              <Text style={{ color: skin.accent, fontFamily: 'Amiri-Bold' }}>﴿{arNum(a.numberInSurah)}﴾ </Text>
            </React.Fragment>
          );
        })}
      </Text>
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
