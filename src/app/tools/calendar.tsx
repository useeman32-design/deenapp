import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatGregorian, HIJRI_MONTHS, hijriDate } from '@/lib/prayer';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Hijri calendar (pass 23 — full redesign): a real month GRID — each day shows
 * the hijri day number big + gregorian small, today highlighted, month arrows,
 * islamic occasions marked. Uses the same hijriDate() engine as prayer times.
 */

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* fixed-date islamic occasions (hijri month/day) */
const OCCASIONS: Array<{ m: number; d: number; label: string; icon: string }> = [
  { m: 1, d: 1, label: 'Hijri New Year', icon: 'star' },
  { m: 1, d: 10, label: 'Day of Ashura', icon: 'moon' },
  { m: 3, d: 12, label: 'Mawlid an-Nabi', icon:'star-and-crescent' },
  { m: 7, d: 27, label: 'Isra & Miraj', icon: 'moon' },
  { m: 8, d: 15, label: 'Laylat al-Bara\'ah', icon: 'moon' },
  { m: 9, d: 1, label: 'First of Ramadan', icon: 'moon' },
  { m: 9, d: 27, label: 'Laylat al-Qadr (est.)', icon: 'moon' },
  { m: 10, d: 1, label: 'Eid al-Fitr', icon: 'star-and-crescent' },
  { m: 12, d: 9, label: 'Day of Arafah', icon: 'kaaba' },
  { m: 12, d: 10, label: 'Eid al-Adha', icon: 'kaaba' },
];

export default function CalendarScreen() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const todayH = hijriDate(today);
  /* anchor = any date inside the month being viewed */
  const [anchor, setAnchor] = useState<Date>(today);

  /* walk to the 1st of the current hijri month, then build the month */
  const grid = useMemo(() => {
    let cur = new Date(anchor);
    cur.setHours(12, 0, 0, 0);
    /* step back to day 1 (safety cap 32 days) */
    for (let i = 0; i < 33; i++) {
      const h = hijriDate(cur);
      if (h.day === 1) break;
      cur.setDate(cur.getDate() - 1);
    }
    const start = new Date(cur);
    const days: Array<{ g: Date; hd: number; hm: number; hy: number; occasion?: string; icon?: string }> = [];
    for (let i = 0; i < 32; i++) {
      const g = new Date(start);
      g.setDate(start.getDate() + i);
      const h = hijriDate(g);
      if (i > 0 && h.day === 1) break;
      const occ = OCCASIONS.find((o) => o.m === h.month && o.d === h.day);
      days.push({ g, hd: h.day, hm: h.month, hy: h.year, occasion: occ?.label, icon: occ?.icon });
    }
    return { days, startOffset: start.getDay(), month: hijriDate(start).month, year: hijriDate(start).year };
  }, [anchor]);

  const monthLabel = `${HIJRI_MONTHS[grid.month - 1]} ${grid.year} AH`;
  const gregSpan = (() => {
    const first = grid.days[0]?.g;
    const last = grid.days[grid.days.length - 1]?.g;
    if (!first || !last) return '';
    const f = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const l = last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${f} – ${l}`;
  })();

  const shiftMonth = (dir: 1 | -1) => {
    haptic.selection();
    const nx = new Date(anchor);
    nx.setDate(nx.getDate() + dir * 29);
    nx.setHours(12, 0, 0, 0);
    setAnchor(nx);
  };

  const upcoming = useMemo(
    () =>
      OCCASIONS.map((o) => {
        /* find next gregorian date for the occasion by scanning ahead 400 days */
        let dt: Date | null = null;
        for (let i = 0; i < 400; i++) {
          const g = new Date();
          g.setDate(g.getDate() + i);
          g.setHours(12, 0, 0, 0);
          const h = hijriDate(g);
          if (h.month === o.m && h.day === o.d) {
            dt = g;
            break;
          }
        }
        return { ...o, date: dt };
      })
        .filter((o) => o.date)
        .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime())
        .slice(0, 5),
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
          <Pressable onPress={() => { haptic.selection(); setAnchor(today); }} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(184,134,11,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="calendar-alt" size={15} color="#E8C96A" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 18, color: d.text }}>Islamic Calendar</T>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>Today: {todayH.day} {HIJRI_MONTHS[todayH.month - 1]} {todayH.year} AH</T>
          </View>
        </View>

        {/* today card */}
        <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 20, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', padding: 18, alignItems: 'center' }}>
          <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: 'rgba(255,255,255,0.75)' }}>
            {WEEK[today.getDay()].toUpperCase()} · {formatGregorian(today).toUpperCase()}
          </T>
          <T v="display" style={{ fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 4 }}>
            {todayH.day} {HIJRI_MONTHS[todayH.month - 1]} {todayH.year}
          </T>
          <T v="caption" style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>AH</T>
        </View>

        {/* month grid */}
        <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="chevron-left" size={10} color={d.subtext} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <T v="body" style={{ fontWeight: '800', fontSize: 14, color: d.text }}>{monthLabel}</T>
              <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 0.5 }}>{gregSpan}</T>
            </View>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="chevron-right" size={10} color={d.subtext} />
            </Pressable>
          </View>

          {/* weekday headers */}
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {WEEK.map((w, i) => (
              <View key={w} style={{ flex: 1, alignItems: 'center' }}>
                <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: i === 5 ? '#E8C96A' : d.faint }}>{w.toUpperCase()}</T>
              </View>
            ))}
          </View>

          {/* days */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: grid.startOffset }).map((_, i) => (
              <View key={`pad${i}`} style={{ width: '14.28%', height: 52 }} />
            ))}
            {grid.days.map((day) => {
              const isToday = day.g.toDateString() === today.toDateString();
              const hasOcc = !!day.occasion;
              return (
                <View key={day.g.toISOString()} style={{ width: '14.28%', height: 52, alignItems: 'center', justifyContent: 'center', padding: 1.5 }}>
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isToday ? (isDark ? '#1F8F5C' : '#1D6F42') : hasOcc ? (isDark ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.1)') : d.bgSoft,
                      borderWidth: hasOcc && !isToday ? 1 : 0,
                      borderColor: 'rgba(212,175,55,0.45)',
                    }}
                  >
                    <T v="body" style={{ fontSize: 13, fontWeight: '800', color: isToday ? '#FFFFFF' : d.text }}>{day.hd}</T>
                    <T v="caption" style={{ fontSize: 7.5, color: isToday ? 'rgba(255,255,255,0.8)' : d.faint }}>{day.g.getDate()}/{day.g.getMonth() + 1}</T>
                    {hasOcc ? <FontAwesome5 name={(day.icon ?? 'star') as never} size={6} color={isToday ? '#FFFFFF' : '#E8C96A'} style={{ marginTop: 0.5 }} /> : null}
                  </View>
                </View>
              );
            })}
          </View>
          <T v="caption" style={{ fontSize: 8.5, color: d.faint, textAlign: 'center', marginTop: 8 }}>
            Gold days carry an islamic occasion · dates follow the Umm al-Qura estimate — your local moon sighting may differ by a day
          </T>
        </View>

        {/* upcoming occasions */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6, color: d.faint, marginHorizontal: 18, marginTop: 16, marginBottom: 8 }}>UPCOMING OCCASIONS</T>
        {upcoming.map((o) => {
          const days = Math.ceil(((o.date as Date).getTime() - today.getTime()) / 864e5);
          return (
            <View key={o.label} style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name={o.icon as never} size={13} color="#E8C96A" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>{o.label}</T>
                <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>
                  {o.d} {HIJRI_MONTHS[o.m - 1]} · {(o.date as Date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </T>
              </View>
              <View style={{ borderRadius: 999, backgroundColor: isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', paddingHorizontal: 10, paddingVertical: 4 }}>
                <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{days === 0 ? 'Today' : `${days}d`}</T>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
