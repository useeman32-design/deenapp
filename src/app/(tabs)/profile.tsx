import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { storage } from '@/lib/storage';
import { markActive, markGoal } from '@/lib/routine';
import * as api from '@/api/client';
import type { Post } from '@/api/types';
import { T } from '@/components/T';
import { Avatar } from '@/components/Avatar';
import { FeedCard } from '@/components/FeedCard';
import { VerificationBadge } from '@/components/VerificationBadge';
import {
  BellIcon,
  CheckIcon,
  GearIcon,
  GiftIcon,
  LogOutIcon,
  MoonStarIcon,
  ShareIcon,
  SunIcon,
} from '@/components/Icons';

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function Profile() {
  const { theme, mode, setMode, isDark } = useTheme();
  const d = theme.dash;
  const { user, logout } = useAuth();
  const router = useRouter();
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

  const doCheckIn = async () => {
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
    setPosts((ps) =>
      ps.map((p) => (p.id === id ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) } : p)),
    );

  const signOut = () => {
    Alert.alert('Sign out', 'Leave DeenLink? Your session on this device will end.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  const stat = (n: number, l: string) => (
    <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(20,36,28,0.04)', borderWidth: 1, borderColor: d.cardBorder, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
      <T v="stat" style={{ fontSize: 16 }}>
        {n.toLocaleString()}
      </T>
      <T v="caption" style={{ fontSize: 10, marginTop: 2 }}>{l}</T>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <FeedCard post={item} onLike={like} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Green hero */}
            <View style={{ height: 190, position: 'relative', overflow: 'hidden' }}>
              <Image
                source={mode === 'dark' ? require('../../../assets/img/pattern-dark.png') : require('../../../assets/img/pattern-light.png')}
                style={{ position: 'absolute', width: '100%', height: '100%', opacity: d.patternOpacity * 0.55 }}
                resizeMode="cover"
              />
              <LinearGradient
                colors={(mode === 'dark'
                  ? ['rgba(3,20,12,0.96)', 'rgba(8,44,27,0.9)']
                  : ['rgba(6,38,23,0.92)', 'rgba(16,66,42,0.85)']) as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', inset: 0 }}
              />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                <T v="h2" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 20 }}>
                  Profile
                </T>
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => router.push('/(tabs)/profile')}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: theme.glass,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <BellIcon size={15} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => {}}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: theme.glass,
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginRight: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <GiftIcon size={13} color="#fff" />
                  <T v="caption" color="onPrimary" style={{ fontWeight: '700' }}>
                    {deenpoints.toLocaleString()}
                  </T>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/settings/edit-profile')}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: theme.glass,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <GearIcon size={16} color="#fff" />
                </Pressable>
              </View>
            </View>

            {/* Profile card (overlaps hero) */}
            <View
              style={{
                backgroundColor: d.card,
                borderWidth: 1,
                borderColor: d.cardBorder,
                borderRadius: 20,
                margin: -54,
                marginLeft: 16,
                marginRight: 16,
                padding: 20,
                shadowColor: '#000',
                shadowOpacity: isDark ? 0.3 : 0.08,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              }}
            >
              <View style={{ alignItems: 'center' }}>
                <Avatar name={name} color={theme.primary} size={110} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <T v="display" style={{ fontSize: 24 }}>{name}</T>
                  {badge ? <VerificationBadge type={badge as 'blue' | 'green' | 'gold'} size={17} /> : null}
                </View>
                <T v="body" color="subtext" style={{ marginTop: 4 }}>
                  {username ? `@${username}` : 'Member'}
                </T>
                {bio ? (
                  <T v="body" style={{ marginTop: 10, textAlign: 'center', lineHeight: 20, maxWidth: 340 }}>
                    {bio}
                  </T>
                ) : null}
                {aqeedah ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 12,
                      backgroundColor: isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)',
                      borderColor: isDark ? 'rgba(74,227,143,0.45)' : 'rgba(29,111,66,0.3)',
                      borderWidth: 1,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <CheckIcon size={13} color={theme.primary} />
                    <T v="caption" color="primary" style={{ fontWeight: '600' }}>
                      {aqeedah}
                    </T>
                  </View>
                ) : null}
              </View>

              {/* Stats */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                {stat(counts.posts, 'Posts')}
                {stat(counts.followers, 'Followers')}
                {stat(counts.following, 'Following')}
                {stat(counts.donations, 'Donations')}
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={() => router.push('/settings/edit-profile')}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: theme.primary,
                    borderRadius: 12,
                    padding: 12,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <T v="button" color="onPrimary" style={{ fontWeight: '700' }}>
                    Edit Profile
                  </T>
                </Pressable>
                <Pressable
                  onPress={doCheckIn}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: checkin === 'done' ? theme.accentSoft : theme.primarySoft,
                    borderRadius: 12,
                    padding: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: checkin === 'done' ? theme.accent : 'transparent',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <T v="button" color={checkin === 'done' ? 'accent' : 'primary'} style={{ fontWeight: '700' }}>
                    {checkin === 'done' ? 'Checked In ✓' : checkin === 'already' ? 'Checked In' : 'Check In'}
                  </T>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/tools/charity')}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: theme.cardSoft,
                    borderRadius: 12,
                    padding: 12,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <T v="button" style={{ fontWeight: '700' }}>
                    Donate
                  </T>
                </Pressable>
              </View>
            </View>

            {/* Settings row */}
            <View style={{ paddingTop: 18, paddingLeft: 16, paddingRight: 16, paddingBottom: 4 }}>
              <T v="h3" style={{ marginBottom: 10 }}>
                Settings
              </T>
              <View
                style={{
                  backgroundColor: d.card,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  borderRadius: 16,
                  shadowColor: '#000',
                  shadowOpacity: isDark ? 0.22 : 0.04,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 1,
                }}
              >
                <SettingRow
                  icon={mode === 'dark' ? <MoonStarIcon size={18} color={theme.primary} /> : <SunIcon size={18} color={theme.primary} />}
                  label="Appearance"
                  desc={mode === 'dark' ? 'Dark mode on' : 'Light mode on'}
                  onPress={() => setMode((mode === 'dark' ? 'light' : 'dark') as ThemeMode)}
                />
                <SettingRow
                  icon={<ShareIcon size={18} color={theme.primary} />}
                  label="Share DeenLink"
                  desc="Invite friends to the community"
                  onPress={() => Alert.alert('Share', 'DeenLink — your deen, connected.')}
                />
                <SettingRow
                  icon={<GiftIcon size={18} color={theme.primary} />}
                  label="DeenPoints"
                  desc="How to earn & spend your points"
                  onPress={() => Alert.alert('DeenPoints', 'Earn daily via check-ins, posts, and learning activities.')}
                />
                <SettingRow
                  icon={<LogOutIcon size={18} color={theme.danger} />}
                  label="Sign Out"
                  desc="End your session on this device"
                  danger
                  onPress={signOut}
                />
              </View>
            </View>

            {/* Posts */}
            <View style={{ paddingTop: 18, paddingLeft: 16, paddingRight: 16, paddingBottom: 4 }}>
              <T v="h3" style={{ marginBottom: 12 }}>
                Your Posts
              </T>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingTop: 10, paddingLeft: 24, paddingRight: 24, paddingBottom: 30 }}>
            <T v="caption" style={{ textAlign: 'center' }}>
              {api.isLive() ? 'You haven’t posted yet.' : 'No posts yet — share a reminder!'}
            </T>
          </View>
        }
      />
    </View>
  );
}

function SettingRow({
  icon,
  label,
  desc,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.cardSoft,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: danger ? theme.dangerSoft : theme.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <T v="bodyS" style={{ fontWeight: '700', color: danger ? theme.danger : theme.text }}>
          {label}
        </T>
        {desc ? <T v="caption" style={{ marginTop: 1 }}>{desc}</T> : null}
      </View>
    </Pressable>
  );
}
