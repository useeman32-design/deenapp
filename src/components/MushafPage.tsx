import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { loadSurah, type SurahContent } from '@/lib/content';

/**
 * Mushaf page (pass 19) — TRUE 604-page uthmani layout from the page API,
 * rendered so the page ALWAYS fits the screen:
 *   · nested styled spans: gold surah header, green basmallah line,
 *     flowing ayah text with gold Arabic-Indic markers ﴿٥﴾
 *   · the API prefixes basmallah onto ayah 1 — we strip it and render our
 *     own styled line (exactly one; none for At-Taubah; Fatiha keeps it as
 *     its real first ayah)
 *   · auto-fit: font steps down until the page fits; if even 13pt doesn't,
 *     the page becomes scrollable (never clipped)
 *   · OFFLINE → falls back to OUR local dataset (whole current surah in
 *     mushaf style), so the mushaf never dies
 */

const BASMALLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export const arNum = (x: number | string) => String(x).replace(/\d/g, (d) => AR_DIGITS[+d]);

const SIZES = [22, 20.5, 19, 17.5, 16, 14.5, 13];

type PageAyah = {
  key: string;
  numberInSurah: number;
  text: string;
  surahNo: number;
  surahNameAr: string;
  isFirst: boolean;
};

type PageInfo = { pageNo: number | null; label: string; ayahs: PageAyah[]; offline: boolean };

export function MushafPage({
  n,
  englishName,
  local,
  startAyah,
}: {
  n: number;
  englishName: string;
  local: SurahContent | null;
  startAyah: number;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const gold = isDark ? '#E8C96A' : '#8C6D1F';
  const green = isDark ? '#4AE38F' : '#1D6F42';

  const [pg, setPg] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fitStep, setFitStep] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const boxH = useRef(0);
  const contentH = useRef(0);
  const triedFit = useRef(0);

  const fs = SIZES[Math.min(fitStep, SIZES.length - 1)];
  const lh = Math.round(fs * 1.95);

  const stripBasmallah = (text: string, surahNo: number, numberInSurah: number) =>
    numberInSurah === 1 && surahNo !== 1 && text.startsWith('بِسْمِ') ? text.slice(BASMALLAH.length).trim() : text;

  const pageFromApi = useCallback(async (p: number): Promise<PageInfo> => {
    const r = await fetch(`https://api.alquran.cloud/v1/page/${p}/quran-uthmani`);
    if (!r.ok) throw new Error('page api');
    const dd = await r.json();
    const list = (dd?.data?.ayahs ?? []) as Array<{
      numberInSurah: number;
      number: number;
      text: string;
      surah?: { number: number; name: string };
    }>;
    const ayahs: PageAyah[] = list.map((a, i) => {
      const surahNo = a.surah?.number ?? 0;
      const prev = list[i - 1]?.surah?.number;
      return {
        key: `${a.number}`,
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
    const ayahs: PageAyah[] = surah.verses.map((v) => ({
      key: `${n}:${v.ayah}`,
      numberInSurah: v.ayah,
      text: n === 1 || n === 9 || v.ayah !== 1 ? v.arabic : v.arabic.startsWith('بِسْمِ') ? v.arabic.slice(v.arabic.indexOf(BASMALLAH) === 0 ? BASMALLAH.length : 0).trim() || v.arabic : v.arabic,
      surahNo: n,
      surahNameAr: '',
      isFirst: v.ayah === 1,
    }));
    return { pageNo: null, label: englishName, ayahs, offline: true };
  }, [englishName, local, n]);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setFitStep(0);
      setScrollable(false);
      triedFit.current = 0;
      try {
        setPg(await pageFromApi(p));
      } catch {
        try {
          setPg(await localFallback());
        } catch {
          setPg(null);
        }
      }
      setLoading(false);
    },
    [pageFromApi, localFallback],
  );

  /* initial: find the madani page for n:startAyah, fall back to local */
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

  /* fit-to-page: shrink font until the content fits the box */
  const tryFit = () => {
    if (!boxH.current || !contentH.current) return;
    if (contentH.current <= boxH.current - 6) return;
    if (fitStep < SIZES.length - 1 && triedFit.current < SIZES.length + 2) {
      triedFit.current += 1;
      setFitStep((f) => f + 1);
    } else {
      setScrollable(true);
    }
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.5)', flex: 1 }} />
      <T v="caption" style={{ color: gold, fontWeight: '800', fontSize: 10, letterSpacing: 1, marginHorizontal: 10 }}>
        {pg ? (pg.offline ? `${pg.label.toUpperCase()} · OFFLINE` : pg.label) : loading ? 'LOADING…' : 'OFFLINE'}
      </T>
      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.5)', flex: 1 }} />
    </View>
  );

  const content = (
    <Text
      onLayout={(e) => {
        contentH.current = e.nativeEvent.layout.height;
        tryFit();
      }}
      style={{
        fontFamily: 'Amiri',
        fontSize: fs,
        lineHeight: lh,
        color: d.text,
        textAlign: 'right',
        writingDirection: 'rtl',
        flex: scrollable ? undefined : 1,
      }}
    >
      {(pg?.ayahs ?? []).map((a) => (
        <React.Fragment key={a.key}>
          {a.isFirst ? (
            <Text>
              {a.surahNameAr ? <Text style={{ fontFamily: 'Amiri-Bold', color: gold, fontSize: fs + 1 }}>{'\n'}﴾ {a.surahNameAr} ﴿{'\n'}</Text> : <Text>{'\n'}</Text>}
              {a.surahNo !== 1 && a.surahNo !== 9 ? <Text style={{ color: green }}>{BASMALLAH}{'\n\n'}</Text> : null}
            </Text>
          ) : null}
          <Text>{a.text} </Text>
          <Text style={{ color: gold, fontFamily: 'Amiri-Bold' }}>﴿{arNum(a.numberInSurah)}﴾ </Text>
        </React.Fragment>
      ))}
    </Text>
  );

  return (
    <View style={{ flex: 1, padding: 10, paddingBottom: 90 }}>
      <View
        onLayout={(e) => {
          boxH.current = e.nativeEvent.layout.height;
          tryFit();
        }}
        style={{
          flex: 1,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: isDark ? 'rgba(212,175,55,0.55)' : 'rgba(184,134,11,0.55)',
          backgroundColor: isDark ? '#0A130E' : '#FFFCF2',
          padding: 14,
          overflow: 'hidden',
        }}
      >
        {header}
        {scrollable ? <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>{content}</ScrollView> : content}
        {loading && !pg ? <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 40 }}>Loading page…</T> : null}
        {!loading && !pg ? (
          <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 40 }}>
            Mushaf page unavailable — check your connection.
          </T>
        ) : null}
      </View>

      {/* page nav */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10 }}>
        <Pressable
          onPress={() => {
            if (pg?.pageNo && pg.pageNo > 1) {
              haptic.selection();
              load(pg.pageNo - 1);
            }
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, opacity: pg?.pageNo && pg.pageNo > 1 ? 1 : 0.4 }}
        >
          <FontAwesome5 name="chevron-left" size={10} color={d.subtext} />
          <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 11 }}>
            Prev
          </T>
        </Pressable>
        <T v="caption" style={{ color: d.faint, fontSize: 11, fontWeight: '700' }}>
          {pg?.pageNo ?? '—'} / 604
        </T>
        <Pressable
          onPress={() => {
            if (pg?.pageNo && pg.pageNo < 604) {
              haptic.selection();
              load(pg.pageNo + 1);
            }
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, opacity: pg?.pageNo && pg.pageNo < 604 ? 1 : 0.4 }}
        >
          <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 11 }}>
            Next
          </T>
          <FontAwesome5 name="chevron-right" size={10} color={d.subtext} />
        </Pressable>
      </View>
    </View>
  );
}
