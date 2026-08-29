import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { storage } from '@/lib/storage';
import { markActive, markGoal } from '@/lib/routine';
import * as api from '@/api/client';
import type { Post } from '@/api/types';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { VerificationBadge } from '@/components/VerificationBadge';
import { FeedCard } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
const deenPointsLogo = require('../../../assets/img/deenpoints.png');
import { useSaved } from '@/lib/savedPosts';

const patternDark = require('../../../assets/img/pattern-dark.png');
const patternLight = require('../../../assets/img/pattern-light.png');

type Tab = 'posts' | 'videos' | 'saved';

/**
 * Personal profile (pass 15) — rebuilt on the public-profile design: pattern
 * header, gold-ring identity card, 4-stat row, tabbed Posts / Settings.
 */
export default function Profile() {
  const { theme, mode, setMode, isDark } = useTheme();
  const d = theme.dash;
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('posts');
  const saved = useSaved().saved;
  const [posts, setPosts] = useState<Post[]>([]);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0, donations: 0 });
  const [checkin, setCheckin] = useState<'idle' | 'done' | 'already'>('idle');

  useEffect(() => {
    api.userPosts().then(setPosts);
    api.profileCounts().then(setCounts);
  }, []);

  const name = (user?.full_name as string) || (user?.username as string) || 'Muslim';
  const badge = (user?.verification_badge as string) || '';
  const username = (user?.username as string) || '';
  const bio = (user?.bio as string) || '';
  const aqeedah = (user?.aqeedah as string) || '';
  const deenpoints = (user?.deenpoints_balance as number) ?? 0;
  const photo = (user?.profile_image_url as string | number | null) ?? null;

  const doCheckIn = async () => {
    haptic.success();
    const k = 'dl.checkin.date';
    const today = new Date().toISOString().slice(0, 10);
    const last = (await storage.getItem(k)) || '';
    if (last === today) {
      setCheckin('already');
      return;
    }
    await storage.setItem(k, today);
    await api.dailyCheckin().catch(() => {});
    markActive();
    markGoal('checkin');
    setCheckin('done');
  };

  const like = (id: number) =>
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) } : p)));

  const signOut = () => {
    Alert.alert('Sign out', 'Leave DeenLink? Your session on this device will end.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n));

  const Setting = ({ icon, label, desc, tint, onPress }: { icon: string; label: string; desc: string; tint: string; onPress: () => void }) => (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${tint}18`, borderWidth: 1, borderColor: `${tint}44`, alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name={icon as never} size={13} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 13 }}>
          {label}
        </T>
        <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
          {desc}
        </T>
      </View>
      <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* header pattern */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 250, overflow: 'hidden' }}>
          <Image source={isDark ? patternDark : patternLight} style={{ width: '100%', height: '100%', opacity: d.patternOpacity * 0.5 }} />
          <LinearGradient colors={['transparent', d.bg] as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
        </View>

        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 6 }}>
          <T v="h2" style={{ flex: 1, fontWeight: '800', fontSize: 18, color: d.text }}>
            Profile
          </T>
          <Pressable
            onPress={() => {
              haptic.light();
              doCheckIn();
            }}
            hitSlop={8}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.08)', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 6, marginRight: 8, opacity: pressed ? 0.75 : 1 })}
          >
            <Image source={deenPointsLogo} style={{ width: 14, height: 14 }} resizeMode="contain" />
            <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 11 }}>
              {fmt(deenpoints)}
            </T>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.selection();
              router.push('/settings');
            }}
            hitSlop={8}
            style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
          >
            <FontAwesome5 name="cog" size={14} color={d.subtext} />
          </Pressable>
        </View>

        {/* identity card */}
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <View style={{ backgroundColor: d.card, borderRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <View style={{ borderWidth: 2, borderColor: d.gold, borderRadius: 40, padding: 2.5 }}>
                <AvatarImage source={photo} name={name} size={76} tint={d.bgSoft} border="transparent" />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <T v="h3" numberOfLines={1} ellipsizeMode="tail" style={{ color: d.text, fontWeight: '800', fontSize: 16.5, flexShrink: 1 }}>
                    {name}
                  </T>
                  {badge ? <VerificationBadge type={badge as 'blue' | 'green' | 'gold'} size={14} /> : null}
                </View>
                <T v="caption" numberOfLines={1} style={{ color: d.faint, fontSize: 11.5, fontWeight: '600' }}>
                  @{username}
                </T>
                {aqeedah ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 7, paddingVertical: 2.5, alignSelf: 'flex-start' }}>
                    <FontAwesome5 name="check-circle" size={8.5} color={d.emerald} />
                    <T v="caption" style={{ fontSize: 9, fontWeight: '700', color: d.subtext, letterSpacing: 0.4 }}>
                      {aqeedah.toUpperCase()}
                    </T>
                  </View>
                ) : null}
              </View>
            </View>

            {bio ? <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, lineHeight: 18 }}>{bio}</T> : null}

            {/* stats */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'Posts', value: fmt(counts.posts) },
                { label: 'Followers', value: fmt(counts.followers) },
                { label: 'Following', value: fmt(counts.following) },
                { label: 'Charity', value: `₦ ${fmt(counts.donations)}` },
              ].map((s) => (
                <View key={s.label} style={{ flex: 1, borderRadius: 13, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder, paddingVertical: 9, alignItems: 'center' }}>
                  <T v="stat" style={{ color: d.text, fontWeight: '800', fontSize: 13.5 }}>
                    {s.value}
                  </T>
                  <T v="caption" style={{ color: d.faint, fontSize: 9, fontWeight: '700', letterSpacing: 0.3, marginTop: 1 }}>
                    {s.label.toUpperCase()}
                  </T>
                </View>
              ))}
            </View>

            {/* actions */}
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <Pressable
                onPress={() => {
                  haptic.light();
                  router.push('/settings/edit-profile');
                }}
                style={({ pressed }) => ({ flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: d.emerald, paddingVertical: 10, opacity: pressed ? 0.85 : 1 })}
              >
                <FontAwesome5 name="user-edit" size={12} color="#FFFFFF" />
                <T v="button" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 }}>
                  Edit Profile
                </T>
              </Pressable>
              <Pressable
                onPress={doCheckIn}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: checkin === 'idle' ? 'rgba(212,175,55,0.5)' : 'rgba(74,227,143,0.5)',
                  backgroundColor: checkin === 'idle' ? (isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.07)') : 'rgba(46,204,113,0.12)',
                  paddingVertical: 10,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <FontAwesome5 name={checkin === 'idle' ? 'calendar-check' : 'check'} size={12} color={checkin === 'idle' ? d.gold : d.emerald} />
                <T v="button" style={{ color: checkin === 'idle' ? (isDark ? '#E8C96A' : '#8C6D1F') : (isDark ? '#4AE38F' : '#1D6F42'), fontWeight: '800', fontSize: 12.5 }}>
                  {checkin === 'done' ? 'Checked In' : checkin === 'already' ? 'Checked In' : 'Check In'}
                </T>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.selection();
                  router.push('/tools/charity' as never);
                }}
                style={({ pressed }) => ({ width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, opacity: pressed ? 0.8 : 1 })}
              >
                <FontAwesome5 name="hand-holding-heart" size={14} color={d.emerald} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* tabs */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16 }}>
          {([
            { id: 'posts' as Tab, label: 'My Posts', icon: 'th-large' },
            { id: 'videos' as Tab, label: 'Videos', icon: 'video' },
            { id: 'saved' as Tab, label: 'Saved', icon: 'bookmark' },
          ]).map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  haptic.selection();
                  setTab(t.id);
                }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 9,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder,
                  backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.07)') : d.card,
                }}
              >
                <FontAwesome5 name={t.icon as never} size={11} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                <T v="caption" style={{ color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext, fontWeight: '800', fontSize: 12 }}>
                  {t.label}
                </T>
              </Pressable>
            );
          })}
        </View>

        {tab === 'posts' ? (
          <View style={{ paddingTop: 14, paddingHorizontal: 16, gap: 12 }}>
            {posts.map((p) => (
              <FeedCard key={p.id} post={p} onLike={like} />
            ))}
            {posts.length === 0 ? (
              <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>
                No posts yet — share your first thought in the community.
              </T>
            ) : null}
          </View>
        ) : tab === 'videos' ? (
          <View style={{ paddingTop: 14, paddingHorizontal: 16, gap: 12 }}>
            {posts
              .filter((p) => p.video_url)
              .map((p) => (
                <FeedCard key={p.id} post={p} onLike={like} />
              ))}
            {posts.filter((p) => p.video_url).length === 0 ? (
              <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>
                No videos yet — attach a video to a community post and it shows up here.
              </T>
            ) : null}
          </View>
        ) : (
          <View style={{ paddingTop: 14, paddingHorizontal: 16, gap: 12 }}>
            {saved.map((p) => (
              <FeedCard key={p.id} post={p} />
            ))}
            {saved.length === 0 ? (
              <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>
                Nothing saved yet — tap the bookmark on any post to keep it here.
              </T>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
