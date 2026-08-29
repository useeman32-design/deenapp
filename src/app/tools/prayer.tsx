import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { computePrayerTimes, formatTime, nextPrayer, PRAYER_NAMES, qiblaDirection } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { useTheme } from '@/context/ThemeContext';
import { Surface } from '@/components/Surface';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { CompassIcon, MosqueIcon } from '@/components/Icons';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PrayerTimes() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [loc, setLoc] = useState<Loc | null>(null);
  const [offset, setOffset] = useState(0); // days from today, -3..+3

  useEffect(() => {
    resolveLocation().then(setLoc);
  }, []);

  const selDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(12, 0, 0, 0);
    return d;
  }, [offset]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  if (!loc) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center' }}>
        <T v="caption">Locating you…</T>
      </View>
    );
  }

  const times = computePrayerTimes(selDate, loc);
  const isToday = offset === 0;
  const now = new Date();
  const np = isToday ? nextPrayer(now, times) : null;
  const isFriday = selDate.getDay() === 5;

  const jumuahTime = (() => {
    const d = new Date(selDate);
    d.setHours(13, 15, 0, 0);
    return d;
  })();

  const rows: { name: string; time: Date; jumuah?: boolean }[] = [
    ...PRAYER_NAMES.map((name, i) => ({ name, time: times[i] })),
    ...(isFriday ? [{ name: 'Jumu’ah', time: jumuahTime, jumuah: true }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar
        title="Prayer times"
        subtitle={`${selDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${loc.name}`}
      />
      <View style={{ padding: 16 }}>
        {/* Date strip */}
        <Surface style={{ flexDirection: 'row', padding: 7, marginBottom: 14 }}>
          {days.map((d, i) => {
            const off = i - 3;
            const selected = off === offset;
            const today = i === 3;
            return (
              <Pressable
                key={i}
                onPress={() => setOffset(off)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: selected ? theme.primary : 'transparent',
                }}
              >
                <T
                  v="meta"
                  style={{ letterSpacing: 0.5, color: selected ? 'rgba(255,255,255,0.85)' : theme.subtext }}
                >
                  {DAY_NAMES[d.getDay()]}
                </T>
                <T
                  v="h3"
                  style={{ color: selected ? '#fff' : today ? theme.primary : theme.text }}
                >
                  {d.getDate()}
                </T>
              </Pressable>
            );
          })}
        </Surface>

        {/* Prayer list */}
        {rows.map((r) => {
          const isNext = np && r.name === np.name;
          const index = PRAYER_NAMES.indexOf(r.name as (typeof PRAYER_NAMES)[number]);
          const past = isToday && index >= 0 && times[index] <= now;
          return (
            <View
              key={r.name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isNext ? theme.primarySoft : theme.card,
                borderRadius: 14,
                borderWidth: 1.2,
                borderColor: isNext ? theme.primary : theme.border,
                paddingVertical: 13,
                paddingHorizontal: 14,
                marginBottom: 8,
              }}
            >
              {r.jumuah ? (
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
                  <MosqueIcon size={17} color={theme.accent} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <T v="h3" color={isNext ? 'primary' : 'text'}>
                  {r.name}
                </T>
                {past && !isNext ? <T v="caption" style={{ marginTop: 1 }}>passed</T> : null}
                {isNext ? (
                  <T v="caption" color="primary" style={{ marginTop: 1, fontWeight: '700' }}>
                    next prayer
                  </T>
                ) : null}
              </View>
              <T v={isNext ? 'stat' : 'h3'} color={isNext ? 'primary' : 'text'} style={{ fontSize: isNext ? 18 : 15 }}>
                {formatTime(r.time)}
              </T>
            </View>
          );
        })}

        <Link href="/(tabs)/qibla" asChild>
          <Pressable
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: theme.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 14,
              marginTop: 4,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <CompassIcon size={17} color={theme.primary} />
            <T v="bodyS" color="primary" style={{ fontWeight: '700' }}>
              Open Qibla Finder
            </T>
          </Pressable>
        </Link>

        <T v="caption" style={{ textAlign: 'center', marginTop: 14, lineHeight: 17 }}>
          Muslim World League · Shafi madhab · Qibla {qiblaDirection(loc).toFixed(1)}°
        </T>
      </View>
    </View>
  );
}
