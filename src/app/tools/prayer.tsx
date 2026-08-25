import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  computePrayerTimes,
  formatHijri,
  formatTime,
  nextPrayer,
  PRAYER_NAMES,
  qiblaDirection,
} from '@/lib/prayer';
import { resetLocation, resolveLocation, type Loc } from '@/lib/location';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';

export default function PrayerTimes() {
  const { theme } = useTheme();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [times, setTimes] = useState<Date[] | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    resolveLocation().then(setLoc);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (loc) setTimes(computePrayerTimes(now, loc));
  }, [loc, now]);

  const refresh = async () => setLoc(await resetLocation());

  if (!loc || !times) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <TopBar title="Prayer Times" />
        <Text style={{ color: theme.subtext, textAlign: 'center', marginTop: 40, fontSize: 13.5 }}>
          Locating you…
        </Text>
      </View>
    );
  }

  const np = nextPrayer(now, times);
  const qibla = qiblaDirection(loc);

  const iconFor = (name: string) =>
    name === 'Sunrise' ? '🌅' : name === 'Maghrib' ? '🌇' : name === 'Isha' ? '🌙' : name === 'Fajr' ? '🌄' : '☀️';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar
        title="Prayer Times"
        subtitle={`${loc.name}${loc.isFallback ? ' (default — tap ↻ for your location)' : ''}`}
        right={
          <Pressable onPress={refresh} hitSlop={10}>
            <Text style={{ color: theme.primary, fontSize: 20, fontWeight: '700' }}>↻</Text>
          </Pressable>
        }
      />
      <View style={{ padding: 16 }}>
        <Card style={{ backgroundColor: theme.primarySoft, borderColor: 'transparent', marginBottom: 10 }}>
          <Text style={{ color: theme.subtext, fontSize: 11.5, fontWeight: '700' }}>{formatHijri(now)}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 19 }}>Next: {np.name}</Text>
            <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 19 }}>{formatTime(np.time)}</Text>
          </View>
        </Card>

        {PRAYER_NAMES.map((name, i) => {
          const isNext = i === np.index;
          const past = times[i] <= now;
          return (
            <Card
              key={name}
              style={{
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isNext ? theme.primary : theme.card,
                borderColor: isNext ? theme.primary : theme.border,
              }}
            >
              <Text style={{ fontSize: 19, width: 36, textAlign: 'center' }}>{iconFor(name)}</Text>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: isNext ? '#fff' : theme.text, fontWeight: '800', fontSize: 15 }}>{name}</Text>
                {past && !isNext ? (
                  <Text style={{ color: isNext ? 'rgba(255,255,255,0.7)' : theme.subtext, fontSize: 11 }}>
                    passed
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: isNext ? '#fff' : theme.text, fontWeight: '700', fontSize: 15 }}>
                {formatTime(times[i])}
              </Text>
            </Card>
          );
        })}

        <Card style={{ marginTop: 14, alignItems: 'center' }}>
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 37,
              backgroundColor: theme.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 30, transform: [{ rotate: `${qibla}deg` }] }}>🧭</Text>
          </View>
          <Text style={{ color: theme.text, fontWeight: '700', marginTop: 10, fontSize: 14.5 }}>
            Qibla: {qibla.toFixed(1)}° from north
          </Text>
          <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 4 }}>
            Face this angle from true north toward the Ka’bah
          </Text>
        </Card>
      </View>
    </View>
  );
}
