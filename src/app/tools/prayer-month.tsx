import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
import { haptic } from '@/lib/haptics';
import { stopBubble } from '@/lib/press';
import { resolveLocation, type Loc } from '@/lib/location';
import { computePrayerTimesWith, DEFAULT_SETTINGS, loadPrayerSettings, PRAYER_NAMES, type PrayerSettings } from '@/lib/prayer';
import { fetchPrayerMonth } from '@/lib/islamicApi';
import { shareSvgRef, saveSvgRefAsJpg, type SvgRefHandle } from '@/lib/svgExport';

/**
 * pass 35 — full-month prayer timetable.
 *  · data: IslamicAPI month fetch (23 methods) with offline local-calc fallback
 *  · view: scrollable day rows (hijri + gregorian + six times)
 *  · export: A4 (1240×1754) image with the DeenLink logo + watermark —
 *    save to gallery or share as JPG (works on native AND web)
 */

type Day = { date: string; hijri?: string; t: string[] };

const A4W = 1240;
const A4H = 1754;
const COLS = ['Date', 'Hijri', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const GOLD = '#D4AF37';
const EMERALD = '#1D6F42';

const fmtHM = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function PrayerMonth() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [settings, setSettings] = useState<PrayerSettings>(DEFAULT_SETTINGS);
  const [days, setDays] = useState<Day[] | null>(null);
  const [src, setSrc] = useState<'loading' | 'live' | 'off'>('loading');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const svgRef = useRef<SvgRefHandle>(null);

  useEffect(() => {
    resolveLocation().then(setLoc);
    loadPrayerSettings().then(setSettings);
  }, []);

  const monthLabel = useMemo(() => new Date().toLocaleDateString([], { month: 'long', year: 'numeric' }), []);

  useEffect(() => {
    if (!loc) return;
    let dead = false;
    const method = settings.apiMethod ?? 3;
    fetchPrayerMonth({ lat: loc.latitude, lon: loc.longitude, method, school: settings.madhab === 'hanafi' ? 2 : 1 })
      .then((list) => {
        if (dead) return;
        setDays(list.map((dy) => ({
          date: dy.date,
          hijri: dy.hijri_date ? `${parseInt(dy.hijri_date.day, 10)} ${dy.hijri_date.month.en}` : undefined,
          t: [dy.times.Fajr, dy.times.Sunrise, dy.times.Dhuhr, dy.times.Asr, dy.times.Maghrib, dy.times.Isha],
        })));
        setSrc('live');
      })
      .catch(() => {
        /* offline fallback: compute the month locally */
        const now = new Date();
        const out: Day[] = [];
        const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= total; i++) {
          const dd = new Date(now.getFullYear(), now.getMonth(), i, 12, 0, 0);
          const ts = computePrayerTimesWith(dd, loc, settings);
          out.push({ date: dd.toISOString().slice(0, 10), t: ts.map(fmtHM) });
        }
        if (!dead) { setDays(out); setSrc('off'); }
      });
    return () => { dead = true; };
  }, [loc, settings]);

  const doShare = async () => {
    if (exporting || !days) return;
    haptic.medium();
    setExporting(true);
    try {
      await shareSvgRef(svgRef, `deenlink-prayer-times-${new Date().toISOString().slice(0, 7)}`, `DeenLink — ${monthLabel} prayer times`);
    } catch { setToast('Could not export — try again'); }
    setExporting(false);
  };

  const doSave = async () => {
    if (exporting || !days) return;
    haptic.medium();
    setExporting(true);
    try {
      if (Platform.OS === 'web') {
        setToast('Long-press the image → Save, or use Share');
        await doShare();
      } else {
        const ok = await saveSvgRefAsJpg(svgRef, `deenlink-prayer-times-${new Date().toISOString().slice(0, 7)}`);
        setToast(ok ? 'Saved to your gallery ✓' : 'Could not save — check photo permission');
      }
    } catch { setToast('Could not save — try Share instead'); }
    setExporting(false);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <PageHero title="Prayer Times" heading="Monthly Timetable" sub={`${monthLabel} · ${src === 'live' ? 'IslamicAPI' : 'offline calculation'}`} height={190} />

        <View style={{ paddingHorizontal: 16, paddingTop: 14, flexDirection: 'row', gap: 9 }}>
          <Pressable accessibilityLabel="share month table" onPress={doShare} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 46, backgroundColor: '#1F8F5C' }}>
            {exporting ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="share-alt" size={13} color="#fff" />}
            <T v="button" style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Share as image (A4)</T>
          </Pressable>
          <Pressable accessibilityLabel="save month table" onPress={doSave} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 46, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
            <FontAwesome5 name="download" size={13} color="#E8C96A" />
            <T v="button" style={{ color: '#E8C96A', fontWeight: '800', fontSize: 13 }}>Save to gallery</T>
          </Pressable>
        </View>

        <View style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, overflow: 'hidden' }}>
          {/* header row */}
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#0E241A' : '#0E7A46', paddingVertical: 10 }}>
            {COLS.map((c, i) => (
              <View key={c} style={{ flex: i < 2 ? 1.3 : 1, alignItems: 'center' }}>
                <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: i === 0 ? '#E8C96A' : '#FFFFFF', letterSpacing: 0.4 }}>{c.toUpperCase()}</T>
              </View>
            ))}
          </View>
          {days == null ? (
            <View style={{ padding: 26, alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="caption" style={{ fontSize: 11, color: d.faint }}>{src === 'live' ? 'Fetching the month from IslamicAPI…' : 'Calculating the month…'}</T>
            </View>
          ) : days.map((dy) => {
            const dt = new Date(`${dy.date}T12:00:00`);
            const isToday = dy.date === todayIso;
            return (
              <View key={dy.date} style={{ flexDirection: 'row', paddingVertical: 8, backgroundColor: isToday ? (isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.08)') : 'transparent', borderBottomWidth: 1, borderBottomColor: d.cardBorder }}>
                <View style={{ flex: 1.3, alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'center' }}>
                  <T v="bodyS" style={{ fontSize: 11, fontWeight: isToday ? '900' : '700', color: isToday ? '#D4AF37' : d.text }}>
                    {dt.getDate()} {dt.toLocaleDateString([], { month: 'short' })}
                  </T>
                </View>
                <View style={{ flex: 1.3, alignItems: 'center' }}>
                  <T v="caption" style={{ fontSize: 9.5, color: d.subtext }}>{dy.hijri ?? '—'}</T>
                </View>
                {dy.t.map((t, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <T v="caption" style={{ fontSize: 10, fontWeight: i === 1 ? '400' : '600', color: i === 1 ? d.faint : d.text }}>{t}</T>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* hidden A4 export surface (rasterized on demand) */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -9999, top: 0, width: A4W, height: A4H }}>
        <MonthTableSvg ref={svgRef} days={days ?? []} monthLabel={monthLabel} location={loc?.name ?? ''} methodLabel="" />
      </View>

      <Modal visible={!!toast} transparent animationType="fade" onRequestClose={() => setToast(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,8,5,0.5)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 90 }} onPress={() => setToast(null)}>
          <View style={{ borderRadius: 14, backgroundColor: isDark ? '#0A1A11' : '#FFFFFF', paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' }}>
            <T v="bodyS" style={{ fontSize: 12.5, color: d.text }}>{toast}</T>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── the A4 export sheet (1240×1754) — logo, watermark, table ── */
function MonthTableSvg({ ref, days, monthLabel, location, methodLabel }: { ref: React.RefObject<SvgRefHandle>; days: Day[]; monthLabel: string; location: string; methodLabel: string }) {
  const rows = days.slice(0, 31);
  const top = 300;
  const rowH = Math.min(40, (A4H - top - 120) / Math.max(rows.length, 1));
  const x0 = 70;
  const colW = (A4W - x0 * 2) / 8;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Svg ref={ref as never} width={A4W} height={A4H} viewBox={`0 0 ${A4W} ${A4H}`}>
      <Defs>
        <RadialGradient id="hdr" cx="50%" cy="0%" r="120%">
          <Stop offset="0%" stopColor="#124A30" />
          <Stop offset="100%" stopColor="#06140D" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={A4W} height={A4H} fill="#FFFFFF" />
      {/* header band */}
      <Rect x="0" y="0" width={A4W} height="230" fill="url(#hdr)" />
      <Rect x="0" y="226" width={A4W} height="6" fill={GOLD} />
      {/* logo medallion */}
      <Circle cx="110" cy="115" r="52" fill="#06140D" stroke={GOLD} strokeWidth="3" />
      <SvgText x="110" y="132" textAnchor="middle" fontSize="40" fill={GOLD} fontFamily="Poppins-Bold">ﷲ</SvgText>
      <SvgText x="190" y="98" fontSize="42" fill="#FFFFFF" fontFamily="Poppins-ExtraBold" fontWeight="800">Prayer Times</SvgText>
      <SvgText x="190" y="140" fontSize="26" fill="#E8C96A" fontFamily="Poppins-Medium">{monthLabel}{location ? ` · ${location}` : ''}</SvgText>
      <SvgText x="190" y="176" fontSize="18" fill="rgba(255,255,255,0.66)" fontFamily="Poppins">{methodLabel || 'Calculated with the Muslim World League method'} · deenlink</SvgText>
      {/* column headers */}
      <Rect x={x0} y="252" width={A4W - x0 * 2} height="40" fill="#0E7A46" />
      {COLS.map((c, i) => (
        <SvgText key={c} x={x0 + colW * i + colW / 2} y="278" textAnchor="middle" fontSize="19" fontWeight="800" fill={i === 0 ? GOLD : '#FFFFFF'} fontFamily="Poppins-Bold">{c}</SvgText>
      ))}
      {/* rows */}
      {rows.map((dy, r) => {
        const y = top + 40 + r * rowH;
        const isToday = dy.date === today;
        const dt = new Date(`${dy.date}T12:00:00`);
        return (
          <G key={dy.date}>
            {isToday ? <Rect x={x0} y={y} width={A4W - x0 * 2} height={rowH} fill="rgba(212,175,55,0.14)" rx="6" /> : null}
            <Line x1={x0} y1={y + rowH} x2={A4W - x0} y2={y + rowH} stroke="rgba(20,36,28,0.10)" strokeWidth="1" />
            <SvgText x={x0 + colW * 0.5} y={y + rowH * 0.66} textAnchor="middle" fontSize="17" fontWeight={isToday ? '800' : '600'} fill={isToday ? '#8a6d14' : '#14241C'} fontFamily="Poppins">
              {dt.getDate()} {dt.toLocaleDateString([], { month: 'short' })}
            </SvgText>
            <SvgText x={x0 + colW * 1.5} y={y + rowH * 0.66} textAnchor="middle" fontSize="15" fill="rgba(20,36,28,0.62)" fontFamily="Poppins">{dy.hijri ?? '—'}</SvgText>
            {dy.t.map((t, i) => (
              <SvgText key={i} x={x0 + colW * (i + 2) + colW / 2} y={y + rowH * 0.66} textAnchor="middle" fontSize="16" fontWeight={i === 1 ? '400' : '600'} fill={i === 1 ? 'rgba(20,36,28,0.5)' : '#14241C'} fontFamily="Poppins">{t}</SvgText>
            ))}
          </G>
        );
      })}
      {/* footer + watermark */}
      <SvgText x={A4W / 2} y={A4H - 62} textAnchor="middle" fontSize="18" fill={EMERALD} fontFamily="Poppins-SemiBold" fontWeight="700">Generated by DeenLink — Strengthen Your Deen, Every Day</SvgText>
      <SvgText x={A4W / 2} y={A4H - 34} textAnchor="middle" fontSize="13" fill="rgba(20,36,28,0.45)" fontFamily="Poppins">Times are estimates — always confirm with your local mosque.</SvgText>
      <SvgText x={A4W / 2} y={A4H / 2 + 60} textAnchor="middle" fontSize="150" fill="rgba(29,111,70,0.045)" fontWeight="900" fontFamily="Poppins-ExtraBold" transform={`rotate(-24 ${A4W / 2} ${A4H / 2})`}>DEENLINK</SvgText>
    </Svg>
  );
}

/* tiny <G> alias so the map above reads clean */
function G({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
