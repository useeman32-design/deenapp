import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { QURAN } from '@/data/quran';
import { useQuranAudio, globalAyahOf, surahOfGlobal } from '@/context/QuranAudioContext';
import { loadSurah, type SurahContent } from '@/lib/content';
import { bare as bareOf, speakWord, useReciteTracker, type ReciteItem } from '@/lib/reciteEngine';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [fs, setFs] = useState(DEFAULT_FS);
  const [followingAudio, setFollowingAudio] = useState(false);
  const [recitePage, setRecitePage] = useState(false);
  const [reciteBlind, setReciteBlind] = useState(false);

  /* inline page recitation (pass 27) — tracks the ayahs of THIS page */
  const reciteItems: ReciteItem[] = useMemo(
    () => (pg?.ayahs ?? []).map((a) => ({ surah: a.surahNo, ayah: a.numberInSurah, arabic: a.text, label: `${a.surahNo}:${a.numberInSurah}` })),
    [pg],
  );
  /* pass 32: CONTINUOUS page recitation — the reciter reads the WHOLE page
   * (or whole surah from its first page) as one stream; he may open with the
   * basmallah or not, mistakes light red, going back and re-saying fixes
   * them, and the current-ayah label rolls along until he finishes. */
  const tr = useReciteTracker(reciteItems, { continuous: true });
  const curItem = reciteItems[tr.curAyah >= 0 ? tr.curAyah : tr.idx];
  const curKey = curItem ? `${curItem.surah}:${curItem.ayah}` : '';
  const boxH = useRef(0);
  const slide = useRef(new Animated.Value(0)).current;
  const loadingPage = useRef<number | null>(null);
  const winW = Dimensions.get('window').width;

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

  /* strip the inline basmallah from ayah 1 (diacritic-insensitive — the API's
   * basmallah uses different harakat than our display constant) */
  const stripBasmallah = (text: string, surahNo: number, numberInSurah: number) => {
    if (numberInSurah !== 1 || surahNo === 1) return text;
    const bare = (t: string) => t.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');
    const bareText = bare(text);
    const bareBasm = bare(BASMALLAH);
    if (bareText.startsWith(bareBasm)) {
      /* find the true cut index in the ORIGINAL string (count stripped chars) */
      let kept = 0, bi = 0;
      for (let i = 0; i < text.length && bi < bareBasm.length; i++) {
        const ch = text[i];
        const isDia = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/.test(ch);
        if (!isDia) { if (bareBasm[bi] !== ch) break; bi++; }
        kept = i + 1;
      }
      return text.slice(kept).replace(/^[\s\u0640]+/, '');
    }
    return text;
  };

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

  /* swipe paging — the page now FOLLOWS the finger, then the outgoing page
   * slides off and the incoming page slides in (RTL: drag right = next). */
  const go = useCallback(
    (dir: 1 | -1) => {
      if (!pg?.pageNo) return;
      const next = pg.pageNo + dir;
      if (next < 1 || next > 604) { Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: false }).start(); return; }
      setFollowingAudio(false);
      const exit = dir === 1 ? winW : -winW;
      haptic.selection();
      /* slide the current page fully off in the drag direction, then bring the
       * next page in from the opposite edge once it's loaded */
      Animated.timing(slide, { toValue: exit, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => {
        slide.setValue(-exit);
        load(next, true).then(() => {
          Animated.timing(slide, { toValue: 0, duration: 230, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
        });
      });
    },
    [pg, load, slide, winW],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dy) < 42,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dy) < 42,
        onPanResponderMove: (_e, g) => { if (pg?.pageNo) slide.setValue(Math.max(-winW, Math.min(winW, g.dx))); },
        onPanResponderRelease: (_e, g) => {
          if (g.dx > 40) go(1);
          else if (g.dx < -40) go(-1);
          else Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: false }).start();
        },
        onPanResponderTerminate: () => Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: false }).start(),
      }),
    [go, pg, slide, winW],
  );

  /* pass 32: on the WEB react-native-web's PanResponder loses touches to the
   * vertical ScrollView — real DOM touch events never lie. Track a swipe
   * manually and turn ⬅/➡ into page turns. */
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeProps =
    Platform.OS === 'web'
      ? {
          onTouchStart: (e: any) => {
            const t0 = e.touches?.[0] ?? e.changedTouches?.[0];
            touch.current = t0 ? { x: t0.clientX, y: t0.clientY, t: Date.now() } : null;
          },
          onTouchMove: (e: any) => {
            const st = touch.current;
            const t1 = e.touches?.[0];
            if (!st || !t1 || !pg?.pageNo) return;
            const dx = t1.clientX - st.x;
            if (Math.abs(dx) > Math.abs(t1.clientY - st.y)) slide.setValue(Math.max(-winW, Math.min(winW, dx)));
          },
          onTouchEnd: (e: any) => {
            const st = touch.current;
            touch.current = null;
            const t1 = e.changedTouches?.[0];
            if (!st || !t1) return;
            const dx = t1.clientX - st.x;
            const dy = t1.clientY - st.y;
            const dt = Date.now() - st.t;
            if (dt > 800) { Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: false }).start(); return; }
            if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.25) go(dx > 0 ? 1 : -1);
            else Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: false }).start();
          },
        }
      : pan.panHandlers;

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

  /* pass 25: content ALWAYS scrolls inside the page — the old measured
   * flex:0 segment hack made multi-surah pages (602-604) render all segments
   * stacked on top of each other (zero-height children overlapping). */

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
      <Animated.View {...swipeProps} style={{ flex: 1, transform: [{ translateX: slide }] }}>
        <View
          onLayout={(e) => {
            boxH.current = e.nativeEvent.layout.height;
          }}
          style={{ flex: 1, backgroundColor: skin.bg, paddingHorizontal: 14, paddingTop: 4, overflow: 'hidden' }}
        >
          {/* recite-this-page mic — top-right; hidden while the inline banner is open
              (pass 27: its oversized hit area covered the banner's close button) */}
          {!recitePage ? (
            <Pressable
              onPress={() => { haptic.light(); setRecitePage(true); }}
              accessibilityLabel="recite this page"
              style={{ position: 'absolute', top: 7, right: 7, zIndex: 5, flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(44,110,143,0.55)', backgroundColor: 'rgba(44,110,143,0.12)', paddingHorizontal: 8 }}
            >
              <FontAwesome5 name="microphone-alt" size={10} color="#2C6E8F" />
              <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 8.5, color: '#2C6E8F', letterSpacing: 0.4 }}>RECITE</Text>
            </Pressable>
          ) : null}

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

          {/* inline recitation controls (pass 27) */}
          {recitePage ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 2, marginBottom: 6, paddingLeft: 40 }}>
              <Pressable
                onPress={() => { haptic.light(); if (tr.listening) tr.stop(); else tr.start(); }}
                accessibilityLabel={tr.listening ? 'page recite mic' : 'page recite start'}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, borderRadius: 10, paddingHorizontal: 10, backgroundColor: tr.listening ? 'rgba(220,80,80,0.14)' : 'rgba(31,143,92,0.14)', borderWidth: 1, borderColor: tr.listening ? 'rgba(220,80,80,0.5)' : 'rgba(31,143,92,0.5)' }}
              >
                <FontAwesome5 name={tr.listening ? 'stop' : 'microphone-alt'} size={9} color={tr.listening ? '#DC5050' : '#1F8F5C'} />
                <T v="caption" style={{ fontFamily: 'Poppins-Bold', fontSize: 8.5, color: tr.listening ? '#DC5050' : '#1F8F5C' }}>{tr.listening ? 'STOP' : 'RECITE'}</T>
              </Pressable>
              <Pressable
                onPress={() => { haptic.selection(); setReciteBlind((b) => !b); }}
                accessibilityLabel="page blind mode"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, borderRadius: 10, paddingHorizontal: 10, backgroundColor: reciteBlind ? 'rgba(44,110,143,0.13)' : `${skin.accent}0D`, borderWidth: 1, borderColor: reciteBlind ? 'rgba(44,110,143,0.5)' : skin.border }}
              >
                <FontAwesome5 name={reciteBlind ? 'eye-slash' : 'eye'} size={9} color={reciteBlind ? '#2C6E8F' : skin.accent} />
                <T v="caption" style={{ fontFamily: 'Poppins-Bold', fontSize: 8.5, color: reciteBlind ? '#2C6E8F' : skin.accent }}>BLIND</T>
              </Pressable>
              <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: `${skin.accent}22`, overflow: 'hidden' }}>
                <View style={{ width: `${tr.flatWords.length ? (100 * tr.reached) / tr.flatWords.length : 0}%`, height: 4, backgroundColor: tr.wrongCount > 0 ? '#E05252' : '#1F8F5C' }} />
              </View>
              <Pressable
                onPress={() => { haptic.selection(); tr.reset(); }}
                accessibilityLabel="reset page recite"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, borderRadius: 10, paddingHorizontal: 9, backgroundColor: `${skin.accent}12`, borderWidth: 1, borderColor: skin.border }}
              >
                <FontAwesome5 name="undo" size={9} color={skin.accent} />
                <T v="caption" style={{ fontFamily: 'Poppins-Bold', fontSize: 8.5, color: skin.accent }}>RESET</T>
              </Pressable>
              <T v="caption" style={{ fontFamily: 'Poppins-Bold', fontSize: 8.5, color: skin.accent }}>{(tr.curAyah >= 0 ? tr.curAyah : 0) + 1}/{reciteItems.length}</T>
              {tr.score ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, height: 24, borderRadius: 8, backgroundColor: tr.score.wrong === 0 ? 'rgba(212,175,55,0.15)' : 'rgba(220,80,80,0.12)', borderWidth: 1, borderColor: tr.score.wrong === 0 ? 'rgba(212,175,55,0.5)' : 'rgba(220,80,80,0.4)' }}>
                  <FontAwesome5 name={tr.score.wrong === 0 ? 'check' : 'exclamation'} size={8} color={tr.score.wrong === 0 ? '#B8870B' : '#DC5050'} />
                  <T v="caption" style={{ fontFamily: 'Poppins-Bold', fontSize: 8, color: tr.score.wrong === 0 ? '#B8870B' : '#DC5050' }}>{tr.score.wrong === 0 ? 'PERFECT' : `${tr.score.wrong} WRONG`}</T>
                </View>
              ) : null}
              <Pressable onPress={() => { haptic.selection(); tr.stop(); setRecitePage(false); }} accessibilityLabel="close page recite" style={{ width: 34, height: 32, borderRadius: 10, backgroundColor: `${skin.accent}12`, borderWidth: 1, borderColor: skin.border, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={10} color={skin.accent} />
              </Pressable>
            </View>
          ) : null}

          {/* live "what we heard" strip — compare it with the page as you
           * recite; red when the mic errors out (pass 32) */}
          {recitePage ? (
            <View style={{ marginHorizontal: 44, marginBottom: 4, minHeight: 16, alignItems: 'center' }} pointerEvents="none">
              {tr.error ? (
                <T v="caption" numberOfLines={1} style={{ fontSize: 8.5, fontWeight: '700', color: '#DC5050' }}>{tr.error}</T>
              ) : tr.live ? (
                <T v="arabic" numberOfLines={1} style={{ fontSize: 12, color: tr.wrongCount > 0 ? '#C0392B' : `${skin.accent}CC` }}>…{tr.live.slice(-70)}</T>
              ) : (
                <T v="caption" numberOfLines={1} style={{ fontSize: 8.5, color: `${skin.accent}AA` }}>{reciteItems.length} ayahs on this page — recite straight through; go back any time to fix a word</T>
              )}
            </View>
          ) : null}

          {/* thin meta strip: page · juz (tiny, keeps the top clean) */}
          <View style={{ alignItems: 'center', marginBottom: 2, marginLeft: 30, marginRight: 30 }}>
            <T v="caption" numberOfLines={1} style={{ color: `${skin.accent}CC`, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.6 }}>
              {followingAudio ? 'FOLLOWING RECITATION' : pg ? (pg.offline ? 'OFFLINE MUSHAF' : `PAGE ${pg.pageNo ?? '—'} · JUZ ${pg.pageNo ? juzOf(pg.pageNo) : '—'}`) : 'LOADING…'}
            </T>
          </View>

          <ScrollView accessibilityLabel="mushaf page content" showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 34, paddingTop: 2 }}>
            {renderContent()}
          </ScrollView>

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
      <View>
        {segments.map((seg, si) => (
          <View key={seg.start?.key ?? `${pg?.pageNo}-${si}`} style={{ marginTop: si === 0 ? 0 : 14 }}>
            {/* pass 32 surah header — the name sits in an ORNATE frame (outer
             * plate + hairline inner + corner diamonds) and the basmallah is
             * larger, calligraphic (Aref Ruqaa) with real breathing room */}
            {seg.start && seg.start.surahNo !== 9 ? (
              <View style={{ alignItems: 'center', marginTop: si === 0 ? 4 : 16, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 3.5, height: 3.5, transform: [{ rotate: '45deg' }], backgroundColor: `${skin.accent}CC` }} />
                    <View style={{ width: 22, height: 1.25, backgroundColor: `${skin.accent}99` }} />
                  </View>
                  <View style={{ borderRadius: 5, borderWidth: 1.25, borderColor: `${skin.accent}CC`, backgroundColor: `${skin.accent}0F`, padding: 2.5 }}>
                    <View style={{ borderRadius: 3.5, borderWidth: 0.6, borderColor: `${skin.accent}59`, paddingVertical: 2.5, paddingHorizontal: 14, alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Amiri-Bold', fontSize: Math.max(13, fs * 0.7), color: recitePage && reciteBlind ? 'transparent' : skin.accent, lineHeight: Math.max(20, fs * 0.7 * 1.5) }}>
                        {seg.start.surahNameAr ? (seg.start.surahNameAr.startsWith('سُورَةُ') || seg.start.surahNameAr.startsWith('سورة') ? seg.start.surahNameAr : `سُورَةُ ${seg.start.surahNameAr}`) : `سُورَةُ ${englishName}`}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 22, height: 1.25, backgroundColor: `${skin.accent}99` }} />
                    <View style={{ width: 3.5, height: 3.5, transform: [{ rotate: '45deg' }], backgroundColor: `${skin.accent}CC` }} />
                  </View>
                </View>
                {/* calligraphic basmallah — ONLY at a true surah start (never 1: it IS ayah 1, never 9) */}
                {seg.start.surahNo !== 1 ? (
                  <Text style={{ fontFamily: 'ArefRuqaa-Bold', fontSize: Math.max(18, fs * 1.02), color: recitePage && reciteBlind ? 'transparent' : skin.basm, lineHeight: Math.max(30, fs * 1.02 * 1.55), marginTop: 9 }}>
                    {BASMALLAH}
                  </Text>
                ) : null}
              </View>
            ) : seg.start ? (
              /* surah 9 starts with no basmallah — just the name pill */
              <View style={{ alignItems: 'center', marginTop: si === 0 ? 4 : 16, marginBottom: 14 }}>
                <View style={{ borderRadius: 5, borderWidth: 1.25, borderColor: `${skin.accent}CC`, backgroundColor: `${skin.accent}0F`, padding: 2.5 }}>
                  <View style={{ borderRadius: 3.5, borderWidth: 0.6, borderColor: `${skin.accent}59`, paddingVertical: 2.5, paddingHorizontal: 14, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Amiri-Bold', fontSize: Math.max(13, fs * 0.7), color: recitePage && reciteBlind ? 'transparent' : skin.accent }}>{seg.start.surahNameAr ? (seg.start.surahNameAr.startsWith('سُورَةُ') || seg.start.surahNameAr.startsWith('سورة') ? seg.start.surahNameAr : `سُورَةُ ${seg.start.surahNameAr}`) : 'سُورَةُ التَّوْبَة'}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Text style={{ fontFamily: 'Amiri', fontSize: fs, lineHeight: lh, color: skin.text, textAlign: 'justify', writingDirection: 'rtl', paddingBottom: 6 }}>
              {seg.ayahs.map((a) => {
                const active = a.global === activeGlobal && audio.surah != null;
                if (!recitePage) {
                  /* normal mode — byte-identical to the classic rendering */
                  return (
                    <React.Fragment key={a.key}>
                      <Text style={active ? { backgroundColor: 'rgba(46,204,113,0.30)', color: skin.id === 'night' ? '#B9F6D3' : '#0E7A46' } : undefined}>{a.text} </Text>
                      <Text style={{ color: skin.accent, fontFamily: 'Amiri-Bold' }}>﴿{arNum(a.numberInSurah)}﴾ </Text>
                    </React.Fragment>
                  );
                }
                /* recite mode — the SAME inline flow, one colour span per word:
                 * layout never re-wraps; blind makes unrecited words transparent
                 * (they keep their exact width, so ayah numbers stay in place) */
                const isCur = `${a.surahNo}:${a.numberInSurah}` === curKey;
                const aIdx = reciteItems.findIndex((it) => `${it.surah}:${it.ayah}` === `${a.surahNo}:${a.numberInSurah}`);
                const aySt = tr.ayahStates && aIdx >= 0 ? tr.ayahStates[aIdx] : null;
                /* same token filter as itemWords — a diacritic-only remnant span
                 * would shift every word colour by one */
                const toks = a.text.split(/\s+/).filter((w) => bareOf(w).length > 0);
                const ayReached = aySt ? aySt.filter((x) => x === 'ok' || x === 'wrong').length : 0;
                const FAINT = `${skin.accent}99`;
                return (
                  <React.Fragment key={a.key}>
                    {toks.map((w, wi) => {
                      let color = FAINT;
                      let tap = false;
                      const st = aySt ? (aySt[wi] ?? 'hidden') : 'hidden';
                      if (st === 'ok') { color = skin.text; tap = true; }
                      else if (st === 'wrong') { color = '#E05252'; tap = true; }
                      else if (reciteBlind) { color = 'transparent'; }
                      else if (isCur && aySt && wi === ayReached) { color = '#C9A227'; } /* next-word cursor */
                      return (
                        <Text
                          key={wi}
                          onPress={tap ? () => { haptic.selection(); speakWord(a.surahNo, a.numberInSurah, wi, w, () => audio.playAyah(a.surahNo, a.numberInSurah)); } : undefined}
                          style={{ color }}
                        >{w} </Text>
                      );
                    })}
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
