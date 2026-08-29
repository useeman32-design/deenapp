import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { MOCK_ACCOUNTS, MOCK_FOLLOWED, MOCK_REELS, REEL_COMMENTS, type MockReel, type SampleComment } from '@/api/mocks';
import type { Post } from '@/api/types';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { AvatarImage } from '@/components/FeedCard';
import { CommunityInbox } from '@/components/CommunityInbox';
import { CommentsModal } from '@/components/CommentsModal';
import * as Clipboard from 'expo-clipboard';
import { HeartIcon } from '@/components/Icons';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { addUserReel, subscribeUserReels, userReels } from '@/lib/reelStore';

const { height: VH, width: VW } = Dimensions.get('window');

const SAVES_KEY = 'dl.reels.saved';
const REPOST_KEY = 'dl.reels.reposted';
const SPEEDS = [0.5, 1, 2, 3];

/** Sample clips offered in the create studio (demo picks). */
const SAMPLE_CLIPS: Array<{ id: number; label: string; reel: MockReel }> = MOCK_REELS.slice(0, 5).map((r) => ({
  id: r.id,
  label: `Clip ${r.id - 200}`,
  reel: r,
}));

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

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
  speed,
  onLike,
  onSave,
  onRepost,
  onComments,
  onOpenProfile,
  onMore,
  onShare,
  onAvatar,
}: {
  reel: MockReel;
  active: boolean;
  muted: boolean;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  speed: number;
  onLike: (id: number) => void;
  onSave: (id: number) => void;
  onRepost: (id: number) => void;
  onComments: (r: MockReel) => void;
  onOpenProfile: (username: string) => void;
  onMore: (r: MockReel) => void;
  onShare: (r: MockReel) => void;
  onAvatar: (img: number | null, name: string) => void;
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
    p.muted = false;
  });
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const lastTap = useRef(0);
  const lastBurstAt = useRef(0);
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (active && !paused) player.play();
    else player.pause();
  }, [active, paused, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    player.playbackRate = speed;
  }, [speed, player, active]);

  useEffect(() => {
    const t = setInterval(() => {
      try {
        const d = player.duration;
        if (d > 0) setProgress(Math.min(1, player.currentTime / d));
      } catch {
        /* player not ready */
      }
    }, 300);
    return () => clearInterval(t);
  }, [player]);

  /** burst at the tap position — every double-tap, even when already liked */
  const spawnBurst = (x: number, y: number) => {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b.slice(-5), { id, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((it) => it.id !== id)), 780);
  };

  /** tap = play/pause (delayed so a double-tap never pauses) · double-tap = like at finger */
  const onTap = (e: { nativeEvent: { locationX?: number; locationY?: number; pageX?: number; pageY?: number } }) => {
    const now = Date.now();
    const dbl = now - lastTap.current < 300;
    lastTap.current = now;
    if (dbl) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      const x = e.nativeEvent.locationX ?? e.nativeEvent.pageX ?? VW / 2;
      const y = e.nativeEvent.locationY ?? e.nativeEvent.pageY ?? VH / 2;
      spawnBurst(x, y);
      lastBurstAt.current = now;
      if (!liked) {
        onLike(reel.id);
        haptic.medium();
      }
    } else if (now - lastBurstAt.current > 800) {
      // single tap → pause, but never right after a burst (rapid tapping)
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        setPaused((p) => {
          if (p) player.play();
          else player.pause();
          return !p;
        });
        haptic.selection();
      }, 300);
    }
  };

  /* ------- draggable seek line ------- */
  const grantX = useRef(0);
  const seekTo = (fraction: number) => {
    try {
      player.currentTime = fraction * Math.max(0.001, player.duration);
    } catch {
      /* ignore */
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3,
      onPanResponderGrant: (e) => {
        haptic.selection();
        grantX.current = e.nativeEvent.locationX;
        setScrub(Math.max(0, Math.min(1, grantX.current / VW)));
      },
      onPanResponderMove: (_e, g) => {
        setScrub(Math.max(0, Math.min(1, (grantX.current + g.dx) / VW)));
      },
      onPanResponderRelease: () => {
        setScrub((final) => {
          if (final != null) seekTo(final);
          return null;
        });
      },
      onPanResponderTerminate: () => setScrub(null),
    }),
  ).current;

  /** one-off heart burst at a tap position */
  function HeartBurst({ x, y }: { x: number; y: number }) {
    const a = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(a, { toValue: 1, duration: 640, useNativeDriver: true, easing: Easing.out(Easing.poly(3)) }).start();
    }, [a]);
    const bOpacity = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] });
    const bScale = a.interpolate({ inputRange: [0, 0.3, 0.8, 1], outputRange: [0.3, 1.25, 1.0, 0.92] });
    const bTy = a.interpolate({ inputRange: [0, 1], outputRange: [0, -44] });
    return (
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: x - 52, top: y - 52, opacity: bOpacity, transform: [{ scale: bScale }, { translateY: bTy }] }}>
        <HeartIcon size={104} filled color="#fff" />
      </Animated.View>
    );
  }

  const railButton = (icon: string, label: string, onPress: () => void, tint?: string) => (
    <Pressable onPress={onPress} hitSlop={6} style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(10,20,14,0.42)',
          borderWidth: 1,
          borderColor: tint ? `${tint}88` : 'rgba(255,255,255,0.15)',
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
      {/* video layer — no native chrome, no touches: our overlay owns interaction */}
      {active ? (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
          <VideoView
            player={player}
            contentFit="cover"
            nativeControls={false}
            playsInline
            style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
          />
        </View>
      ) : (
        <Image source={reel.poster as never} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} resizeMode="cover" />
      )}

      {/* soft scrims — small, dissolving into the video at both ends */}
      <LinearGradient
        colors={['rgba(0,0,0,0.50)', 'rgba(0,0,0,0)']}
        locations={[0, 1]}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 84 }}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.58)']}
        locations={[0, 0.45, 1]}
        pointerEvents="none"
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 170 }}
      />

      {/* tap + long-press surface (long-press = more menu) */}
      <Pressable onPress={onTap} onLongPress={() => onMore(reel)} delayLongPress={380} style={{ position: 'absolute', inset: 0 }} />
      {paused && active ? (
        <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', inset: 0 }}>
          <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="play" size={25} color="#FFFFFF" />
          </View>
        </View>
      ) : null}

      {/* double-tap heart bursts — wherever the finger tapped */}
      {bursts.map((b) => (
        <HeartBurst key={b.id} x={b.x} y={b.y} />
      ))}

      {/* right action rail — like · comment · save · share · ••• */}
      <View style={{ position: 'absolute', right: 12, bottom: 152, gap: 13 }}>
        {railButton('heart', (reel.likes + (liked ? 1 : 0)).toLocaleString(), () => { haptic.light(); onLike(reel.id); }, liked ? '#FF5A5A' : undefined)}
        {railButton('comment', String(reel.comments), () => onComments(reel))}
        {railButton('bookmark', (reel.saves + (saved ? 1 : 0)).toLocaleString(), () => { haptic.light(); onSave(reel.id); }, saved ? '#E8C96A' : undefined)}
        {railButton('share', 'Share', () => { haptic.light(); onShare(reel); })}
        {railButton('ellipsis-h', '', () => { haptic.light(); onMore(reel); })}
      </View>

      {/* bottom info */}
      <View style={{ position: 'absolute', left: 14, right: 76, bottom: 96 }}>
        {reel.repostedBy ? (
          <Pressable
            onPress={() => onOpenProfile(reel.repostedBy as string)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(10,20,14,0.45)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
              borderRadius: 999,
              paddingLeft: 3,
              paddingRight: 9,
              paddingVertical: 3,
              marginBottom: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {(() => {
              const rp = MOCK_ACCOUNTS.find((x) => x.username === reel.repostedBy);
              return (
                <>
                  <AvatarImage source={rp?.photo ?? null} name={rp?.full_name ?? String(reel.repostedBy)} size={18} tint="rgba(46,204,113,0.2)" border="rgba(255,255,255,0.35)" />
                  <FontAwesome5 name="retweet" size={9} color="#4AE38F" />
                  <T v="caption" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' }}>
                    Reposted by @{reel.repostedBy}
                  </T>
                </>
              );
            })()}
          </Pressable>
        ) : null}
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
              {reel.music} · {reel.views.toLocaleString()} views{speed !== 1 ? ` · ${speed}x` : ''}
            </T>
          </View>
        </View>
      </View>

      {/* seek line — draggable scrubber */}
      <View
        {...pan.panHandlers}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, justifyContent: 'flex-end' }}
      >
        <SeekTrack progress={progress} scrub={scrub} duration={durSafe(player)} />
      </View>
    </View>
  );
}

const durSafe = (player: { duration: number }) => {
  try {
    return Math.max(0.001, player.duration);
  } catch {
    return 0.001;
  }
};

/** visual track + thumb + time bubble */
function SeekTrack({ progress, scrub, duration }: { progress: number; scrub: number | null; duration: number }) {
  const shown = scrub ?? progress;
  return (
    <View style={{ height: 22, justifyContent: 'center' }}>
      <View style={{ height: scrub != null ? 5 : 3, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 8 }}>
        <View style={{ width: `${shown * 100}%`, height: '100%', borderRadius: 2.5, backgroundColor: '#2ECC71' }} />
      </View>
      {scrub != null ? (
        <>
          <View style={{ position: 'absolute', left: 8 + shown * (VW - 16) - 6.5, width: 13, height: 13, borderRadius: 7, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5 }} />
          <View style={{ position: 'absolute', right: 14, bottom: 20, backgroundColor: 'rgba(8,16,11,0.9)', borderWidth: 1, borderColor: 'rgba(74,227,143,0.4)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <T v="caption" style={{ color: '#EAF7EE', fontSize: 10.5, fontWeight: '800' }}>
              {fmtTime(shown * duration)} / {fmtTime(duration)}
            </T>
          </View>
        </>
      ) : null}
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

type FeedTab = 'foryou' | 'following' | 'friends';
type LibraryTab = 'saved' | 'liked' | 'reposts';

export default function VideosFeed() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ start?: string; create?: string }>();

  const [feedTab, setFeedTab] = useState<FeedTab>('foryou');
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [reposted, setReposted] = useState<Set<number>>(new Set());
  const [commentReel, setCommentReel] = useState<MockReel | null>(null);
  const [shareReel, setShareReel] = useState<MockReel | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<{ img: number | null; name: string } | null>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('saved');
  const [createOpen, setCreateOpen] = useState(false);
  const [moreReel, setMoreReel] = useState<MockReel | null>(null);
  const [sendToOpen, setSendToOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [storeTick, setStoreTick] = useState(0);
  const SEG_W = 72;
  const thumbX = useRef(new Animated.Value(feedTab === 'following' ? 0 : feedTab === 'foryou' ? SEG_W : SEG_W * 2)).current;

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
    if (feedTab === 'friends') {
      return MOCK_REELS.filter((r) => MOCK_FOLLOWED.includes(r.username) || r.repostedBy != null);
    }
    return [...mine, ...MOCK_REELS];
  }, [feedTab, storeTick]);

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

  const downloadReel = async (reel: MockReel) => {
    haptic.light();
    try {
      let uri: string;
      if (reel.wm != null) {
        // bundled sample → use the pre-built DeenLink-watermarked copy
        const { Asset } = await import('expo-asset');
        const asset = Asset.fromModule(reel.wm);
        await asset.downloadAsync();
        uri = asset.localUri ?? asset.uri;
      } else if (typeof reel.src === 'number') {
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
        showToast('Downloading with DeenLink watermark');
        return;
      }
      const MediaLibrary = await import('expo-media-library');
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo-library access to save videos.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved ✓', reel.wm != null ? 'Video saved to your gallery with the DeenLink watermark.' : 'Video saved to your gallery.');
    } catch {
      Alert.alert('Download failed', 'Please try again in a moment.');
    }
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

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* top bar: back · glassy tabs · search */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(10,20,14,0.45)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FontAwesome5 name="chevron-left" size={15} color="#FFFFFF" />
        </Pressable>

        {/* Following / For-you — segmented control with sliding thumb */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 21,
              padding: 3,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              backgroundColor: 'rgba(8,16,11,0.55)',
            }}
          >
            {/* sliding thumb */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                width: SEG_W,
                height: 30,
                borderRadius: 18,
                backgroundColor: '#F2F7F3',
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
                transform: [{ translateX: thumbX }],
              }}
            />
            {(['following', 'foryou', 'friends'] as FeedTab[]).map((id) => {
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
                    Animated.spring(thumbX, { toValue: id === 'following' ? 0 : id === 'foryou' ? SEG_W : SEG_W * 2, useNativeDriver: true, friction: 7, tension: 90 }).start();
                  }}
                  style={{ width: SEG_W, height: 30, alignItems: 'center', justifyContent: 'center' }}
                >
                  <T v="body" style={{ color: on ? '#0B1512' : 'rgba(255,255,255,0.62)', fontWeight: on ? '800' : '600', fontSize: 12, letterSpacing: 0.2 }}>
                    {id === 'following' ? 'Following' : id === 'foryou' ? 'For you' : 'Friends'}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => { haptic.selection(); setSearchOpen(true); }}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(10,20,14,0.45)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FontAwesome5 name="search" size={14} color="#FFFFFF" />
        </Pressable>
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
            speed={speed}
            onLike={toggleLike}
            onSave={toggleSave}
            onRepost={toggleRepost}
            onComments={(r) => setCommentReel(r)}
            onShare={(r) => setShareReel(r)}
            onAvatar={(img, nm) => setAvatarPreview({ img, name: nm })}
            onOpenProfile={(u) => router.push(`/profile/${u}`)}
            onMore={(r) => setMoreReel(r)}
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

      {/* bottom menu — labels pill + plus fully outside, level */}
      <View style={{ position: 'absolute', alignSelf: 'center', bottom: 16 + insets.bottom * 0.4, flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            borderRadius: 27,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.16)',
            shadowColor: '#000',
            shadowOpacity: 0.35,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
          }}
        >
          <BlurView intensity={34} tint="dark" style={{ position: 'absolute', inset: 0 }} />
          <View
            style={{
              backgroundColor: 'rgba(10,20,14,0.35)',
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 6,
              paddingVertical: 7,
              gap: 2,
            }}
          >
            {[
              { id: 'inbox', icon: 'comment-dots', label: 'Inbox' },
              { id: 'friends', icon: 'user-friends', label: 'Friends' },
              { id: 'saved', icon: 'bookmark', label: 'Saved' },
            ].map((b) => (
              <Pressable
                key={b.id}
                onPress={() => {
                  haptic.selection();
                  if (b.id === 'saved') setLibraryOpen(true);
                  else if (b.id === 'inbox') setInboxOpen(true);
                  else {
                    setFeedTab('friends');
                    setIndex(0);
                    listRef.current?.scrollToOffset({ offset: 0, animated: false });
                    Animated.spring(thumbX, { toValue: SEG_W * 2, useNativeDriver: true, friction: 7, tension: 90 }).start();
                  }
                }}
                style={({ pressed }) => ({ alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 3, opacity: pressed ? 0.7 : 1 })}
              >
                <FontAwesome5 name={b.icon as never} size={15} color="#FFFFFF" />
                <T v="caption" style={{ color: 'rgba(255,255,255,0.87)', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.3 }}>
                  {b.label}
                </T>
              </Pressable>
            ))}
          </View>
        </View>

        {/* plus — fully OUTSIDE the pill, level with it (pass 18) */}
        <Pressable
          onPress={() => { haptic.light(); setCreateOpen(true); }}
          style={({ pressed }) => ({
            marginLeft: 14,
            alignSelf: 'center',
            width: 50,
            height: 50,
            borderRadius: 25,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1F8F5C',
            borderWidth: 2,
            borderColor: 'rgba(212,175,55,0.8)',
            opacity: pressed ? 0.85 : 1,
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 12,
          })}
        >
          <FontAwesome5 name="plus" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* inbox — the SAME universal inbox as the main app: reels/posts/duas/ayahs, chat + reactions */}
      <CommunityInbox visible={inboxOpen} onClose={() => setInboxOpen(false)} />

      {/* friends sheet */}
      {friendsOpen ? (
        <View style={{ position: 'absolute', inset: 0, zIndex: 80, backgroundColor: 'rgba(4,8,6,0.72)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setFriendsOpen(false)} />
          <View style={{ maxHeight: 520, backgroundColor: '#0C1712', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T v="body" style={{ flex: 1, color: '#F2F7F3', fontWeight: '800', fontSize: 15 }}>
                Friends
              </T>
              <Pressable onPress={() => setFriendsOpen(false)} hitSlop={10} style={{ padding: 4 }}>
                <FontAwesome5 name="times" size={15} color="rgba(242,247,243,0.5)" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              {MOCK_ACCOUNTS.filter((a) => a.username !== 'abdalrahman').map((a) => (
                <View key={a.username} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  <AvatarImage source={a.photo ?? null} name={a.full_name} size={36} tint="rgba(46,204,113,0.2)" border="rgba(255,255,255,0.2)" />
                  <View style={{ flex: 1 }}>
                    <T v="bodyS" style={{ color: '#F2F7F3', fontWeight: '700', fontSize: 12.5 }}>
                      {a.full_name}
                    </T>
                    <T v="caption" style={{ color: 'rgba(242,247,243,0.5)', fontSize: 10.5 }}>
                      @{a.username}
                    </T>
                  </View>
                  <Pressable
                    onPress={() => { haptic.light(); showToast(`Sent to @${a.username}`); }}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(46,204,113,0.18)', borderWidth: 1, borderColor: 'rgba(74,227,143,0.45)' }}
                  >
                    <T v="caption" style={{ color: '#4AE38F', fontWeight: '800', fontSize: 10.5 }}>
                      Send
                    </T>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* share sheet — send to · copy link · more (native share) */}
      {shareReel ? (
        <View style={{ position: 'absolute', inset: 0, zIndex: 85, backgroundColor: 'rgba(4,8,6,0.72)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShareReel(null)} />
          <View style={{ backgroundColor: '#0C1712', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <T v="body" style={{ flex: 1, color: '#F2F7F3', fontWeight: '800', fontSize: 15 }}>
                Share
              </T>
              <Pressable onPress={() => setShareReel(null)} hitSlop={10} style={{ padding: 4 }}>
                <FontAwesome5 name="times" size={15} color="rgba(242,247,243,0.5)" />
              </Pressable>
            </View>
            <T v="caption" style={{ color: 'rgba(242,247,243,0.5)', fontWeight: '800', fontSize: 10, letterSpacing: 1, marginBottom: 10 }}>
              SEND TO
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 6 }}>
              {MOCK_ACCOUNTS.filter((a) => a.username !== 'abdalrahman').map((a) => (
                <Pressable
                  key={a.username}
                  onPress={() => { haptic.light(); showToast(`Sent to @${a.username}`); setShareReel(null); }}
                  style={{ alignItems: 'center', gap: 6, width: 64 }}
                >
                  <AvatarImage source={a.photo ?? null} name={a.full_name} size={52} tint="rgba(46,204,113,0.2)" border="rgba(255,255,255,0.2)" />
                  <T v="caption" numberOfLines={1} style={{ color: 'rgba(242,247,243,0.8)', fontSize: 10 }}>
                    {a.full_name.split(' ')[0]}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 }} />
            <Pressable
              onPress={async () => {
                haptic.light();
                const link = `https://useeman32-design.github.io/deenapp/videos?start=${shareReel.id}`;
                await Clipboard.setStringAsync(link).catch(() => {});
                showToast('Link copied');
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.14)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="link" size={14} color="#E8C96A" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="body" style={{ color: '#F2F7F3', fontWeight: '700', fontSize: 13 }}>
                  Copy line
                </T>
                <T v="caption" style={{ color: 'rgba(242,247,243,0.45)', fontSize: 10.5 }}>
                  Copy a direct link to this video
                </T>
              </View>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic.light();
                Share.share({ message: `${shareReel.username} on DeenLink Videos — https://useeman32-design.github.io/deenapp/videos?start=${shareReel.id}` }).catch(() => {});
                setShareReel(null);
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(46,204,113,0.14)', borderWidth: 1, borderColor: 'rgba(74,227,143,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="ellipsis-h" size={14} color="#4AE38F" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="body" style={{ color: '#F2F7F3', fontWeight: '700', fontSize: 13 }}>
                  More
                </T>
                <T v="caption" style={{ color: 'rgba(242,247,243,0.45)', fontSize: 10.5 }}>
                  Open the system share sheet
                </T>
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* avatar fullscreen preview — DeenLink tagged */}
      {avatarPreview ? (
        <Pressable style={{ position: 'absolute', inset: 0, zIndex: 130, backgroundColor: 'rgba(4,8,6,0.95)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setAvatarPreview(null)}>
          <View style={{ alignItems: 'center' }}>
            <AvatarImage source={avatarPreview.img} name={avatarPreview.name} size={300} tint="rgba(46,204,113,0.2)" border="rgba(212,175,55,0.55)" />
            <T v="h2" style={{ color: '#F2F7F3', fontWeight: '800', fontSize: 17, marginTop: 16 }}>
              {avatarPreview.name}
            </T>
            <View style={{ position: 'absolute', bottom: -44, right: -6, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(4,8,6,0.7)' }}>
              <FontAwesome5 name="check-circle" size={9} color="#E8C96A" />
              <T v="caption" style={{ color: '#E8C96A', fontWeight: '800', fontSize: 9.5, letterSpacing: 0.4 }}>
                @deenlink
              </T>
            </View>
          </View>
        </Pressable>
      ) : null}

      {/* toast */}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: VW / 2 - 140,
            width: 280,
            bottom: 92 + insets.bottom,
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
              {([
                { id: 'saved', label: 'Saved', icon: 'bookmark' },
                { id: 'liked', label: 'Liked', icon: 'heart' },
                { id: 'reposts', label: 'Reposts', icon: 'retweet' },
              ] as Array<{ id: LibraryTab; label: string; icon: string }>).map((t) => {
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
                  <FontAwesome5 name={libraryTab === 'saved' ? 'bookmark' : libraryTab === 'liked' ? 'heart' : 'retweet'} size={20} color="rgba(242,247,243,0.35)" />
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

      {/* ---------------- more menu (••• / long-press) ---------------- */}
      <Modal visible={!!moreReel} transparent animationType="slide" onRequestClose={() => setMoreReel(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,10,6,0.7)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => { setMoreReel(null); setSendToOpen(false); }} />
          <View
            style={{
              backgroundColor: '#0C1511',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              paddingTop: 12,
              paddingBottom: 20,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            </View>

            {!sendToOpen ? (
              <View style={{ paddingHorizontal: 14, gap: 2 }}>
                <MoreRow icon="retweet" label={moreReel && reposted.has(moreReel.id) ? 'Undo repost' : 'Repost'} tint="#4AE38F" onPress={() => { if (moreReel) toggleRepost(moreReel.id); setMoreReel(null); }} />
                <MoreRow icon="download" label="Download (watermarked)" tint="#E8C96A" onPress={() => { if (moreReel) downloadReel(moreReel); setMoreReel(null); }} />
                <MoreRow icon="paper-plane" label="Send to…" tint="#4AE38F" onPress={() => setSendToOpen(true)} />

                {/* speed selector */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingVertical: 10 }}>
                  <View style={{ width: 30, alignItems: 'center' }}>
                    <FontAwesome5 name="tachometer-alt" size={15} color="rgba(242,247,243,0.7)" />
                  </View>
                  {SPEEDS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => { haptic.selection(); setSpeed(s); }}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 7,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: speed === s ? 'rgba(74,227,143,0.6)' : 'rgba(255,255,255,0.12)',
                        backgroundColor: speed === s ? 'rgba(46,204,113,0.16)' : 'transparent',
                      }}
                    >
                      <T v="caption" style={{ color: speed === s ? '#4AE38F' : 'rgba(242,247,243,0.7)', fontWeight: '800', fontSize: 11 }}>
                        {s}x
                      </T>
                    </Pressable>
                  ))}
                </View>

                <MoreRow icon="flag" label="Report" tint="#FF7B7B" onPress={() => { setMoreReel(null); Alert.alert('Report submitted', 'JazakAllah khair — our moderation team will review this video.'); }} />
                <MoreRow icon="eye-slash" label="Not interested" tint="rgba(242,247,243,0.7)" onPress={() => { setMoreReel(null); showToast('You’ll see fewer videos like this'); }} />
              </View>
            ) : (
              <View style={{ paddingHorizontal: 8 }}>
                <T v="caption" style={{ color: 'rgba(242,247,243,0.55)', fontWeight: '800', fontSize: 10, letterSpacing: 0.7, paddingHorizontal: 10, marginBottom: 6 }}>
                  SEND TO
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {MOCK_ACCOUNTS.map((a) => (
                    <Pressable
                      key={a.username}
                      onPress={() => {
                        haptic.success();
                        setSendToOpen(false);
                        setMoreReel(null);
                        showToast(`Sent to @${a.username}`);
                      }}
                      style={{ alignItems: 'center', width: 76, paddingVertical: 8, gap: 5 }}
                    >
                      <AvatarImage source={a.photo ?? null} name={a.full_name} size={44} tint="rgba(46,204,113,0.16)" border="rgba(255,255,255,0.2)" />
                      <T v="caption" numberOfLines={1} style={{ color: 'rgba(242,247,243,0.8)', fontSize: 9.5, fontWeight: '700' }}>
                        @{a.username}
                      </T>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ---------------- create studio ---------------- */}
      <CreateReelModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onPosted={() => {
          setCreateOpen(false);
          setFeedTab('foryou');
          setIndex(0);
          requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
          showToast('Posted — playing your video');
        }}
      />

      {/* comments — inline sheet on native (RN Modal inside a modal route
          doesn't present reliably on iOS), system Modal on web */}
      <CommentsModal
        visible={!!commentPost}
        inline={Platform.OS !== 'web'}
        post={commentPost}
        seed={(commentPost ? (REEL_COMMENTS[commentPost.id] ?? []) as SampleComment[] : [])}
        onClose={() => setCommentReel(null)}
      />
    </View>
  );
}

function MoreRow({ icon, label, tint, onPress }: { icon: string; label: string; tint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 6,
        paddingVertical: 11,
        borderRadius: 12,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <View style={{ width: 30, alignItems: 'center' }}>
        <FontAwesome5 name={icon} size={15} color={tint} />
      </View>
      <T v="body" style={{ color: '#F2F7F3', fontSize: 13.5, fontWeight: '600' }}>
        {label}
      </T>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  Create studio — caption + pick a video (library/file) or a sample clip     */
/* -------------------------------------------------------------------------- */

function CreateReelModal({ visible, onClose, onPosted }: { visible: boolean; onClose: () => void; onPosted: () => void }) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [picked, setPicked] = useState<{ src: MockReel['src']; poster: MockReel['poster']; label: string } | null>(null);
  const [posting, setPosting] = useState(false);
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
      addUserReel({
        src: picked.src,
        poster: picked.poster,
        username: 'abdalrahman',
        caption: caption.trim() || 'New video on DeenLink 🎬',
        music: 'Original audio — Abdulrahman',
      });
      setPosting(false);
      setPicked(null);
      setCaption('');
      onPosted();
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
            <Pressable
              onPress={pickFromLibrary}
              style={({ pressed }) => ({
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
              {posting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome5 name="video" size={13} color="#FFFFFF" />}
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

/* ------------------------------------------------------------------ */
/* TikTok-style inbox (pass 18):                                       */
/*   level 1 — list of friends who shared reels with you              */
/*   level 2 — conversation-like thread of the reels you two shared   */
/*   NO chat anywhere: only reel bubbles + emoji reactions.           */
/*   Double-tap a reel bubble → emoji panel → react.                   */
/* ------------------------------------------------------------------ */

const INBOX_EMOJIS = ['❤️', '😂', '😮', '🤲', '🔥', '🤍'] as const;

type ShareEntry = { reelId: number; ago: string; dir: 'them' | 'me' };
type FriendThread = { friend: string; items: ShareEntry[] };

const INBOX_THREADS: FriendThread[] = [
  { friend: 'aisha_yusuf', items: [
    { reelId: 204, ago: '2h', dir: 'them' },
    { reelId: 201, ago: '1d', dir: 'me' },
    { reelId: 205, ago: '3d', dir: 'them' },
  ] },
  { friend: 'alameen', items: [
    { reelId: 201, ago: '5h', dir: 'them' },
    { reelId: 203, ago: '2d', dir: 'them' },
  ] },
  { friend: 'usman_ahmad', items: [
    { reelId: 203, ago: '9h', dir: 'them' },
    { reelId: 202, ago: '4d', dir: 'me' },
  ] },
  { friend: 'Gimba', items: [
    { reelId: 205, ago: '1d', dir: 'them' },
  ] },
  { friend: 'mayanchie12', items: [
    { reelId: 202, ago: '2d', dir: 'them' },
    { reelId: 204, ago: '5d', dir: 'me' },
  ] },
];

function InboxOverlay({ onClose, openReel }: { onClose: () => void; openReel: (reelId: number) => void }) {
  const insets = useSafeAreaInsets();
  const [thread, setThread] = useState<FriendThread | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const lastTap = useRef<{ key: string; t: number }>({ key: '', t: 0 });
  const pop = useRef(new Animated.Value(0)).current;

  const popIn = () => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4, tension: 70 }).start();
  };

  const onTapBubble = (key: string) => {
    const now = Date.now();
    const isDouble = lastTap.current.key === key && now - lastTap.current.t < 320;
    lastTap.current = { key, t: now };
    if (isDouble) {
      haptic.light();
      setEmojiFor(key);
    }
  };

  const react = (key: string, emoji: string) => {
    haptic.success();
    setReactions((r) => ({ ...r, [key]: r[key] === emoji ? '' : emoji }));
    setEmojiFor(null);
    popIn();
  };

  const acc = (u: string) => MOCK_ACCOUNTS.find((a) => a.username === u) ?? MOCK_ACCOUNTS[0];
  const reel = (id: number) => MOCK_REELS.find((x) => x.id === id);

  /* ---------- level 2 — the reel thread with one friend ---------- */
  if (thread) {
    const a = acc(thread.friend);
    return (
      <View style={{ position: 'absolute', inset: 0, zIndex: 120, backgroundColor: '#07100C' }}>
        {/* header */}
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => { haptic.selection(); setThread(null); }} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={14} color="#FFFFFF" />
          </Pressable>
          <AvatarImage source={a.photo ?? null} name={a.full_name} size={36} tint="rgba(46,204,113,0.2)" border="rgba(212,175,55,0.5)" />
          <View style={{ flex: 1 }}>
            <T v="bodyS" style={{ color: '#F2F7F3', fontWeight: '800', fontSize: 13.5 }}>
              {a.full_name}
            </T>
            <T v="caption" style={{ color: 'rgba(242,247,243,0.5)', fontSize: 10, marginTop: 1 }}>
              @{a.username} · reels you share with each other
            </T>
          </View>
          <View style={{ borderRadius: 9, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 8, paddingVertical: 4 }}>
            <T v="caption" style={{ color: '#E8C96A', fontWeight: '800', fontSize: 9 }}>NO CHAT</T>
          </View>
        </View>

        {/* the shared-reel history */}
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110, gap: 14 }} showsVerticalScrollIndicator={false}>
          {thread.items.map((it) => {
            const r = reel(it.reelId);
            if (!r) return null;
            const key = `${thread.friend}-${it.reelId}-${it.ago}`;
            const mine = it.dir === 'me';
            const reaction = reactions[key];
            return (
              <View key={key} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
                {!mine ? <AvatarImage source={acc(thread.friend).photo ?? null} name={acc(thread.friend).full_name} size={28} tint="rgba(46,204,113,0.2)" border="rgba(255,255,255,0.2)" /> : null}
                <Pressable
                  onPress={() => onTapBubble(key)}
                  onLongPress={() => openReel(it.reelId)}
                  style={({ pressed }) => ({
                    maxWidth: '72%',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: mine ? 'rgba(74,227,143,0.45)' : 'rgba(255,255,255,0.12)',
                    backgroundColor: mine ? 'rgba(31,143,92,0.14)' : 'rgba(255,255,255,0.05)',
                    padding: 6,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{ borderRadius: 10, overflow: 'hidden' }}>
                    <Image source={r.poster as never} style={{ width: 168, height: 224 }} resizeMode="cover" />
                    <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(4,12,8,0.6)', borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name="play" size={13} color="#FFFFFF" />
                      </View>
                    </View>
                    {/* reaction badge pinned to the bubble corner */}
                    {reaction ? (
                      <Animated.Text
                        key={reaction}
                        style={{ position: 'absolute', right: 6, bottom: 6, fontSize: 17, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }}
                      >
                        {reaction}
                      </Animated.Text>
                    ) : null}
                  </View>
                  <T v="caption" numberOfLines={1} style={{ color: 'rgba(242,247,243,0.8)', fontSize: 10.5, marginTop: 6, marginHorizontal: 2, width: 160 }}>
                    {r.caption}
                  </T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, marginHorizontal: 2, marginBottom: 2 }}>
                    <FontAwesome5 name={mine ? 'share' : 'share-square'} size={8} color="rgba(242,247,243,0.4)" />
                    <T v="caption" style={{ color: 'rgba(242,247,243,0.4)', fontSize: 9 }}>{mine ? `you shared · ${it.ago}` : `shared with you · ${it.ago}`}</T>
                  </View>
                </Pressable>
                {mine ? <AvatarImage source={null} name="You" size={28} tint="rgba(212,175,55,0.22)" border="rgba(212,175,55,0.5)" /> : null}
              </View>
            );
          })}
          <T v="caption" style={{ color: 'rgba(242,247,243,0.3)', textAlign: 'center', fontSize: 9.5, fontStyle: 'italic' }}>
            Long-press a reel to watch it · double-tap to react
          </T>
        </ScrollView>

        {/* where a chat bar would be — emoji-only instead */}
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14 + insets.bottom, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(10,20,14,0.9)', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
          <FontAwesome5 name="video" size={12} color="rgba(242,247,243,0.5)" />
          <T v="caption" style={{ flex: 1, color: 'rgba(242,247,243,0.5)', fontSize: 10.5 }}>
            Chat is off — reactions only. Double-tap any reel to react.
          </T>
          {INBOX_EMOJIS.slice(0, 3).map((e) => (
            <Pressable key={e} onPress={() => { haptic.selection(); setEmojiFor(lastTap.current.key || `${thread.friend}-${thread.items[0].reelId}-${thread.items[0].ago}`); }} style={{ padding: 2 }}>
              <T v="bodyS" style={{ fontSize: 15 }}>{e}</T>
            </Pressable>
          ))}
        </View>

        {/* double-tap emoji panel */}
        {emojiFor ? (
          <Pressable style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,8,6,0.55)', justifyContent: 'flex-end' }} onPress={() => setEmojiFor(null)}>
            <Pressable style={{ paddingBottom: 24 + insets.bottom, paddingHorizontal: 14 }}>
              <View style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(12,23,18,0.97)', paddingVertical: 14, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                {INBOX_EMOJIS.map((e, i) => (
                  <Pressable
                    key={e}
                    onPress={() => react(emojiFor, e)}
                    style={({ pressed }) => ({ transform: [{ scale: pressed ? 1.35 : 1 }] })}
                  >
                    <Animated.Text style={{ fontSize: 30, opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), marginTop: i % 2 === 0 ? 0 : 10 }}>
                      {e}
                    </Animated.Text>
                  </Pressable>
                ))}
              </View>
              <T v="caption" style={{ color: 'rgba(242,247,243,0.45)', textAlign: 'center', fontSize: 10, marginTop: 10 }}>
                Tap an emoji to react to this reel
              </T>
            </Pressable>
          </Pressable>
        ) : null}
      </View>
    );
  }

  /* ---------- level 1 — friends who shared with you ---------- */
  return (
    <View style={{ position: 'absolute', inset: 0, zIndex: 120, backgroundColor: '#07100C' }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={onClose} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={14} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ color: '#F2F7F3', fontWeight: '800', fontSize: 18 }}>
            Inbox
          </T>
          <T v="caption" style={{ color: 'rgba(242,247,243,0.5)', fontSize: 10.5, marginTop: 1 }}>
            Shared reels · react with emojis · no chat
          </T>
        </View>
        <FontAwesome5 name="video" size={16} color="rgba(242,247,243,0.4)" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {INBOX_THREADS.map((t) => {
          const a = acc(t.friend);
          const first = reel(t.items[0].reelId);
          if (!first) return null;
          const newCount = t.items.filter((x) => x.dir === 'them').length;
          return (
            <Pressable
              key={t.friend}
              onPress={() => { haptic.selection(); setThread(t); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, marginBottom: 10, opacity: pressed ? 0.8 : 1 })}
            >
              <View>
                <AvatarImage source={a.photo ?? null} name={a.full_name} size={46} tint="rgba(46,204,113,0.2)" border="rgba(255,255,255,0.2)" />
                <View style={{ position: 'absolute', right: -1, top: -1, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#1F8F5C', borderWidth: 1.5, borderColor: '#07100C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                  <T v="caption" style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{newCount}</T>
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bodyS" numberOfLines={1} style={{ color: '#F2F7F3', fontWeight: '700', fontSize: 13 }}>
                  {a.full_name}
                </T>
                <T v="caption" numberOfLines={1} style={{ color: 'rgba(242,247,243,0.5)', fontSize: 10.5, marginTop: 2 }}>
                  shared {t.items.length} reel{t.items.length > 1 ? 's' : ''} with you · {t.items[0].ago}
                </T>
              </View>
              <Image source={first.poster as never} style={{ width: 44, height: 58, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }} resizeMode="cover" />
              <FontAwesome5 name="chevron-right" size={12} color="rgba(242,247,243,0.35)" />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
