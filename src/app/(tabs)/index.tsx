import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { computePrayerTimes, formatTime, nextPrayer } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { storage } from '@/lib/storage';
import { ArchCard } from '@/components/ArchCard';
import { PrayerArc } from '@/components/PrayerArc';
import { Avatar } from '@/components/Avatar';
import { T } from '@/components/T';
import { SectionHeader } from '@/components/SectionHeader';
import {
  BeadsIcon,
  BellIcon,
  BookIcon,
  CalendarIcon,
  ClockIcon,
  CompassIcon,
  FlameIcon,
  HeartIcon,
  MedalIcon,
  PinIcon,
  ScrollIcon,
  TargetIcon,
} from '@/components/Icons';

const QUICK = [
  { label: 'Quran', icon: BookIcon, href: '/(tabs)/quran' },
  { label: 'Hadith', icon: ScrollIcon, href: '/tools/hadith' },
  { label: 'Duas', icon: HeartIcon, href: '/tools/dua' },
  { label: 'Tasbeeh', icon: BeadsIcon, href: '/tools/tasbeeh' },
  { label: 'Prayers', icon: ClockIcon, href: '/tools/prayer' },
  { label: 'Calendar', icon: CalendarIcon, href: '/tools/calendar' },
] as const;

export default function Home() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [dhikrTotal, setDhikrTotal] = useState(160);

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
          const total = Object.values(c).reduce((a, b) => a + (Number(b) || 0), 0);
          if (total > 0) setDhikrTotal(total);
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
            <T v="caption">Assalamu’alaikum,</T>
            <T v="h2" style={{ marginTop: 2 }}>
              {user?.name ?? 'friend'} 👋
            </T>
          </View>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BellIcon size={18} color={theme.subtext} />
            <View style={{ position: 'absolute', top: 9, right: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent }} />
          </View>
        </View>

        {/* Next prayer */}
        <ArchCard style={{ marginTop: 18 }} archHeight={58} strokeColor={theme.accent} strokeWidth={1.3} padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T v="meta" color="accent" uppercase style={{ letterSpacing: 1.2 }}>
                Next prayer
              </T>
              <T v="display" style={{ marginTop: 6 }}>
                {np?.name ?? '—'}
              </T>
              <T v="stat" color="primary" style={{ marginTop: 2 }}>
                {np ? formatTime(np.time) : ''}
              </T>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 10,
                  backgroundColor: theme.primarySoft,
                  borderRadius: 999,
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  alignSelf: 'flex-start',
                }}
              >
                <ClockIcon size={13} color={theme.primary} />
                <T v="caption" color="primary" style={{ fontWeight: '700' }}>
                  in {hh > 0 ? `${hh}h ${mm}m` : `${mm}m`}
                </T>
              </View>
            </View>
            {times ? <PrayerArc times={times} nextIndex={np?.index ?? 0} size={152} /> : null}
          </View>
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 13 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <PinIcon size={14} color={theme.subtext} />
              <T v="caption">{loc?.name ?? 'Locating…'}</T>
            </View>
            <Link href="/(tabs)/qibla" asChild>
              <Pressable
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderWidth: 1.2,
                  borderColor: theme.primary,
                  borderRadius: 999,
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  backgroundColor: pressed ? theme.primarySoft : 'transparent',
                })}
              >
                <CompassIcon size={14} color={theme.primary} />
                <T v="caption" color="primary" style={{ fontWeight: '800' }}>
                  Qibla
                </T>
              </Pressable>
            </Link>
          </View>
        </ArchCard>

        {/* Quick actions */}
        <SectionHeader title="Tools" subtitle="Your daily essentials" action="See all" onAction={() => router.push('/(tabs)/tools')} style={{ marginTop: 24 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Link key={q.label} href={q.href} asChild>
                <Pressable
                  style={({ pressed }) => ({
                    flexBasis: '31.6%',
                    flexGrow: 1,
                    backgroundColor: theme.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: 13,
                    alignItems: 'center',
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 13,
                      backgroundColor: theme.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} color={theme.primary} />
                  </View>
                  <T v="caption" style={{ marginTop: 8, fontWeight: '600' }}>{q.label}</T>
                </Pressable>
              </Link>
            );
          })}
        </View>

        {/* Daily progress */}
        <SectionHeader title="Today" style={{ marginTop: 24 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { icon: <FlameIcon size={17} color={theme.accent} />, tile: theme.accentSoft, value: '7', label: 'Day streak', pct: 70, tint: theme.accent },
            { icon: <TargetIcon size={17} color={theme.primary} />, tile: theme.primarySoft, value: `${goalPct}%`, label: 'Goals', pct: goalPct, tint: theme.primary },
            { icon: <MedalIcon size={17} color={theme.accent} />, tile: theme.accentSoft, value: '3', label: 'Awards', pct: 45, tint: theme.accent },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: theme.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 13,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: s.tile, alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </View>
              <T v="stat" style={{ marginTop: 9, fontSize: 18 }}>{s.value}</T>
              <T v="caption" style={{ marginTop: 2 }}>{s.label}</T>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.border, marginTop: 9, overflow: 'hidden' }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: s.tint, width: `${s.pct}%` }} />
              </View>
            </View>
          ))}
        </View>

        {/* Daily hadith */}
        <ArchCard style={{ marginTop: 20 }} archHeight={48} strokeColor={theme.accent} strokeWidth={1.1} padding={16}>
          <T v="meta" color="accent" uppercase style={{ textAlign: 'center', letterSpacing: 1.2 }}>
            Daily hadith
          </T>
          <T v="arabic" style={{ textAlign: 'center', marginTop: 12 }}>
            إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ
          </T>
          <T v="caption" style={{ marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
            “The deeds are (judged) by intentions.” — Bukhari 1
          </T>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
            <Link href="/tools/hadith" asChild>
              <Pressable hitSlop={6}>
                <T v="caption" color="primary" style={{ fontWeight: '800' }}>
                  Read more →
                </T>
              </Pressable>
            </Link>
          </View>
        </ArchCard>
      </ScrollView>
    </View>
  );
}
