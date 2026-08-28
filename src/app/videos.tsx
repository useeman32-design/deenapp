import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTheme } from '@/context/ThemeContext';
import { MOCK_ACCOUNTS, MOCK_FOLLOWED, MOCK_REELS, REEL_COMMENTS, type MockReel, type SampleComment } from '@/api/mocks';
import type { Post } from '@/api/types';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { AvatarImage } from '@/components/FeedCard';
import { CommentsModal } from '@/components/CommentsModal';
import { HeartIcon } from '@/components/Icons';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { addUserReel, subscribeUserReels, userReels } from '@/lib/reelStore';

const { height: VH, width: VW } = Dimensions.get('window');

const SAVES_KEY = 'dl.reels.saved';
const REPOST_KEY = 'dl.reels.reposted';

/** Sample clips offered in the create studio (demo picks). */
const SAMPLE_CLIPS: Array<{ id: number; label: string; reel: MockReel }> = MOCK_REELS.slice(0, 5).map((r) => ({
  id: r.id,
  label: `Clip ${r.id - 200}`,
  reel: r,
}));

/** reel → synthetic Post so the shared CommentsModal works unchanged. */
function reelAsPost(r: MockReel, account: (typeof MOCK_ACCOUNTS)[number]): Post {
  return {
    id: r.id,
    content_text: r.caption,
    time_ago: '2h',
    like_count: r.likes,
    comment_count: r.comments,
    liked_by_me: false,
    is_public_qa: false,
    user: {
      id: 1,
      username: r.username,
      full_name: account.full_name,
      user_type: 'user',
      profile_image_url: account.photo ?? null,
      deenpoints_balance: 0,
      is_email_verified: 1,
      account_status: 'active',
      verification_badge: account.badge ?? null,
      scholar: null,
    } as Post['user'],
    media: [],
  };
}

/* -------------------------------------------------------------------------- */
/*  One fullscreen reel                                                        */
/* -------------------------------------------------------------------------- */

function ReelItem({
  reel,
  active,
  muted,
  liked,
  saved,
  reposted,
  onLike,
  onSave,
  onRepost,
  onComments,
  onOpenProfile,
}: {
  reel: MockReel;
  active: boolean;
  muted: boolean;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  onLike: (id: number) => void;
  onSave: (id: number) => void;
  onRepost: (id: number) => void;
  onComments: (r: MockReel) => void;
  onOpenProfile: (username: string) => void;
}) {
  const { isDark } = useTheme();
  const account = useMemo(
    () =>
      MOCK_ACCOUNTS.find((a) => a.username === reel.username) ?? {
        username: reel.username,
        full_name: reel.username === 'abdalrahman' ? 'Abdulrahman Al-Harbi' : reel.username,
        photo: null as number | null,
        badge: undefined,
        fields: null,
      },
    [reel.username],
  );
  const player = useVideoPlayer(reel.src, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastTap = useRef(0);
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active && !paused) player.play();
    else player.pause();
  }, [active, paused, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    const t = setInterval(() => {
      try {
        const d = player.duration;
        if (d > 0) setProgress(Math.min(1, player.currentTime / d));
      } catch {
        /* player not ready */
      }
    }, 400);
    return () => clearInterval(t);
  }, [player]);

  const likeBurst = () => {
    burst.setValue(0);
    Animated.sequence([
      Animated.timing(burst, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.9)), useNativeDriver: true }),
      Animated.delay(120),
      Animated.timing(burst, { toValue: 0, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => burst.setValue(0));
  };

  /** tap = play/pause · double-tap = like */
  const onTap = () => {
    const now = Date.now();
    const dbl = now - lastTap.current < 300;
    lastTap.current = now;
    if (dbl) {
      if (!liked) {
        onLike(reel.id);
        likeBurst();
        haptic.medium();
      }
    } else {
      setPaused((p) => {
        if (p) player.play();
        else player.pause();
        return !p;
      });
      haptic.selection();
    }
  };

  const scale = burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.22, 1.02, 1.35] });
  const opacity = burst.interpolate({ inputRange: [0, 0.12, 0.72, 1], outputRange: [0, 0.95, 0.95, 0] });

  const download = async () => {
    haptic.light();
    try {
      // Bundled asset → resolve its served URL. Picked/user files already have one.
      let uri: string;
      if (typeof reel.src === 'number') {
        const { Asset } = await import('expo-asset');
        const asset = Asset.fromModule(reel.src);
        await asset.downloadAsync();
        uri = asset.localUri ?? asset.uri;
      } else {
        uri = reel.src.uri;
      }
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = uri;
        a.download = `deenlink-video-${reel.id}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const MediaLibrary = await import('expo-media-library');
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo-library access to save videos.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved ✓', 'Video saved to your gallery.');
    } catch {
      Alert.alert('Download failed', 'Please try again in a moment.');
    }
  };

  const railButton = (icon: string, label: string, onPress: () => void, tint?: string) => (
    <Pressable onPress={onPress} hitSlop={6} style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(10,20,14,0.45)',
          borderWidth: 1,
          borderColor: tint ? `${tint}88` : 'rgba(255,255,255,0.16)',
        }}
      >
        <FontAwesome5 name={icon} size={17} color={tint ?? '#FFFFFF'} solid={icon === 'heart' || icon === 'bookmark'} />
      </View>
      {label ? (
        <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 10.5, fontWeight: '700' }}>{label}</Text>
      ) : null}
    </Pressable>
  );

  return (
    <View style={{ width: VW, height: VH, backgroundColor: '#000' }}>
      {/* video layer — pointerEvents none so iOS native controls NEVER take over;
          all interaction goes through our overlay (play/pause, double-tap like) */}
      {active ? (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
          <VideoView
            player={player}
            contentFit="cover"
            nativeControls={false}
            style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
          />
        </View>
      ) : (
        <Image source={reel.poster as never} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} resizeMode="cover" />
      )}

      {/* legibility scrims */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130, backgroundColor: 'rgba(0,0,0,0.32)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 250, backgroundColor: 'rgba(0,0,0,0.42)' }} />

      {/* tap surface */}
      <Pressable onPress={onTap} style={{ position: 'absolute', inset: 0 }} />
      {paused && active ? (
        <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', inset: 0 }}>
          <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="play" size={26} color="#FFFFFF" />
          </View>
        </View>
      ) : null}

      {/* double-tap heart burst */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', inset: 0, opacity, transform: [{ scale }] }}
      >
        <HeartIcon size={104} filled color="#fff" />
      </Animated.View>

      {/* right action rail */}
      <View style={{ position: 'absolute', right: 12, bottom: 150, gap: 13 }}>
        {railButton('heart', (reel.likes + (liked ? 1 : 0)).toLocaleString(), () => { haptic.light(); onLike(reel.id); }, liked ? '#FF5A5A' : undefined)}
        {railButton('comment', String(reel.comments), () => onComments(reel))}
        {railButton('bookmark', (reel.saves + (saved ? 1 : 0)).toLocaleString(), () => { haptic.light(); onSave(reel.id); }, saved ? '#E8C96A' : undefined)}
        {railButton('retweet', 'Repost', () => { haptic.light(); onRepost(reel.id); }, reposted ? '#4AE38F' : undefined)}
        {railButton('share', 'Share', () => {
          Share.share({ message: `${account.full_name} on DeenLink Videos: ${reel.caption}` }).catch(() => {});
        })}
        {railButton('download', 'Download', download)}
      </View>

      {/* bottom info */}
      <View style={{ position: 'absolute', left: 14, right: 74, bottom: 34 }}>
        <Pressable
          onPress={() => onOpenProfile(reel.username)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, opacity: pressed ? 0.8 : 1 })}
        >
          <AvatarImage source={account.photo ?? null} name={account.full_name} size={38} tint="rgba(46,204,113,0.2)" border="rgba(255,255,255,0.3)" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <T v="bodyS" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
              @{reel.username}
            </T>
            {account.badge ? <VerificationBadge type={account.badge} size={13} /> : null}
          </View>
          <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}>
            <T v="caption" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>
              Follow
            </T>
          </View>
        </Pressable>
        <T v="bodyS" numberOfLines={2} style={{ color: 'rgba(255,255,255,0.94)', fontSize: 13, lineHeight: 18.5, marginTop: 10 }}>
          {reel.caption}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 }}>
          {account.fields ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(212,175,55,0.55)', borderRadius: 7, backgroundColor: 'rgba(212,175,55,0.14)', paddingHorizontal: 7, paddingVertical: 2.5 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D4AF37' }} />
              <T v="caption" style={{ color: '#E8C96A', fontSize: 8.5, fontWeight: '700', letterSpacing: 0.5 }}>
                {account.fields.toUpperCase()}
              </T>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
            <FontAwesome5 name="music" size={10} color="rgba(255,255,255,0.85)" />
            <T v="caption" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
              {reel.music} · {reel.views.toLocaleString()} views
            </T>
          </View>
        </View>
      </View>

      {/* progress bar */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.18)' }}>
        <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: isDark ? '#4AE38F' : '#2ECC71' }} />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Poster grid tile (search results / library sheets)                         */
/* -------------------------------------------------------------------------- */

function PosterTile({ reel, size, onOpen }: { reel: MockReel; size: number; onOpen: (r: MockReel) => void }) {
  return (
    <Pressable
      onPress={() => onOpen(reel)}
      style={({ pressed }) => ({
        width: size,
        height: (size * 16) / 9,
        borderRadius: 12,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
      })}
    >
      <Image source={reel.poster as never} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(4,12,8,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="play" size={11} color="#FFFFFF" />
        </View>
      </View>
      <View style={{ position: 'absolute', left: 6, bottom: 5, right: 6 }}>
        <T v="caption" numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 8.5, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>
          @{reel.username}
        </T>
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  The feed                                                                   */
/* -------------------------------------------------------------------------- */

type FeedTab = 'foryou' | 'following';
type LibraryTab = 'saved' | 'liked' | 'reposts';

export default function VideosFeed() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ start?: string; create?: string }>();

  const [feedTab, setFeedTab] = useState<FeedTab>('foryou');
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [reposted, setReposted] = useState<Set<number>>(new Set());
  const [commentReel, setCommentReel] = useState<MockReel | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('saved');
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [storeTick, setStoreTick] = useState(0);

  const listRef = useRef<FlatList<MockReel>>(null);

  useEffect(() => subscribeUserReels(() => setStoreTick((t) => t + 1)), []);

  useEffect(() => {
    storage.getItem(SAVES_KEY).then((raw) => {
      if (raw) {
        try {
          setSaved(new Set(JSON.parse(raw) as number[]));
        } catch { /* ignore */ }
      }
    });
    storage.getItem(REPOST_KEY).then((raw) => {
      if (raw) {
        try {
          setReposted(new Set(JSON.parse(raw) as number[]));
        } catch { /* ignore */ }
      }
    });
  }, []);

  useEffect(() => {
    if (params.create === '1') setCreateOpen(true);
  }, [params.create]);

  const reels = useMemo(() => {
    void storeTick;
    const mine: MockReel[] = [...userReels];
    if (feedTab === 'following') {
      return [...mine.filter((r) => r.username === 'abdalrahman'), ...MOCK_REELS.filter((r) => MOCK_FOLLOWED.includes(r.username))];
    }
    return [...mine, ...MOCK_REELS];
  }, [feedTab, storeTick]);

  // deep link ?start=<reel id>
  useEffect(() => {
    if (params.start) {
      const i = reels.findIndex((r) => String(r.id) === params.start);
      if (i >= 0) {
        setIndex(i);
        requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: VH * i, animated: false }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.start, storeTick]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const toggleLike = (id: number) =>
    setLiked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleSave = (id: number) => {
    let added = false;
    setSaved((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else {
        n.add(id);
        added = true;
      }
      storage.setItem(SAVES_KEY, JSON.stringify([...n])).catch(() => {});
      return n;
    });
    if (added) showToast('Added to your saved videos');
  };

  const toggleRepost = (id: number) => {
    let added = false;
    setReposted((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else {
        n.add(id);
        added = true;
      }
      storage.setItem(REPOST_KEY, JSON.stringify([...n])).catch(() => {});
      return n;
    });
    showToast(added ? 'Reposted — your followers can see it' : 'Repost removed');
  };

  const jumpToReel = useCallback(
    (r: MockReel) => {
      const i = reels.findIndex((x) => x.id === r.id);
      if (i >= 0) {
        setIndex(i);
        listRef.current?.scrollToOffset({ offset: VH * i, animated: false });
      } else {
        showToast('Not in this tab — switch to For you');
      }
    },
    [reels, showToast],
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length && viewableItems[0].index != null) setIndex(viewableItems[0].index);
  }).current;

  const commentPost: Post | null = commentReel
    ? reelAsPost(
        commentReel,
        MOCK_ACCOUNTS.find((a) => a.username === commentReel.username) ?? MOCK_ACCOUNTS[0],
      )
    : null;

  const q = query.trim().toLowerCase();
  const results = q
    ? reels.filter((r) => r.caption.toLowerCase().includes(q) || r.username.toLowerCase().includes(q) || (MOCK_ACCOUNTS.find((a) => a.username === r.username)?.fields ?? '').toLowerCase().includes(q))
    : [];
  const savedReels = reels.filter((r) => saved.has(r.id));
  const likedReels = reels.filter((r) => liked.has(r.id));
  const repostedReels = reels.filter((r) => reposted.has(r.id));

  const tabButton = (id: FeedTab, label: string) => {
    const on = feedTab === id;
    return (
      <Pressable
        key={id}
        onPress={() => {
          if (on) return;
          haptic.selection();
          setFeedTab(id);
          setIndex(0);
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        }}
        style={{ paddingHorizontal: 10, paddingVertical: 4 }}
      >
        <T v="body" style={{ color: on ? '#FFFFFF' : 'rgba(255,255,255,0.55)', fontWeight: on ? '800' : '600', fontSize: 15 }}>
          {label}
        </T>
      </Pressable>
    );
  };

  const topIcon = (icon: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(10,20,14,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FontAwesome5 name={icon} size={14} color="#FFFFFF" />
    </Pressable>
  );

  const LIB_TABS: Array<{ id: LibraryTab; label: string; icon: string }> = [
    { id: 'saved', label: 'Saved', icon: 'bookmark' },
    { id: 'liked', label: 'Liked', icon: 'heart' },
    { id: 'reposts', label: 'Reposts', icon: 'retweet' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* top bar: close · tabs · search · library */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(10,20,14,0.5)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.16)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FontAwesome5 name="times" size={14} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {tabButton('following', 'Following')}
          <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.25)' }} />
          {tabButton('foryou', 'For you')}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {topIcon('search', () => { haptic.selection(); setSearchOpen(true); })}
          {topIcon('bookmark', () => { haptic.selection(); setLibraryOpen(true); })}
        </View>
      </View>

      {/* pager */}
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item, index: i }) => (
          <ReelItem
            reel={item}
            active={i === index}
            muted={muted}
            liked={liked.has(item.id)}
            saved={saved.has(item.id)}
            reposted={reposted.has(item.id)}
            onLike={toggleLike}
            onSave={toggleSave}
            onRepost={toggleRepost}
            onComments={(r) => setCommentReel(r)}
            onOpenProfile={(u) => router.push(`/profile/${u}`)}
          />
        )}
        pagingEnabled
        snapToInterval={VH}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: VH, offset: VH * i, index: i })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        extraData={storeTick}
      />

      {/* create button (TikTok-style center +) */}
      <Pressable
        onPress={() => { haptic.light(); setCreateOpen(true); }}
        style={({ pressed }) => ({
          position: 'absolute',
          left: VW / 2 - 27,
          bottom: 118,
          width: 54,
          height: 36,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: 'rgba(10,20,14,0.6)',
          borderWidth: 1,
          borderColor: 'rgba(212,175,55,0.55)',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <FontAwesome5 name="plus" size={13} color="#E8C96A" />
        <T v="caption" style={{ color: '#E8C96A', fontWeight: '800', fontSize: 11.5 }}>
          Create
        </T>
      </Pressable>

      {/* mute toggle */}
      <Pressable
        onPress={() => { haptic.selection(); setMuted((m) => !m); }}
        hitSlop={10}
        style={{
          position: 'absolute',
          right: 14,
          top: insets.top + 54,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(10,20,14,0.5)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FontAwesome5 name={muted ? 'volume-mute' : 'volume-up'} size={13} color="#FFFFFF" />
      </Pressable>

      {/* toast */}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: VW / 2 - 140,
            width: 280,
            bottom: 168,
            alignItems: 'center',
            backgroundColor: 'rgba(8,16,11,0.88)',
            borderWidth: 1,
            borderColor: 'rgba(74,227,143,0.4)',
            borderRadius: 12,
            paddingVertical: 9,
            paddingHorizontal: 12,
          }}
        >
          <T v="caption" style={{ color: '#EAF7EE', fontSize: 11.5, fontWeight: '700', textAlign: 'center' }}>
            {toast}
          </T>
        </View>
      ) : null}

      {/* ---------------- search overlay ---------------- */}
      <Modal visible={searchOpen} transparent animationType="fade" onRequestClose={() => setSearchOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,10,6,0.92)', paddingTop: insets.top + 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
                paddingHorizontal: 11,
                height: 42,
              }}
            >
              <FontAwesome5 name="search" size={12} color="rgba(255,255,255,0.5)" />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Search videos, people, fields…"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={{ flex: 1, width: 0, color: '#FFFFFF', fontFamily: 'Poppins-Medium', fontSize: 16, paddingVertical: 0 }}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <FontAwesome5 name="times-circle" size={14} color="rgba(255,255,255,0.5)" />
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => { setSearchOpen(false); setQuery(''); }} hitSlop={8} style={{ padding: 6 }}>
              <T v="bodyS" style={{ color: '#E8C96A', fontWeight: '700', fontSize: 13 }}>
                Cancel
              </T>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
            {q && results.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 44, gap: 8 }}>
                <FontAwesome5 name="search" size={20} color="rgba(255,255,255,0.4)" />
                <T v="bodyS" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5 }}>
                  No videos found for “{query}”
                </T>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {results.map((r) => (
                <PosterTile
                  key={r.id}
                  reel={r}
                  size={(VW - 40) / 3}
                  onOpen={(rr) => {
                    setSearchOpen(false);
                    setQuery('');
                    jumpToReel(rr);
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- library (saved / liked / reposts) ---------------- */}
      <Modal visible={libraryOpen} transparent animationType="slide" onRequestClose={() => setLibraryOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,10,6,0.85)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setLibraryOpen(false)} />
          <View
            style={{
              maxHeight: 560,
              backgroundColor: '#0C1511',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              paddingBottom: 18,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
              <View style={{ flex: 1 }} />
              <T v="body" style={{ color: '#F2F7F3', fontWeight: '700', fontSize: 14 }}>
                Your videos
              </T>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Pressable onPress={() => setLibraryOpen(false)} hitSlop={10} style={{ padding: 4 }}>
                  <FontAwesome5 name="times" size={15} color="rgba(242,247,243,0.5)" />
                </Pressable>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 }}>
              {LIB_TABS.map((t) => {
                const on = libraryTab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => { haptic.selection(); setLibraryTab(t.id); }}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 8,
                      borderRadius: 11,
                      borderWidth: 1,
                      borderColor: on ? 'rgba(74,227,143,0.5)' : 'transparent',
                      backgroundColor: on ? 'rgba(46,204,113,0.16)' : 'transparent',
                    }}
                  >
                    <FontAwesome5 name={t.icon} size={11} color={on ? '#4AE38F' : 'rgba(242,247,243,0.5)'} />
                    <T v="caption" style={{ color: on ? '#4AE38F' : 'rgba(242,247,243,0.6)', fontWeight: '700', fontSize: 12 }}>
                      {t.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              {(libraryTab === 'saved' ? savedReels : libraryTab === 'liked' ? likedReels : repostedReels).length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 34, gap: 8 }}>
                  <FontAwesome5 name={LIB_TABS.find((t) => t.id === libraryTab)?.icon ?? 'bookmark'} size={20} color="rgba(242,247,243,0.35)" />
                  <T v="bodyS" style={{ color: 'rgba(242,247,243,0.55)', fontSize: 12.5 }}>
                    {libraryTab === 'saved' ? 'Videos you save will appear here.' : libraryTab === 'liked' ? 'Videos you like will appear here.' : 'Your reposts will appear here.'}
                  </T>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {(libraryTab === 'saved' ? savedReels : libraryTab === 'liked' ? likedReels : repostedReels).map((r) => (
                    <PosterTile
                      key={r.id}
                      reel={r}
                      size={(VW - 40) / 3}
                      onOpen={(rr) => {
                        setLibraryOpen(false);
                        jumpToReel(rr);
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- create studio ---------------- */}
      <CreateReelModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onPosted={(r) => {
          setCreateOpen(false);
          setFeedTab('foryou');
          setIndex(0);
          requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
          showToast('Posted — playing your video');
        }}
      />

      {/* comments */}
      <CommentsModal
        visible={!!commentPost}
        post={commentPost}
        seed={(commentPost ? (REEL_COMMENTS[commentPost.id] ?? []) as SampleComment[] : [])}
        onClose={() => setCommentReel(null)}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Create studio — caption + pick a video (library/file) or a sample clip     */
/* -------------------------------------------------------------------------- */

function CreateReelModal({ visible, onClose, onPosted }: { visible: boolean; onClose: () => void; onPosted: (r: MockReel) => void }) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [picked, setPicked] = useState<{ src: MockReel['src']; poster: MockReel['poster']; label: string } | null>(null);
  const [posting, setPosting] = useState(false);
  // web-only hidden file input (rendered as a real <input> by RNW)
  const fileRef = useRef<TextInput | null>(null);

  const pickFromLibrary = async () => {
    haptic.light();
    try {
      if (Platform.OS === 'web') {
        (fileRef.current as unknown as HTMLInputElement | null)?.click?.();
        return;
      }
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo-library access to pick a video.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setPicked({ src: { uri: res.assets[0].uri }, poster: SAMPLE_CLIPS[0].reel.poster, label: res.assets[0].fileName ?? 'Selected video' });
      }
    } catch {
      Alert.alert('Could not open the picker', 'Please try again.');
    }
  };

  const post = () => {
    if (!picked || posting) return;
    haptic.medium();
    setPosting(true);
    setTimeout(() => {
      const r = addUserReel({
        src: picked.src,
        poster: picked.poster,
        username: 'abdalrahman',
        caption: caption.trim() || 'New video on DeenLink 🎬',
        music: 'Original audio — Abdulrahman',
      });
      setPosting(false);
      setPicked(null);
      setCaption('');
      onPosted(r);
    }, 1200);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !posting && onClose()}>
      <View style={{ flex: 1, backgroundColor: 'rgba(2,6,4,0.78)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={() => !posting && onClose()} />
        <View
          style={{
            backgroundColor: isDark ? '#0C1511' : '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20,36,28,0.1)',
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 14) + 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={{ flex: 1 }} />
            <T v="body" style={{ fontWeight: '700', fontSize: 15, color: isDark ? '#F2F7F3' : '#14241C' }}>
              New video
            </T>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Pressable onPress={() => !posting && onClose()} hitSlop={10} style={{ padding: 4 }}>
                <FontAwesome5 name="times" size={16} color={isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)'} />
              </Pressable>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {/* source picker */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={pickFromLibrary}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  gap: 7,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.4)',
                  borderRadius: 14,
                  paddingVertical: 16,
                  backgroundColor: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(184,134,11,0.04)',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <FontAwesome5 name="photo-video" size={18} color={isDark ? '#E8C96A' : '#B8860B'} />
                <T v="bodyS" style={{ color: isDark ? '#E8C96A' : '#B8860B', fontWeight: '700', fontSize: 12.5 }}>
                  Choose video
                </T>
              </Pressable>
            </View>

            {/* hidden web file input */}
            {Platform.OS === 'web' ? (
              <input
                ref={fileRef as never}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e: unknown) => {
                  const file = (e as React.ChangeEvent<HTMLInputElement>).target.files?.[0];
                  if (file) setPicked({ src: { uri: URL.createObjectURL(file) }, poster: SAMPLE_CLIPS[0].reel.poster, label: file.name });
                }}
              />
            ) : null}

            {picked ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(14,122,70,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(46,204,113,0.4)' : 'rgba(14,122,70,0.3)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 }}>
                <FontAwesome5 name="check-circle" size={15} color={isDark ? '#4AE38F' : '#0E7A46'} />
                <T v="bodyS" numberOfLines={1} style={{ flex: 1, width: 0, color: isDark ? '#EAF7EE' : '#14241C', fontSize: 12.5, fontWeight: '600' }}>
                  {picked.label}
                </T>
                <Pressable onPress={() => setPicked(null)} hitSlop={8}>
                  <FontAwesome5 name="times-circle" size={14} color={isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.5)'} />
                </Pressable>
              </View>
            ) : null}

            {/* sample clips */}
            <View>
              <T v="caption" style={{ color: isDark ? 'rgba(242,247,243,0.55)' : 'rgba(20,36,28,0.55)', fontWeight: '800', fontSize: 10, letterSpacing: 0.7, marginBottom: 7 }}>
                OR USE A SAMPLE CLIP
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SAMPLE_CLIPS.map((s) => {
                  const on = picked?.label === s.label;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => { haptic.selection(); setPicked({ src: s.reel.src, poster: s.reel.poster, label: s.label }); }}
                      style={{
                        width: 62,
                        height: 110,
                        borderRadius: 10,
                        overflow: 'hidden',
                        borderWidth: on ? 2 : 1,
                        borderColor: on ? '#4AE38F' : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.14)',
                      }}
                    >
                      <Image source={s.reel.poster as never} style={{ width: 62, height: 110 }} resizeMode="cover" />
                      {on ? (
                        <View style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#4AE38F', alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesome5 name="check" size={9} color="#06230F" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* caption */}
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Write a caption…"
              placeholderTextColor={isDark ? 'rgba(242,247,243,0.4)' : 'rgba(20,36,28,0.4)'}
              multiline
              editable={!posting}
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 16,
                color: isDark ? '#F2F7F3' : '#14241C',
                minHeight: 62,
                textAlignVertical: 'top',
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.05)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20,36,28,0.1)',
                paddingHorizontal: 12,
                paddingTop: 10,
              }}
            />

            <Pressable
              onPress={post}
              disabled={posting || !picked}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 14,
                backgroundColor: isDark ? '#1F8F5C' : '#1D6F42',
                paddingVertical: 13,
                opacity: (picked ? 1 : 0.45) * (posting ? 0.8 : pressed ? 0.85 : 1),
              })}
            >
              <FontAwesome5 name="video" size={13} color="#FFFFFF" />
              <T v="body" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                {posting ? 'Posting… just a moment' : 'Post video'}
              </T>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
