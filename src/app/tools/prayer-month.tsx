import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { create as createQR } from 'qrcode';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
import { CrescentLoader } from '@/components/CrescentLoader';
import { haptic } from '@/lib/haptics';
import { stopBubble } from '@/lib/press';
import { resolveLocation, type Loc } from '@/lib/location';
import { computePrayerTimesWith, DEFAULT_SETTINGS, loadPrayerSettings, PRAYER_NAMES, to12h, type PrayerSettings } from '@/lib/prayer';
import { fetchPrayerMonth } from '@/lib/islamicApi';
import { shareSvgRef, saveSvgRefAsJpg, shareImage, type SvgRefHandle } from '@/lib/svgExport';

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

/* pass 37 — ALL date/time formatting is locale-free and deterministic.
 * toLocale* on Hermes/Expo Go is unreliable (missing Intl data on some
 * builds) and was part of the month-screen death. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtHM = (d: Date) => {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};
const shortDate = (iso: string) => {
  const dt = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const day = dt.getDate();
  if (Number.isNaN(day)) return iso.slice(0, 10);
  return `${day} ${MONTHS[dt.getMonth()] ?? ''}`;
};

/* pass 37 — hijri fallback WITHOUT Intl: the tabular Islamic calendar
 * (arithmetic, widely-used approximation of Umm al-Qura ±1 day).
 * Works identically on every JS engine including Hermes without Intl. */
const HI_MONTHS = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah'];
const localHijri = (iso: string): string | undefined => {
  try {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return undefined;
    const jd = Math.floor(d.getTime() / 86400000) + 2440588;
    const l0 = jd - 1948440 + 10632;
    const n = Math.floor((l0 - 1) / 10631);
    let l1 = l0 - 10631 * n + 354;
    const j = Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) + Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
    l1 = l1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    const m = Math.floor((24 * l1) / 709);
    const day = l1 - Math.floor((709 * m) / 24);
    const year = 30 * n + j - 30;
    const mo = HI_MONTHS[m - 1];
    if (!mo || day < 1 || day > 30) return undefined;
    return `${day} ${mo}`;
  } catch {
    return undefined;
  }
};

export default function PrayerMonth() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [settings, setSettings] = useState<PrayerSettings>(DEFAULT_SETTINGS);
  const [days, setDays] = useState<Day[] | null>(null);
  const [src, setSrc] = useState<'loading' | 'live' | 'off'>('loading');
  const [exporting, setExporting] = useState(false);
  /* pass 37 — the A4 surface mounts ONLY during an export. It used to sit
   * offscreen permanently; on native that giant surface was the page-killer. */
  const [exportOn, setExportOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const svgRef = useRef<SvgRefHandle>(null);

  useEffect(() => {
    resolveLocation().then(setLoc);
    loadPrayerSettings().then(setSettings);
  }, []);

  const now0 = new Date();
  const monthLabel = `${MONTHS_LONG[now0.getMonth()]} ${now0.getFullYear()}`;

  useEffect(() => {
    if (!loc) return;
    let dead = false;
    const method = settings.apiMethod ?? 3;
    fetchPrayerMonth({ lat: loc.latitude, lon: loc.longitude, method, school: settings.madhab === 'hanafi' ? 2 : 1 })
      .then((list) => {
        if (dead) return;
        setDays(list.map((dy) => {
          /* pass 38 — the API nests hijri under hijri_date.hijri (the flat
           * read produced "NaN undefined" on every live row) */
          const hj = (dy.hijri_date as unknown as { hijri?: { day?: string; month?: { en?: string } }; day?: string; month?: { en?: string } } | undefined) ?? undefined;
          const hd = hj?.hijri ?? hj;
          const hijri = hd?.day && hd?.month?.en ? `${parseInt(hd.day, 10)} ${hd.month.en}` : localHijri(dy.date);
          return {
            date: dy.date,
            hijri,
            t: [dy.times.Fajr, dy.times.Sunrise, dy.times.Dhuhr, dy.times.Asr, dy.times.Maghrib, dy.times.Isha].map(to12h),
          };
        }));
        setSrc('live');
      })
      .catch(() => {
        /* offline fallback: compute the month locally */
        const now = new Date();
        const out: Day[] = [];
        const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= total; i++) {
          try {
            const dd = new Date(now.getFullYear(), now.getMonth(), i, 12, 0, 0);
            const iso = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const ts = computePrayerTimesWith(dd, loc, settings);
            out.push({ date: iso, hijri: localHijri(iso), t: ts.map(fmtHM) });
          } catch {}
        }
        if (!dead) { setDays(out); setSrc('off'); }
      });
    return () => { dead = true; };
  }, [loc, settings]);

  const runExport = async (mode: 'share' | 'save') => {
    setExportOn(true);
    /* give the surface a beat to lay out before rasterizing */
    await new Promise((r) => setTimeout(r, 450));
    const name = `deenlink-prayer-times-${new Date().toISOString().slice(0, 7)}`;
    try {
      if (Platform.OS === 'web') {
        /* pass 39 — THE FIX: web Svg refs expose no toDataURL (that is why
         * export "failed" silently). Rasterize the SAME A4 design on a canvas. */
        const dataUrl = monthCanvasDataUrl(days ?? [], monthLabel, loc?.name ?? '');
        (window as unknown as { __dlMonthExport?: number }).__dlMonthExport = dataUrl.length;
        await shareImage(dataUrl, name, `DeenLink — ${monthLabel} prayer times`);
        setToast(mode === 'save' ? 'Image downloaded — check your files' : 'Opening share / download…');
      } else if (mode === 'share') {
        await shareSvgRef(svgRef, name, `DeenLink — ${monthLabel} prayer times`);
      } else {
        const ok = await saveSvgRefAsJpg(svgRef, name);
        setToast(ok ? 'Saved to your gallery ✓' : 'Could not save — check photo permission');
      }
    } catch {
      setToast('Could not export — try again');
    } finally {
      setExportOn(false);
    }
  };

  const doShare = () => {
    if (exporting || !days) return;
    haptic.medium();
    setExporting(true);
    runExport('share').finally(() => setExporting(false));
  };

  const doSave = () => {
    if (exporting || !days) return;
    haptic.medium();
    setExporting(true);
    runExport('save').finally(() => setExporting(false));
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
            {exporting ? <CrescentLoader size={22} /> : <FontAwesome5 name="share-alt" size={13} color="#fff" />}
            <T v="button" style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Share as image</T>
          </Pressable>
          <Pressable accessibilityLabel="save month table" onPress={doSave} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 46, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
            <FontAwesome5 name="download" size={13} color="#E8C96A" />
            <T v="button" style={{ color: '#E8C96A', fontWeight: '800', fontSize: 13 }}>Save to gallery</T>
          </Pressable>
        </View>

        {/* pass 40 — balanced, swipable table: fixed column widths so every
         * column gets the room it needs; swipe sideways on narrow phones. */}
        <View style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, overflow: 'hidden' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 660 }}>
          {/* header row */}
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#0E241A' : '#0E7A46', paddingVertical: 11, borderStartWidth: 0 }}>
            {COLS.map((c, i) => (
              <View key={c} style={{ width: i === 0 ? 96 : i === 1 ? 104 : 76.6, alignItems: 'center' }}>
                <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: i === 0 ? '#E8C96A' : '#FFFFFF', letterSpacing: 0.4 }}>{c.toUpperCase()}</T>
              </View>
            ))}
          </View>
          {days == null ? (
            <View style={{ padding: 18, gap: 10 }}>
              {[...Array(10)].map((_, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, opacity: 1 - i * 0.07 }}>
                  {[...Array(8)].map((_, j) => (
                    <View key={j} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: isDark ? 'rgba(242,247,243,0.07)' : 'rgba(20,36,28,0.06)' }} />
                  ))}
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
                <T v="caption" style={{ fontSize: 11, color: d.faint }}>Building the month timetable…</T>
              </View>
            </View>
          ) : days.map((dy) => {
            const dt = new Date(`${dy.date}T12:00:00`);
            const isToday = dy.date === todayIso;
            return (
              <View key={dy.date} style={{ flexDirection: 'row', paddingVertical: 9, backgroundColor: isToday ? (isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.08)') : 'transparent', borderBottomWidth: 1, borderBottomColor: d.cardBorder }}>
                <View style={{ width: 96, alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'center' }}>
                  <T v="bodyS" style={{ fontSize: 12, fontWeight: isToday ? '900' : '700', color: isToday ? '#D4AF37' : d.text }}>
                    {shortDate(dy.date)}
                  </T>
                </View>
                <View style={{ width: 104, alignItems: 'center' }}>
                  <T v="caption" style={{ fontSize: 10.5, color: d.subtext }}>{dy.hijri ?? '—'}</T>
                </View>
                {dy.t.map((t, i) => (
                  <View key={i} style={{ width: 76.6, alignItems: 'center' }}>
                    <T v="caption" style={{ fontSize: 11, fontWeight: i === 1 ? '400' : '600', color: i === 1 ? d.faint : d.text }}>{t}</T>
                  </View>
                ))}
              </View>
            );
          })}
          </View>
          </ScrollView>
          <T v="caption" style={{ fontSize: 8.5, color: d.faint, textAlign: 'center', paddingVertical: 6 }}>Swipe sideways to see all columns</T>
        </View>
      </ScrollView>

      {/* hidden A4 export surface — mounted ONLY while exporting (pass 37) */}
      {exportOn ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: -9999, top: 0, width: A4W, height: A4H }}>
          <MonthTableSvg ref={svgRef} days={days ?? []} monthLabel={monthLabel} location={loc?.name ?? ''} methodLabel="" />
        </View>
      ) : null}

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


/* pass 40 — QR cells for the export (deep link to the app) */
const APP_LINK = 'https://deenlink.org';
function qrCells(url: string): Array<{ x: number; y: number; s: number }> {
  try {
    const qr = createQR(url, { margin: 0 });
    const m = qr.modules as unknown as { size: number; data: Uint8Array };
    const cells: Array<{ x: number; y: number; s: number }> = [];
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.data[y * m.size + x]) cells.push({ x, y, s: m.size });
    return cells;
  } catch { return []; }
}
/* 5-point star, unit radius 1, centred (0,0) */
const STAR_UNIT = 'M 0 -1 L 0.224 -0.309 L 0.951 -0.309 L 0.363 0.118 L 0.588 0.809 L 0 0.382 L -0.588 0.809 L -0.363 0.118 L -0.951 -0.309 L -0.224 -0.309 Z';

/* ── the A4 export sheet (1240×1754) — logo + QR, watermark, table ── */
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
      {/* DeenLink logo mark: ring + crescent (evenodd punch) + star */}
      <Circle cx="110" cy="115" r="54" fill="#06140D" stroke={GOLD} strokeWidth="3" />
      <G transform={`translate(110 115)`}>
        <Path fillRule="evenodd" d="M 0 -42 A 42 42 0 0 1 0 42 A 42 42 0 0 1 0 -42 Z M 10 -30 A 30 30 0 0 1 10 30 A 30 30 0 0 1 10 -30 Z" fill={GOLD} />
        <G transform={`translate(24 0) scale(15)`}>
          <Path d={STAR_UNIT} fill={GOLD} />
        </G>
      </G>
      <SvgText x="190" y="86" fontSize="30" fill="#FFFFFF" fontFamily="Poppins-ExtraBold" fontWeight="800" letterSpacing="5">DEENLINK</SvgText>
      <SvgText x="190" y="124" fontSize="40" fill="#FFFFFF" fontFamily="Poppins-ExtraBold" fontWeight="800">Prayer Times</SvgText>
      <SvgText x="190" y="160" fontSize="26" fill="#E8C96A" fontFamily="Poppins-Medium">{monthLabel}{location ? ` · ${location}` : ''}</SvgText>
      <SvgText x="190" y="192" fontSize="18" fill="rgba(255,255,255,0.66)" fontFamily="Poppins">{methodLabel || 'Calculated for your location'} · deenlink.org</SvgText>
      {/* column headers */}
      <Rect x={x0} y="252" width={A4W - x0 * 2} height="40" fill="#0E7A46" />
      {COLS.map((c, i) => (
        <SvgText key={c} x={x0 + colW * i + colW / 2} y="278" textAnchor="middle" fontSize="19" fontWeight="800" fill={i === 0 ? GOLD : '#FFFFFF'} fontFamily="Poppins-Bold">{c}</SvgText>
      ))}
      {/* rows */}
      {rows.map((dy, r) => {
        const y = top + 40 + r * rowH;
        const isToday = dy.date === today;
        return (
          <G key={dy.date}>
            {isToday ? <Rect x={x0} y={y} width={A4W - x0 * 2} height={rowH} fill="rgba(212,175,55,0.14)" rx="6" /> : null}
            <Line x1={x0} y1={y + rowH} x2={A4W - x0} y2={y + rowH} stroke="rgba(20,36,28,0.10)" strokeWidth="1" />
            <SvgText x={x0 + colW * 0.5} y={y + rowH * 0.66} textAnchor="middle" fontSize="17" fontWeight={isToday ? '800' : '600'} fill={isToday ? '#8a6d14' : '#14241C'} fontFamily="Poppins">
              {shortDate(dy.date)}
            </SvgText>
            <SvgText x={x0 + colW * 1.5} y={y + rowH * 0.66} textAnchor="middle" fontSize="15" fill="rgba(20,36,28,0.62)" fontFamily="Poppins">{dy.hijri ?? '—'}</SvgText>
            {dy.t.map((t, i) => (
              <SvgText key={i} x={x0 + colW * (i + 2) + colW / 2} y={y + rowH * 0.66} textAnchor="middle" fontSize="16" fontWeight={i === 1 ? '400' : '600'} fill={i === 1 ? 'rgba(20,36,28,0.5)' : '#14241C'} fontFamily="Poppins">{t}</SvgText>
            ))}
          </G>
        );
      })}
      {/* QR deep link — bottom right, clear of the centred footer text */}
      {(() => {
        const cells = qrCells(APP_LINK);
        const size = 118; const c = cells.length ? size / cells[0].s : 0;
        const qx = A4W - 70 - size; const qy = A4H - 200;
        return (
          <G transform={`translate(${qx} ${qy})`}>
            <Rect x={-10} y={-10} width={size + 20} height={size + 20} rx={10} fill="#FFFFFF" stroke={EMERALD} strokeWidth={2} />
            {cells.map((cl, i) => (
              <Rect key={i} x={cl.x * c} y={cl.y * c} width={c} height={c} fill="#14241C" />
            ))}
            <SvgText x={size / 2} y={size + 34} textAnchor="middle" fontSize="15" fontWeight="700" fill={EMERALD} fontFamily="Poppins-SemiBold">Scan for DeenLink</SvgText>
          </G>
        );
      })()}
      {/* footer + watermark */}
      <SvgText x={A4W / 2} y={A4H - 62} textAnchor="middle" fontSize="18" fill={EMERALD} fontFamily="Poppins-SemiBold" fontWeight="700">Generated by DeenLink — Strengthen Your Deen, Every Day</SvgText>
      <SvgText x={A4W / 2} y={A4H - 34} textAnchor="middle" fontSize="13" fill="rgba(20,36,28,0.45)" fontFamily="Poppins">Times are estimates — always confirm with your local mosque.</SvgText>
      <SvgText x={A4W / 2} y={A4H / 2 + 60} textAnchor="middle" fontSize="150" fill="rgba(29,111,70,0.045)" fontWeight="900" fontFamily="Poppins-ExtraBold" transform={`rotate(-24 ${A4W / 2} ${A4H / 2})`}>DEENLINK</SvgText>
    </Svg>
  );
}

/* ── pass 39 — WEB export: the A4 table drawn on a real canvas.
 * react-native-svg refs have no toDataURL() on web — this is the fix for
 * "the timetable is not generating an image". Mirrors MonthTableSvg 1:1. ── */

function monthCanvasDataUrl(days: Day[], monthLabel: string, location: string): string {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) throw new Error('no document');
  const canvas = doc.createElement('canvas');
  canvas.width = A4W;
  canvas.height = A4H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d ctx');

  const rows = days.slice(0, 31);
  const top = 300;
  const rowH = Math.min(40, (A4H - top - 120) / Math.max(rows.length, 1));
  const x0 = 70;
  const colW = (A4W - x0 * 2) / 8;
  const today = new Date().toISOString().slice(0, 10);

  /* paper */
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, A4W, A4H);
  /* header band gradient */
  const g = ctx.createLinearGradient(0, 0, A4W * 0.4, 230);
  g.addColorStop(0, '#124A30');
  g.addColorStop(1, '#06140D');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, A4W, 230);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 226, A4W, 6);
  /* DeenLink logo mark: ring + crescent (evenodd) + star */
  ctx.beginPath();
  ctx.arc(110, 115, 54, 0, Math.PI * 2);
  ctx.fillStyle = '#06140D';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(110, 115, 42, 0, Math.PI * 2);
  ctx.arc(120, 115, 30, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill('evenodd');
  ctx.save();
  ctx.translate(134, 115);
  ctx.scale(15, 15);
  ctx.beginPath();
  const SU = [0, -1, 0.224, -0.309, 0.951, -0.309, 0.363, 0.118, 0.588, 0.809, 0, 0.382, -0.588, 0.809, -0.363, 0.118, -0.951, -0.309, -0.224, -0.309];
  ctx.moveTo(SU[0], SU[1]);
  for (let k = 2; k < SU.length; k += 2) ctx.lineTo(SU[k], SU[k + 1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  /* titles */
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 30px "Poppins-ExtraBold", "Poppins-Bold", sans-serif';
  ctx.fillText('D E E N L I N K', 190, 88);
  ctx.font = '800 40px "Poppins-ExtraBold", "Poppins-Bold", sans-serif';
  ctx.fillText('Prayer Times', 190, 128);
  ctx.fillStyle = '#E8C96A';
  ctx.font = '26px "Poppins-Medium", sans-serif';
  ctx.fillText(`${monthLabel}${location ? ` · ${location}` : ''}`, 190, 162);
  ctx.fillStyle = 'rgba(255,255,255,0.66)';
  ctx.font = '18px "Poppins", sans-serif';
  ctx.fillText('Calculated for your location · deenlink.org', 190, 194);

  /* column headers */
  ctx.fillStyle = '#0E7A46';
  ctx.fillRect(x0, 252, A4W - x0 * 2, 40);
  ctx.textAlign = 'center';
  COLS.forEach((c, i) => {
    ctx.fillStyle = i === 0 ? GOLD : '#FFFFFF';
    ctx.font = '800 19px "Poppins-Bold", sans-serif';
    ctx.fillText(c, x0 + colW * i + colW / 2, 279);
  });

  /* rows */
  rows.forEach((dy, r) => {
    const y = top + 40 + r * rowH;
    const isToday = dy.date === today;
    if (isToday) {
      ctx.fillStyle = 'rgba(212,175,55,0.14)';
      ctx.fillRect(x0, y, A4W - x0 * 2, rowH);
    }
    ctx.strokeStyle = 'rgba(20,36,28,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y + rowH);
    ctx.lineTo(A4W - x0, y + rowH);
    ctx.stroke();
    ctx.fillStyle = isToday ? '#8a6d14' : '#14241C';
    ctx.font = `${isToday ? '800' : '600'} 17px "Poppins", sans-serif`;
    ctx.fillText(shortDate(dy.date), x0 + colW * 0.5, y + rowH * 0.66);
    ctx.fillStyle = 'rgba(20,36,28,0.62)';
    ctx.font = '15px "Poppins", sans-serif';
    ctx.fillText(dy.hijri ?? '—', x0 + colW * 1.5, y + rowH * 0.66);
    dy.t.forEach((t, i) => {
      ctx.fillStyle = i === 1 ? 'rgba(20,36,28,0.5)' : '#14241C';
      ctx.font = `${i === 1 ? '400' : '600'} 16px "Poppins", sans-serif`;
      ctx.fillText(t, x0 + colW * (i + 2) + colW / 2, y + rowH * 0.66);
    });
  });

  /* watermark */
  ctx.save();
  ctx.translate(A4W / 2, A4H / 2 + 60);
  ctx.rotate((-24 * Math.PI) / 180);
  ctx.fillStyle = 'rgba(29,111,70,0.045)';
  ctx.font = '900 150px "Poppins-ExtraBold", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEENLINK', 0, 0);
  ctx.restore();

  /* QR deep link — bottom right (mirrors the SVG export) */
  try {
    const cells = qrCells(APP_LINK);
    if (cells.length) {
      const size = 118; const c = size / cells[0].s;
      const qx = A4W - 70 - size; const qy = A4H - 200;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = EMERALD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(qx - 10, qy - 10, size + 20, size + 20, 10);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#14241C';
      cells.forEach((cl) => ctx.fillRect(qx + cl.x * c, qy + cl.y * c, c, c));
      ctx.fillStyle = EMERALD;
      ctx.font = '700 15px "Poppins-SemiBold", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Scan for DeenLink', qx + size / 2, qy + size + 34);
    }
  } catch {}

  /* footer */
  ctx.textAlign = 'center';
  ctx.fillStyle = EMERALD;
  ctx.font = '700 18px "Poppins-SemiBold", sans-serif';
  ctx.fillText('Generated by DeenLink — Strengthen Your Deen, Every Day', A4W / 2, A4H - 62);
  ctx.fillStyle = 'rgba(20,36,28,0.45)';
  ctx.font = '13px "Poppins", sans-serif';
  ctx.fillText('Times are estimates — always confirm with your local mosque.', A4W / 2, A4H - 34);

  return canvas.toDataURL('image/jpeg', 0.92);
}
