import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Platform,
  Pressable,
  Share,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTheme } from '@/context/ThemeContext';
import { MOCK_ACCOUNTS, MOCK_REELS, REEL_COMMENTS, type MockReel, type SampleComment } from '@/api/mocks';
import type { Post } from '@/api/types';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { AvatarImage } from '@/components/FeedCard';
import { CommentsModal } from '@/components/CommentsModal';
import { HeartIcon } from '@/components/Icons';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

const { height: VH, width: VW } = Dimensions.get('window');

const SAVES_KEY = 'dl.reels.saved';

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
  onLike,
  onSave,
  onComments,
  onOpenProfile,
}: {
  reel: MockReel;
  active: boolean;
  muted: boolean;
  liked: boolean;
  saved: boolean;
  onLike: (id: number) => void;
  onSave: (id: number) => void;
  onComments: (r: MockReel) => void;
  onOpenProfile: (username: string) => void;
}) {
  const { isDark } = useTheme();
  const account = useMemo(
    () => MOCK_ACCOUNTS.find((a) => a.username === reel.username) ?? MOCK_ACCOUNTS[0],
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
      if (Platform.OS === 'web') {
        // resolve the bundled asset URL and let the browser save it
        const { Asset } = await import('expo-asset');
        const asset = Asset.fromModule(reel.src);
        await asset.downloadAsync();
        const a = document.createElement('a');
        a.href = asset.uri;
        a.download = `deenlink-video-${reel.id}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const { Asset } = await import('expo-asset');
      const asset = Asset.fromModule(reel.src);
      await asset.downloadAsync();
      const MediaLibrary = await import('expo-media-library');
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo-library access to save videos.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(asset.localUri ?? asset.uri);
      Alert.alert('Saved ✓', 'Video saved to your gallery.');
    } catch {
      Alert.alert('Download failed', 'Please try again in a moment.');
    }
  };

  const railButton = (icon: string, label: string, onPress: () => void, tint?: string) => (
    <Pressable onPress={onPress} hitSlop={6} style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(10,20,14,0.45)',
          borderWidth: 1,
          borderColor: tint ? `${tint}88` : 'rgba(255,255,255,0.16)',
        }}
      >
        <FontAwesome5 name={icon} size={18} color={tint ?? '#FFFFFF'} solid={icon === 'heart' || icon === 'bookmark'} />
      </View>
      {label ? (
        <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 11, fontWeight: '700' }}>{label}</Text>
      ) : null}
    </Pressable>
  );

  return (
    <View style={{ width: VW, height: VH, backgroundColor: '#000' }}>
      {/* video layer (mounted only when near-active to save memory) */}
      {active ? (
        <VideoView
          player={player}
          contentFit="cover"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundColor: '#000' }}
        />
      ) : (
        <Image source={reel.poster} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} resizeMode="cover" />
      )}

      {/* legibility scrims */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130, backgroundColor: 'rgba(0,0,0,0.32)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 240, backgroundColor: 'rgba(0,0,0,0.42)' }} />

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
      <View style={{ position: 'absolute', right: 12, bottom: 148, gap: 15 }}>
        {railButton('heart', (reel.likes + (liked ? 1 : 0)).toLocaleString(), () => { haptic.light(); onLike(reel.id); }, liked ? '#FF5A5A' : undefined)}
        {railButton('comment', String(reel.comments), () => onComments(reel))}
        {railButton('bookmark', (reel.saves + (saved ? 1 : 0)).toLocaleString(), () => { haptic.light(); onSave(reel.id); }, saved ? '#E8C96A' : undefined)}
        {railButton('share', 'Share', () => {
          Share.share({ message: `${account.full_name} on DeenLink Videos: ${reel.caption}` }).catch(() => {});
        })}
        {railButton('download', 'Save', download)}
      </View>

      {/* bottom info */}
      <View style={{ position: 'absolute', left: 14, right: 78, bottom: 34 }}>
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
/*  The feed                                                                   */
/* -------------------------------------------------------------------------- */

export default function VideosFeed() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ start?: string }>();
  const startIndex = Math.max(0, MOCK_REELS.findIndex((r) => String(r.id) === params.start));

  const [index, setIndex] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [commentReel, setCommentReel] = useState<MockReel | null>(null);

  useEffect(() => {
    storage.getItem(SAVES_KEY).then((raw) => {
      if (!raw) return;
      try {
        setSaved(new Set(JSON.parse(raw) as number[]));
      } catch {
        /* ignore */
      }
    });
  }, []);

  const toggleLike = (id: number) =>
    setLiked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleSave = (id: number) =>
    setSaved((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      storage.setItem(SAVES_KEY, JSON.stringify([...n])).catch(() => {});
      return n;
    });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length && viewableItems[0].index != null) setIndex(viewableItems[0].index);
  }).current;

  const commentPost: Post | null = commentReel
    ? reelAsPost(
        commentReel,
        MOCK_ACCOUNTS.find((a) => a.username === commentReel.username) ?? MOCK_ACCOUNTS[0],
      )
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* top bar */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(10,20,14,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
        >
          <FontAwesome5 name="times" size={15} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', gap: 7 }}>
          <FontAwesome5 name="play-circle" size={17} color="#4AE38F" />
          <T v="body" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15.5, letterSpacing: 0.2 }}>
            Videos
          </T>
        </View>
        <Pressable
          onPress={() => { haptic.selection(); setMuted((m) => !m); }}
          hitSlop={10}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(10,20,14,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
        >
          <FontAwesome5 name={muted ? 'volume-mute' : 'volume-up'} size={15} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* pager */}
      <FlatList
        data={MOCK_REELS}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item, index: i }) => (
          <ReelItem
            reel={item}
            active={i === index}
            muted={muted}
            liked={liked.has(item.id)}
            saved={saved.has(item.id)}
            onLike={toggleLike}
            onSave={toggleSave}
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
        initialScrollIndex={startIndex}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
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
