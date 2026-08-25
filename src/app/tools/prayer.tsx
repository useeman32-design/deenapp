import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { computePrayerTimes, formatTime, nextPrayer, PRAYER_NAMES, qiblaDirection } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { useTheme } from '@/context/ThemeContext';
import { TopBar } from '@/components/TopBar';
import { CompassIcon, MosqueIcon } from '@/components/Icons';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PrayerTimes() {
  const { theme } = useTheme();
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
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.subtext, fontSize: 13 }}>Locating you…</Text>
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

  const rows = [
    ...PRAYER_NAMES.map((name, i) => ({ name, time: times[i], sunrise: name === 'Sunrise' })),
    ...(isFriday ? [{ name: 'Jumu’ah' as const, time: jumuahTime, sunrise: false, jumuah: true }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar
        title="Prayer Times"
        subtitle={`${selDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${loc.name}`}
      />
      <View style={{ padding: 16 }}>
        {/* Date strip */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: theme.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 8,
            marginBottom: 14,
          }}
        >
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
                  borderRadius: 13,
                  backgroundColor: selected ? theme.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: selected ? 'rgba(255,255,255,0.8)' : theme.subtext,
                    fontSize: 10.5,
                    fontWeight: '700',
                  }}
                >
                  {DAY_NAMES[d.getDay()]}
                </Text>
                <Text
                  style={{
                    color: selected ? '#fff' : today ? theme.primary : theme.text,
                    fontSize: 15,
                    fontWeight: '800',
                    marginTop: 3,
                  }}
                >
                  {d.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Prayer list */}
        {rows.map((r) => {
          const isNext = np && r.name === np.name;
          const index = PRAYER_NAMES.indexOf(r.name as (typeof PRAYER_NAMES)[number]);
          const past = isToday && times[index] <= now;
          return (
            <View
              key={r.name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isNext ? theme.primarySoft : theme.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isNext ? theme.primary : theme.border,
                paddingVertical: 13,
                paddingHorizontal: 14,
                marginBottom: 8,
              }}
            >
              {'jumuah' in r && r.jumuah ? (
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <MosqueIcon size={17} color={theme.accent} />
                </View>
              ) : null}
              <View style={{ flex: 1, marginLeft: 'jumuah' in r && r.jumuah ? 12 : 0 }}>
                <Text style={{ color: isNext ? theme.primaryDark : theme.text, fontWeight: '800', fontSize: 14.5 }}>
                  {r.name}
                </Text>
                {past && !isNext ? (
                  <Text style={{ color: theme.subtext, fontSize: 11 }}>passed</Text>
                ) : isNext ? (
                  <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700' }}>Next prayer</Text>
                ) : null}
              </View>
              <Text
                style={{
                  color: isNext ? theme.primary : theme.text,
                  fontWeight: isNext ? '800' : '600',
                  fontSize: 14.5,
                }}
              >
                {formatTime(r.time)}
              </Text>
            </View>
          );
        })}

        <Link href="/(tabs)/qibla" asChild>
          <View
            style={{
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
            }}
          >
            <CompassIcon size={17} color={theme.primary} />
            <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 13 }}>Open Qibla Finder</Text>
          </View>
        </Link>

        <Text style={{ color: theme.subtext, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
          Muslim World League method · Shafi madhab · Qibla {qiblaDirection(loc).toFixed(1)}°
        </Text>
      </View>
    </View>
  );
}
