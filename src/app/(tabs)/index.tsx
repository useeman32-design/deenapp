import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient as SvgRadial, LinearGradient as SvgLinear, Stop } from 'react-native-svg';

import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { getGoal as fetchGoal, getStreak, setGoal as setGoalItem, markActive } from '@/lib/routine';
import { haptic } from '@/lib/haptics';
import { computePrayerTimes, formatTime, nextPrayer } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { T } from '@/components/T';
import { SunPath } from '@/components/SunPath';
import * as api from '@/api/client';
import type { Post, Scholar, Video } from '@/api/types';
import { MOCK_COMMENTS, MOCK_FEED, MOCK_SCHOLARS, MOCK_VIDEOS } from '@/api/mocks';
import { storage } from '@/lib/storage';
import { DEFAULT_QUICK, QUICK_STORAGE_KEY, quickItems, type QuickItem } from '@/lib/quick-access';
import { dailyAyah, dailyHadith } from '@/lib/daily';
import { formatHijri, formatGregorian } from '@/lib/prayer';
import { QURAN } from '@/data/quran';
import { loadSurah } from '@/lib/content';
import { BeadsIcon } from '@/components/Icons';
import { FeedCard, YouTubeFrame } from '@/components/FeedCard';
import { GroupFeedInline } from '@/components/Groups';
import { CommentsModal } from '@/components/CommentsModal';
import { VideoModal } from '@/components/VideoModal';
import { downloadDataUrl, generateShareCard, shareOrSaveCard, SHARE_DESIGNS } from '@/lib/shareCard';

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
const campaignQuran = require('../../../assets/img/campaign-quran.jpg');
const campaignRamadan = require('../../../assets/img/campaign-ramadan.jpg');
const campaignScholars = require('../../../assets/img/campaign-scholars.jpg');
const campaignLearning = require('../../../assets/img/campaign-learning.jpg');
const scholarAvatar1 = require('../../../assets/img/scholar-1.jpg');
const scholarAvatar2 = require('../../../assets/img/scholar-2.jpg');
const scholarAvatar3 = require('../../../assets/img/scholar-3.jpg');

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

/* pass 44 — campaign order per user: Learning Hub NEW and first,
 * Finish the Qur'an SECOND, then Ramadan, then scholars. Videos removed. */
const CAMPAIGNS = [
  {
    key: 'learning',
    image: campaignLearning,
    title: 'Learning Hub',
    sub: 'Courses, tafsir and short lessons — grow your deen.',
    href: '/tools/learning',
  },
  {
    key: 'quran',
    image: campaignQuran,
    title: 'Finish the Qur’an',
    sub: 'One surah a day — keep the chain alive.',
    href: '/(tabs)/quran',
  },
  {
    key: 'ramadan',
    image: campaignRamadan,
    title: 'Ramadan Countdown',
    titleSmall: true,
    sub: 'Start your preparation streak today.',
    href: '/tools/calendar',
  },
  {
    key: 'scholars',
    image: campaignScholars,
    title: 'Ask a Scholar',
    sub: 'Verified answers from the scholars.',
    href: '/tools/scholars',
  },
];

const POST_FIELDS: Record<number, string> = { 101: 'Sunni · Mufti', 102: 'Sunni', 103: 'Sunni · Sheikh', 104: 'Sufi', 105: 'Sufi', 106: 'Sunni · Sheikh', 107: 'Sunni · Mufti', 108: 'Sufi', 109: 'Sunni' };
const SCHOLAR_AVATARS: Record<number, number> = { 1: scholarAvatar1, 2: scholarAvatar2, 3: scholarAvatar3 };

/* pass 29: UNIVERSAL daily ayah & hadith — src/lib/daily.ts. One ayah + one
 * hadith per day, identical on every screen (home, shares, notifications).
 * Texts are curated short so they always fit the card / image container. */
const DAILY_AYAH = dailyAyah();
const DAILY_HADITH = dailyHadith();

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
  const [goal, setGoal] = useState<{ done: number; total: number; demo: boolean; items: { key: string; label: string; done: boolean }[] }>({ done: 0, total: 4, demo: true, items: [] });
  /* pass 42 — Today's Goal modal */
  const [goalOpen, setGoalOpen] = useState(false);
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followed, setFollowed] = useState<number[]>([]);
  const [videoOpen, setVideoOpen] = useState<Video | null>(null);
  const [dhOpen, setDhOpen] = useState<'ayah' | 'hadith' | null>(null);
  /* dailyAyah / dailyHadith are universal constants for the day (lib/daily) */
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [videoLiked, setVideoLiked] = useState<Set<number>>(new Set());
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  /* pass 38 — group posts MIXED into the main feed */
  const [hasGroups, setHasGroups] = useState(true);
  const [heroSz, setHeroSz] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [dhShareView, setDhShareView] = useState(false);
  const [shareCard, setShareCard] = useState<{ status: 'loading' | 'ready' | 'error'; url?: string }>({ status: 'loading' });
  const [shareDesign, setShareDesign] = useState('classic');
  const togglePostLike = (id: number) =>
    setLikedPosts((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleVideoLike = (id: number) =>
    setVideoLiked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const likeSeed = useRef(false);
  useEffect(() => {
    if (!likeSeed.current && posts.length) {
      likeSeed.current = true;
      setLikedPosts(new Set(posts.filter((p) => p.liked_by_me).map((p) => p.id)));
    }
  }, [posts]);

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
    fetchGoal().then((g) => setGoal({ done: g.done, total: g.total, demo: g.demo, items: g.items }));
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
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 230, overflow: 'hidden' }}>
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
            onPress={() => router.push('/tools/notifications')}
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

        {/* pass 40 — hijri + gregorian dates in ONE pill · pass 41 — CENTERED (was right-aligned) */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 8 }} pointerEvents="none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.07)', paddingHorizontal: 11, paddingVertical: 5 }}>
            <FontAwesome5 name="moon" size={9} color="#E8C96A" />
            <T v="caption" numberOfLines={1} style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#E8C96A' : '#8C6D1F' }}>
              {formatHijri(new Date())}
            </T>
            <View style={{ width: 1, height: 10, backgroundColor: 'rgba(212,175,55,0.4)' }} />
            <T v="caption" numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: d.subtext }}>
              {(() => {
                /* compact form so the pill fits narrow screens too */
                const d2 = new Date();
                const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return `${W[d2.getDay()]}, ${M[d2.getMonth()]} ${d2.getDate()}, ${d2.getFullYear()}`;
              })()}
            </T>
          </View>
        </View>

        {/* 2 ─ Prayer times hero card */}

        <View style={{ marginHorizontal: 16, borderRadius: 26, overflow: 'hidden', backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder }}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) setHeroSz({ w: width, h: height });
            }}
          >
          <View style={{ position: 'relative', padding: 18, paddingBottom: 12 }}>
            {heroSz.w > 0 ? (
              /* pass 35 — expo-image contentFit=cover centers the crop correctly
               * on every native build (RN Image cover mis-anchors on some Androids) */
              <ExpoImage
                source={mecca}
                style={{ position: 'absolute', top: 0, left: 0, width: heroSz.w, height: heroSz.h }}
                contentFit="cover"
              />
            ) : null}
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
                    <FontAwesome5 name="star-and-crescent" size={19} color={isDark ? d.emerald : '#5BE59B'} />
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
                  <FontAwesome5 name="star-and-crescent" size={12} color={d.goldBright} />
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
                  icon={<FontAwesome5 name="book-open" size={15} color={d.emerald} />}
                />
              </View>
            </View>

            {/* Today's goal — pass 42: taps open the goals modal */}
            <Pressable accessibilityLabel="today-goal" onPress={() => { haptic.selection(); setGoalOpen(true); }} style={({ pressed }) => ({ flex: 1, borderRadius: 20, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 14, opacity: pressed ? 0.88 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <FontAwesome5 name="bullseye" size={13} color={d.gold} />
                <T v="bodyS" style={{ color: d.text, fontWeight: '600', fontSize: 12.5, flex: 1 }}>
                  Today’s Goal
                </T>
                <FontAwesome5 name="angle-right" size={13} color={d.subtext} />
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
            </Pressable>
          </View>
        </View>

        {/* pass 42 — TODAY'S GOAL modal: full goals list with live progress */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Campaigns
            </T>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
            {CAMPAIGNS.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => router.push(c.href as never)}
                style={({ pressed }) => ({
                  width: 358,
                  borderRadius: 20,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Image source={c.image} style={{ width: 358, height: 150 }} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(4,9,7,0.88)', 'rgba(4,9,7,0.55)', 'rgba(4,9,7,0)']}
                  locations={[0, 0.5, 0.92]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ position: 'absolute', inset: 0 }}
                />
                <View style={{ position: 'absolute', left: 15, right: 130, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <T v="h3" style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '700', lineHeight: 19 }}>
                    {c.title}
                  </T>
                  <T v="caption" style={{ color: 'rgba(255,255,255,0.78)', fontSize: 10.5, marginTop: 4, lineHeight: 14 }}>
                    {c.sub}
                  </T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                    <View style={{ width: 14, height: 2, backgroundColor: 'rgba(212,175,55,0.9)', borderRadius: 1 }} />
                    <FontAwesome5 name="chevron-right" size={9} color="rgba(212,175,55,0.9)" />
                  </View>
                </View>
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

        {/* 7 ─ Daily videos (tap → viewing modal) */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Daily Videos
            </T>
            <Pressable onPress={() => router.push('/videos')} hitSlop={8}>
              <T v="caption" style={{ color: d.emerald, fontSize: 11.5, fontWeight: '600' }}>
                Watch more <T v="caption" style={{ color: d.emerald, fontSize: 11.5 }}>→</T>
              </T>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
            {videos.map((v) => (
              <Pressable key={v.id} onPress={() => setVideoOpen(v)} style={({ pressed }) => ({ width: 158, opacity: pressed ? 0.9 : 1 })}>
                <View style={{ height: 100, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder }}>
                  <LinearGradient
                    colors={(isDark ? ['#123524', '#0A1A12'] : ['#DCEEE2', '#F2F7F2']) as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: 'absolute', inset: 0 }}
                  />
                  {v.thumb != null ? (
                    <Image source={v.thumb as number} style={{ position: 'absolute', inset: 0, width: '100%', height: 100 }} resizeMode="cover" />
                  ) : null}
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)'] as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
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
                        {String(v.duration)}
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

        {/* 8 ─ Community / recent posts (web-style cards) */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Recent Posts
            </T>
            <Pressable onPress={() => router.push('/(tabs)/community')} hitSlop={8}>
              <T v="caption" style={{ color: d.emerald, fontSize: 11.5, fontWeight: '600' }}>
                Go to community <T v="caption" style={{ color: d.emerald, fontSize: 11.5 }}>→</T>
              </T>
            </Pressable>
          </View>
          <View style={{ gap: 12 }}>
            {/* pass 39 — fewer posts on home (was 8) */}
            {posts.slice(0, 4).map((p, pi) => (
              <View key={p.id} style={{ gap: 12 }}>
              {pi === 1 && hasGroups ? <GroupFeedInline index={0} onComments={(pp) => setCommentPost(pp)} /> : null}
              <FeedCard
                key={p.id}
                dash={d}
                field={
                  POST_FIELDS[p.id] ??
                  (p.user?.scholar?.fields_of_knowledge as string | undefined) ??
                  ((p.user as { fields?: string }).fields as string | undefined)
                }
                post={{ ...p, liked_by_me: likedPosts.has(p.id), like_count: (p.like_count ?? 0) + (likedPosts.has(p.id) ? 1 : 0) }}
                onLike={(id) => togglePostLike(id)}
                onComments={(pp) => setCommentPost(pp)}
                onDismiss={(id) => setPosts((ps) => ps.filter((x) => x.id !== id))}
                onPlayVideo={(pp) =>
                  setVideoOpen({
                    id: pp.id,
                    title: (pp.content_text ?? 'Video').slice(0, 60),
                    source_url: pp.youtube_url as string | null,
                    embed_url: pp.youtube_embed_url as string | null,
                    duration: null,
                    view_count: (pp.like_count as number) ?? 0,
                    like_count: 0,
                  })
                }
              />
              </View>
            ))}
          </View>
          {/* View more on community */}
          <Pressable
            onPress={() => router.push('/(tabs)/community')}
            style={({ pressed }) => ({
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(212,175,55,0.55)',
              backgroundColor: 'rgba(212,175,55,0.10)',
              paddingVertical: 12,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <FontAwesome5 name="users" size={13} color={d.gold} />
            <T v="bodyS" style={{ color: d.gold, fontSize: 12.5, fontWeight: '700' }}>
              View more on community
            </T>
            <T v="caption" style={{ color: d.gold, fontSize: 12 }}>→</T>
          </Pressable>
        </View>

        {/* 9 ─ Daily Ayah & Hadith (premium cards, tap → modal + share image) */}
        <View style={{ marginHorizontal: 16, marginTop: 26, gap: 14 }}>
          {(['ayah', 'hadith'] as const).map((kind) => {
            const isH = kind === 'hadith';
            const dh = isH ? DAILY_HADITH : DAILY_AYAH;
            return (
              <Pressable
                key={kind}
                onPress={() => setDhOpen(kind)}
                style={({ pressed }) => ({
                  borderRadius: 24,
                  overflow: 'hidden',
                  backgroundColor: d.card,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  padding: 20,
                  alignItems: 'center',
                  opacity: pressed ? 0.96 : 1,
                })}
              >
                {/* faint pattern backdrop */}
                <View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: isDark ? 0.5 : 0.4 }}>
                  <Image
                    source={isDark ? patternDark : patternLight}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </View>
                {/* gold inner frame */}
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', inset: 7, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(212,175,55,0.32)' }}
                />
                {/* corner accents */}
                {[
                  { top: 7, left: 7, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 18 },
                  { top: 7, right: 7, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 18 },
                  { bottom: 7, left: 7, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 18 },
                  { bottom: 7, right: 7, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 18 },
                ].map((cst, k) => (
                  <View key={k} pointerEvents="none" style={{ position: 'absolute', width: 22, height: 22, ...cst, borderColor: 'rgba(212,175,55,0.8)' }} />
                ))}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 22, height: 1, backgroundColor: 'rgba(212,175,55,0.55)' }} />
                  <FontAwesome5 name={isH ? 'scroll' : 'star-and-crescent'} size={11} color={d.gold} />
                  <T v="caption" style={{ color: d.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 }}>
                    {isH ? 'DAILY HADITH' : 'DAILY AYAH'}
                  </T>
                  <FontAwesome5 name={isH ? 'scroll' : 'star-and-crescent'} size={11} color={d.gold} style={{ transform: [{ scaleX: -1 }] }} />
                  <View style={{ width: 22, height: 1, backgroundColor: 'rgba(212,175,55,0.55)' }} />
                </View>

                <Text
                  style={{
                    fontFamily: 'Amiri-Bold',
                    fontSize: 27,
                    color: d.text,
                    textAlign: 'center',
                    lineHeight: 44,
                    marginTop: 12,
                    writingDirection: 'rtl',
                  }}
                >
                  {dh.arabic}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <View style={{ width: 40, height: 1, backgroundColor: 'rgba(212,175,55,0.5)' }} />
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: d.gold, transform: [{ rotate: '45deg' }] }} />
                  <View style={{ width: 40, height: 1, backgroundColor: 'rgba(212,175,55,0.5)' }} />
                </View>

                <T v="caption" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 11, lineHeight: 18, fontStyle: 'italic', paddingHorizontal: 12 }}>
                  “{dh.meaning}”
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
                  <T v="caption" style={{ color: d.faint, fontSize: 9.5, fontWeight: '600', letterSpacing: 0.4 }}>
                    {dh.ref.toUpperCase()}
                  </T>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: d.faint }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <FontAwesome5 name="image" size={9} color={d.emerald} />
                    <T v="caption" style={{ color: d.emerald, fontSize: 9.5, fontWeight: '700' }}>
                      Share as image
                    </T>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

                {/* 11 ─ Accounts to follow (with photos) */}
        <View style={{ marginHorizontal: 16, marginTop: 26, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Accounts to Follow
            </T>
            <Pressable onPress={() => router.push('/tools/suggestions')} hitSlop={8}>
              <T v="caption" style={{ color: d.emerald, fontSize: 11.5, fontWeight: '600' }}>
                View more <T v="caption" style={{ color: d.emerald, fontSize: 11.5 }}>→</T>
              </T>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
            {scholars.map((sc) => {
              const name = sc.display_name ?? 'Scholar';
              const isF = followed.includes(sc.id);
              const photo = SCHOLAR_AVATARS[sc.id];
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
                  {photo ? (
                    <Image
                      source={photo}
                      style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: d.greenBorder }}
                      resizeMode="cover"
                    />
                  ) : (
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
                  )}
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
              style={{ flex: 1, fontFamily: 'Poppins-Medium', fontSize: 16 /*13.5*/, color: d.text, paddingVertical: 12, paddingLeft: 9 }}
            />
            <Pressable onPress={() => setSearchOpen(false)} style={{ padding: 5 }}>
              <FontAwesome5 name="times" size={12} color={d.faint} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ── Video viewing modal (reels/shorts-style preview) ── */}
      <VideoModal
        video={videoOpen}
        liked={videoLiked.has(videoOpen?.id ?? -1)}
        onLike={() => videoOpen && toggleVideoLike(videoOpen.id)}
        onClose={() => setVideoOpen(null)}
      />

      {/* ── Daily ayah / hadith modal ── */}
      <Modal visible={!!dhOpen} transparent animationType="fade" onRequestClose={() => setDhOpen(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(4,8,6,0.78)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          onPress={() => setDhOpen(null)}
        >
          {(() => {
            const isHadith = dhOpen === 'hadith';
            const dh = isHadith ? DAILY_HADITH : DAILY_AYAH;
            return (
              <View
                onStartShouldSetResponder={() => true}
                style={{
                  width: 330,
                  borderRadius: 24,
                  backgroundColor: d.card,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  padding: 22,
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.3,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6 }}>
                  <FontAwesome5 name={isHadith ? 'scroll' : 'star-and-crescent'} size={12} color={d.gold} />
                  <T v="caption" style={{ color: d.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 }}>
                    {isHadith ? 'DAILY HADITH' : 'DAILY AYAH'}
                  </T>
                </View>
                <Text
                  style={{ fontFamily: 'Amiri-Bold', fontSize: 26, color: d.text, textAlign: 'center', lineHeight: 42, marginTop: 14, writingDirection: 'rtl' }}
                >
                  {dh.arabic}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 }}>
                  <View style={{ width: 34, height: 1, backgroundColor: 'rgba(212,175,55,0.5)' }} />
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: d.gold, transform: [{ rotate: '45deg' }] }} />
                  <View style={{ width: 34, height: 1, backgroundColor: 'rgba(212,175,55,0.5)' }} />
                </View>
                <T v="caption" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 11, lineHeight: 18, fontStyle: 'italic' }}>
                  “{dh.meaning}”
                </T>
                <T v="caption" style={{ color: d.faint, fontSize: 10, textAlign: 'center', marginTop: 8, fontWeight: '600', letterSpacing: 0.4 }}>
                  {dh.ref.toUpperCase()}
                </T>

                {dhShareView ? (
                  <View style={{ marginTop: 14, alignSelf: 'stretch', alignItems: 'center' }}>
                    {shareCard.status === 'ready' && shareCard.url ? (
                      <Image
                        source={{ uri: shareCard.url }}
                        style={{ width: 252, height: 315, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder }}
                        resizeMode="contain"
                      />
                    ) : shareCard.status === 'loading' ? (
                      <View
                        style={{
                          width: 252,
                          height: 315,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: d.cardBorder,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FontAwesome5 name="spinner" spin size={22} color={d.gold} />
                        <T v="caption" style={{ color: d.faint, fontSize: 10, marginTop: 8 }}>
                          Creating your share card…
                        </T>
                      </View>
                    ) : (
                      <T v="caption" style={{ color: d.faint, fontSize: 11, textAlign: 'center' }}>
                        Couldn’t create the image. Try again.
                      </T>
                    )}
                    {/* Design picker */}
                    <View style={{ marginTop: 16, alignSelf: 'stretch' }}>
                      <T v="caption" style={{ fontSize: 9.5, color: d.faint, fontWeight: '700', letterSpacing: 1, marginBottom: 9, alignSelf: 'center' }}>
                        CHOOSE A DESIGN
                      </T>
                      <View style={{ flexDirection: 'row', gap: 9, justifyContent: 'center' }}>
                        {SHARE_DESIGNS.map((ds) => {
                          const sel = shareDesign === ds.id;
                          return (
                            <Pressable
                              key={ds.id}
                              onPress={async () => {
                                if (sel) return;
                                setShareDesign(ds.id);
                                setShareCard({ status: 'loading' });
                                try {
                                  const url = await generateShareCard({ kind: isHadith ? 'hadith' : 'ayah', arabic: dh.arabic, meaning: dh.meaning, ref: dh.ref }, ds.id);
                                  setShareCard({ status: 'ready', url });
                                } catch {
                                  setShareCard({ status: 'error' });
                                }
                              }}
                              style={({ pressed }) => ({ alignItems: 'center', gap: 5, opacity: pressed ? 0.7 : 1 })}
                            >
                              <View
                                style={{
                                  width: 54,
                                  height: 68,
                                  borderRadius: 9,
                                  overflow: 'hidden',
                                  borderWidth: 2,
                                  borderColor: sel ? d.gold : 'transparent',
                                  backgroundColor: ds.dark ? '#0B0F0D' : '#F5EFE2',
                                }}
                              >
                                {ds.src != null ? (
                                  <Image source={ds.src as number} style={{ width: 54, height: 68 }} resizeMode="cover" />
                                ) : (
                                  <LinearGradient
                                    colors={['#0B0F0D', '#123024', '#0B0F0D'] as [string, string, ...string[]]}
                                    style={{ flex: 1 }}
                                  />
                                )}
                                <View style={{ position: 'absolute', top: 7, left: 0, right: 0, alignItems: 'center' }}>
                                  <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: ds.dark ? '#D4AF37' : '#8C6D1F' }} />
                                </View>
                              </View>
                              <T v="caption" style={{ fontSize: 9, fontWeight: sel ? '700' : '500', color: sel ? d.gold : d.faint }}>
                                {ds.name}
                              </T>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' }}>
                      <Pressable
                        onPress={() => shareCard.url && downloadDataUrl(shareCard.url, `deenlink-daily-${isHadith ? 'hadith' : 'ayah'}.png`)}
                        disabled={shareCard.status !== 'ready'}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: d.cardBorder,
                          paddingVertical: 11,
                          opacity: shareCard.status === 'ready' ? (pressed ? 0.7 : 1) : 0.45,
                        })}
                      >
                        <FontAwesome5 name="download" size={13} color={d.text} />
                        <T v="bodyS" style={{ color: d.text, fontSize: 12, fontWeight: '600' }}>
                          Save
                        </T>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          shareCard.url &&
                          shareOrSaveCard(shareCard.url, `deenlink-daily-${isHadith ? 'hadith' : 'ayah'}.png`, `${dh.meaning} — ${dh.ref}`)
                        }
                        disabled={shareCard.status !== 'ready'}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                          borderRadius: 14,
                          backgroundColor: d.emerald,
                          paddingVertical: 11,
                          opacity: shareCard.status === 'ready' ? (pressed ? 0.8 : 1) : 0.45,
                        })}
                      >
                        <FontAwesome5 name="share-alt" size={13} color="#fff" />
                        <T v="bodyS" style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                          Share
                        </T>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => setDhShareView(false)} hitSlop={8} style={{ marginTop: 10 }}>
                      <T v="caption" style={{ color: d.faint, fontSize: 10.5, fontWeight: '600' }}>
                        ← Back
                      </T>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' }}>
                    <Pressable
                      onPress={async () => {
                        setDhShareView(true);
                        setShareCard({ status: 'loading' });
                        try {
                          const url = await generateShareCard(
                            {
                              kind: isHadith ? 'hadith' : 'ayah',
                              arabic: dh.arabic,
                              meaning: dh.meaning,
                              ref: dh.ref,
                            },
                            shareDesign,
                          );
                          setShareCard({ status: 'ready', url });
                        } catch {
                          setShareCard({ status: 'error' });
                        }
                      }}
                      style={({ pressed }) => ({
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 7,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: 'rgba(212,175,55,0.55)',
                        backgroundColor: 'rgba(212,175,55,0.10)',
                        paddingVertical: 11,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <FontAwesome5 name="image" size={13} color={d.gold} />
                      <T v="bodyS" style={{ color: d.gold, fontSize: 12, fontWeight: '700' }}>
                        Share Image
                      </T>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setDhOpen(null);
                        router.push(isHadith ? '/tools/hadith' : '/(tabs)/quran');
                      }}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, backgroundColor: d.emerald, paddingVertical: 11 }}
                    >
                      <FontAwesome5 name={isHadith ? 'book' : 'book-open'} size={13} color="#fff" />
                      <T v="bodyS" style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                        {isHadith ? 'Open Hadith' : 'Open Qur’an'}
                      </T>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })()}
        </Pressable>
      </Modal>

      {/* ── pass 42 — TODAY'S GOAL modal ── */}
      <Modal visible={goalOpen} transparent animationType="fade" onRequestClose={() => setGoalOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setGoalOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 20, paddingBottom: (insets?.bottom ?? 0) + 22, maxHeight: '78%' }}>
            {/* grabber */}
            <View style={{ alignSelf: 'center', width: 40, height: 4.5, borderRadius: 3, backgroundColor: d.cardBorder, marginBottom: 15 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(212,175,55,0.13)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="bullseye" size={15} color={isDark ? d.goldBright : d.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="h3" style={{ fontWeight: '800', fontSize: 16 }}>Today’s Goal</T>
                <T v="caption" style={{ fontSize: 10, marginTop: 1 }}>{goal.done} of {goal.total} tasks completed · resets tomorrow</T>
              </View>
              <Pressable onPress={() => { haptic.selection(); setGoalOpen(false); }} style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: d.bg, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>
            {/* big progress */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, borderRadius: 16, backgroundColor: d.bg, borderWidth: 1, borderColor: d.cardBorder, padding: 14 }}>
              <ProgressRing size={56} progress={goal.done / goal.total} color={isDark ? d.goldBright : d.gold} icon={<FontAwesome5 name="bullseye" size={16} color={isDark ? d.goldBright : d.gold} />} />
              <View style={{ flex: 1 }}>
                <T v="display" style={{ fontSize: 28, fontWeight: '800', color: d.text }}>{Math.round((goal.done / goal.total) * 100)}%</T>
                <T v="caption" style={{ fontSize: 10, color: d.subtext, marginTop: 2 }}>{goal.done === goal.total ? 'Mashā’Allah — day complete! 🌙' : `${goal.total - goal.done} task${goal.total - goal.done === 1 ? '' : 's'} to go`}</T>
              </View>
            </View>
            {/* the checklist */}
            <View style={{ marginTop: 12, gap: 8 }}>
              {(goal.items.length ? goal.items : [{ key: 'surah', label: 'Read a surah', done: false }, { key: 'checkin', label: 'Daily check-in', done: false }, { key: 'dua', label: 'Make a dua', done: false }, { key: 'dhikr', label: 'Dhikr (33×)', done: false }]).map((it) => {
                const on = it.done;
                return (
                  <Pressable
                    key={it.key}
                    onPress={async () => {
                      haptic.selection();
                      const nextItems = goal.items.map((x) => (x.key === it.key ? { ...x, done: !on } : x));
                      const done = nextItems.filter((x) => x.done).length;
                      setGoal({ ...goal, items: nextItems, done });
                      await setGoalItem(it.key, !on);
                      if (!on) { markActive(); refreshProgress(); }
                    }}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, borderWidth: 1.5, borderColor: on ? 'rgba(212,175,55,0.45)' : d.cardBorder, backgroundColor: on ? 'rgba(212,175,55,0.08)' : d.bg, padding: 13, opacity: pressed ? 0.85 : 1 })}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: on ? 'rgba(212,175,55,0.7)' : d.cardBorder, backgroundColor: on ? 'rgba(212,175,55,0.18)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="check" size={11} color={on ? (isDark ? d.goldBright : d.gold) : 'transparent'} />
                    </View>
                    <T v="bodyS" style={{ flex: 1, fontSize: 13, fontWeight: '700', color: on ? d.subtext : d.text, textDecorationLine: on ? 'line-through' : 'none' }}>{it.label}</T>
                    <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: on ? 'rgba(212,175,55,0.9)' : d.faint }}>{on ? 'DONE' : 'MARK'}</T>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Instagram-style comments sheet ── */}
      <CommentsModal
        visible={!!commentPost}
        post={commentPost}
        seed={commentPost ? MOCK_COMMENTS[commentPost.id] ?? MOCK_COMMENTS[101] ?? [] : []}
        onClose={() => setCommentPost(null)}
      />
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
