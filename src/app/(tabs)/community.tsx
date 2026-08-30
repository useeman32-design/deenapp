import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import type { Post } from '@/api/types';
import { MOCK_ACCOUNTS, MOCK_COMMENTS, MOCK_FEED, MOCK_FOLLOWED, MOCK_TRENDING, type SampleComment } from '@/api/mocks';
import { T } from '@/components/T';
import { FeedCard, AvatarImage } from '@/components/FeedCard';
import { CommunityInbox } from '@/components/CommunityInbox';
import { CommentsModal } from '@/components/CommentsModal';
import { VideoModal } from '@/components/VideoModal';
import { haptic } from '@/lib/haptics';
import { useRouter } from 'expo-router';

const patternDark = require('../../../assets/img/pattern-dark.png');
const patternLight = require('../../../assets/img/pattern-light.png');

const ME = { name: 'Abdulrahman Al-Harbi', handle: 'abdalrahman' };
const EMOJIS = ['😄', '😅', '🥹', '😍', '🤲', '🕌', '✨', '🤍', '📖', '🌙', '🔥', '🕋'];

const B = ({ children }: { children: ReactNode }) => <Text style={{ fontWeight: '800' }}>{children}</Text>;

type FeedTab = 'foryou' | 'following' | 'scholars';

/**
 * Community — the DeenLink social hub in the new dash design:
 * search (posts + accounts) → trending → sticky For you / Following /
 * Scholars tabs → community posts (full FeedCard: double-tap like,
 * report menu, in-container YouTube, image preview, polls) →
 * recent activity. FAB (+) opens the new-post modal with
 * progress indication while the post is being published.
 */
export default function CommunityScreen() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>(MOCK_FEED);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [videoPost, setVideoPost] = useState<Post | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<FeedTab>('foryou');
  const [sticky, setSticky] = useState(false);

  // composer modal state
  const [composerOpen, setComposerOpen] = useState(false);
  const [cDraft, setCDraft] = useState('');
  const [pollOn, setPollOn] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [pollOpts, setPollOpts] = useState<string[]>(['', '']);
  const [pollHours, setPollHours] = useState(24);
  const [ytOn, setYtOn] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [videoAttach, setVideoAttach] = useState<{ uri: string; name: string } | null>(null);
  const [imageAttach, setImageAttach] = useState<{ uri: string; name: string } | null>(null);
  const imageFileRef = useRef<TextInput | null>(null);

  /** Pick an image for the post (native picker / web file input). */
  const pickImage = async () => {
    haptic.light();
    try {
      if (Platform.OS === 'web') {
        (imageFileRef.current as unknown as HTMLInputElement | null)?.click?.();
        return;
      }
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo-library access to pick an image.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: false });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setImageAttach({ uri: res.assets[0].uri, name: res.assets[0].fileName ?? 'Selected photo' });
      }
    } catch {
      Alert.alert('Could not open the picker', 'Please try again.');
    }
  };
  const [posting, setPosting] = useState(false);
  const videoFileRef = useRef<TextInput | null>(null);

  /** Pick a video file for a community video post (NOT a reel). */
  const pickVideo = async () => {
    haptic.light();
    try {
      if (Platform.OS === 'web') {
        (videoFileRef.current as unknown as HTMLInputElement | null)?.click?.();
        return;
      }
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo-library access to pick a video.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setVideoAttach({ uri: res.assets[0].uri, name: res.assets[0].fileName ?? 'Selected video' });
      }
    } catch {
      Alert.alert('Could not open the picker', 'Please try again.');
    }
  };

  const togglePostLike = (id: number) =>
    setLikedPosts((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const q = query.trim().toLowerCase();
  const accResults = useMemo(
    () =>
      q
        ? MOCK_ACCOUNTS.filter((a) => a.full_name.toLowerCase().includes(q) || a.username.toLowerCase().includes(q))
        : [],
    [q],
  );
  const postResults = useMemo(
    () => (q ? posts.filter((p) => (p.content_text ?? '').toLowerCase().includes(q)).slice(0, 4) : []),
    [q, posts],
  );
  const searching = q.length > 0;

  const visiblePosts = useMemo(() => {
    if (searching) return [];
    if (tab === 'following') return posts.filter((p) => MOCK_FOLLOWED.includes(p.user.username));
    if (tab === 'scholars') return posts.filter((p) => !!p.user.scholar);
    return posts;
  }, [posts, tab, searching]);

  const pickTab = (t: FeedTab) => {
    if (t === tab) return;
    haptic.selection();
    setTab(t);
  };

  const submitComposer = () => {
    const t = cDraft.trim();
    const opts = pollOpts.map((o) => o.trim()).filter(Boolean);
    if (!t || posting) return;
    haptic.medium();
    setPosting(true);
    // simulate the network/publish round-trip so heavy posts show progress
    setTimeout(() => {
      const np: Post = {
        id: Date.now(),
        content_text: t,
        time_ago: 'now',
        like_count: 0,
        comment_count: 0,
        liked_by_me: false,
        is_public_qa: false,
        user: {
          id: 99,
          username: ME.handle,
          full_name: ME.name,
          user_type: 'user',
          profile_image_url: null,
          deenpoints_balance: 240,
          is_email_verified: 1,
          account_status: 'active',
          verification_badge: null,
          scholar: null,
        } as Post['user'],
        media: [],
      };
      (np.user as { fields?: string }).fields = 'Sunni';
      if (pollOn && opts.length >= 2) {
        np.poll = { options: opts.map((text, i) => ({ id: i + 1, text, votes: 0 })), duration: pollHours };
      }
      if (imageAttach) {
        np.image_url = imageAttach.uri;
      }
      if (videoAttach) {
        np.video_url = videoAttach.uri;
      }
      if (ytOn && ytUrl.trim()) {
        const url = ytUrl.trim();
        const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
        (np as { youtube_url?: string; youtube_embed_url?: string }).youtube_url = url;
        if (m) (np as { youtube_embed_url?: string }).youtube_embed_url = `https://www.youtube.com/embed/${m[1]}`;
      }
      setPosts((ps) => [np, ...ps]);
      setPosting(false);
      setComposerOpen(false);
      setCDraft('');
      setPollOn(false);
      setPollOpts(['', '']);
      setYtOn(false);
      setYtUrl('');
      setVideoAttach(null);
      setImageAttach(null);
      haptic.success();
    }, 1600);
  };

  const TABS: Array<{ id: FeedTab; label: string }> = [
    { id: 'foryou', label: 'For you' },
    { id: 'following', label: 'Following' },
    { id: 'scholars', label: 'Scholars' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* Sticky feed tabs — appear at the top while scrolling */}
      <View
        pointerEvents={sticky ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          backgroundColor: isDark ? 'rgba(6,14,10,0.96)' : 'rgba(246,249,245,0.97)',
          borderBottomWidth: 1,
          borderBottomColor: d.cardBorder,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 10,
          paddingHorizontal: 16,
          transform: [{ translateY: sticky ? 0 : -58 }],
        }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => pickTab(t.id)}
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
                <T v="bodyS" style={{ color: on ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext, fontWeight: '700', fontSize: 16 /*12.5*/ }}>
                  {t.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 170 }}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const s = y > 165;
          if (s !== sticky) setSticky(s);
        }}
        scrollEventThrottle={16}
      >
        {/* header pattern */}
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

        {/* Header */}
        <View style={{ padding: 16, paddingTop: insets.top + 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 1.5,
                borderColor: d.gold,
                backgroundColor: d.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FontAwesome5 name="users" size={17} color={d.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 20 }}>
                Community
              </T>
              <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
                Ask, share and learn together
              </T>
            </View>
            <Pressable
              onPress={() => { haptic.selection(); router.push('/tools/notifications'); }}
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
            {/* inbox — shared reels/posts/duas/ayahs (same inbox as videos) */}
            <Pressable
              onPress={() => { haptic.selection(); setInboxOpen(true); }}
              style={({ pressed }) => ({
                position: 'relative',
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)',
                backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <FontAwesome5 name="comment-dots" size={15} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <View
                style={{
                  position: 'absolute',
                  top: 7,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#1F8F5C',
                  borderWidth: 1.5,
                  borderColor: d.bg,
                }}
              />
            </Pressable>
          </View>
        </View>

        {/* Search (posts + accounts) */}
        <View style={{ marginHorizontal: 16, marginTop: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: d.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: d.cardBorder,
              paddingHorizontal: 12,
              paddingVertical: 4,
            }}
          >
            <FontAwesome5 name="search" size={13} color={d.faint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search posts or accounts…"
              placeholderTextColor={d.faint}
              returnKeyType="search"
              style={{
                flex: 1,
                width: 0,
                fontFamily: 'Poppins-Regular',
                fontSize: 16,
                color: d.text,
                paddingVertical: 8,
              }}
            />
            {q.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <FontAwesome5 name="times-circle" size={15} color={d.faint} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Composer bar — under search, opens the post sheet */}
        {!searching ? (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <Pressable
              onPress={() => {
                haptic.light();
                setComposerOpen(true);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                backgroundColor: d.card,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: d.cardBorder,
                paddingHorizontal: 12,
                paddingVertical: 11,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  borderWidth: 1.5,
                  borderColor: d.gold,
                  backgroundColor: d.bgSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <T v="h3" style={{ color: d.gold, fontWeight: '700', fontSize: 15 }}>
                  A
                </T>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bodyS" style={{ color: d.faint, fontSize: 13.5 }}>
                  Share a thought, question or du’aa…
                </T>
                <T v="caption" style={{ color: d.faint, fontSize: 9.5, marginTop: 2, letterSpacing: 0.3 }}>
                  POLL · VIDEO · YOUTUBE
                </T>
              </View>
              <Pressable
                onPress={() => {
                  haptic.selection();
                  router.push('/videos?create=1');
                }}
                hitSlop={6}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.10)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(46,204,113,0.4)' : 'rgba(14,122,70,0.3)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FontAwesome5 name="film" size={14} color={isDark ? '#4AE38F' : '#0E7A46'} />
                </View>
              </Pressable>
            </Pressable>
          </View>
        ) : null}

        {/* Trending */}
        {!searching ? (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 8 }}>
              <FontAwesome5 name="chart-line" size={11} color={d.gold} />
              <T v="caption" style={{ color: d.subtext, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
                TRENDING
              </T>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 10 }}>
              {MOCK_TRENDING.map((t) => (
                <Pressable
                  key={t.tag}
                  onPress={() => {
                    haptic.selection();
                    setQuery(t.tag.slice(1));
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(212,175,55,0.35)' : 'rgba(140,109,31,0.3)',
                    backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(140,109,31,0.06)',
                    paddingHorizontal: 13,
                    paddingVertical: 8,
                    marginRight: 2,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <T v="bodyS" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '700', fontSize: 11.5 }}>
                    {t.tag}
                  </T>
                  <T v="caption" style={{ color: d.faint, fontSize: 9.5, fontWeight: '600' }}>
                    {t.posts}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Feed tabs (inline at the top of the feed; sticky clone appears on scroll) */}
        {!searching ? (
          <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16, marginBottom: 14, opacity: sticky ? 0 : 1 }}>
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => pickTab(t.id)}
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
        ) : null}

        {/* Search results */}
        {searching ? (
          <View style={{ marginHorizontal: 16, marginTop: 6, gap: 14 }}>
            {accResults.length > 0 ? (
              <View>
                <T v="caption" style={{ color: d.faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>
                  ACCOUNTS
                </T>
                <View style={{ backgroundColor: d.card, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, paddingVertical: 4 }}>
                  {accResults.map((a, i) => (
                    <Pressable
                      key={a.username}
                      onPress={() => {
                        haptic.selection();
                        setQuery('');
                        router.push(`/profile/${a.username}`);
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: d.cardBorder,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <AvatarImage source={a.photo} name={a.full_name} size={38} tint={d.bgSoft} border={d.cardBorder} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T v="body" numberOfLines={1} style={{ color: d.text, fontWeight: '700', fontSize: 13 }}>
                          {a.full_name}
                        </T>
                        <T v="caption" numberOfLines={1} style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
                          @{a.username}
                          {a.fields ? ` · ${a.fields}` : ''}
                        </T>
                      </View>
                      <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {postResults.length > 0 ? (
              <View>
                <T v="caption" style={{ color: d.faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>
                  POSTS
                </T>
                <View style={{ backgroundColor: d.card, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, padding: 12, gap: 8 }}>
                  {postResults.map((p) => (
                    <View key={p.id} style={{ flexDirection: 'row', gap: 9 }}>
                      <AvatarImage
                        source={(p.user as { profile_image_url?: string | number | null }).profile_image_url ?? (MOCK_ACCOUNTS.find((a) => a.username === p.user.username)?.photo ?? null)}
                        name={p.user.full_name ?? p.user.username}
                        size={32}
                        tint={d.bgSoft}
                        border={d.cardBorder}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T v="body" numberOfLines={1} style={{ color: d.text, fontWeight: '700', fontSize: 12.5 }}>
                          {p.user.full_name ?? p.user.username}
                        </T>
                        <T v="bodyS" numberOfLines={2} style={{ color: d.subtext, fontSize: 11.5, marginTop: 2 }}>
                          {p.content_text}
                        </T>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {accResults.length === 0 && postResults.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
                <FontAwesome5 name="search" size={22} color={d.faint} />
                <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, fontWeight: '600' }}>
                  No posts or accounts found for “{query}”
                </T>
              </View>
            ) : null}
          </View>
        ) : (
          <>
            {/* Community posts */}
            <View style={{ marginHorizontal: 16, marginTop: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <T v="h2" style={{ color: d.text, fontWeight: '700', fontSize: 16.5 }}>
                  {tab === 'following' ? 'From people you follow' : tab === 'scholars' ? 'Scholar posts' : 'Community Posts'}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: d.emerald }} />
                  <T v="caption" style={{ color: d.faint, fontSize: 10.5, fontWeight: '600' }}>
                    {visiblePosts.length} posts
                  </T>
                </View>
              </View>
              <View style={{ gap: 12 }}>
                {visiblePosts.length === 0 ? (
                  <View
                    style={{
                      backgroundColor: d.card,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: d.cardBorder,
                      padding: 22,
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <FontAwesome5 name={tab === 'following' ? 'user-plus' : 'graduation-cap'} size={20} color={d.faint} />
                    <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, fontWeight: '600' }}>
                      {tab === 'following' ? 'Follow scholars and friends to see their posts here.' : 'No scholar posts yet — check back soon.'}
                    </T>
                  </View>
                ) : (
                  visiblePosts.map((p, pi) => (
                    <View key={p.id}>
                      <FeedCard
                      dash={d}
                      post={{ ...p, liked_by_me: likedPosts.has(p.id), like_count: (p.like_count ?? 0) + (likedPosts.has(p.id) ? 1 : 0) }}
                      onLike={(id) => togglePostLike(id)}
                      onComments={(pp) => setCommentPost(pp)}
                      onDismiss={(id) => setPosts((ps) => ps.filter((x) => x.id !== id))}
                      onPlayVideo={(pp) =>
                        setVideoPost({
                          ...pp,
                          like_count: (pp.like_count ?? 0) + (likedPosts.has(pp.id) ? 1 : 0),
                        })
                      }
                    />
                      {/* every 5th card — suggested accounts while you scroll (pass 22) */}
                      {(pi + 1) % 5 === 0 ? <SuggestStrip dash={d} /> : null}
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* community inbox — shared posts/reels/ayahs, reactions only */}
      <CommunityInbox visible={inboxOpen} onClose={() => setInboxOpen(false)} />

      {/* FAB — new post */}
      <Pressable
        onPress={() => {
          haptic.light();
          setComposerOpen(true);
        }}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 16,
          bottom: insets.bottom + 96,
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: d.emerald,
          borderWidth: 1.5,
          borderColor: d.gold,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: d.emerald,
          shadowOpacity: 0.45,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 8,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <FontAwesome5 name="plus" size={20} color={isDark ? '#062312' : '#FFFFFF'} />
      </Pressable>

      {/* New post modal */}
      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => !posting && setComposerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2,6,4,0.78)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => !posting && setComposerOpen(false)} />
          <View
            style={{
              backgroundColor: isDark ? '#0C1511' : '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: d.cardBorder,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 14) + 8,
            }}
          >
            {/* header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ flex: 1 }} />
              <T v="body" style={{ fontWeight: '700', fontSize: 15, color: d.text }}>
                New post
              </T>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Pressable onPress={() => !posting && setComposerOpen(false)} hitSlop={10} style={{ padding: 4 }}>
                  <FontAwesome5 name="times" size={16} color={d.faint} />
                </Pressable>
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    borderWidth: 1.5,
                    borderColor: d.gold,
                    backgroundColor: d.bgSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <T v="h3" style={{ color: d.gold, fontWeight: '700', fontSize: 14 }}>
                    A
                  </T>
                </View>
                <TextInput
                  value={cDraft}
                  onChangeText={setCDraft}
                  placeholder="Share a thought, question or du’aa…"
                  placeholderTextColor={d.faint}
                  multiline
                  editable={!posting}
                  style={{
                    flex: 1,
                    fontFamily: 'Poppins-Regular',
                    fontSize: 16,
                    color: d.text,
                    minHeight: 74,
                    textAlignVertical: 'top',
                  }}
                />
              </View>

              {/* emoji row */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 36, flexGrow: 0, flexShrink: 0, paddingBottom: 2 }}>
                {EMOJIS.map((e, i) => (
                  <Pressable key={`e${i}`} onPress={() => setCDraft((prev) => prev + e)} hitSlop={4} style={{ padding: 4, marginRight: 2 }}>
                    <T v="caption" style={{ fontSize: 21, fontWeight: '400' }}>
                      {e}
                    </T>
                  </Pressable>
                ))}
              </ScrollView>

              {/* attach: image / video / youtube */}
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <Pressable
                  onPress={pickImage}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: imageAttach ? d.emerald : d.cardBorder,
                    backgroundColor: imageAttach ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(14,122,70,0.07)') : 'transparent',
                    paddingVertical: 10,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <FontAwesome5 name="image" size={12} color={imageAttach ? (isDark ? '#4AE38F' : '#0E7A46') : d.emerald} />
                  <T v="bodyS" style={{ color: imageAttach ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext, fontWeight: '700', fontSize: 11.5 }}>
                    {imageAttach ? 'Photo added' : 'Photo'}
                  </T>
                </Pressable>
                <Pressable
                  onPress={pickVideo}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: videoAttach ? d.emerald : d.cardBorder,
                    backgroundColor: videoAttach ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(14,122,70,0.07)') : 'transparent',
                    paddingVertical: 10,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <FontAwesome5 name="film" size={12} color={videoAttach ? (isDark ? '#4AE38F' : '#0E7A46') : d.emerald} />
                  <T v="bodyS" style={{ color: videoAttach ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext, fontWeight: '700', fontSize: 11.5 }}>
                    {videoAttach ? 'Video attached' : 'Video'}
                  </T>
                </Pressable>
                <Pressable
                  onPress={() => {
                    haptic.selection();
                    setYtOn((v) => !v);
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: ytOn ? d.emerald : d.cardBorder,
                    backgroundColor: ytOn ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(14,122,70,0.07)') : 'transparent',
                    paddingVertical: 10,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <FontAwesome5 name="youtube" size={12} color={ytOn ? (isDark ? '#4AE38F' : '#0E7A46') : '#E74C3C'} brand />
                  <T v="bodyS" style={{ color: ytOn ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext, fontWeight: '700', fontSize: 11.5 }}>
                    {ytOn ? 'Remove link' : 'YouTube'}
                  </T>
                </Pressable>
              </View>

              {ytOn ? (
                <TextInput
                  value={ytUrl}
                  onChangeText={setYtUrl}
                  placeholder="Paste a YouTube link…"
                  placeholderTextColor={d.faint}
                  autoCapitalize="none"
                  editable={!posting}
                  style={{
                    fontFamily: 'Poppins-Regular',
                    fontSize: 16,
                    color: d.text,
                    backgroundColor: d.bgSoft,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: d.cardBorder,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                />
              ) : null}

              {Platform.OS === 'web' ? (
                <>
                <input
                  ref={imageFileRef as never}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e: unknown) => {
                    const file = (e as React.ChangeEvent<HTMLInputElement>).target.files?.[0];
                    if (file) setImageAttach({ uri: URL.createObjectURL(file), name: file.name });
                  }}
                />
                <input
                  ref={videoFileRef as never}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={(e: unknown) => {
                    const file = (e as React.ChangeEvent<HTMLInputElement>).target.files?.[0];
                    if (file) setVideoAttach({ uri: URL.createObjectURL(file), name: file.name });
                  }}
                />
                </>
              ) : null}

              {imageAttach ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(14,122,70,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(46,204,113,0.4)' : 'rgba(14,122,70,0.3)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 }}>
                  <FontAwesome5 name="image" size={14} color={isDark ? '#4AE38F' : '#0E7A46'} />
                  <T v="bodyS" numberOfLines={1} style={{ flex: 1, width: 0, color: d.text, fontSize: 12.5, fontWeight: '600' }}>
                    {imageAttach.name}
                  </T>
                  <Pressable onPress={() => setImageAttach(null)} hitSlop={8}>
                    <FontAwesome5 name="times-circle" size={14} color={d.faint} />
                  </Pressable>
                </View>
              ) : null}

              {videoAttach ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(14,122,70,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(46,204,113,0.4)' : 'rgba(14,122,70,0.3)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 }}>
                  <FontAwesome5 name="video" size={14} color={isDark ? '#4AE38F' : '#0E7A46'} />
                  <T v="bodyS" numberOfLines={1} style={{ flex: 1, width: 0, color: d.text, fontSize: 12.5, fontWeight: '600' }}>
                    {videoAttach.name}
                  </T>
                  <Pressable onPress={() => setVideoAttach(null)} hitSlop={8}>
                    <FontAwesome5 name="times-circle" size={14} color={d.faint} />
                  </Pressable>
                </View>
              ) : null}

              {/* poll builder */}
              <Pressable
                onPress={() => {
                  haptic.selection();
                  setPollOn((v) => !v);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: pollOn ? d.emerald : d.cardBorder,
                  backgroundColor: pollOn ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(14,122,70,0.07)') : 'transparent',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <FontAwesome5 name="poll-h" size={13} color={pollOn ? (isDark ? '#4AE38F' : '#0E7A46') : d.faint} />
                <T v="bodyS" style={{ color: pollOn ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext, fontWeight: '700', fontSize: 12 }}>
                  {pollOn ? 'Remove poll' : 'Add a poll'}
                </T>
              </Pressable>

              {pollOn
                ? pollOpts.map((opt, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <T v="caption" style={{ color: d.faint, fontSize: 10, fontWeight: '800', width: 16 }}>
                        {i + 1}
                      </T>
                      <TextInput
                        value={opt}
                        onChangeText={(v) => setPollOpts((prev) => prev.map((o, j) => (j === i ? v : o)))}
                        placeholder={`Poll option ${i + 1}`}
                        placeholderTextColor={d.faint}
                        editable={!posting}
                        style={{
                          flex: 1,
                          width: 0,
                          fontFamily: 'Poppins-Regular',
                          fontSize: 16,
                          color: d.text,
                          backgroundColor: d.bgSoft,
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      />
                      {pollOpts.length > 2 ? (
                        <Pressable
                          onPress={() => setPollOpts((prev) => prev.filter((_, j) => j !== i))}
                          hitSlop={8}
                          style={{ padding: 4 }}
                        >
                          <FontAwesome5 name="trash-alt" size={12} color={d.faint} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                : null}

              {pollOn && pollOpts.length < 4 ? (
                <Pressable
                  onPress={() => setPollOpts((prev) => [...prev, ''])}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: d.cardBorder,
                    paddingVertical: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <FontAwesome5 name="plus" size={11} color={d.emerald} />
                  <T v="bodyS" style={{ color: d.subtext, fontWeight: '700', fontSize: 11.5 }}>
                    Add option
                  </T>
                </Pressable>
              ) : null}

              {pollOn ? (
                <View>
                  <T v="caption" style={{ color: d.faint, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 }}>
                    POLL DURATION
                  </T>
                  <View style={{ flexDirection: 'row', gap: 7 }}>
                    {[{ h: 1, l: '1h' }, { h: 8, l: '8h' }, { h: 24, l: '1 day' }, { h: 72, l: '3 days' }, { h: 168, l: '7 days' }].map((o) => {
                      const on = pollHours === o.h;
                      return (
                        <Pressable
                          key={o.h}
                          onPress={() => { haptic.selection(); setPollHours(o.h); }}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            paddingVertical: 7,
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: on ? d.gold : d.cardBorder,
                            backgroundColor: on ? (isDark ? 'rgba(212,175,55,0.12)' : 'rgba(140,109,31,0.07)') : 'transparent',
                          }}
                        >
                          <T v="caption" style={{ color: on ? (isDark ? '#E8C96A' : '#8C6D1F') : d.subtext, fontWeight: '700', fontSize: 10.5 }}>
                            {o.l}
                          </T>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Post button w/ progress */}
              <Pressable
                onPress={submitComposer}
                disabled={posting || !cDraft.trim()}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderRadius: 14,
                  backgroundColor: d.emerald,
                  paddingVertical: 13,
                  opacity: (cDraft.trim() ? 1 : 0.45) * (posting ? 0.8 : pressed ? 0.85 : 1),
                })}
              >
                {posting ? (
                  <>
                    <ActivityIndicator size="small" color={isDark ? '#062312' : '#FFFFFF'} />
                    <T v="body" style={{ color: isDark ? '#062312' : '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                      Posting… just a moment
                    </T>
                  </>
                ) : (
                  <>
                    <FontAwesome5 name="paper-plane" size={12} color={isDark ? '#062312' : '#FFFFFF'} />
                    <T v="body" style={{ color: isDark ? '#062312' : '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                      {pollOn ? 'Post poll' : 'Post'}
                    </T>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Comments sheet */}
      <CommentsModal
        visible={!!commentPost}
        post={commentPost}
        seed={commentPost ? (MOCK_COMMENTS[commentPost.id] ?? MOCK_COMMENTS[101] ?? []) as SampleComment[] : []}
        onClose={() => setCommentPost(null)}
      />

      {/* Video viewing modal */}
      {videoPost ? (
        <VideoModal
          video={{
            id: videoPost.id,
            title: (videoPost.content_text ?? 'Video').slice(0, 60),
            source_url: (videoPost as { youtube_url?: string }).youtube_url ?? null,
            embed_url: (videoPost as { youtube_embed_url?: string | null }).youtube_embed_url ?? null,
            duration: null,
            view_count: videoPost.like_count ?? 0,
            like_count: videoPost.like_count ?? 0,
          }}
          liked={likedPosts.has(videoPost.id)}
          onLike={() => togglePostLike(videoPost.id)}
          onClose={() => setVideoPost(null)}
        />
      ) : null}
    </View>
  );
}


/* Suggested accounts card — interleaved into the community feed (pass 22). */
function SuggestStrip({ dash }: { dash: any }) {
  const { isDark } = useTheme();
  const router = useRouter();
  const [followed, setFollowed] = useState<string[]>([]);
  const picks = useMemo(() => MOCK_ACCOUNTS.slice().sort(() => Math.random() - 0.5).slice(0, 3), []);
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: dash.cardBorder, backgroundColor: dash.card, padding: 13, marginTop: 10, marginBottom: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, color: dash.faint }}>SUGGESTED FOR YOU</T>
        <Pressable onPress={() => { haptic.selection(); router.push('/tools/suggestions'); }} hitSlop={8}>
          <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>See all</T>
        </Pressable>
      </View>
      {/* same card design as the home screen's Accounts to Follow */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
        {picks.map((a) => (
          <View key={a.username} style={{ width: 122, borderRadius: 18, backgroundColor: dash.card, borderWidth: 1, borderColor: dash.cardBorder, padding: 14, alignItems: 'center', gap: 7 }}>
            <Pressable onPress={() => router.push(`/profile/${a.username}`)}>
              <AvatarImage source={a.photo ?? null} name={a.full_name} size={44} tint={dash.bgSoft} border={dash.cardBorder} />
            </Pressable>
            <T v="caption" numberOfLines={1} style={{ fontWeight: '800', fontSize: 11, color: dash.text, textAlign: 'center' }}>
              {a.full_name.split(' ').slice(0, 2).join(' ')}
            </T>
            {a.fields ? (
              <T v="caption" numberOfLines={1} style={{ fontSize: 8.5, color: dash.faint, marginTop: -3 }}>{a.fields}</T>
            ) : null}
            <Pressable
              onPress={() => {
                haptic.light();
                setFollowed((f) => (f.includes(a.username) ? f.filter((x) => x !== a.username) : [...f, a.username]));
              }}
              style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: followed.includes(a.username) ? dash.cardBorder : 'transparent', backgroundColor: followed.includes(a.username) ? 'transparent' : '#1F8F5C', marginTop: 2 }}
            >
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: followed.includes(a.username) ? dash.subtext : '#FFFFFF' }}>
                {followed.includes(a.username) ? 'Following' : 'Follow'}
              </T>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
