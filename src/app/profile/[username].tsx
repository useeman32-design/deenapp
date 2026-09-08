import { useEffect, useMemo, useState, useRef } from 'react';
import { goBack } from '@/lib/navigation';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, Image, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ContentShareSheet } from '@/components/ContentShareSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  MOCK_ACCOUNTS,
  MOCK_FEED,
  MOCK_PROFILES,
  MOCK_REELS,
  type MockProfile,
} from '@/api/mocks';
import { blockUser, directFatwas, getUserProfile, isLive, reportAccount, toggleFollow as srvToggleFollow, type PublicProfile } from '@/api/client';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { FeedCard, AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
import { useIsGuest } from '@/lib/guest';
import { LoginRequired } from '@/components/LoginRequired';

const patternDark = require('../../../assets/img/pattern-dark.png');
const patternLight = require('../../../assets/img/pattern-light.png');

const W = Dimensions.get('window').width;

const ANSWERED: Record<string, Array<{ q: string; a: string }>> = {
  alameen: [
    {
      q: 'Can I pray the Qasr shortening while travelling in the city?',
      a: 'You may shorten the four-rak’ah prayers to two if your journey meets the conditions (distance and intent). If you settle in a place for a known duration (≈10 days or more), pray them in full.',
    },
    {
      q: 'Is it permissible to delay Isha past midnight for a better congregation?',
      a: 'The preferred time ends before midnight. Delaying past midnight is only disliked if it becomes a habit; waiting briefly for the Imaam is acceptable with a sound intention.',
    },
  ],
  kunfai_ibrahim: [
    {
      q: 'My student keeps merging the letters in madd — how do I correct this?',
      a: 'Start with the madd al-thabīʿī (2 counts) on isolated words until it is automatic, then move into short āyāt. Slower, measured recitation cures most merging.',
    },
  ],
  usman_ahmad: [
    {
      q: 'What is the ruling on recording the Imam and distributing the khutbah?',
      a: 'Permissible if there is no deception or false attribution — many masjids do this for those who miss Jumuʿah. Ensure the context of the speech is preserved.',
    },
  ],
};

type ProfileTab = 'posts' | 'questions' | 'videos';

/**
 * Public profile — refined from deenlink.org's public profile page to
 * our dash design: large photo, name + @handle + badges + field,
 * Posts / Followers / Following / Charity stats, Follow + Share actions,
 * and Posts / Questions (scholars) / About tabs.
 */
function PublicProfileScreenInner() {
  const { username = '', tab: initialTab } = useLocalSearchParams<{ username: string; tab?: string }>();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<ProfileTab>(initialTab === 'videos' || initialTab === 'questions' ? (initialTab as ProfileTab) : 'posts');
  const [photoPreview, setPhotoPreview] = useState(false);
  // the account's reels — shown in the Videos tab
  const userReels = useMemo(() => MOCK_REELS.filter((r) => r.username === username), [username]);
  const [following, setFollowing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  /* pass 74 — was declared below the `if (!profile)` early return: the first
   * successful fetch changed the hook count and crashed the screen (#310). */
  const [shareOpen, setShareOpen] = useState(false);
  /* pass 66-night — live profile: real stats, bio, photo and follow edge. */
  const [liveP, setLiveP] = useState<PublicProfile | null>(null);
  /* pass 75 — a real scholar's answered questions come from the server */
  const [liveQAs, setLiveQAs] = useState<Array<{ q: string; a: string }> | null>(null);
  /* pass 75 — account tools: report this account (server account_reports) */
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  /* pass 76 (Tier 3) — block/unblock, server-enforced */
  const [iBlocked, setIBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  /* pass 81 — block/report live in a top-right ⋮ dropdown, not the action row */
  const [menuOpen, setMenuOpen] = useState(false);
  /* pass 74 — WAIT for the session restore: on a hard navigation (web refresh
   * or an MPA route hop) this screen mounts before /me resolves, isLive() is
   * still false, the fetch was skipped and real accounts showed "not found". */
  const { ready, user } = useAuth();
  /* pass 81 — track the fetch itself: between `ready` and liveP landing the
   * memo was null and the screen flashed "couldn't find" for real accounts. */
  const [liveLoading, setLiveLoading] = useState(true);
  useEffect(() => {
    if (!ready) return;
    if (!isLive() || !username) { setLiveLoading(false); return; }
    setLiveLoading(true);
    void getUserProfile(username)
      .then((p) => {
        if (!p) return;
        setLiveP(p);
        setFollowing(!!p.following_by_me);
      })
      .finally(() => setLiveLoading(false));
  }, [username, ready]);
  useEffect(() => {
    if (!liveP || liveP.user_type !== 'scholar') return;
    void directFatwas(30, liveP.id).then((rows) => {
      if (rows.length) setLiveQAs(rows.map((r) => ({ q: r.question || r.title, a: r.answer })));
    });
  }, [liveP]);

  const profile: MockProfile | null = useMemo(() => {
    /* pass 66-night — real accounts surface from the server even when the
     * bundled demo roster has never heard of them. */
    if (liveP) {
      return {
        username: liveP.username,
        full_name: liveP.full_name || liveP.username,
        photo: liveP.profile_image_url ?? null,
        bio: liveP.bio ?? '', /* pass 83-3: no fake bio — empty renders "No bio" */
        posts_count: liveP.posts ?? 0,
        followers: liveP.followers ?? 0,
        following: liveP.following ?? 0,
      } as MockProfile;
    }
    const p = MOCK_PROFILES[username];
    if (p) return p;
    const acc = MOCK_ACCOUNTS.find((a) => a.username === username);
    if (acc) {
      return {
        username: acc.username,
        full_name: acc.full_name,
        badge: acc.badge as MockProfile['badge'],
        fields: acc.fields,
        photo: acc.photo,
        bio: 'DeenLink community member.',
        posts_count: 0,
        followers: 0,
        following: 0,
      };
    }
    const post = MOCK_FEED.find((p) => p.user.username === username);
    if (post) {
      return {
        username: post.user.username,
        full_name: post.user.full_name ?? post.user.username,
        fields: (post.user as { fields?: string | null }).fields ?? null,
        bio: 'DeenLink community member.',
        posts_count: 0,
        followers: 0,
        following: 0,
      };
    }
    return null;
    /* pass 74 — MUST recompute when liveP lands, else a hard-nav mount
     * freezes the memo at null and real accounts show "couldn't find". */
  }, [username, liveP]);

  const posts = useMemo(
    () => MOCK_FEED.filter((p) => p.user.username === username),
    [username],
  );
  /* live scholar → the server's answered questions win over the demo set */
  const answered = (liveP?.user_type === 'scholar' || profile?.scholar)
    ? (liveQAs ?? ANSWERED[username] ?? [])
    : [];

  if (!profile) {
    if (!ready || liveLoading) {
      /* session still restoring — never flash "not found" for a real account */
      return <BreathingContent bar={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)'} />;
    }
    return (
      <View style={{ flex: 1, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
        <FontAwesome5 name="question-circle" size={30} color={d.faint} />
        <T v="bodyS" style={{ color: d.subtext, fontSize: 13, fontWeight: '600' }}>
          We couldn’t find this account.
        </T>
        <Pressable onPress={() => goBack(router)} style={{ borderRadius: 10, backgroundColor: d.emerald, paddingHorizontal: 16, paddingVertical: 9 }}>
          <T v="bodyS" style={{ color: isDark ? '#062312' : '#fff', fontWeight: '700', fontSize: 12 }}>
            Go back
          </T>
        </Pressable>
      </View>
    );
  }

  /* pass 66-night — live values win; the mock fills anything the API omits. */
  const photo = liveP?.profile_image_url ?? profile.photo ?? null;
  const name = liveP?.full_name || profile.full_name;
  const bioText = liveP?.bio ?? profile.bio ?? null;
  const followerCount = liveP ? liveP.followers : profile.followers;
  const followingCount = liveP ? liveP.following : profile.following;
  const isScholar = !!profile.scholar;
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n));

  const shareProfile = () => {
    haptic.light();
    setShareOpen(true);
  };

  const toggleFollow = () => {
    haptic.success();
    const want = !following;
    setFollowing(want);
    /* live: the real user_follows edge flips */
    if (liveP) void srvToggleFollow(liveP.id, want);
  };

  const TABS: Array<{ id: ProfileTab; label: string }> = [
    { id: 'posts', label: 'Posts' },
    ...(isScholar ? [{ id: 'questions' as ProfileTab, label: 'Questions' }] : []),
    { id: 'videos', label: 'Videos' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* pass 83-3 — tap-outside backdrop sized to the SCREEN (the old one hung
          off negative offsets, growing the page and making it shrink/shake) */}
      {menuOpen ? (
        <Pressable
          accessibilityLabel="Close profile options"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 55 }}
          onPress={() => setMenuOpen(false)}
        />
      ) : null}
      {/* pass 81 — account actions dropdown, anchored top-right of the container */}
      {liveP && user && liveP.username !== user.username ? (
        <View style={{ position: 'absolute', top: insets.top + 10, right: 16, zIndex: 60 }}>
          <Pressable
            accessibilityLabel="Profile options"
            onPress={() => { haptic.selection(); setMenuOpen((v) => !v); }}
            style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
          >
            <FontAwesome5 name="ellipsis-v" size={14} color={d.subtext} />
          </Pressable>
          {menuOpen ? (
            <>
              <View style={{ position: 'absolute', top: 44, right: 0, width: 196, borderRadius: 14, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, paddingVertical: 6, shadowColor: '#000', shadowOpacity: isDark ? 0.4 : 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } }}>
                <Pressable
                  disabled={blockBusy}
                  onPress={() => {
                    setMenuOpen(false);
                    haptic.light();
                    setBlockBusy(true);
                    void blockUser(liveP.username, !iBlocked).then((ok) => {
                      setBlockBusy(false);
                      if (ok) {
                        setIBlocked((v) => !v);
                        Alert.alert(iBlocked ? 'Unblocked' : `Blocked @${liveP.username}`, iBlocked ? 'They can message and find you again.' : 'They can no longer message, follow or find you. Manage this in Settings → Privacy & Safety.');
                      } else {
                        Alert.alert('Could not update', 'Please try again in a moment.');
                      }
                    });
                  }}
                  style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 }}
                >
                  <FontAwesome5 name={iBlocked ? 'user-check' : 'user-slash'} size={12} color="#E05252" />
                  <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700', color: d.text }}>{blockBusy ? 'Working…' : iBlocked ? 'Unblock account' : 'Block account'}</T>
                </Pressable>
                <Pressable
                  onPress={() => { setMenuOpen(false); haptic.selection(); setReportOpen(true); }}
                  style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 }}
                >
                  <FontAwesome5 name="flag" size={12} color="#E05252" />
                  <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700', color: d.text }}>Report account</T>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {/* header pattern */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 240, overflow: 'hidden' }}>
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

        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 6 }}>
          <Pressable
            onPress={() => goBack(router)}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 19,
              borderWidth: 1,
              borderColor: d.cardBorder,
              backgroundColor: d.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <FontAwesome5 name="chevron-left" size={14} color={d.text} />
          </Pressable>
          <T v="body" style={{ flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 14.5, color: d.text, marginRight: 38 }}>
            Public Profile
          </T>
        </View>

        {/* identity card */}
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <View
            style={{
              backgroundColor: d.card,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: d.cardBorder,
              padding: 16,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <View style={{ borderWidth: 2, borderColor: d.gold, borderRadius: 40, padding: 2.5 }}>
                {/* pass 18: tapping the photo on a PROFILE page opens fullscreen preview (only place it does) */}
                <Pressable
                  onPress={() => {
                    haptic.selection();
                    setPhotoPreview(true);
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                >
                  <AvatarImage source={photo} name={name} size={76} tint={d.bgSoft} border="transparent" gender={((liveP as { gender?: string } | null)?.gender ?? null) as string | null} />
                </Pressable>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
                  {/* pass 67 — the FULL name, always: long names wrap onto a
                   * second line instead of dying as "Abdulrahman Al-H…" */}
                  <T v="h3" style={{ color: d.text, fontWeight: '800', fontSize: 16.5, flexShrink: 1, lineHeight: 22 }}>
                    {name}
                  </T>
                  {profile.badge ? <VerificationBadge type={profile.badge} size={14} /> : null}
                </View>
                <T v="caption" numberOfLines={1} style={{ color: d.faint, fontSize: 11.5, fontWeight: '600' }}>
                  @{profile.username}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {isScholar ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        borderRadius: 8,
                        backgroundColor: isDark ? 'rgba(212,175,55,0.14)' : 'rgba(140,109,31,0.10)',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(212,175,55,0.45)' : 'rgba(140,109,31,0.35)',
                        paddingHorizontal: 7,
                        paddingVertical: 2.5,
                      }}
                    >
                      <FontAwesome5 name="graduation-cap" size={8.5} color={d.gold} />
                      <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: isDark ? '#E8C96A' : '#8C6D1F', letterSpacing: 0.4 }}>
                        {String(profile.scholar_title ?? 'Scholar').toUpperCase()}
                      </T>
                    </View>
                  ) : null}
                  {profile.fields ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: d.cardBorder,
                        paddingHorizontal: 7,
                        paddingVertical: 2.5,
                      }}
                    >
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: d.gold }} />
                      <T v="caption" style={{ fontSize: 9, fontWeight: '700', color: d.subtext, letterSpacing: 0.4 }}>
                        {String(profile.fields).toUpperCase()}
                      </T>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* pass 83-3 — real bio, or an honest "No bio" (never a fake one) */}
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, lineHeight: 18 }}>
              {bioText?.trim() ? bioText : 'No bio'}
            </T>

            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              {profile.location ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <FontAwesome5 name="map-marker-alt" size={10} color={d.faint} />
                  <T v="caption" style={{ color: d.subtext, fontSize: 10.5, fontWeight: '600' }}>
                    {profile.location}
                  </T>
                </View>
              ) : null}
              {profile.joined ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <FontAwesome5 name="calendar-alt" size={10} color={d.faint} />
                  <T v="caption" style={{ color: d.subtext, fontSize: 10.5, fontWeight: '600' }}>
                    {profile.joined}
                  </T>
                </View>
              ) : null}
            </View>

            {/* stats: Posts / Followers / Following / Charity */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'Posts', value: fmt(Math.max(posts.length, liveP?.posts ?? profile.posts_count)), tab: null },
                { label: 'Followers', value: fmt(followerCount + (following !== !!liveP?.following_by_me ? (following ? 1 : -1) : 0)), tab: 'followers' },
                { label: 'Following', value: fmt(followingCount), tab: 'following' },
                { label: 'Charity', value: '₦ 12.4k', tab: null },
              ].map((s) => {
                const inner = (
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 13,
                      backgroundColor: d.bgSoft,
                      borderWidth: 1,
                      borderColor: d.cardBorder,
                      paddingVertical: 9,
                      alignItems: 'center',
                    }}
                  >
                  <T v="stat" style={{ color: d.text, fontWeight: '800', fontSize: 13.5 }}>
                    {s.value}
                  </T>
                  <T v="caption" style={{ color: d.faint, fontSize: 9, fontWeight: '700', letterSpacing: 0.3, marginTop: 1 }}>
                    {s.label.toUpperCase()}
                  </T>
                  </View>
                );
                return s.tab ? (
                  <Pressable key={s.label} style={{ flex: 1 }} onPress={() => { haptic.selection(); router.push({ pathname: '/tools/connections', params: { tab: s.tab! } } as never); }}>
                    {inner}
                  </Pressable>
                ) : (
                  <View key={s.label} style={{ flex: 1 }}>
                    {inner}
                  </View>
                );
              })}
            </View>

            {/* actions */}
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <Pressable
                onPress={toggleFollow}
                style={({ pressed }) => ({
                  flex: 1.4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 12,
                  backgroundColor: following ? 'transparent' : d.emerald,
                  borderWidth: 1,
                  borderColor: d.emerald,
                  paddingVertical: 10,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <FontAwesome5 name={following ? 'user-check' : 'user-plus'} size={12} color={following ? (isDark ? '#4AE38F' : '#0E7A46') : isDark ? '#062312' : '#fff'} />
                <T v="body" style={{ color: following ? (isDark ? '#4AE38F' : '#0E7A46') : isDark ? '#062312' : '#fff', fontWeight: '800', fontSize: 12 }}>
                  {following ? 'Following' : 'Follow'}
                </T>
              </Pressable>
              {/* pass 59 — message this user straight from their profile */}
              <Pressable
                onPress={() => { haptic.light(); router.push(`/tools/inbox?u=${profile.username}` as never); }}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 12,
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  paddingVertical: 10,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <FontAwesome5 name="comment-dots" size={12} color={isDark ? '#4AE38F' : '#0E7A46'} />
                <T v="body" style={{ color: isDark ? '#4AE38F' : '#0E7A46', fontWeight: '800', fontSize: 12 }}>Message</T>
              </Pressable>
              <Pressable
                onPress={shareProfile}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  backgroundColor: d.bgSoft,
                  paddingVertical: 10,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <FontAwesome5 name="share-alt" size={11} color={d.subtext} />
                <T v="body" style={{ color: d.subtext, fontWeight: '800', fontSize: 12 }}>
                  Share
                </T>
              </Pressable>
            </View>
          </View>
        </View>

        {/* tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16, marginBottom: 14 }}>
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  haptic.selection();
                  setTab(t.id);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderRadius: 11,
                  backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.10)') : 'transparent',
                  borderWidth: 1,
                  borderColor: on ? (isDark ? 'rgba(46,204,113,0.5)' : 'rgba(14,122,70,0.35)') : 'transparent',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <T v="bodyS" style={{ color: on ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext, fontWeight: '700', fontSize: 12.5 }}>
                  {t.label}
                </T>
              </Pressable>
            );
          })}
        </View>

        {/* Posts */}
        {tab === 'posts' ? (
          <View style={{ marginHorizontal: 16, gap: 12 }}>
            {posts.length === 0 ? (
              <View
                style={{
                  backgroundColor: d.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  padding: 24,
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FontAwesome5 name="feather-alt" size={20} color={d.faint} />
                <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, fontWeight: '600' }}>
                  No public posts yet.
                </T>
              </View>
            ) : (
              posts.map((p) => (
                <FeedCard
                  key={p.id}
                  dash={d}
                  post={{ ...p, liked_by_me: likedPosts.has(p.id), like_count: (p.like_count ?? 0) + (likedPosts.has(p.id) ? 1 : 0) }}
                  onLike={(id) =>
                    setLikedPosts((prev) => {
                      const n = new Set(prev);
                      if (n.has(id)) n.delete(id);
                      else n.add(id);
                      return n;
                    })
                  }
                />
              ))
            )}
          </View>
        ) : null}

        {/* Questions (scholars) */}
        {tab === 'questions' && isScholar ? (
          <View style={{ marginHorizontal: 16, gap: 12 }}>
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(212,175,55,0.4)' : 'rgba(140,109,31,0.35)',
                backgroundColor: isDark ? 'rgba(212,175,55,0.07)' : 'rgba(140,109,31,0.05)',
                padding: 14,
                flexDirection: 'row',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark ? 'rgba(212,175,55,0.16)' : 'rgba(140,109,31,0.12)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(212,175,55,0.45)' : 'rgba(140,109,31,0.35)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FontAwesome5 name="question-circle" size={14} color={d.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ color: d.text, fontWeight: '700', fontSize: 12.5 }}>
                  Ask this scholar a question
                </T>
                <T v="caption" style={{ color: d.subtext, fontSize: 11, marginTop: 2 }}>
                  Browse their answered questions below.
                </T>
              </View>
            </View>

            {answered.length === 0 ? (
              <T v="bodyS" style={{ color: d.faint, fontSize: 12, paddingVertical: 8, textAlign: 'center' }}>
                No answered questions yet.
              </T>
            ) : (
              answered.map((qa, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: d.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: d.cardBorder,
                    padding: 14,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <FontAwesome5 name="question" size={11} color={d.emerald} style={{ marginTop: 3 }} />
                    <T v="bodyS" style={{ color: d.text, fontWeight: '700', fontSize: 12.5, flex: 1, lineHeight: 18 }}>
                      {qa.q}
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <FontAwesome5 name="check-circle" size={11} color={d.gold} style={{ marginTop: 3 }} />
                    <T v="bodyS" style={{ color: d.subtext, fontSize: 12, lineHeight: 17.5, flex: 1 }}>
                      {qa.a}
                    </T>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {/* Videos — the account's reels (was: About) */}
        {tab === 'videos' ? (
          <View style={{ marginHorizontal: 16 }}>
            {userReels.length === 0 ? (
              <View
                style={{
                  backgroundColor: d.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  padding: 26,
                  alignItems: 'center',
                  gap: 9,
                }}
              >
                <FontAwesome5 name="video" size={22} color={d.faint} />
                <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, fontWeight: '600', textAlign: 'center' }}>
                  No videos yet — posts from this account will appear here.
                </T>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {userReels.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      haptic.selection();
                      router.push({ pathname: '/videos', params: { start: String(r.id) } });
                    }}
                    style={({ pressed }) => ({
                      width: (W - 44) / 3,
                      borderRadius: 13,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: d.cardBorder,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Image source={r.poster} style={{ width: '100%', height: (((W - 44) / 3) * 16) / 9 }} resizeMode="cover" />
                    <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(4,12,8,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name="play" size={12} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={{ position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <FontAwesome5 name="play" size={8} color="#FFFFFF" />
                      <T v="caption" style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>
                        {r.views > 999 ? `${(r.views / 1000).toFixed(1)}K` : r.views}
                      </T>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Fullscreen profile-photo preview (pass 18) — @deenlink tag bottom-right, slightly on top of the photo */}
      <Modal visible={photoPreview} transparent animationType="fade" onRequestClose={() => setPhotoPreview(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(4,8,6,0.95)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setPhotoPreview(false)}>
          <View>
            <AvatarImage source={photo} name={name} size={300} tint={`${theme.primary}26`} border="rgba(212,175,55,0.55)" />
            {/* DeenLink tag — sitting ON TOP of the photo, top-right (pass 22) */}
            <View
              style={{
                position: 'absolute',
                right: -10,
                top: -12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: 'rgba(212,175,55,0.5)',
                backgroundColor: 'rgba(4,12,8,0.85)',
              }}
            >
              <FontAwesome5 name="check-circle" size={9} color="#E8C96A" />
              <T v="caption" style={{ color: '#E8C96A', fontWeight: '800', fontSize: 9.5, letterSpacing: 0.4 }}>
                @deenlink
              </T>
            </View>
          </View>
          <T v="caption" style={{ color: 'rgba(242,247,243,0.45)', fontSize: 10.5, marginTop: 34 }}>
            Tap anywhere to close
          </T>
        </Pressable>
      </Modal>
      <ContentShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        card={{ kind: 'post', meaning: `${name} (@${profile.username}) — ${profile.bio ?? 'sharing deen together.'}`, ref: 'DeenLink profile' }}
        link={`https://deenlink.org/profile/${profile.username}`}
        noImage
      />

      {/* pass 75 — report this account */}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setReportOpen(false)}>
          <Pressable style={{ backgroundColor: d.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 30 }} onPress={() => undefined}>
            <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: d.cardBorder, marginBottom: 14 }} />
            <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text, marginBottom: 4 }}>Report @{profile.username}</T>
            <T v="caption" style={{ fontSize: 11, color: d.faint, marginBottom: 12 }}>Tell us what is wrong — our moderation team reviews every report.</T>
            {['Spam or scam', 'Harassment or hate speech', 'Impersonation or fake account', 'Inappropriate content', 'Something else'].map((reason) => (
              <Pressable
                key={reason}
                disabled={reportBusy}
                onPress={() => {
                  haptic.light();
                  setReportBusy(true);
                  void reportAccount(liveP?.id ?? 0, reason).then((ok) => {
                    setReportBusy(false);
                    setReportOpen(false);
                    if (ok) { Alert.alert('Report sent', 'JazakAllah khair — our moderation team will review this account.'); }
                    else { Alert.alert('Could not send', 'Please try again in a moment.'); }
                  });
                }}
                style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 9, opacity: reportBusy ? 0.6 : 1 }}
              >
                <FontAwesome5 name="flag" size={10} color="#E05252" />
                <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700', color: d.text }}>{reason}</T>
                {reportBusy ? <ActivityIndicator size="small" color={d.faint} style={{ marginLeft: 'auto' }} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
/* pass 83-12 — owner: the loading state should be the CONTENT breathing,
 * not an icon. A profile-shaped skeleton (avatar, name, bio, stats, posts)
 * that slowly inhales/exhales until the real page is ready. */
function BreathingContent({ bar }: { bar: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const { height } = Dimensions.get('window');
  return (
    <Animated.View
      style={{
        flex: 1,
        paddingTop: 72,
        paddingHorizontal: 20,
        gap: 14,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
      }}
    >
      <View style={{ alignItems: 'center', gap: 12 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: bar }} />
        <View style={{ width: 150, height: 15, borderRadius: 8, backgroundColor: bar }} />
        <View style={{ width: 104, height: 11, borderRadius: 6, backgroundColor: bar }} />
      </View>
      <View style={{ alignItems: 'center', gap: 8, marginTop: 6 }}>
        <View style={{ width: '72%', height: 11, borderRadius: 6, backgroundColor: bar }} />
        <View style={{ width: '54%', height: 11, borderRadius: 6, backgroundColor: bar }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 }}>
        <View style={{ width: 72, height: 38, borderRadius: 12, backgroundColor: bar }} />
        <View style={{ width: 72, height: 38, borderRadius: 12, backgroundColor: bar }} />
        <View style={{ width: 72, height: 38, borderRadius: 12, backgroundColor: bar }} />
      </View>
      <View style={{ gap: 12, marginTop: 10 }}>
        {Array.from({ length: Math.max(2, Math.min(4, Math.floor((height - 420) / 92))) }).map((_, i) => (
          <View key={i} style={{ height: 80, borderRadius: 16, backgroundColor: bar }} />
        ))}
      </View>
    </Animated.View>
  );
}

export default function PublicProfileScreen() {
  const guest = useIsGuest();
  if (guest) return <LoginRequired module="Profiles" />;
  return <PublicProfileScreenInner />;
}
