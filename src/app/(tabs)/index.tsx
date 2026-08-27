import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient as SvgRadial, LinearGradient as SvgLinear, Stop } from 'react-native-svg';

import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { getGoal, getStreak } from '@/lib/routine';
import { computePrayerTimes, formatTime, nextPrayer } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { T } from '@/components/T';
import * as api from '@/api/client';
import type { Post, Scholar, Video } from '@/api/types';
import { MOCK_FEED, MOCK_SCHOLARS, MOCK_VIDEOS } from '@/api/mocks';
import { storage } from '@/lib/storage';
import { DEFAULT_QUICK, QUICK_STORAGE_KEY, quickItems, type QuickItem } from '@/lib/quick-access';
import { BeadsIcon } from '@/components/Icons';

/** Soft radial glow (SVG-based, works on all platforms). */
function Glow({ size, color, id, opacity = 0.35 }: { size: number; color: string; id: string; opacity?: number }) {
  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Defs>
        <SvgRadial id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </SvgRadial>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

const mecca = require('../../../assets/img/mecca.jpg');
const patternDark = require('../../../assets/img/pattern-dark.png');
const patternLight = require('../../../assets/img/pattern-light.png');

/** Read the user's saved Quick-Access shortcuts (falls back to the default five). */
function useQuickAccess(): QuickItem[] {
  const [keys, setKeys] = useState<string[]>(DEFAULT_QUICK);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      storage.getItem(QUICK_STORAGE_KEY).then((raw) => {
        if (!alive || !raw) return;
        try {
          const arr = JSON.parse(raw) as string[];
          const items = quickItems(arr);
          if (items.length) setKeys(items.map((i) => i.key));
        } catch {
          /* ignore corrupt data */
        }
      });
      return () => {
        alive = false;
      };
    }, [])
  );
  return quickItems(keys);
}

/* ------------------------------ Campaigns ------------------------------ */

const CAMPAIGNS = [
  {
    title: 'Finish the Qur\'an',
    sub: 'One surah a day — keep the chain alive.',
    icon: 'quran' as const,
    accent: '#F1C40F',
    from: '#0E2A1C',
    to: '#123B26',
    href: '/(tabs)/quran',
  },
  {
    title: 'Ramadan Countdown',
    sub: 'Start your preparation streak today.',
    icon: 'moon' as const,
    accent: '#5BE59B',
    from: '#0F1F2C',
    to: '#14301F',
    href: '/tools/calendar',
  },
  {
    title: 'Ask a Scholar',
    sub: 'Verified answers from the scholars.',
    icon: 'user-graduate' as const,
    accent: '#F1C40F',
    from: '#2A2410',
    to: '#14291C',
    href: '/tools/scholars',
  },
];

const DAILY_AYAH = {
  arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',
  meaning: 'For indeed, with hardship [will be] ease.',
  ref: 'Ash-Sharh 94:6',
};

const DAILY_HADITH = {
  arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
  meaning: 'Actions are only by intentions.',
  ref: 'Sahih al-Bukhari 1',
};

function initialsOf(name?: string | null) {
  const parts = (name ?? 'U').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U';
}

function fmtViews(n?: number | null) {
  if (!n) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

export default function Home() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const quick = useQuickAccess();

  const [loc, setLoc] = useState<Loc | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [streak, setStreak] = useState({ days: 0, demo: true });
  const [goal, setGoal] = useState<{ done: number; total: number; demo: boolean }>({ done: 0, total: 4, demo: true });
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followed, setFollowed] = useState<number[]>([]);

  useEffect(() => {
    api.scholars().then((r) => setScholars(r.length ? r : MOCK_SCHOLARS)).catch(() => setScholars(MOCK_SCHOLARS));
    api.videos('daily').then((r) => setVideos(r.length ? r : MOCK_VIDEOS)).catch(() => setVideos(MOCK_VIDEOS));
    api.feed('for-you').then((r) => setPosts(r.posts && r.posts.length ? r.posts : MOCK_FEED)).catch(() => setPosts(MOCK_FEED));
  }, []);

  const toggleFollow = (id: number) =>
    setFollowed((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  useEffect(() => {
    resolveLocation().then(setLoc);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const refreshProgress = useCallback(() => {
    getStreak().then(setStreak);
    getGoal().then((g) => setGoal({ done: g.done, total: g.total, demo: g.demo }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshProgress();
    }, [refreshProgress]),
  );

  const times = loc ? computePrayerTimes(now, loc) : null;
  const np = useMemo(() => {
    if (!times) return null;
    const n = nextPrayer(now, times);
    if (n.index !== 1) return n; // never "Sunrise"
    return nextPrayer(n.time, times);
  }, [times, now]);

  const countdown = useMemo(() => {
    if (!np) return '—';
    let diff = np.time.getTime() - now.getTime();
    if (diff <= 0) diff += 24 * 3600 * 1000;
    const s = Math.floor(diff / 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}h ${p(Math.floor((s % 3600) / 60))}m ${p(s % 60)}s remaining`;
  }, [now, np]);

  const firstName = (user?.full_name as string | undefined)?.split(/\s+/)[0] ?? 'Abdulrahman';

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={undefined}
      >
        {/* subtle arabesque pattern behind the header */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 230, overflow: 'hidden' }}>
          <Image
            source={isDark ? patternDark : patternLight}
            style={{ width: '100%', height: '100%', opacity: d.patternOpacity * 0.5, resizeMode: 'cover' }}
          />
          <LinearGradient
            colors={['transparent', d.bg] as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', inset: 0 }}
          />
        </View>

        {/* 1 ─ Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: insets.top + 8 }}>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 1.5,
              borderColor: d.gold,
              backgroundColor: d.card,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <T v="h3" style={{ color: d.gold, fontWeight: '700', fontSize: 16 }}>
              {(firstName || 'A').slice(0, 1).toUpperCase()}
            </T>
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <T v="caption" style={{ color: d.subtext, fontSize: 11.5 }}>
              Assalamu Alaikum,
            </T>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 17, marginTop: 1 }}>
              {firstName} <T v="h2" style={{ fontSize: 15 }}>👋</T>
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              May Allah bless your day
            </T>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => ({
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: d.cardBorder,
              backgroundColor: d.card,
              alignItems: 'center',
              justifyContent: 'center',
              marginEnd: 10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <FontAwesome5 name="bell" size={15} color={d.text} />
            <View
              style={{
                position: 'absolute',
                top: 7,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#E67E22',
                borderWidth: 1.5,
                borderColor: d.bg,
              }}
            />
          </Pressable>
          <Pressable
            onPress={() => setSearchOpen(true)}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: d.cardBorder,
              backgroundColor: d.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <FontAwesome5 name="search" size={15} color={d.text} />
          </Pressable>
        </View>

        {/* 2 ─ Prayer times hero card */}
        <View style={{ marginHorizontal: 16, borderRadius: 26, overflow: 'hidden', backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder }}>
          <View style={{ position: 'relative', padding: 18, paddingBottom: 12 }}>
            <Image source={mecca} style={{ position: 'absolute', width: '100%', height: '100%', transform: [{ scale: 1.12 }] }} resizeMode="cover" />
            <LinearGradient
              colors={[d.heroTop, d.heroBottom] as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.55, y: 1 }}
              style={{ position: 'absolute', inset: 0 }}
            />
            <View style={{ position: 'relative' }}>
              {/* identity row */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 42, height: 42, borderRadius: 21 }}>
                  <Glow size={68} color={isDark ? d.emerald : '#5BE59B'} id="glow-mosque" opacity={0.45} />
                  <View
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 21,
                      borderWidth: 1,
                      borderColor: isDark ? `${d.emerald}59` : 'rgba(91,229,155,0.45)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FontAwesome5 name="mosque" size={19} color={isDark ? d.emerald : '#5BE59B'} />
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <T v="meta" style={{ color: 'rgba(255,255,255,0.65)', letterSpacing: 1.4, fontSize: 9.5 }}>
                    NEXT PRAYER
                  </T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <T v="display" style={{ color: '#FFFFFF', fontSize: 23, fontWeight: '700' }}>
                      {np?.name ?? '—'}
                    </T>
                    <PulseDot color={isDark ? d.emerald : '#5BE59B'} />
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.2)',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <FontAwesome5 name="map-marker-alt" size={10} color={isDark ? d.emerald : '#5BE59B'} />
                  <T v="caption" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' }}>
                    {loc ? loc.name.split(',').slice(0, 2).join(',') : 'Locating…'}
                  </T>
                </View>
              </View>

              {/* time + qibla */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 }}>
                <View>
                  <T v="display" style={{ color: isDark ? d.emerald : '#5BE59B', fontSize: 24, fontWeight: '700' }}>
                    {np ? formatTime(np.time) : '—'}
                  </T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                    <FontAwesome5 name="clock" size={10} color={d.goldBright} />
                    <T v="bodyS" style={{ color: d.goldBright, fontSize: 11.5, fontWeight: '500' }}>
                      {countdown}
                    </T>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/tools/qibla')}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: `${d.gold}99`,
                    backgroundColor: `${d.gold}14`,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <FontAwesome5 name="kaaba" size={12} color={d.goldBright} />
                  <T v="button" style={{ color: d.goldBright, fontSize: 12, fontWeight: '600' }}>
                    Qibla Finder
                  </T>
                </Pressable>
              </View>

              {/* sun path — real time-based day arc */}
              <View style={{ marginTop: 16 }}>
                <SunPath times={times} now={now} nextIndex={np?.index ?? null} />
              </View>
            </View>
          </View>
        </View>

        {/* 3 ─ Quick Access */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Quick Access
            </T>
            <Pressable onPress={() => router.push('/settings/quick-access')} hitSlop={8}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: pressed ? 0.6 : 1 })}>
              <FontAwesome5 name="edit" size={10} color={d.faint} />
              <T v="caption" style={{ color: d.faint, fontSize: 11.5 }}>
                Edit
              </T>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
            {quick.map((it) => (
              <QuickTile key={it.key} item={it} onPress={() => router.push(it.href as never)} />
            ))}
          </ScrollView>
        </View>

        {/* 4 ─ Daily Progress */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5, marginBottom: 12 }}>
            Daily Progress
          </T>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Quran streak */}
            <View style={{ flex: 1, borderRadius: 20, backgroundColor: d.card, borderWidth: 1, borderColor: d.greenBorder, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <FontAwesome5 name="fire" size={13} color={d.goldBright} />
                <T v="bodyS" style={{ color: d.text, fontWeight: '600', fontSize: 12.5 }}>
                  Quran Streak
                </T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                    <T v="display" style={{ color: d.text, fontSize: 26, fontWeight: '700' }}>
                      {streak.days}
                    </T>
                    <T v="caption" style={{ color: d.subtext, fontSize: 11 }}>
                      days
                    </T>
                  </View>
                  <T v="caption" style={{ color: d.emerald, fontSize: 10.5, fontWeight: '600', marginTop: 4 }}>
                    Keep it going!
                  </T>
                </View>
                <ProgressRing
                  size={52}
                  progress={streak.days === 0 ? 0 : (streak.days % 7) / 7 || 1}
                  color={d.emerald}
                  icon={<FontAwesome5 name="quran" size={15} color={d.emerald} />}
                />
              </View>
            </View>

            {/* Today's goal */}
            <View style={{ flex: 1, borderRadius: 20, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <FontAwesome5 name="bullseye" size={13} color={d.gold} />
                <T v="bodyS" style={{ color: d.text, fontWeight: '600', fontSize: 12.5 }}>
                  Today’s Goal
                </T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="display" style={{ color: d.text, fontSize: 26, fontWeight: '700' }}>
                    {Math.round((goal.done / goal.total) * 100)}%
                  </T>
                  <T v="caption" style={{ color: d.subtext, fontSize: 9.5, marginTop: 4, lineHeight: 12 }}>
                    {goal.done} of {goal.total} tasks completed
                  </T>
                </View>
                <ProgressRing
                  size={52}
                  progress={goal.done / goal.total}
                  color={isDark ? d.goldBright : d.gold}
                  icon={<FontAwesome5 name="bullseye" size={15} color={isDark ? d.goldBright : d.gold} />}
                />
              </View>
            </View>
          </View>
        </View>

        {/* 5 ─ Campaign banners */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Campaigns
            </T>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
            {CAMPAIGNS.map((c) => (
              <Pressable
                key={c.title}
                onPress={() => router.push(c.href as never)}
                style={({ pressed }) => ({ width: 296, borderRadius: 20, overflow: 'hidden', opacity: pressed ? 0.9 : 1 })}
              >
                <LinearGradient
                  colors={[c.from, c.to] as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.28)' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.09)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.16)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FontAwesome5 name={c.icon} size={18} color={c.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="h3" style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' }}>
                        {c.title}
                      </T>
                      <T v="caption" style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 3 }}>
                        {c.sub}
                      </T>
                    </View>
                    <FontAwesome5 name="chevron-right" size={12} color="rgba(255,255,255,0.55)" />
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* 6 ─ Continue Learning */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Continue Learning
            </T>
            <Pressable onPress={() => router.push('/tools/courses')} hitSlop={8}>
              <T v="caption" style={{ color: d.emerald, fontSize: 11.5, fontWeight: '600' }}>
                View All <T v="caption" style={{ color: d.emerald, fontSize: 11.5 }}>→</T>
              </T>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push('/tools/courses')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 13,
              borderRadius: 20,
              backgroundColor: d.card,
              borderWidth: 1,
              borderColor: d.cardBorder,
              padding: 14,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {/* Islamic hexagon container */}
            <View style={{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }}>
              <HexBadge />
              <FontAwesome5 name="book-open" size={19} color={d.emerald} style={{ position: 'absolute' }} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h3" style={{ color: d.text, fontWeight: '600', fontSize: 14.5 }}>
                Seerah of the Prophet ﷺ
              </T>
              <T v="caption" style={{ color: d.subtext, fontSize: 11.5, marginTop: 3 }}>
                Lesson 4 • The Early Years in Makkah
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(242,247,243,0.12)' : 'rgba(24,36,32,0.1)' }}>
                  <View style={{ width: '60%', height: '100%', borderRadius: 3, backgroundColor: d.emerald }} />
                </View>
                <T v="caption" style={{ color: d.emerald, fontSize: 10.5, fontWeight: '600' }}>
                  60%
                </T>
              </View>
            </View>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: d.emerald,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: d.emerald,
                shadowOpacity: 0.5,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              <FontAwesome5 name="play" size={13} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          </Pressable>
          {/* second course */}
          <Pressable
            onPress={() => router.push('/tools/courses')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 13,
              borderRadius: 20,
              backgroundColor: d.card,
              borderWidth: 1,
              borderColor: d.cardBorder,
              padding: 14,
              marginTop: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                backgroundColor: isDark ? `${d.gold}1F` : `${d.gold}14`,
                borderWidth: 1,
                borderColor: isDark ? `${d.gold}40` : `${d.gold}33`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesome5 name="graduation-cap" size={19} color={d.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h3" style={{ color: d.text, fontWeight: '600', fontSize: 14.5 }}>
                Tajwid Essentials
              </T>
              <T v="caption" style={{ color: d.subtext, fontSize: 11.5, marginTop: 3 }}>
                Lesson 1 • The Foundation of Recitation
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(242,247,243,0.12)' : 'rgba(24,36,32,0.1)' }}>
                  <View style={{ width: '15%', height: '100%', borderRadius: 3, backgroundColor: d.gold }} />
                </View>
                <T v="caption" style={{ color: d.gold, fontSize: 10.5, fontWeight: '600' }}>
                  15%
                </T>
              </View>
            </View>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: d.gold,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: d.gold,
                shadowOpacity: 0.5,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              <FontAwesome5 name="play" size={13} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          </Pressable>
        </View>

        {/* 7 ─ Accounts to follow */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Accounts to Follow
            </T>
            <Pressable onPress={() => router.push('/tools/scholars')} hitSlop={8}>
              <T v="caption" style={{ color: d.emerald, fontSize: 11.5, fontWeight: '600' }}>
                View more <T v="caption" style={{ color: d.emerald, fontSize: 11.5 }}>→</T>
              </T>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
            {scholars.map((sc) => {
              const name = sc.display_name ?? 'Scholar';
              const isF = followed.includes(sc.id);
              return (
                <View
                  key={sc.id}
                  style={{
                    width: 122,
                    borderRadius: 18,
                    backgroundColor: d.card,
                    borderWidth: 1,
                    borderColor: d.cardBorder,
                    padding: 14,
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: isDark ? `${d.emerald}24` : `${d.emerald}16`,
                      borderWidth: 1,
                      borderColor: d.greenBorder,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T v="bodyS" style={{ color: d.emerald, fontSize: 13, fontWeight: '700' }}>
                      {initialsOf(name)}
                    </T>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <T v="bodyS" style={{ color: d.text, fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 13, width: 104 }}>
                      {name}
                    </T>
                    <T v="caption" style={{ color: d.faint, fontSize: 9, marginTop: 2, textAlign: 'center' }}>
                      {sc.institute || sc.title || 'Scholar'}
                    </T>
                  </View>
                  <Pressable
                    onPress={() => toggleFollow(sc.id)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: isF ? 'transparent' : d.greenBorder,
                      backgroundColor: isF ? d.emerald : 'transparent',
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <T v="caption" style={{ color: isF ? '#fff' : d.emerald, fontSize: 10, fontWeight: '700' }}>
                      {isF ? 'Following' : 'Follow'}
                    </T>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* 8 ─ Community / recent posts */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Recent Posts
            </T>
            <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={8}>
              <T v="caption" style={{ color: d.emerald, fontSize: 11.5, fontWeight: '600' }}>
                Go to community <T v="caption" style={{ color: d.emerald, fontSize: 11.5 }}>→</T>
              </T>
            </Pressable>
          </View>
          <View style={{ gap: 12 }}>
            {posts.slice(0, 4).map((p) => {
              const uname = p.user?.full_name || p.user?.username || 'Member';
              return (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    gap: 11,
                    backgroundColor: d.card,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: d.cardBorder,
                    padding: 13,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: isDark ? `${d.gold}22` : `${d.gold}14`,
                      borderWidth: 1,
                      borderColor: d.cardBorder,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {p.user?.profile_image_url ? (
                      <Image source={{ uri: p.user.profile_image_url }} style={{ width: 40, height: 40, borderRadius: 20 }} resizeMode="cover" />
                    ) : (
                      <T v="bodyS" style={{ color: d.gold, fontSize: 12, fontWeight: '700' }}>
                        {initialsOf(uname)}
                      </T>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <T v="bodyS" style={{ color: d.text, fontSize: 11.5, fontWeight: '600', flexShrink: 1 }}>
                        {uname}
                      </T>
                      {p.time_ago ? (
                        <T v="caption" style={{ color: d.faint, fontSize: 9.5 }}>
                          • {p.time_ago}
                        </T>
                      ) : null}
                    </View>
                    {p.content_text ? (
                      <T v="bodyS" style={{ color: d.subtext, fontSize: 11.5, marginTop: 4, lineHeight: 15 }}>
                        {p.content_text.length > 160 ? `${p.content_text.slice(0, 160)}…` : p.content_text}
                      </T>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <FontAwesome5 name="heart" size={10} color={d.faint} />
                        <T v="caption" style={{ color: d.faint, fontSize: 10 }}>
                          {p.like_count ?? 0}
                        </T>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <FontAwesome5 name="comment" size={10} color={d.faint} />
                        <T v="caption" style={{ color: d.faint, fontSize: 10 }}>
                          {p.comment_count ?? 0}
                        </T>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* 9 ─ Daily Ayah & Hadith */}
        <View style={{ marginHorizontal: 16, marginTop: 26, flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, borderRadius: 20, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <FontAwesome5 name="star-and-crescent" size={11} color={d.gold} />
              <T v="caption" style={{ color: d.subtext, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.1 }}>
                DAILY AYAH
              </T>
            </View>
            <Text
              style={{
                fontFamily: 'Amiri',
                fontSize: 16,
                color: d.text,
                textAlign: 'center',
                lineHeight: 26,
                marginTop: 10,
                writingDirection: 'rtl',
              }}
            >
              {DAILY_AYAH.arabic}
            </Text>
            <T v="caption" style={{ color: d.subtext, fontSize: 10, textAlign: 'center', marginTop: 6, lineHeight: 13 }}>
              {DAILY_AYAH.meaning}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 9, textAlign: 'center', marginTop: 6, fontWeight: '600' }}>
              {DAILY_AYAH.ref}
            </T>
          </View>
          <View style={{ flex: 1, borderRadius: 20, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <FontAwesome5 name="scroll" size={11} color={d.gold} />
              <T v="caption" style={{ color: d.subtext, fontSize: 9.5, fontWeight: '700', letterSpacing: 1.1 }}>
                DAILY HADITH
              </T>
            </View>
            <Text
              style={{
                fontFamily: 'Amiri',
                fontSize: 16,
                color: d.text,
                textAlign: 'center',
                lineHeight: 26,
                marginTop: 10,
                writingDirection: 'rtl',
              }}
            >
              {DAILY_HADITH.arabic}
            </Text>
            <T v="caption" style={{ color: d.subtext, fontSize: 10, textAlign: 'center', marginTop: 6, lineHeight: 13 }}>
              {DAILY_HADITH.meaning}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 9, textAlign: 'center', marginTop: 6, fontWeight: '600' }}>
              {DAILY_HADITH.ref}
            </T>
          </View>
        </View>

        {/* 10 ─ Videos */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Videos
            </T>
            <Pressable onPress={() => router.push('/tools/videos')} hitSlop={8}>
              <T v="caption" style={{ color: d.emerald, fontSize: 11.5, fontWeight: '600' }}>
                View all <T v="caption" style={{ color: d.emerald, fontSize: 11.5 }}>→</T>
              </T>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
            {videos.map((v) => (
              <Pressable key={v.id} onPress={() => router.push('/tools/videos')} style={({ pressed }) => ({ width: 158, opacity: pressed ? 0.9 : 1 })}>
                <View style={{ height: 100, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder }}>
                  <LinearGradient
                    colors={(isDark ? ['#123524', '#0A1A12'] : ['#DCEEE2', '#F2F7F2']) as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: 'absolute', inset: 0 }}
                  />
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: d.emerald,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: d.emerald,
                        shadowOpacity: 0.5,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 6,
                      }}
                    >
                      <FontAwesome5 name="play" size={12} color="#fff" style={{ marginLeft: 2 }} />
                    </View>
                  </View>
                  {v.duration ? (
                    <View style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <T v="caption" style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>
                        {v.duration}
                      </T>
                    </View>
                  ) : null}
                </View>
                <T v="bodyS" style={{ color: d.text, fontSize: 11.5, fontWeight: '600', marginTop: 8, lineHeight: 14 }}>
                  {v.title ?? 'Daily reminder'}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <FontAwesome5 name="play" size={8} color={d.faint} />
                  <T v="caption" style={{ color: d.faint, fontSize: 9.5 }}>
                    {fmtViews(v.view_count as number)} views
                  </T>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Search overlay */}
      {searchOpen ? (
        <View style={{ position: 'absolute', top: 66, left: 16, right: 16, zIndex: 50 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: d.card,
              borderRadius: 30,
              borderWidth: 1,
              borderColor: d.cardBorder,
              paddingHorizontal: 14,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <FontAwesome5 name="search" size={13} color={d.faint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search accounts by name or username..."
              placeholderTextColor={d.faint}
              autoFocus
              style={{ flex: 1, fontFamily: 'Poppins-Medium', fontSize: 13.5, color: d.text, paddingVertical: 12, paddingLeft: 9 }}
            />
            <Pressable onPress={() => setSearchOpen(false)} style={{ padding: 5 }}>
              <FontAwesome5 name="times" size={12} color={d.faint} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------- Animated pulse dot -------------------------- */

function PulseDot({ color }: { color: string }) {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: o }} />;
}

/* ---------------------------- Quick access tile ---------------------------- */

function QuickTile({
  item,
  onPress,
}: {
  item: QuickItem;
  onPress: () => void;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const accent = item.accent === 'gold' ? d.gold : d.emerald;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 66,
        height: 84,
        borderRadius: 18,
        backgroundColor: d.card,
        borderWidth: 1,
        borderColor: isDark ? `${accent}4D` : `${accent}40`,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.85 : 1,
        overflow: 'hidden',
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          backgroundColor: isDark ? `${accent}29` : `${accent}1A`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isDark ? <Glow size={52} color={accent} id={`glow-quick-${item.key}`} opacity={0.25} /> : null}
        {item.icon.beads ? (
          <BeadsIcon size={20} color={accent} />
        ) : (
          <FontAwesome5 name={item.icon.fa as never} size={19} color={accent} />
        )}
      </View>
      <T
        v="caption"
        style={{
          color: d.subtext,
          fontSize: 9.5,
          fontWeight: '600',
          textAlign: 'center',
          includeFontPadding: false,
          lineHeight: 12,
          width: 58,
        }}
      >
        {item.label}
      </T>
    </Pressable>
  );
}

/* ------------------------------ Progress ring ------------------------------ */

function ProgressRing({
  size,
  progress,
  color,
  icon,
}: {
  size: number;
  progress: number;
  color: string;
  icon: React.ReactNode;
}) {
  const { theme } = useTheme();
  const d = theme.dash;
  const stroke = 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={d.bgSoft} strokeWidth={stroke} fill="none" strokeOpacity={0.9} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(c * Math.min(Math.max(progress, 0.02), 1), 1)} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
    </View>
  );
}

/* ------------------------------ Hexagon badge ------------------------------ */

function HexBadge() {
  const { theme } = useTheme();
  const d = theme.dash;
  const s = 54;
  const c = s / 2;
  const r = s / 2 - 2;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${c + r * Math.cos(a)},${c + r * Math.sin(a)}`);
  }
  return (
    <Svg width={s} height={s}>
      <Path d={`M${pts.join(' L')} Z`} fill={`${d.emerald}14`} stroke={d.emerald} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d={`M${pts.map((p) => p.split(',')).map(([x, y]) => [Number(x) * 0.8 + c * 0.2, Number(y) * 0.8 + c * 0.2].join(',')).join(' L')} Z`} fill="none" stroke={`${d.gold}66`} strokeWidth={0.8} strokeLinejoin="round" />
    </Svg>
  );
}

/* --------------------- Sun path (time-based day arc) --------------------- */
/* Professional prayer-day visual: markers at their REAL positions on the
   day's arc, sun/moon at the CURRENT time, next prayer highlighted. */

function SunPath({ times, now, nextIndex }: { times: Date[] | null; now: Date; nextIndex: number | null }) {
  const [w, setW] = useState(338);
  const H = 120;
  const pad = 18;
  const baseline = 84;
  const peak = 20;
  // fixed palette — SunPath always renders on the dark hero card
  const c = {
    horizon: 'rgba(255,255,255,0.16)',
    nowLine: 'rgba(255,255,255,0.22)',
    curve: '#D4AF37',
    elapsed: '#F1C40F',
    area: '#D4AF37',
    dotFill: '#0E241A',
    dotStroke: 'rgba(255,255,255,0.5)',
    active: '#2ECC71',
    label: 'rgba(255,255,255,0.62)',
    labelActive: '#4AE38F',
    time: 'rgba(255,255,255,0.4)',
    halo: '#F1C40F',
    sunDay: '#F1C40F',
    sunNight: '#B9C7E4',
    sunRingDay: '#D4AF37',
    sunRingNight: 'rgba(255,255,255,0.45)',
    card: '#0E241A',
  };

  if (!times) {
    return (
      <View
        onLayout={(e) => setW(Math.max(e.nativeEvent.layout.width, 200))}
        style={{ height: H, justifyContent: 'center' }}
      >
        <View
          style={{
            position: 'absolute',
            left: pad - 6,
            right: pad - 6,
            top: baseline,
            borderTopWidth: 1,
            borderTopColor: c.horizon,
            opacity: 0.6,
          }}
        />
        <T v="caption" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5 }}>
          Calculating prayer times…
        </T>
      </View>
    );
  }

  const fajr = times[0].getTime();
  const dhuhr = times[2].getTime();
  const asr = times[3].getTime();
  const maghrib = times[4].getTime();
  const isha = times[5].getTime();
  const end = isha + 45 * 60e3;
  const span = Math.max(end - fajr, 3600e3);

  const X = (t: number) => pad + ((t - fajr) / span) * (w - 2 * pad);
  const Y = (t: number) => {
    const p = Math.min(Math.max((t - fajr) / span, 0), 1);
    return baseline - (baseline - peak) * Math.sin(Math.PI * p);
  };

  const N = 48;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = fajr + (span * i) / N;
    pts.push(`${X(t).toFixed(1)},${Y(t).toFixed(1)}`);
  }
  const curve = `M ${pts.join(' L ')}`;
  const area = `${curve} L ${X(end).toFixed(1)},${baseline} L ${X(fajr).toFixed(1)},${baseline} Z`;

  const nowMs = now.getTime();
  const sunT = Math.min(Math.max(nowMs, fajr), end);
  // bright "day so far" segment: Fajr → now
  const elapsedIdx = Math.min(Math.round(((sunT - fajr) / span) * N), N);
  const elapsed =
    elapsedIdx > 0
      ? `M ${pts.slice(0, elapsedIdx + 1).join(' L ')} ${X(sunT).toFixed(1)},${Y(sunT).toFixed(1)}`
      : '';
  const sx = X(sunT);
  const sy = Y(sunT);
  const isDay = nowMs >= fajr && nowMs < maghrib;
  const npIndex = nextIndex;

  const markers = [
    { label: 'Fajr', t: fajr, idx: 0, icon: 'cloud-sun' as const },
    { label: 'Dhuhr', t: dhuhr, idx: 2, icon: 'sun' as const },
    { label: 'Asr', t: asr, idx: 3, icon: 'sun' as const },
    { label: 'Maghrib', t: maghrib, idx: 4, icon: 'cloud-sun' as const },
    { label: 'Isha', t: isha, idx: 5, icon: 'moon' as const },
  ];


  return (
    <View onLayout={(e) => setW(Math.max(e.nativeEvent.layout.width, 200))} style={{ height: H }}>
      <Svg width={w} height={H}>
        <Defs>
          <SvgLinear id="sun-area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={c.area} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={c.area} stopOpacity={0} />
          </SvgLinear>
          <SvgRadial id="sun-halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={c.halo} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={c.halo} stopOpacity={0} />
          </SvgRadial>
          <SvgRadial id="active-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={c.active} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={c.active} stopOpacity={0} />
          </SvgRadial>
        </Defs>
        {/* horizon */}
        <Line x1={pad - 8} y1={baseline} x2={w - pad + 8} y2={baseline} stroke={c.horizon} strokeWidth={1} strokeDasharray="1 4" strokeLinecap="round" />
        {/* soft fill under the arc */}
        <Path d={area} fill="url(#sun-area)" />
        {/* the day arc (remaining) */}
        <Path d={curve} stroke={c.curve} strokeOpacity={0.3} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        {/* the elapsed portion, brighter */}
        {elapsed ? <Path d={elapsed} stroke={c.elapsed} strokeOpacity={0.95} strokeWidth={2} fill="none" strokeLinecap="round" /> : null}
        {/* now line */}
        <Line x1={sx} y1={sy + 13} x2={sx} y2={baseline} stroke={c.nowLine} strokeWidth={1} />
        {/* prayer markers at their real positions */}
        {markers.map((m) => {
          const active = npIndex === m.idx;
          return (
            <React.Fragment key={m.label}>
              {active ? <Circle cx={X(m.t)} cy={Y(m.t)} r={13} fill="url(#active-glow)" /> : null}
              <Circle
                cx={X(m.t)}
                cy={Y(m.t)}
                r={8}
                fill={c.dotFill}
                stroke={active ? c.active : c.dotStroke}
                strokeWidth={active ? 1.5 : 1}
              />
            </React.Fragment>
          );
        })}
        {/* sun / moon at the current time */}
        <Circle cx={sx} cy={sy} r={16} fill="url(#sun-halo)" />
        <Circle cx={sx} cy={sy} r={11} fill={c.card} stroke={isDay ? c.sunRingDay : c.sunRingNight} strokeWidth={1.2} />
        {isDay ? (
          <G>
            <Circle cx={sx} cy={sy} r={4} fill={c.sunDay} />
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k * Math.PI) / 4;
              return (
                <Line
                  key={k}
                  x1={sx + Math.cos(a) * 6}
                  y1={sy + Math.sin(a) * 6}
                  x2={sx + Math.cos(a) * 8.4}
                  y2={sy + Math.sin(a) * 8.4}
                  stroke={c.sunDay}
                  strokeWidth={1.3}
                  strokeLinecap="round"
                />
              );
            })}
          </G>
        ) : (
          <Path
            d={`M ${sx + 1.6} ${sy - 4.7} A 4.7 4.7 0 1 0 ${sx + 1.6} ${sy + 4.7} A 3.5 3.5 0 1 1 ${sx + 1.6} ${sy - 4.7} Z`}
            fill={c.sunNight}
          />
        )}
      </Svg>


      {/* prayer icons inside the dots */}
      {markers.map((m) => (
        <View
          key={`gi-${m.label}`}
          style={{
            position: 'absolute',
            left: X(m.t) - 8,
            top: Y(m.t) - 8,
            width: 16,
            height: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FontAwesome5 name={m.icon} size={7.5} color={npIndex === m.idx ? c.active : 'rgba(255,255,255,0.82)'} />
        </View>
      ))}

      {/* labels: name + real time under each marker (collisions resolved L→R) */}
      {(() => {
        const W = [40, 40, 38, 48, 40]; // per-label box widths (fit name + time)
        const GAP = 3;
        const lefts = markers.map((m, i) => Math.min(Math.max(X(m.t) - W[i] / 2, 2), w - W[i] - 2));
        // Right-to-left pass: the rightmost labels (Maghrib/Isha) are close in time,
        // so keep the last at the edge and pull earlier boxes left of their neighbours.
        for (let i = markers.length - 2; i >= 0; i--) {
          lefts[i] = Math.min(lefts[i], lefts[i + 1] - W[i] - GAP);
          lefts[i] = Math.max(lefts[i], 2);
        }
        return markers.map((m, i) => {
          const active = npIndex === m.idx;
          return (
            <View key={`l-${m.label}`} style={{ position: 'absolute', left: lefts[i], top: baseline + 10, width: W[i], alignItems: 'center' }}>
              <T v="caption" style={{ color: active ? c.labelActive : c.label, fontSize: 9, fontWeight: active ? '700' : '500' }}>
                {m.label}
              </T>
              <T v="caption" style={{ color: c.time, fontSize: 8.5, marginTop: 1 }}>
                {formatTime(new Date(m.t))}
              </T>
            </View>
          );
        });
      })()}
    </View>
  );
}
