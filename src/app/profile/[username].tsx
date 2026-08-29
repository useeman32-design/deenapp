import { useMemo, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import {
  MOCK_ACCOUNTS,
  MOCK_FEED,
  MOCK_PROFILES,
  MOCK_REELS,
  type MockProfile,
} from '@/api/mocks';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { FeedCard, AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';

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
export default function PublicProfileScreen() {
  const { username = '' } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<ProfileTab>('posts');
  const [photoPreview, setPhotoPreview] = useState(false);
  // the account's reels — shown in the Videos tab
  const userReels = useMemo(() => MOCK_REELS.filter((r) => r.username === username), [username]);
  const [following, setFollowing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());

  const profile: MockProfile | null = useMemo(() => {
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
  }, [username]);

  const posts = useMemo(
    () => MOCK_FEED.filter((p) => p.user.username === username),
    [username],
  );
  const answered = profile?.scholar ? (ANSWERED[username] ?? []) : [];

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
        <FontAwesome5 name="question-circle" size={30} color={d.faint} />
        <T v="bodyS" style={{ color: d.subtext, fontSize: 13, fontWeight: '600' }}>
          We couldn’t find this account.
        </T>
        <Pressable onPress={() => router.back()} style={{ borderRadius: 10, backgroundColor: d.emerald, paddingHorizontal: 16, paddingVertical: 9 }}>
          <T v="bodyS" style={{ color: isDark ? '#062312' : '#fff', fontWeight: '700', fontSize: 12 }}>
            Go back
          </T>
        </Pressable>
      </View>
    );
  }

  const photo = profile.photo ?? null;
  const name = profile.full_name;
  const isScholar = !!profile.scholar;
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n));

  const shareProfile = () => {
    haptic.light();
    Share.share({
      title: `${name} on DeenLink`,
      message: `Check out ${name} (@${profile.username}) on DeenLink — ${profile.bio ?? 'sharing deen together.'} https://deenlink.org/profile/${profile.username}`,
    }).catch(() => {});
  };

  const toggleFollow = () => {
    haptic.success();
    setFollowing((v) => !v);
  };

  const TABS: Array<{ id: ProfileTab; label: string }> = [
    { id: 'posts', label: 'Posts' },
    ...(isScholar ? [{ id: 'questions' as ProfileTab, label: 'Questions' }] : []),
    { id: 'videos', label: 'Videos' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
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
            onPress={() => router.back()}
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
                  <AvatarImage source={photo} name={name} size={76} tint={d.bgSoft} border="transparent" />
                </Pressable>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <T v="h3" numberOfLines={1} ellipsizeMode="tail" style={{ color: d.text, fontWeight: '800', fontSize: 16.5, flexShrink: 1 }}>
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

            {profile.bio ? (
              <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, lineHeight: 18 }}>
                {profile.bio}
              </T>
            ) : null}

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
                { label: 'Posts', value: fmt(Math.max(posts.length, profile.posts_count)) },
                { label: 'Followers', value: fmt(profile.followers + (following ? 1 : 0)) },
                { label: 'Following', value: fmt(profile.following) },
                { label: 'Charity', value: '₦ 12.4k' },
              ].map((s) => (
                <View
                  key={s.label}
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
              ))}
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
    </View>
  );
}
