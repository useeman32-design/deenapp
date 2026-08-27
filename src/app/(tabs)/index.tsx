import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Defs, Path, RadialGradient as SvgRadial, Stop } from 'react-native-svg';

import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import { getGoal, getStreak } from '@/lib/routine';
import { computePrayerTimes, formatTime, nextPrayer } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { T } from '@/components/T';
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

type PrayerKey = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
const ARC_PRAYERS: { key: PrayerKey; icon: string; angle: number }[] = [
  { key: 'Fajr', icon: 'cloud-sun', angle: 150 },
  { key: 'Dhuhr', icon: 'sun', angle: 120 },
  { key: 'Asr', icon: 'hourglass-half', angle: 90 },
  { key: 'Maghrib', icon: 'cloud-moon', angle: 60 },
  { key: 'Isha', icon: 'moon', angle: 30 },
];

const QUICK = [
  { key: 'quran', label: 'Quran', icon: { fa: 'quran' }, accent: 'emerald', href: '/(tabs)/quran' as const },
  { key: 'hadith', label: 'Hadith', icon: { fa: 'scroll' }, accent: 'gold', href: '/tools/hadith' as const },
  { key: 'dua', label: 'Dua', icon: { fa: 'praying-hands' }, accent: 'emerald', href: '/tools/dua' as const },
  { key: 'prayer', label: 'Prayer Times', icon: { fa: 'mosque' }, accent: 'gold', href: '/tools/prayer' as const },
  { key: 'dhikr', label: 'Dhikr', icon: { beads: true }, accent: 'emerald', href: '/tools/tasbeeh' as const },
];

export default function Home() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const { user } = useAuth();
  const router = useRouter();

  const [loc, setLoc] = useState<Loc | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);
  const [body, setBody] = useState('');
  const [youtube, setYoutube] = useState('');
  const [fabOpen, setFabOpen] = useState(false);
  const [streak, setStreak] = useState({ days: 0, demo: true });
  const [goal, setGoal] = useState<{ done: number; total: number; demo: boolean }>({ done: 0, total: 4, demo: true });

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
  const np = times ? nextPrayer(now, times) : null;

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
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 8 }}>
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
        <View style={{ marginHorizontal: 16, borderRadius: 28, overflow: 'hidden', backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder }}>
          <View style={{ position: 'relative', padding: 20, minHeight: 272 }}>
            <Image source={mecca} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
            <LinearGradient
              colors={[d.heroTop, d.heroBottom] as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={{ position: 'absolute', inset: 0 }}
            />
            <View style={{ position: 'relative', flexDirection: 'row' }}>
              {/* Left column */}
              <View style={{ flex: 1, paddingRight: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23 }}>
                    <Glow size={76} color={d.emerald} id="glow-mosque" opacity={0.4} />
                    <View style={{ position: 'absolute', inset: 0, borderRadius: 23, borderWidth: 1, borderColor: `${d.emerald}66`, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="mosque" size={20} color={d.emerald} />
                    </View>
                  </View>
                  <Pressable onPress={() => router.push('/tools/prayer')} hitSlop={8}>
                    <T v="caption" style={{ color: d.gold, fontSize: 11.5, fontWeight: '600' }}>
                      View All <T v="caption" style={{ color: d.gold, fontSize: 11.5 }}>→</T>
                    </T>
                  </Pressable>
                </View>

                <T v="meta" style={{ color: d.subtext, marginTop: 16, letterSpacing: 1.2, fontSize: 10.5 }}>
                  NEXT PRAYER
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <T v="display" style={{ color: '#FFFFFF', fontSize: 29, fontWeight: '700' }}>
                    {np?.name ?? '—'}
                  </T>
                  <PulseDot color={d.emerald} />
                </View>
                <T v="stat" style={{ color: d.emerald, fontSize: 23, fontWeight: '700', marginTop: 2 }}>
                  {np ? formatTime(np.time) : '—'}
                </T>
                <T v="bodyS" style={{ color: d.gold, fontSize: 11.5, fontWeight: '500', marginTop: 5, lineHeight: 16 }}>
                  {countdown}
                </T>

                <Pressable
                  onPress={() => router.push('/tools/qibla')}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    alignSelf: 'flex-start',
                    marginTop: 16,
                    paddingHorizontal: 15,
                    paddingVertical: 9,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: `${d.gold}99`,
                    backgroundColor: `${d.gold}14`,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <FontAwesome5 name="kaaba" size={13} color={d.goldBright} />
                  <T v="button" style={{ color: d.goldBright, fontSize: 12.5, fontWeight: '600' }}>
                    Qibla Finder
                  </T>
                </Pressable>
              </View>

              {/* Right: prayer arc */}
              <PrayerArc current={np?.name ?? null} />
            </View>
          </View>
        </View>

        {/* 3 ─ Quick Access */}
        <View style={{ marginHorizontal: 16, marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
              Quick Access
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <FontAwesome5 name="edit" size={10} color={d.faint} />
              <T v="caption" style={{ color: d.faint, fontSize: 11.5 }}>
                Edit
              </T>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
            {QUICK.map((it) => (
              <QuickTile key={it.key} item={it} onPress={() => router.push(it.href)} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                    <T v="display" style={{ color: d.text, fontSize: 28, fontWeight: '700' }}>
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
                  size={56}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <View>
                  <T v="display" style={{ color: d.text, fontSize: 28, fontWeight: '700' }}>
                    {Math.round((goal.done / goal.total) * 100)}%
                  </T>
                  <T v="caption" style={{ color: d.subtext, fontSize: 10, marginTop: 4, lineHeight: 13 }}>
                    {goal.done} of {goal.total} tasks completed
                  </T>
                </View>
                <ProgressRing
                  size={56}
                  progress={goal.done / goal.total}
                  color={isDark ? d.goldBright : d.gold}
                  icon={<FontAwesome5 name="bullseye" size={15} color={isDark ? d.goldBright : d.gold} />}
                />
              </View>
            </View>
          </View>
        </View>

        {/* 5 ─ Continue Learning */}
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

      {/* FAB */}
      {fabOpen ? (
        <View style={{ position: 'absolute', bottom: 128, right: 24, gap: 14, alignItems: 'center', zIndex: 40 }}>
          {[
            { label: 'Add Post', icon: 'plus' as const, onPress: () => { setFabOpen(false); setCompose(true); } },
            { label: 'Send Message', icon: 'paper-plane' as const, onPress: () => { setFabOpen(false); router.push('/(tabs)/profile'); } },
            { label: 'AI Assistant', icon: 'robot' as const, onPress: () => { setFabOpen(false); } },
          ].map((it) => (
            <View key={it.label} style={{ alignItems: 'center', gap: 4 }}>
              <Pressable
                onPress={it.onPress}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: d.card,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 5,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <FontAwesome5 name={it.icon} size={15} color={d.text} />
              </Pressable>
              <T v="caption" style={{ color: d.text, fontSize: 9.5, fontWeight: '600' }}>
                {it.label}
              </T>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        onPress={() => setFabOpen((o) => !o)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 110,
          right: 18,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: d.emerald,
          borderWidth: 1,
          borderColor: `${d.gold}88`,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: fabOpen ? '45deg' : '0deg' }],
          opacity: pressed ? 0.88 : 1,
          shadowColor: d.emerald,
          shadowOpacity: 0.5,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
          zIndex: 41,
        })}
      >
        <FontAwesome5 name="plus" size={19} color="#fff" />
      </Pressable>

      {/* Add post modal */}
      <Modal visible={compose} transparent animationType="fade" onRequestClose={() => setCompose(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }} onPress={() => setCompose(false)}>
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: d.card,
              borderRadius: 20,
              padding: 22,
              maxWidth: 500,
              width: '100%',
              alignSelf: 'center',
              gap: 14,
              borderWidth: 1,
              borderColor: d.cardBorder,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: d.cardBorder }}>
              <T v="h1" style={{ color: d.text, fontSize: 18, fontWeight: '700' }}>
                Create new post
              </T>
              <Pressable onPress={() => setCompose(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write your post description…"
              placeholderTextColor={d.faint}
              multiline
              numberOfLines={5}
              style={{
                backgroundColor: d.bgSoft,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: d.cardBorder,
                paddingHorizontal: 13,
                paddingTop: 11,
                fontFamily: 'Poppins',
                fontSize: 14,
                color: d.text,
                minHeight: 110,
                textAlignVertical: 'top',
              }}
            />
            <TextInput
              value={youtube}
              onChangeText={setYoutube}
              placeholder="YouTube link (optional)"
              placeholderTextColor={d.faint}
              autoCapitalize="none"
              keyboardType="url"
              style={{
                backgroundColor: d.bgSoft,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: d.cardBorder,
                paddingHorizontal: 13,
                paddingVertical: 11,
                fontFamily: 'Poppins',
                fontSize: 13.5,
                color: d.text,
              }}
            />
            <Pressable
              onPress={() => {
                if (!body.trim() && !youtube.trim()) return;
                setCompose(false);
                api.createPost(body.trim(), youtube.trim() || undefined).catch(() => {});
                setBody('');
                setYoutube('');
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: d.emerald,
                borderRadius: 12,
                padding: 13,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <FontAwesome5 name="paper-plane" size={13} color="#fff" />
              <T v="button" color="onPrimary" style={{ color: '#fff', fontWeight: '600' }}>
                Post
              </T>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  item: (typeof QUICK)[number];
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const d = theme.dash;
  const accent = item.accent === 'gold' ? d.gold : d.emerald;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 66,
        height: 82,
        borderRadius: 18,
        backgroundColor: d.card,
        borderWidth: 1,
        borderColor: `${accent}55`,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        opacity: pressed ? 0.85 : 1,
        overflow: 'hidden',
      })}
    >
      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Glow size={56} color={accent} id={`glow-quick-${item.key}`} opacity={0.35} />
        {item.icon.beads ? (
          <BeadsIcon size={21} color={accent} />
        ) : (
          <FontAwesome5 name={item.icon.fa} size={21} color={accent} />
        )}
      </View>
      <T v="caption" style={{ color: d.subtext, fontSize: 9.5, fontWeight: '600' }}>
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

/* --------------------------- Prayer arc (hero) --------------------------- */

function PrayerArc({ current }: { current: string | null }) {
  const { theme } = useTheme();
  const d = theme.dash;
  const W = 150;
  const H = 150;
  const cx = W / 2;
  const cy = H - 12;
  const R = 64;
  const pos = (angleDeg: number, radius = R) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) };
  };
  const start = pos(150);
  const end = pos(30);

  // pulse for the current prayer node
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={{ width: W, height: H, marginRight: 2 }}>
      <Svg width={W} height={H}>
        <Path
          d={`M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`}
          stroke={d.text}
          strokeOpacity={0.18}
          strokeWidth={1.2}
          strokeDasharray="1 5"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      {/* sun at the top of the arc */}
      <View style={{ position: 'absolute', left: cx - 11, top: cy - R - 28, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Glow size={36} color={d.goldBright} id="glow-sun" opacity={0.5} />
        <FontAwesome5 name="sun" size={13} color={d.goldBright} />
      </View>

      {/* moon near Isha */}
      <View style={{ position: 'absolute', left: pos(34, R - 26).x - 8, top: pos(34, R - 26).y - 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name="moon" size={9} color={d.faint} />
      </View>

      {/* prayer nodes */}
      {ARC_PRAYERS.map((p) => {
        const pt = pos(p.angle);
        const active = current === p.key;
        const size = active ? 34 : 24;
        return (
          <View key={p.key}>
            {active ? (
              <Animated.View
                style={{
                  position: 'absolute',
                  left: pt.x - 19,
                  top: pt.y - 19,
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  borderWidth: 1.5,
                  borderColor: d.emerald,
                  transform: [{ scale: ringScale }],
                  opacity: ringOpacity,
                }}
              />
            ) : null}
            <View
              style={{
                position: 'absolute',
                left: pt.x - size / 2,
                top: pt.y - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: active ? d.emerald : d.card,
                borderWidth: 1,
                borderColor: active ? d.emerald : `${d.text}30`,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: active ? d.emerald : 'transparent',
                shadowOpacity: 0.7,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 2 },
                elevation: active ? 6 : 1,
              }}
            >
              <FontAwesome5 name={p.icon} size={active ? 14 : 10.5} color={active ? '#fff' : d.faint} />
            </View>
            <View style={{ position: 'absolute', left: pt.x - 22, top: pt.y + size / 2 + 3, width: 44, alignItems: 'center' }}>
              <T v="caption" style={{ color: active ? d.emerald : d.faint, fontSize: 8.5, fontWeight: active ? '600' : '500' }}>
                {p.key}
              </T>
            </View>
          </View>
        );
      })}
    </View>
  );
}
