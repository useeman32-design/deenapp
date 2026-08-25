import { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { computePrayerTimes, formatTime, nextPrayer } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { storage } from '@/lib/storage';
import { ArchCard } from '@/components/ArchCard';
import { PrayerArc } from '@/components/PrayerArc';
import { Avatar } from '@/components/Avatar';
import {
  BeadsIcon,
  BellIcon,
  BookIcon,
  CalendarIcon,
  CompassIcon,
  FlameIcon,
  HeartIcon,
  MedalIcon,
  ScrollIcon,
  TargetIcon,
} from '@/components/Icons';

const QUICK = [
  { label: 'Quran', icon: BookIcon, href: '/(tabs)/quran' },
  { label: 'Hadith', icon: ScrollIcon, href: '/tools/hadith' },
  { label: 'Duas', icon: HeartIcon, href: '/tools/dua' },
  { label: 'Tasbeeh', icon: BeadsIcon, href: '/tools/tasbeeh' },
  { label: 'Calendar', icon: CalendarIcon, href: '/tools/calendar' },
] as const;

export default function Home() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [dhikrTotal, setDhikrTotal] = useState(0);

  useEffect(() => {
    resolveLocation().then(setLoc);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    storage.getItem('dl.tasbeeh').then((raw) => {
      if (raw) {
        try {
          const c = JSON.parse(raw) as Record<string, number>;
          setDhikrTotal(Object.values(c).reduce((a, b) => a + (Number(b) || 0), 0));
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const times = loc ? computePrayerTimes(now, loc) : null;
  const np = times ? nextPrayer(now, times) : null;
  const diff = np ? Math.max(0, np.time.getTime() - now.getTime()) : 0;
  const hh = Math.floor(diff / 3600000);
  const mm = Math.floor(diff / 60000) % 60;
  const goalPct = Math.min(100, Math.round((dhikrTotal / 200) * 100));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 2,
              borderColor: theme.primary,
              backgroundColor: theme.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Avatar name={user?.name ?? 'U'} color={theme.primary} size={34} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: theme.subtext, fontSize: 12 }}>Assalamu’alaikum,</Text>
            <Text style={{ color: theme.heading, fontSize: 16.5, fontWeight: '800', marginTop: 1 }}>
              {user?.name ?? 'friend'} 👋
            </Text>
            <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 2 }}>May Allah bless your day</Text>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BellIcon size={18} color={theme.subtext} />
          </View>
        </View>

        {/* Next prayer */}
        <ArchCard style={{ marginTop: 16 }} archHeight={54} strokeColor={theme.accent} strokeWidth={1.3}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.subtext, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>
                NEXT PRAYER
              </Text>
              <Text style={{ color: theme.heading, fontSize: 27, fontWeight: '800', marginTop: 5 }}>
                {np?.name ?? '—'}
              </Text>
              <Text style={{ color: theme.primary, fontSize: 16.5, fontWeight: '800', marginTop: 2 }}>
                {np ? formatTime(np.time) : ''}
              </Text>
              <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 6 }}>
                {hh > 0 ? `${hh}h ${mm}m` : `${mm}m`} to next prayer
              </Text>
              <Link href="/(tabs)/qibla" asChild>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    marginTop: 13,
                    borderWidth: 1.2,
                    borderColor: theme.primary,
                    borderRadius: 12,
                    paddingHorizontal: 13,
                    paddingVertical: 8,
                    alignSelf: 'flex-start',
                    backgroundColor: theme.primarySoft,
                  }}
                >
                  <CompassIcon size={15} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>Qibla Finder</Text>
                </View>
              </Link>
            </View>
            {times ? <PrayerArc times={times} nextIndex={np?.index ?? 0} size={156} /> : null}
          </View>
        </ArchCard>

        {/* Quick access */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }}>
          <Text style={{ color: theme.heading, fontSize: 16.5, fontWeight: '800' }}>Quick Access</Text>
          <Link href="/(tabs)/tools">
            <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>See All ›</Text>
          </Link>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Link key={q.label} href={q.href} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={22} color={q.label === 'Quran' ? theme.accent : theme.primary} />
                </View>
                <Text style={{ color: theme.subtext, fontSize: 10.5, marginTop: 7, fontWeight: '700' }}>{q.label}</Text>
              </Link>
            );
          })}
        </View>

        {/* Daily progress */}
        <Text style={{ color: theme.heading, fontSize: 16.5, fontWeight: '800', marginTop: 24, marginBottom: 12 }}>
          Daily Progress
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { icon: <FlameIcon size={20} color={theme.accent} />, value: '7', label: 'Day Streak' },
            { icon: <TargetIcon size={20} color={theme.primary} />, value: `${goalPct}%`, label: 'Goals' },
            { icon: <MedalIcon size={20} color={theme.accent} />, value: '3', label: 'Achievements' },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: theme.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 14,
                alignItems: 'center',
              }}
            >
              {s.icon}
              <Text style={{ color: theme.heading, fontSize: 19, fontWeight: '800', marginTop: 7 }}>{s.value}</Text>
              <Text style={{ color: theme.subtext, fontSize: 10.5, marginTop: 3, fontWeight: '600' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Daily hadith teaser */}
        <ArchCard style={{ marginTop: 20 }} archHeight={46} strokeColor={theme.accent} strokeWidth={1.1}>
          <Text style={{ color: theme.subtext, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>DAILY HADITH</Text>
          <Text style={{ color: theme.text, fontSize: 19, textAlign: 'center', marginTop: 10, lineHeight: 30 }}>
            إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ
          </Text>
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 8, fontStyle: 'italic', textAlign: 'center' }}>
            “The deeds are (judged) by intentions.” — Sahih Bukhari 1
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 6 }}>
            <Link href="/tools/hadith" asChild>
              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>Read more ›</Text>
            </Link>
          </View>
        </ArchCard>
      </ScrollView>
    </View>
  );
}
