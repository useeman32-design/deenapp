import { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { create as createQR } from 'qrcode';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { saveSvgRefAsJpg, shareSvgRef, svgWebDownload, type SvgRefHandle } from '@/lib/svgExport';
import { stopBubble } from '@/lib/press';
import { CrescentLoader } from '@/components/CrescentLoader';

/**
 * Mirath — Islamic inheritance calculator (pass 29).
 * Implements the classical order for the common heir set:
 *   1. deduct funeral costs, debts and bequests (max ⅓)
 *   2. fixed shares (fara'id) — spouse, father, mother, daughters, sisters
 *   3. residue (`r`) to sons : daughters 2 : 1 (or brothers : sisters when
 *      there are no children and no father)
 *   4. remainder returns to the sharers (radd)
 * A scholar should always review real estates — this is a study aid.
 */

type HeirKey = 'husband' | 'wife' | 'son' | 'daughter' | 'father' | 'mother' | 'brother' | 'sister';

const HEIRS: Array<{ key: HeirKey; label: string; icon: string }> = [
  { key: 'husband', label: 'Husband', icon: 'user-tie' },
  { key: 'wife', label: 'Wife', icon: 'user-alt' },
  { key: 'son', label: 'Sons', icon: 'male' },
  { key: 'daughter', label: 'Daughters', icon: 'female' },
  { key: 'father', label: 'Father', icon: 'user-friends' },
  { key: 'mother', label: 'Mother', icon: 'user-friends' },
  { key: 'brother', label: 'Brothers', icon: 'users' },
  { key: 'sister', label: 'Sisters', icon: 'users' },
];

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function Mirath() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  
  /* pass 40 — fields start EMPTY (they were pre-filled before) */
  const [estate, setEstate] = useState('');
  const [debts, setDebts] = useState('');
  const [bequestPct, setBequestPct] = useState('');
  const [on, setOn] = useState<Record<HeirKey, boolean>>({
    husband: false, wife: false, son: false, daughter: false,
    father: false, mother: false, brother: false, sister: false,
  });
  const [counts, setCounts] = useState<Record<HeirKey, number>>({
    husband: 1, wife: 1, son: 2, daughter: 2, father: 1, mother: 1, brother: 1, sister: 1,
  });

  const result = useMemo(() => compute(+estate || 0, +debts || 0, Math.min(33, +bequestPct || 0), on, counts), [estate, debts, bequestPct, on, counts]);

  /* pass 40 — Quranic-basis modal + image report */
  const [verseOpen, setVerseOpen] = useState(false);
  const [reportOn, setReportOn] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportToast, setReportToast] = useState<string | null>(null);
  const reportRef = useRef<SvgRefHandle>(null);

  /* pass 40 — block impossible mixes AT SELECTION TIME:
   * husband ↔ wife are mutually exclusive; a son (male child) excludes
   * siblings; the father excludes siblings too (al-hajb). */
  const blocked = (key: HeirKey): string | null => {
    if (key === 'wife' && on.husband) return 'Remove the husband first — one spouse';
    if (key === 'husband' && on.wife) return 'Remove the wife first — one spouse';
    if ((key === 'brother' || key === 'sister') && on.son) return 'A son excludes siblings (al-hajb)';
    if ((key === 'brother' || key === 'sister') && on.father) return 'The father excludes siblings (al-hajb)';
    return null;
  };
  const toggleHeir = (key: HeirKey) => {
    if (blocked(key)) { haptic.medium(); return; }
    haptic.selection();
    setOn((o) => ({ ...o, [key]: !o[key] }));
  };

  const runReport = async (mode: 'save' | 'share') => {
    if (reportBusy || !result.rows.length) return;
    haptic.medium();
    setReportBusy(true);
    setReportOn(true);
    await new Promise((r) => setTimeout(r, 500));
    const name = 'deenlink-mirath-report';
    try {
      if (mode === 'share') {
        await shareSvgRef(reportRef, name, 'DeenLink — Islamic inheritance report');
        setReportToast('Opening share…');
      } else if (Platform.OS === 'web') {
        const ok = await svgWebDownload(reportRef, name, 'dl-mirath-report', 1080);
        setReportToast(ok ? 'Report image downloaded ✓' : 'Could not save — try Share');
      } else {
        const ok = await saveSvgRefAsJpg(reportRef, name);
        setReportToast(ok ? 'Saved to your gallery ✓' : 'Allow photo permission to save');
      }
    } catch {
      setReportToast('Could not export — try again');
    } finally {
      setReportBusy(false);
      setReportOn(false);
    }
  };

  const card = { backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 16 } as const;
  const input = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.04)',
    borderWidth: 1,
    borderColor: d.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: d.text,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title="Mirath — Inheritance" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* hero */}
        <View style={{ borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.05)', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(212,175,55,0.14)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="balance-scale" size={16} color="#E8C96A" />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h3" style={{ fontWeight: '800', fontSize: 14.5, color: d.text }}>Fara{"'"}id — the Islamic division</T>
            <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2, lineHeight: 14 }}>Enter the estate and the heirs — the shares follow the classical order: funeral costs &rarr; debts &rarr; bequest (&le;⅓) &rarr; fixed shares &rarr; residue 2:1.</T>
          </View>
        </View>

        {/* estate inputs */}
        <View style={{ ...card, padding: 14 }}>
          <T v="h3" style={{ fontWeight: '800', fontSize: 14, marginBottom: 10 }}>The estate</T>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 4 }}>Total estate left (money + assets, any currency)</T>
          <TextInput
            style={{ ...(input as object), width: '100%' } as never}
            keyboardType="numeric"
            value={estate}
            onChangeText={setEstate}
            placeholder="e.g. 1000000"
            placeholderTextColor={d.faint}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 4 }}>Funeral & debts</T>
              <TextInput
                style={{ ...(input as object), width: '100%' } as never}
                keyboardType="numeric"
                value={debts}
                onChangeText={setDebts}
                placeholder="0"
                placeholderTextColor={d.faint}
              />
            </View>
            <View style={{ flex: 1 }}>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 4 }}>Bequest (max ⅓ = 33%)</T>
              <TextInput
                style={{ ...(input as object), width: '100%' } as never}
                keyboardType="numeric"
                value={bequestPct}
                onChangeText={setBequestPct}
                placeholder="0"
                placeholderTextColor={d.faint}
              />
            </View>
          </View>
        </View>

        {/* heirs */}
        <View style={{ ...card, padding: 14, marginTop: 12 }}>
          <T v="h3" style={{ fontWeight: '800', fontSize: 14 }}>Who is left behind?</T>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 3, marginBottom: 12 }}>Tap to include — the count steps for multiple sons, daughters, brothers or sisters.</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {HEIRS.map((h) => {
              const active = on[h.key];
              const many = h.key === 'son' || h.key === 'daughter' || h.key === 'brother' || h.key === 'sister';
              const why = blocked(h.key);
              return (
                <View key={h.key} style={{ width: '48%', flexGrow: 1, borderRadius: 15, borderWidth: 1.4, borderColor: why ? 'rgba(255,123,123,0.35)' : active ? (isDark ? 'rgba(74,227,143,0.55)' : 'rgba(29,111,66,0.45)') : d.cardBorder, backgroundColor: active ? (isDark ? 'rgba(46,204,113,0.09)' : 'rgba(29,111,66,0.05)') : 'transparent', padding: 11, gap: 8, opacity: why ? 0.55 : 1 }}>
                  <Pressable accessibilityLabel={`heir ${h.label}`} disabled={!!why} onPress={() => toggleHeir(h.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: active ? (isDark ? 'rgba(74,227,143,0.18)' : 'rgba(29,111,66,0.1)') : isDark ? 'rgba(242,247,243,0.06)' : 'rgba(20,36,28,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: active ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)') : d.cardBorder }}>
                      <FontAwesome5 name={h.icon as never} size={12} color={active ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: active ? d.text : d.subtext }}>{h.label}</T>
                      <T v="caption" style={{ fontSize: 8.5, fontWeight: '700', letterSpacing: 0.4, color: why ? 'rgba(255,123,123,0.8)' : active ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint, marginTop: 1 }}>{why ? why.toUpperCase() : active ? 'INCLUDED' : 'TAP TO ADD'}</T>
                    </View>
                    <View style={{ width: 17, height: 17, borderRadius: 9, borderWidth: 1.6, borderColor: active ? (isDark ? '#4AE38F' : '#1D6F42') : d.cardBorder, backgroundColor: active ? (isDark ? '#4AE38F' : '#1D6F42') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {active ? <FontAwesome5 name="check" size={8} color="#fff" /> : null}
                    </View>
                  </Pressable>
                  {active && many ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.04)', paddingHorizontal: 6, paddingVertical: 4 }}>
                      <Pressable onPress={() => { haptic.selection(); setCounts((c) => ({ ...c, [h.key]: Math.max(1, c[h.key] - 1) })); }} style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: 'rgba(140,150,145,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name="minus" size={9} color={d.subtext} />
                      </Pressable>
                      <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: d.text }}>{counts[h.key]} {counts[h.key] > 1 ? 'people' : 'person'}</T>
                      <Pressable onPress={() => { haptic.selection(); setCounts((c) => ({ ...c, [h.key]: Math.min(12, c[h.key] + 1) })); }} style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: isDark ? 'rgba(74,227,143,0.16)' : 'rgba(29,111,66,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name="plus" size={9} color={isDark ? '#4AE38F' : '#1D6F42'} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* results */}
        <View style={{ ...card, padding: 14, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <T v="h3" style={{ fontWeight: '800', fontSize: 14 }}>Division</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>Net estate: {fmt(result.net)}</T>
          </View>
          {result.rows.length === 0 ? (
            <T v="caption" style={{ fontSize: 11.5, color: d.faint }}>Select at least one heir to see the shares.</T>
          ) : (
            <>
              {result.rows.map((r, i) => {
                const pct = result.net > 0 ? (r.amount / result.net) * 100 : 0;
                return (
                  <View key={i} style={{ marginBottom: 11 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name={r.icon as never} size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>{r.label}</T>
                        <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{r.note} · {r.frac}</T>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <T v="bodyS" style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#4AE38F' : '#1D6F42' }}>{fmt(r.amount)}</T>
                        <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: d.subtext }}>{pct.toFixed(1)}%</T>
                      </View>
                    </View>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(20,36,28,0.06)', marginTop: 7, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.min(100, pct)}%`, height: 5, borderRadius: 3, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
                    </View>
                  </View>
                );
              })}
              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: d.cardBorder, paddingTop: 9 }}>
                <T v="caption" style={{ flex: 1, fontSize: 10.5, fontWeight: '800', color: d.faint }}>DISTRIBUTED</T>
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '900', color: d.text }}>{fmt(result.rows.reduce((a, r) => a + r.amount, 0))} of {fmt(result.net)}</T>
              </View>
              {/* pass 40 — report as image + the Quranic basis */}
              <View style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}>
                <Pressable accessibilityLabel="save report image" onPress={() => runReport('save')} disabled={reportBusy} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, backgroundColor: '#1F8F5C', paddingVertical: 11 }}>
                  {reportBusy ? <CrescentLoader size={20} /> : <FontAwesome5 name="download" size={12} color="#fff" />}
                  <T v="button" style={{ fontSize: 12 }}>Save report</T>
                </Pressable>
                <Pressable accessibilityLabel="share report image" onPress={() => runReport('share')} disabled={reportBusy} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 16, paddingVertical: 11 }}>
                  <FontAwesome5 name="share-alt" size={12} color={d.text} />
                  <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: d.text }}>Share</T>
                </Pressable>
                <Pressable accessibilityLabel="quranic basis" onPress={() => { haptic.light(); setVerseOpen(true); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', paddingHorizontal: 14, paddingVertical: 11 }}>
                  <FontAwesome5 name="book-open" size={12} color="#E8C96A" />
                  <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: '#E8C96A' }}>4:11-12, 176</T>
                </Pressable>
              </View>
              {reportToast ? <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#4AE38F' : '#1D6F42', textAlign: 'center', marginTop: 8 }}>{reportToast}</T> : null}
            </>
          )}
          {result.note ? (
            <View style={{ marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(212,175,55,0.08)', padding: 10 }}>
              <T v="caption" style={{ fontSize: 10.5, color: '#B8870B', lineHeight: 15 }}>{result.note}</T>
            </View>
          ) : null}
        </View>

        {/* pass 39 — the inheritance ayah at the bottom */}
        <View style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.04)', padding: 16, alignItems: 'center', marginBottom: 4 }}>
          <FontAwesome5 name="balance-scale" size={12} color="#E8C96A" style={{ marginBottom: 8 }} />
          <T v="bodyS" style={{ fontFamily: 'Amiri-Bold', fontSize: 16, lineHeight: 30, color: isDark ? '#E8C96A' : '#8C6D1F', textAlign: 'right' }}>
            يُوصِيكُمُ اللَّهُ فِي أَوْلَادِكُمْ ۖ لِلذَّكَرِ مِثْلُ حَظِّ الْأُنثَيَيْنِ
          </T>
          <T v="caption" style={{ fontSize: 10, color: d.subtext, marginTop: 8, lineHeight: 15, textAlign: 'center' }}>
            “Allah instructs you concerning your children: for the male, what is equal to the share of two females…” — Quran 4:11
          </T>
        </View>

        <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 12, lineHeight: 15, textAlign: 'center' }}>
          Classical fara'id for common cases. Complex estates (grandchildren, half-siblings, waqf…) need a qualified scholar — verify before distribution.
        </T>
      </ScrollView>

      {/* hidden report surface — mounted only while exporting */}
      {reportOn ? (
        <View nativeID="dl-mirath-report" pointerEvents="none" style={{ position: 'absolute', left: -9999, top: 0, width: 1080, height: reportHeight(result) }}>
          <ReportSvg ref={reportRef} result={result} estate={+estate || 0} debts={+debts || 0} bequestPct={Math.min(33, +bequestPct || 0)} />
        </View>
      ) : null}

      {/* the Quranic basis — An-Nisa 4:11, 4:12, 4:176 */}
      <Modal visible={verseOpen} transparent animationType="slide" onRequestClose={() => setVerseOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setVerseOpen(false)} />
          <Pressable onPress={(e) => stopBubble(e)} style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', paddingTop: 16, paddingBottom: 30, maxHeight: '86%' }}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(212,175,55,0.14)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="book-open" size={14} color="#E8C96A" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="h3" style={{ fontSize: 15.5, fontWeight: '800' }}>The Quranic basis</T>
                <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>Surah An-Nisa — 4:11, 4:12 and 4:176</T>
              </View>
              <Pressable onPress={() => setVerseOpen(false)} accessibilityLabel="close" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,36,28,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={11} color={d.subtext} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 14 }}>
              {VERSES.map((v) => (
                <View key={v.ref} style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: isDark ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.04)', padding: 14 }}>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, color: '#B8870B', marginBottom: 6 }}>{v.ref.toUpperCase()} — {v.topic}</T>
                  <T v="arabic" style={{ fontSize: 16, lineHeight: 30, color: d.text, textAlign: 'right', marginBottom: 8 }}>{v.arabic}</T>
                  <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 17.5, color: d.subtext, fontStyle: 'italic' }}>“{v.text}”</T>
                  <T v="caption" style={{ fontSize: 10, lineHeight: 15, color: d.faint, marginTop: 8 }}>{v.explain}</T>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}


/* ── pass 40 — the three inheritance verses (Ar-Nisa), with translation and
 * a short explanation of what each fixes) ── */
const VERSES = [
  {
    ref: 'Quran 4:11', topic: 'children and parents',
    arabic: 'يُوصِيكُمُ اللَّهُ فِي أَوْلَادِكُمْ ۖ لِلذَّكَرِ مِثْلُ حَظِّ الْأُنثَيَيْنِ ۚ فَإِن كُنَّ نِسَاءً فَوْقَ اثْنَتَيْنِ فَلَهُنَّ ثُلُثَا مَا تَرَكَ وَإِن كَانَتْ وَاحِدَةً فَلَهَا النِّصْفُ',
    text: 'Allah instructs you concerning your children: for the male, what is equal to the share of two females. But if there are [only] daughters, two or more, for them is two thirds of what he left. And if there is only one, for her is half.',
    explain: 'Fixes the children’s shares: sons take twice a daughter’s share; daughters alone take ½ (one) or ⅔ (two or more). The verse continues: each parent takes ⅙ when a child survives.',
  },
  {
    ref: 'Quran 4:12', topic: 'spouses',
    arabic: 'وَلَكُمْ نِصْفُ مَا تَرَكَ أَزْوَاجُكُمْ إِلَّا أَن يَتْرُكْنَ وَلَدًا ۚ وَلَهُنَّ الرُّبُعُ مِمَّا تَرَكْتُمْ إِلَّا أَن تَرَكْتُمْ وَلَدًا',
    text: 'And for you is half of what your wives leave if they have no child. But if they have a child, for you is one fourth of what they leave. And for them is one fourth of what you leave if you have no child. But if you have a child, for them is one eighth of what you leave.',
    explain: 'Fixes the spouses’ shares: husband ½ (¼ with children); wife ¼ (⅛ with children) — after debts and bequests are settled.',
  },
  {
    ref: 'Quran 4:176', topic: 'siblings (kalala)',
    arabic: 'يَسْتَفْتُونَكَ ۖ قُلِ اللَّهُ يُفْتِيكُمْ فِي الْكَلَالَةِ ۚ إِنِ امْرُؤٌ هَلَكَ لَيْسَ لَهُ وَلَدٌ وَلَهُ أُخْتٌ فَلَهَا نِصْفُ مَا تَرَكَ',
    text: 'They request from you a ruling. Say: Allah gives you a ruling concerning one having no descendants or parents [kalala]: if he dies having no child but has a sister, for her is half of what he left.',
    explain: 'Fixes the siblings’ shares when no children and no father survive: a sister ½, two sisters ⅔, a brother takes the residue — siblings inherit 2:1 like children, and are excluded (hajb) by a son or the father.',
  },
];

/* ── the computation ── */
type Row = { label: string; icon: string; frac: string; amount: number; note: string };

function compute(estate: number, debts: number, bequestPct: number, on: Record<HeirKey, boolean>, counts: Record<HeirKey, number>): { net: number; rows: Row[]; note: string } {
  /* pass 40 — REWRITTEN with the full classical order. Fixes the reported
   * bug (father alone showed ⅙): the father is a RESIDUARY (ta'sib) when
   * there is no son — ⅙ + everything left. Mother gets the umariyyatan
   * rule (⅓ of what remains after the spouse). Radd now applies whenever
   * no residuary exists, to the non-spouse fixed sharers. */
  const net = Math.max(0, estate - debts - (estate * bequestPct) / 100);
  const hasChild = on.son || on.daughter;
  const nSons = on.son ? counts.son : 0;
  const nDaus = on.daughter ? counts.daughter : 0;
  const nBros = on.brother ? counts.brother : 0;
  const nSis = on.sister ? counts.sister : 0;
  const nSib = nBros + nSis;
  const rows: Row[] = [];
  const notes: string[] = [];

  const push = (label: string, icon: string, frac: string, amount: number, note: string) => {
    const ex = rows.find((r) => r.label === label);
    if (ex) { ex.amount += amount; ex.note = `${ex.note} + ${note}`; }
    else rows.push({ label, icon, frac, amount, note });
  };

  /* 1 — spouse (mutually exclusive in the UI, guarded here too) */
  let spouseCapped = 0;
  /* Quran 4:12 — husband: ½ with no children, ¼ with children.
   * wife: ¼ with no children, ⅛ with children. (The old code had ¼/⅛ for
   * the husband and ⅛/1/16 for the wife — both wrong; verified pass 40.) */
  if (on.husband && !on.wife) {
    const f = hasChild ? 1 / 4 : 1 / 2;
    spouseCapped = net * f;
    push('Husband', 'user-tie', fracToStr(f), spouseCapped, hasChild ? '¼ — children exist' : '½ — no children');
  } else if (on.wife && !on.husband) {
    const f = hasChild ? 1 / 8 : 1 / 4;
    spouseCapped = net * f;
    push('Wife', 'user-alt', fracToStr(f), spouseCapped, hasChild ? '⅛ — children exist' : '¼ — no children');
  } else if (on.husband && on.wife) {
    notes.unshift('Both spouses selected — check this estate (a person is normally survived by one spouse).');
  }

  /* 2 — mother */
  if (on.mother) {
    if (!hasChild && nSib < 2) {
      if (spouseCapped > 0) {
        /* umariyyatan: ⅓ of what remains AFTER the spouse */
        const m = (net - spouseCapped) / 3;
        push('Mother', 'user-friends', '⅓ of rest', m, '⅓ of what remains after the spouse (al-umariyyatan)');
      } else {
        push('Mother', 'user-friends', '⅓', net / 3, '⅓ — no descendants, fewer than 2 siblings');
      }
    } else {
      push('Mother', 'user-friends', '⅙', net / 6, '⅙ — descendants or 2+ siblings exist');
    }
  }

  /* 3 — father (fixed ⅙; residuary later when there is no son) */
  if (on.father) push('Father', 'user-friends', '⅙', net / 6, hasChild ? '⅙ — children exist' : '⅙ (+ residue as residuary)');

  /* 4 — daughters (fixed only when there is NO son) */
  if (on.daughter && !on.son) {
    if (nDaus === 1) push('Daughter', 'female', '½', net / 2, '½ — only daughter, no sons');
    else push(`${nDaus} Daughters`, 'female', '⅔', (net * 2) / 3, '⅔ shared — two or more daughters', );
  }

  /* 5 — full sisters: NO fixed share here; they act as residuaries (asaba)
   * in step 6 — with or without daughters — whenever no son and no father
   * survive. (Alone this equals the classical ½ + radd = everything.) */

  /* 6 — residue (ta'sib), in strict priority */
  const sum = () => rows.reduce((a, r) => a + r.amount, 0);
  let res = net - sum();
  if (nSons > 0) {
    /* sons : daughters 2:1 over everything left (daughters take no fixed
     * share when a son exists) */
    const parts = nSons * 2 + nDaus;
    const per = res / parts;
    if (nSons) push(nSons === 1 ? 'Son' : `${nSons} Sons`, 'male', 'residue 2:1', per * 2 * nSons, `${fmt(per * 2)} per son`);
    if (nDaus) push(nDaus === 1 ? 'Daughter' : `${nDaus} Daughters`, 'female', 'residue 1:2', per * nDaus, `${fmt(per)} per daughter`);
    res = 0;
  } else if (on.father) {
    /* father is the residuary when there is no son — takes all that is left
     * (THE fix: father alone = ⅙ + ⅚ = 100%) */
    if (res > 0.01) {
      push('Father', 'user-friends', '+ residue', res, 'residue as residuary (no son survives)');
      res = 0;
    }
  } else if ((nBros > 0 || nSis > 0) && !on.father && res > 0) {
    /* siblings are the residuaries (asaba) — with daughters present they
     * take what remains after them (al-asaba ma'a al-banat) */
    const parts = nBros * 2 + nSis;
    const per = res / parts;
    if (nBros) push(nBros === 1 ? 'Brother' : `${nBros} Brothers`, 'users', 'residue 2:1', per * 2 * nBros, `${fmt(per * 2)} per brother${nDaus ? ' — residuaries with the daughters' : ''}`);
    if (nSis) push(nSis === 1 ? 'Sister' : `${nSis} Sisters`, 'users', 'residue 1:2', per * nSis, `${fmt(per)} per sister${nDaus ? ' — residuaries with the daughters' : ''}`);
    res = 0;
  }
  if (res > 0.01) {
    /* 7 — radd: no residuary exists → the remainder returns to the
     * non-spouse fixed sharers, proportionally to their fractions */
    const raddRows = rows.filter((r) => r.label !== 'Husband' && r.label !== 'Wife' && r.label !== 'Father');
    if (raddRows.length) {
      const totalAmt = raddRows.reduce((a, r) => a + r.amount, 0) || 1;
      for (const r of raddRows) {
        const add = (res * r.amount) / totalAmt;
        r.amount += add;
        r.note += ' + radd';
      }
      notes.push(`Remainder returned proportionally to the fixed-share heirs (radd).`);
      res = 0;
    } else if (rows.length) {
      notes.push(`Remaining ${fmt(res)}: with only a spouse surviving, the surplus goes to the treasury / other relatives per a scholar’s ruling.`);
    } else {
      notes.push('No eligible heir selected — the estate goes to the public treasury / closer family per a scholar’s ruling.');
    }
  }

  /* blocking notes (kept for safety even though the UI blocks the mixes) */
  if ((on.brother || on.sister) && on.son) {
    notes.unshift('Siblings do NOT inherit: a son excludes them completely (al-hajb).');
  } else if ((on.brother || on.sister) && on.father) {
    notes.unshift('Siblings do NOT inherit: the father excludes them (al-hajb).');
  }
  return { net, rows, note: notes.join(' ') };
}

const fracToStr = (f: number) => {
  const table: Array<[number, string]> = [
    [1 / 8, '⅛'], [1 / 6, '⅙'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1 / 16, '⅟₁₆'],
  ];
  for (const [v, s] of table) if (Math.abs(f - v) < 1e-6) return s;
  return `${(f * 100).toFixed(1)}%`;
};
const parseFrac = (s: string) => {
  const map: Record<string, number> = { '⅛': 1 / 8, '⅙': 1 / 6, '¼': 1 / 4, '⅓': 1 / 3, '½': 1 / 2, '⅔': 2 / 3, '¾': 3 / 4, '⅟₁₆': 1 / 16 };
  if (map[s]) return map[s];
  const pct = parseFloat(s);
  return Number.isFinite(pct) ? pct / 100 : 0;
};


/* ── pass 40 — the REPORT image (portrait card: title, description, shares,
 * logo + QR). Rasterized only while exporting. ── */
const reportHeight = (r: { rows: Array<{ amount: number }> }) => 620 + r.rows.length * 78 + 210;

function qrCells(url: string): Array<{ x: number; y: number; s: number }> {
  try {
    const qr = createQR(url, { margin: 0 });
    const m = qr.modules as unknown as { size: number; data: Uint8Array };
    const cells: Array<{ x: number; y: number; s: number }> = [];
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.data[y * m.size + x]) cells.push({ x, y, s: m.size });
    return cells;
  } catch { return []; }
}

function ReportSvg({ ref, result, estate, debts, bequestPct }: { ref: React.RefObject<any>; result: { net: number; rows: Array<{ label: string; icon: string; frac: string; amount: number; note: string }>; note: string }; estate: number; debts: number; bequestPct: number }) {
  const W = 1080;
  const H = reportHeight(result);
  const gold = '#D4AF37';
  const rowsY = 620;
  const qr = qrCells('https://deenlink.org');
  const qrSize = 110;
  const qrCell = qr.length ? qrSize / qr[0].s : 0;
  return (
    <Svg ref={ref as never} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="rpHdr" x1="0" y1="0" x2="0.5" y2="1">
          <Stop offset="0%" stopColor="#124A30" />
          <Stop offset="100%" stopColor="#06140D" />
        </LinearGradient>
      </Defs>
      <Rect width={W} height={H} fill="#FFFFFF" />
      <Rect width={W} height={230} fill="url(#rpHdr)" />
      <Rect y={226} width={W} height={5} fill={gold} />
      {/* DeenLink logo mark */}
      <Circle cx={112} cy={112} r={50} fill="#06140D" stroke={gold} strokeWidth={3} />
      <Path fillRule="evenodd" d="M 112 72 A 40 40 0 0 1 112 152 A 40 40 0 0 1 112 72 Z M 121 84 A 28 28 0 0 1 121 140 A 28 28 0 0 1 121 84 Z" fill={gold} />
      <G transform="translate(134 112) scale(14)">
        <Path d="M 0 -1 L 0.224 -0.309 L 0.951 -0.309 L 0.363 0.118 L 0.588 0.809 L 0 0.382 L -0.588 0.809 L -0.363 0.118 L -0.951 -0.309 L -0.224 -0.309 Z" fill={gold} />
      </G>
      <SvgText x={190} y={86} fontSize={28} fill="#FFFFFF" fontWeight="800" letterSpacing={5} fontFamily="Poppins-ExtraBold">DEENLINK</SvgText>
      <SvgText x={190} y={132} fontSize={40} fill="#FFFFFF" fontWeight="800" fontFamily="Poppins-ExtraBold">Inheritance Report</SvgText>
      <SvgText x={190} y={170} fontSize={22} fill="#E8C96A" fontFamily="Poppins-Medium">Fara’id — the Islamic division</SvgText>
      <SvgText x={190} y={200} fontSize={17} fill="rgba(255,255,255,0.66)" fontFamily="Poppins">deenlink.org · study aid — a scholar must review real estates</SvgText>
      {/* description */}
      <Rect x={60} y={270} width={W - 120} height={120} rx={14} fill="#F2F7F3" stroke="rgba(20,36,28,0.12)" />
      <SvgText x={84} y={306} fontSize={20} fontWeight="800" fill="#14241C" fontFamily="Poppins-SemiBold">Description</SvgText>
      <SvgText x={84} y={336} fontSize={18} fill="rgba(20,36,28,0.7)" fontFamily="Poppins">Estate {fmt(estate)} · Funeral & debts {fmt(debts)} · Bequest {bequestPct}%</SvgText>
      <SvgText x={84} y={364} fontSize={18} fill="rgba(20,36,28,0.7)" fontFamily="Poppins">Net to distribute: {fmt(result.net)}</SvgText>
      {/* column header */}
      <Rect x={60} y={560} width={W - 120} height={44} rx={8} fill="#0E7A46" />
      <SvgText x={90} y={589} fontSize={19} fontWeight="800" fill="#FFFFFF" fontFamily="Poppins-Bold">HEIR</SvgText>
      <SvgText x={W - 420} y={589} fontSize={19} fontWeight="800" fill="#FFFFFF" fontFamily="Poppins-Bold">SHARE</SvgText>
      <SvgText x={W - 90} y={589} fontSize={19} fontWeight="800" fill="#FFFFFF" textAnchor="end" fontFamily="Poppins-Bold">AMOUNT</SvgText>
      {/* rows */}
      {result.rows.map((r, i) => {
        const y = rowsY + 44 + i * 78;
        return (
          <G key={i}>
            {i % 2 === 0 ? <Rect x={60} y={y} width={W - 120} height={78} fill="rgba(14,122,70,0.045)" /> : null}
            <SvgText x={90} y={y + 34} fontSize={22} fontWeight="800" fill="#14241C" fontFamily="Poppins-SemiBold">{r.label}</SvgText>
            <SvgText x={90} y={y + 60} fontSize={16} fill="rgba(20,36,28,0.55)" fontFamily="Poppins">{r.note.slice(0, 62)}{r.note.length > 62 ? '…' : ''}</SvgText>
            <SvgText x={W - 420} y={y + 40} fontSize={20} fill="rgba(20,36,28,0.7)" fontFamily="Poppins">{r.frac}</SvgText>
            <SvgText x={W - 90} y={y + 40} fontSize={26} fontWeight="900" fill="#1D6F42" textAnchor="end" fontFamily="Poppins-ExtraBold">{fmt(r.amount)}</SvgText>
            <Line x1={60} y1={y + 78} x2={W - 60} y2={y + 78} stroke="rgba(20,36,28,0.10)" />
          </G>
        );
      })}
      {/* footer + QR */}
      <G transform={`translate(${W - 60 - qrSize} ${H - 200})`}>
        <Rect x={-10} y={-10} width={qrSize + 20} height={qrSize + 20} rx={10} fill="#FFFFFF" stroke="#1D6F42" strokeWidth={2} />
        {qr.map((c, i) => (
          <Rect key={i} x={c.x * qrCell} y={c.y * qrCell} width={qrCell} height={qrCell} fill="#14241C" />
        ))}
        <SvgText x={qrSize / 2} y={qrSize + 36} textAnchor="middle" fontSize={16} fontWeight="700" fill="#1D6F42" fontFamily="Poppins-SemiBold">Scan for DeenLink</SvgText>
      </G>
      <SvgText x={60} y={H - 130} fontSize={18} fontWeight="800" fill="#1D6F42" fontFamily="Poppins-SemiBold">Generated by DeenLink — Strengthen Your Deen, Every Day</SvgText>
      <SvgText x={60} y={H - 98} fontSize={14} fill="rgba(20,36,28,0.5)" fontFamily="Poppins">Classical fara’id for the common heir set. Complex estates need a qualified scholar.</SvgText>
      <SvgText x={60} y={H - 66} fontSize={14} fill="rgba(20,36,28,0.5)" fontFamily="Poppins">Verify with your local scholar before any distribution.</SvgText>
    </Svg>
  );
}
