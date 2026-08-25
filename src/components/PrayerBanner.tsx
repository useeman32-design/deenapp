import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  computePrayerTimes,
  formatHijri,
  formatTime,
  hijriDate,
  HIJRI_WEEKDAYS,
  nextPrayer,
  type PrayerName,
} from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { useTheme } from '@/context/ThemeContext';

type BannerState = {
  name: PrayerName;
  time: Date;
  countdown: string;
  hijri: string;
  weekday: string;
  location: string;
};

export function PrayerBanner() {
  const { theme } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<BannerState | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    resolveLocation().then((loc: Loc) => {
      if (!alive) return;
      const tick = () => {
        const now = new Date();
        const times = computePrayerTimes(now, loc);
        const np = nextPrayer(now, times);
        const h = hijriDate(now);
        const diff = Math.max(0, np.time.getTime() - now.getTime());
        const hh = Math.floor(diff / 3600000);
        const mm = Math.floor(diff / 60000) % 60;
        const ss = Math.floor(diff / 1000) % 60;
        setData({
          name: np.name,
          time: np.time,
          countdown: [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':'),
          hijri: formatHijri(now),
          weekday: HIJRI_WEEKDAYS[h.weekday],
          location: loc.name,
        });
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    });
    return () => {
      alive = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <Pressable
      onPress={() => router.push('/tools/prayer')}
      style={{
        backgroundColor: theme.primary,
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
      }}
    >
      {data ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' }}>
              NEXT PRAYER · {data.weekday.toUpperCase()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
              <Text style={{ color: '#fff', fontSize: 25, fontWeight: '800' }}>{data.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 17, fontWeight: '700', marginLeft: 10 }}>
                {formatTime(data.time)}
              </Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginTop: 6 }}>
              {data.hijri} · {data.location}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700' }}>COUNTDOWN</Text>
            <Text
              style={{
                color: '#fff',
                fontSize: 21,
                fontWeight: '800',
                marginTop: 5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {data.countdown}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>Calculating prayer times…</Text>
      )}
    </Pressable>
  );
}
