import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, Dimensions, Easing, FlatList, Image, LayoutAnimation, Linking, Modal, PanResponder, Platform, Pressable, ScrollView, Share, TextInput, View, type ViewStyle } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '@/context/ThemeContext';
import type { DashTheme } from '@/constants/theme';
import type { Post } from '@/api/types';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { haptic } from '@/lib/haptics';
import { useAuth } from '@/context/AuthContext';
import { BookmarkIcon, ChatIcon, FlagIcon, HeartIcon, PlayIcon, ShareIcon } from '@/components/Icons';
import { savedStore } from '@/lib/savedPosts';
import { ContentShareSheet } from '@/components/ContentShareSheet';
import { DefaultAvatar } from '@/components/AvatarPicker';
import { API_ORIGIN } from '@/api/client';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { VideoView, useVideoPlayer } from 'expo-video';
import { VideoLoader } from '@/components/VideoLoader';
import { isLive, votePoll } from '@/api/client';
import { guestBlock } from '@/lib/guest';
import { AudioCassette } from '@/components/AudioCassette';

/** Poll length label from the composer duration picker. */
const pollDurationLabel = (hours?: number): string => {
  if (!hours) return '2 days';
  if (hours < 24) return `${hours}h`;
  const d = Math.round(hours / 24);
  return d === 1 ? '1 day' : `${d} days`;
};

/* ------------------------------------------------------------------ */
/* Web-only iframe (react-native-web renders custom components to DOM) */
/* ------------------------------------------------------------------ */
// Web-only: real YouTube iframe inside the post container.
const YouTubeFrame = ({ src, height = 208, title }: { src: string; height?: number; title?: string }) => (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <iframe
    src={src}
    title={title ?? 'DeenLink video'}
    style={{ width: '100%', height, border: 'none', borderRadius: 12, display: 'block', background: '#000' } as any}
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
    referrerPolicy="strict-origin-when-cross-origin"
  />
);
export { YouTubeFrame };

/** Resolves a profile image that may be a bundled asset (number) or a URL (string).
 * pass 73 — accounts with no photo now get the SAME gendered default art as the
 * edit-profile screen (was initials), and bare filenames resolve against the
 * API's uploads dir instead of rendering nothing. */
export function AvatarImage({
  source,
  name,
  size,
  tint,
  border,
  gender,
}: {
  source?: string | number | null;
  name: string;
  size: number;
  tint: string;
  border: string;
  gender?: string | null;
}) {
  const str0 = typeof source === 'string' ? source.trim() : '';
  const isDefaultName = str0 === '' || str0 === 'default_profile.jpg' || str0.endsWith('/img/default_profile.jpg');
  const uri =
    typeof source === 'number'
      ? null
      : !str0 || isDefaultName
        ? null
        : str0.startsWith('http') || str0.startsWith('data:')
          ? str0
          : str0.includes('/')
            ? str0
            : `${API_ORIGIN}/uploads/profile/${str0}`;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: border,
        backgroundColor: tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {source != null && (typeof source === 'number' || uri) ? (
        <Image
          source={typeof source === 'number' ? source : { uri: uri as string }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <DefaultAvatar gender={gender} size={size} />
      )}
    </View>
  );
}

/** Inline player for community video posts — plays in the card, expand → modal. */
function VideoPostPlayer({ src, poster, accent, hairline, post, onOpenReels }: { src: string; poster?: number | { uri: string } | null; accent: string; hairline: string; post: Post; onOpenReels?: (post: Post) => void }) {
  const player = useVideoPlayer({ uri: src }, (p) => {
    /* pass 83-35 — owner: a finished video must STOP, not loop. Replay
     * (tapping play at the end) seeks back to 0 first — see the toggle below. */
    p.loop = false;
    p.muted = false;
  });
  const endedRef = useRef(false);
  useEffect(() => {
    const sub = (player.addListener as (ev: string, cb: (st: { status?: string }) => void) => { remove: () => void })('statusChange', (st) => {
      if (st?.status === 'playToEnd') { endedRef.current = true; setPaused(true); }
      if (st?.status === 'readyToPlay') endedRef.current = false;
    });
    return () => sub.remove();
  }, [player]);
  /* pass 83-35 — owner: leaving the screen (tab switch / push) STOPS the video */
  useFocusEffect(useCallback(() => () => { try { player.pause(); } catch {} }, [player]));
  const [started, setStarted] = useState(false);
  /* pass 83-35 — in-card fullscreen REMOVED (owner decision): the expand
   * button hands the video to the VIDEOS page (reels view) via onOpenReels. */
  const [paused, setPaused] = useState(false);
  /* pass 20: seek + speed */
  const [frac, setFrac] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const barW = useRef(300);
  const [dragging, setDragging] = useState(false);
  const [dragFrac, setDragFrac] = useState(0);
  const dragFracRef = useRef(0);
  /* draggable seek — tap or SLIDE the bar (pass 22; the old tap-only bar never moved) */
  const seekPan = () =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setDragging(true);
        const f = Math.max(0, Math.min(1, e.nativeEvent.locationX / (barW.current || 300)));
        dragFracRef.current = f;
        setDragFrac(f);
      },
      onPanResponderMove: (e) => {
        const f = Math.max(0, Math.min(1, e.nativeEvent.locationX / (barW.current || 300)));
        dragFracRef.current = f;
        setDragFrac(f);
      },
      onPanResponderRelease: () => {
        setDragging(false);
        const f = dragFracRef.current;
        setFrac(f);
        if (dur > 0) {
          try {
            player.currentTime = f * dur;
          } catch {}
        }
      },
      onPanResponderTerminate: () => setDragging(false),
    });

  useEffect(() => {
    if (started && !paused && !outRef.current && screenFocusedRef.current) {
      if (endedRef.current) { try { player.currentTime = 0; endedRef.current = false; } catch {} }
      player.play();
    } else player.pause();
  }, [started, paused, player]);

  /* pass 83-28 — three hard stops so audio never leaks: the card UNMOUNTS,
   * the SCREEN loses focus (user opened another module — the poll above only
   * catches scroll, coordinates can stay stale), or the APP is backgrounded. */
  const screenFocusedRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true;
      return () => {
        screenFocusedRef.current = false;
        try { player.pause(); } catch {}
      };
    }, [player]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') { try { player.pause(); } catch {} }
    });
    return () => sub.remove();
  }, [player]);
  useEffect(() => () => { try { player.pause(); } catch {} }, [player]);

  /* pass 41 — PAUSE when scrolled out of view, resume when back (user request).
   * measureInWindow works on native AND web, so the poll catches both. */
  const outRef = useRef(false);
  useEffect(() => {
    if (!started) return;
    const iv = setInterval(() => {
      try {
        boxRef.current?.measureInWindow((y: number, _x: number, h: number, _w: number) => {
          const vh = Dimensions.get('window').height;
          /* stop as soon as the card is mostly scrolled past (not only fully off) */
          const out = y + h < vh * 0.28 || y > vh * 0.72;
          if (out !== outRef.current) {
            outRef.current = out;
            if (out) player.pause();
            else if (!paused) player.play();
          }
        });
      } catch {}
    }, 220);
    return () => clearInterval(iv);
  }, [started, paused, player]);

  useEffect(() => {
    const t = player.addListener('timeUpdate', (st: { currentTime: number; duration?: number }) => {
      if (st.duration && st.duration > 0) {
        setDur(st.duration);
        setFrac(Math.min(1, st.currentTime / st.duration));
      }
    });
    /* some web engines don't emit timeUpdate until seeked — poll as backup */
    const iv = setInterval(() => {
      const ct = (player as unknown as { currentTime?: number }).currentTime ?? 0;
      const du = (player as unknown as { duration?: number }).duration ?? 0;
      if (du > 0) {
        setDur(du);
        setFrac(Math.min(1, ct / du));
      }
    }, 500);
    return () => {
      t.remove();
      clearInterval(iv);
    };
  }, [player]);

  const cycleRate = () => {
    setRate((r) => (r === 1 ? 1.25 : r === 1.25 ? 1.5 : r === 1.5 ? 2 : 1));
  };
  useEffect(() => {
    player.playbackRate = rate;
  }, [rate, player]);

  const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const isWeb = Platform.OS === 'web';
  /* pass 83-34 — one seek/speed bar renderer for inline, web-fullscreen and
   * the native modal (they were three near-identical copies that drifted). */
  const renderBar = (pill: boolean) => (
    <View
      style={pill ? { position: 'absolute', left: 14, right: 14, bottom: Math.max(24, 34), flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(10,20,14,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' } : { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: 'rgba(10,20,14,0.55)' }}
    >
      <Pressable onPress={() => setPaused((v) => !v)} hitSlop={8}>
        <FontAwesome5 name={paused ? 'play' : 'pause'} size={pill ? 13 : 12} color="#FFFFFF" />
      </Pressable>
      <T v="caption" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.75)', fontVariant: ['tabular-nums'] }}>{mmss((dragging ? dragFrac : frac) * dur)}</T>
      <View
        {...seekPan().panHandlers}
        onLayout={(e) => (barW.current = e.nativeEvent.layout.width)}
        style={{ flex: 1, height: 20, justifyContent: 'center' }}
      >
        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.24)' }} />
        <View style={{ position: 'absolute', left: 0, width: `${(dragging ? dragFrac : frac) * 100}%`, height: 4, borderRadius: 2, backgroundColor: '#4AE38F' }} />
        <View style={{ position: 'absolute', left: `${(dragging ? dragFrac : frac) * 100}%`, marginLeft: -5.5, width: 11, height: 11, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#4AE38F', transform: [{ scale: dragging ? 1.25 : 1 }] }} />
      </View>
      <T v="caption" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.75)', fontVariant: ['tabular-nums'] }}>{mmss(dur)}</T>
      <Pressable onPress={cycleRate} hitSlop={8} style={{ borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(212,175,55,0.12)', paddingHorizontal: 7, paddingVertical: 3 }}>
        <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: '#E8C96A' }}>{rate}x</T>
      </Pressable>
    </View>
  );

  const boxRef = useRef<View>(null);
  /* pass 83-31 — owner: "fullscreen must use the app's player, never the
   * browser/native player." ONE path now: the opaque in-app Modal with the
   * custom controls (its portal escapes transformed ancestors on web, so the
   * old transform-offset bug can't shrink it into a corner box). The inline
   * VideoView stays mounted underneath — playback lives on the SHARED player
   * object, so fullscreen never re-downloads the video (pass 83-24 fix kept). */
  const openReels = () => {
    haptic.light();
    try { player.pause(); } catch {}
    onOpenReels?.(post);
  };
  return (
    <View ref={boxRef} style={[
      { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: hairline, backgroundColor: '#000' },
    ]}>
      <View style={{ height: 300 }}>
        {started ? (
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
            <VideoView player={player} contentFit="contain" nativeControls={false} playsInline style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />
            <VideoLoader player={player} />
          </View>
        ) : poster != null && !started ? (
          <Image source={poster as never} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} resizeMode="cover" />
        ) : null}
        {!started ? (
          <Pressable style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }} onPress={() => { haptic.medium(); setStarted(true); }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(4,12,8,0.6)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="play" size={20} color="#FFFFFF" />
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={() => setPaused((p) => !p)} style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            {paused ? (
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="play" size={19} color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>
        )}
        {/* pass 83-35 — expand → the VIDEOS page (reels view); no in-card fullscreen */}
        {onOpenReels ? <Pressable
          onPress={openReels}
          hitSlop={8}
          style={{ position: 'absolute', top: 8, right: 8, width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(4,12,8,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}
        >
          <FontAwesome5 name="expand" size={13} color="#FFFFFF" />
        </Pressable> : null}
      </View>

    
      {/* pass 20: seek bar + speed — always visible once started */}
      {started ? renderBar(false) : null}</View>
  );
}

const REPORT_TYPES: Array<{ id: string; label: string; icon: any }> = [
  { id: 'spam', label: 'Spam or scam', icon: 'ban' },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'user-slash' },
  { id: 'hate', label: 'Hate speech', icon: 'fire' },
  { id: 'danger', label: 'Dangerous content', icon: 'exclamation-triangle' },
  { id: 'misleading', label: 'Misleading content', icon: 'question-circle' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'shield-alt' },
];

/**
 * Instagram-style feed card for the DeenLink dash:
 * photo avatar · name (1-line, ellipsis) · verify · aqeedah chip ·
 * text (Show more/less when long) · image (tap = preview, double-tap = like) ·
 * YouTube in-container (double-tap = like, tap = in-app player) ·
 * like / comment / share actions · ••• menu (Report modal / Not interested).
 */
export function FeedCard({
  post,
  onLike,
  onComments,
  onDismiss,
  showActions = true,
  dash,
  field,
  groupLabel,
  group,
  rank,
  onOpenGroup,
  onDelete,
  onOpenReels,
  lockProfileNav,
}: {
  post: Post;
  onLike?: (id: number) => void;
  onComments?: (post: Post) => void;
  onDismiss?: (id: number) => void;
  showActions?: boolean;
  /** pass 83-14 — present when the viewer may delete THIS post (author, or
   *  group owner/admin, or site admin). Renders the Delete row in the ••• menu
   *  and calls onDelete (which hits the server + removes the card). */
  onDelete?: () => void;
  /** pass 83-35 — owner decision: the in-card fullscreen is GONE. The expand
   * button opens the video in the VIDEOS page (reels view, scrollable). */
  onOpenReels?: (post: Post) => void;
  /** pass 83-19 — on a profile page the author's name/avatar must not
   *  navigate back to the same profile (owner: "when user clicked his
   *  profile on his posts it should not navigate to his profile"). */
  lockProfileNav?: boolean;
  dash?: DashTheme;
  field?: string;
  /** pass 36 — group posts: emerald chip with the group's name */
  groupLabel?: string;
  /** pass 38 — GROUP-FIRST cards: group identity leads, user follows, rank badge */
  group?: { name: string; cat?: string; avatar?: string; catIcon?: string };
  rank?: 'owner' | 'admin' | 'member';
  onOpenGroup?: () => void;
}) {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const user = post.user;
  // color resolution: premium dash palette when provided, base theme otherwise
  const card = dash?.card ?? theme.card;
  const soft = dash ? dash.bgSoft : theme.cardSoft;
  const txt = dash?.text ?? theme.text;
  const sub = dash?.subtext ?? theme.subtext;
  const faint = dash?.faint ?? theme.subtext;
  const hairline = dash?.cardBorder ?? theme.border;
  const accent = dash?.emerald ?? theme.primary;
  const gold = dash?.gold ?? '#D4AF37';
  const danger = dash ? '#FF7B7B' : theme.danger;
  const name = user.full_name ?? user.username;
  const img = (user as { profile_image_url?: string | number | null }).profile_image_url ?? null;

  const [menuOpen, setMenuOpen] = useState(false);
  /* pass 83-36 — owner: tapping YOUR OWN name/avatar on a post must NOT open
   * your profile (community, groups, home — everywhere FeedCard renders). */
  const meUser = useAuth().user;
  const isSelfPost = !!meUser && (
    (post.user?.id != null && meUser.id != null && String(post.user.id) === String(meUser.id)) ||
    (!!post.user?.username && !!meUser.username && post.user.username === meUser.username)
  );
  /* pass 83-19 — Instagram-style multi-photo carousel state */
  const [carouselPage, setCarouselPage] = useState(0);
  const [carouselW, setCarouselW] = useState(0);
  /* pass 83-16 — inline two-step delete confirm. RN's Alert.alert with
   * buttons is a NO-OP on web, so the old confirm dialog never appeared on
   * app.deenlink.org and Delete silently did nothing. */
  const [confirmDel, setConfirmDel] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [imgPreview, setImgPreview] = useState(false);
  /* pass 83-28 — the preview opens on the image you TAPPED (it always showed the first slide) */
  const [previewIdx, setPreviewIdx] = useState(0);
  const [pollState, setPollState] = useState<{ voted: number | null; options: Array<{ id: number; text: string; votes: number }> }>(() => ({
    /* pass 66-night — server polls arrive already voted so the card opens truthful */
    voted: post.poll?.voted ?? null,
    options: post.poll?.options ?? [],
  }));
  const [reportType, setReportType] = useState<string | null>(null);
  const [reportDesc, setReportDesc] = useState('');
  const [savedNow, setSavedNow] = useState(() => savedStore.has(post.id));
  const [shareOpen, setShareOpen] = useState(false);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  const sharePost = () => {
    haptic.light();
    setShareOpen(true);
  };

  const liked = !!post.liked_by_me;

  const likeBurst = () => {
    haptic.medium();
    burst.setValue(0);
    const anim = Animated.sequence([
      // quick pop-in with a springy overshoot, hold, then a soft fade
      Animated.timing(burst, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.9)), useNativeDriver: true }),
      Animated.delay(140),
      Animated.timing(burst, { toValue: 0, duration: 260, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]);
    // guaranteed clean end-state (prevents any residual "shade" on the post)
    // guaranteed clean end-state (prevents any residual "shade" on the post)
    anim.start(() => {
      burst.setValue(0);
    });
  };

  /** One tap detector: double-tap anywhere on the post = like;
   *  an optional single-tap action fires after a short grace window. */
  const onTap = (single?: () => void) => {
    const now = Date.now();
    const isDouble = now - lastTap.current < 300;
    lastTap.current = now;
    if (isDouble) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      if (!liked) {
        onLike?.(post.id);
        likeBurst();
      }
    } else if (single) {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        single();
      }, 310);
    }
  };

  const fieldLabel = field || (user as { fields?: string | null }).fields || user.scholar?.fields_of_knowledge || null;
  /* pass 83-31 — owner: "post card shows 2 video containers." When media[]
   * carries the video entry, the old `media?.[0]` picked it and painted it
   * AGAIN as an <Image> block under the inline player. Media for the image
   * blocks is now IMAGE-kind only — the video plays in exactly one place. */
  const media =
    (post.media ?? []).find((m) => String((m as Record<string, unknown>).media_type ?? m.type ?? 'image') === 'image') ??
    (post.video_url ? undefined : post.media?.[0]);
  const mediaUrl = media?.url as string | number | null | undefined;
  /* pass 83-19 — image-only urls from media[] for the swipe carousel */
  const mediaImgs = (post.media ?? [])
    .map((m) => { const mm = m as { url?: unknown; video_url?: unknown }; return mm.video_url == null && mm.url != null ? String(mm.url) : null; })
    .filter((u): u is string => u != null);

  const fullText = post.content_text ?? '';
  const longText = fullText.length > 230;
  const cutAt = longText ? Math.max(fullText.lastIndexOf(' ', 230), 180) : fullText.length;
  const shownText = expanded || !longText ? fullText : `${fullText.slice(0, cutAt).trimEnd()}…`;

  const scale = burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.22, 1.02, 1.3] });
  const opacity = burst.interpolate({ inputRange: [0, 0.12, 0.72, 1], outputRange: [0, 0.95, 0.95, 0] });

  const submitReport = () => {
    setReportOpen(false);
    setReportType(null);
    setReportDesc('');
    Alert.alert('Report submitted', 'JazakAllah khair — our moderation team will review this post.');
  };

  return (
    <View
      style={{
        backgroundColor: card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: hairline,
        padding: 14,
        marginBottom: 14, /* pass 40 — cards always carry their own spacing */
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.22 : 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        /* pass 83-16 — lift the whole card while its ••• menu is open, else
         * later sibling cards paint over the menu (owner: "z index making it
         * appear under the post card"). */
        zIndex: menuOpen ? 900 : 0,
        elevation: menuOpen ? 30 : 2,
      }}
    >
      {/* pass 38 — GROUP-FIRST header: the group leads the card (name, pic,
       * badge), then the posting member underneath, then content */}
      {group ? (
        <Pressable
          accessibilityLabel={`open group ${group.name}`}
          onPress={() => { haptic.selection(); onOpenGroup?.(); }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9, opacity: pressed ? 0.75 : 1 })}
        >
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(212,175,55,0.14)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            {group.avatar && /^data:|^file:|^https?:/.test(group.avatar) ? (
              <ExpoImage source={{ uri: group.avatar }} style={{ width: '100%', height: '100%', borderRadius: 10 }} contentFit="cover" />
            ) : group.avatar ? (
              <T v="h3" style={{ fontSize: 16 }}>{group.avatar}</T>
            ) : (
              <FontAwesome5 name={(group.catIcon ?? 'users') as never} size={12} color="#E8C96A" />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <T v="body" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '900', fontSize: 13, color: txt, flexShrink: 1, letterSpacing: 0.2 }}>
                {group.name}
              </T>
              <FontAwesome5 name="chevron-right" size={8} color={faint} />
              <T v="caption" style={{ color: faint, fontSize: 11 }}>{post.time_ago ?? ''}</T>
            </View>
            {group.cat ? <T v="caption" numberOfLines={1} style={{ fontSize: 9.5, color: faint, marginTop: 1.5, letterSpacing: 0.3 }}>{group.cat.toUpperCase()} GROUP</T> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3.5, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(212,175,55,0.1)' }}>
            <FontAwesome5 name="users" size={7} color="#E8C96A" />
            <T v="caption" style={{ fontSize: 8, fontWeight: '900', color: '#E8C96A', letterSpacing: 0.5 }}>GROUP</T>
          </View>
        </Pressable>
      ) : null}

      {/* Header (avatar + name open the public profile — pass 18: no avatar preview on posts) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11, marginLeft: group ? 6 : 0 }}>
        <Pressable
          hitSlop={8}
          onPress={() => {
            if (lockProfileNav || isSelfPost) return;
            haptic.selection();
            router.push(`/profile/${user.username}`);
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <AvatarImage source={img} name={name} size={42} tint={`${accent}26`} border={dash ? dash.greenBorder : hairline} gender={(user as { gender?: string }).gender ?? null} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <Pressable hitSlop={4} onPress={() => { if (!lockProfileNav && !isSelfPost) router.push(`/profile/${user.username}`); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <T v="body" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '700', fontSize: 13.5, color: txt, flexShrink: 1 }}>
                {name}
              </T>
              {user.verification_badge ? <VerificationBadge type={user.verification_badge} size={13} /> : null}
              <T v="caption" style={{ color: faint, fontSize: 11, flexShrink: 0 }}>
                · {post.time_ago ?? ''}
              </T>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <T v="caption" numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 10.5, color: sub, flexShrink: 1, maxWidth: 150 }}>
              @{user.username}
            </T>
            {/* pass 83-24 — a group post in the mixed feed says which group */}
            {post.group_name ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3.5, borderWidth: 1, borderColor: `${accent}55`, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 1.5, backgroundColor: `${accent}12` }}>
                <FontAwesome5 name="users" size={8} color={accent} />
                <T v="caption" numberOfLines={1} style={{ fontSize: 9.5, color: accent, fontWeight: '700' }}>{post.group_name}</T>
              </View>
            ) : null}
            {rank ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3.5,
                  borderWidth: 1,
                  borderColor: rank === 'owner' ? 'rgba(212,175,55,0.5)' : rank === 'admin' ? 'rgba(47,164,107,0.5)' : `${hairline}`,
                  borderRadius: 7,
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  backgroundColor: rank === 'owner' ? 'rgba(212,175,55,0.1)' : rank === 'admin' ? 'rgba(47,164,107,0.1)' : 'transparent',
                }}
              >
                <FontAwesome5 name={rank === 'owner' ? 'crown' : rank === 'admin' ? 'shield-alt' : 'user'} size={7} color={rank === 'owner' ? '#E8C96A' : rank === 'admin' ? '#2FA46B' : sub} solid />
                <T v="caption" style={{ fontSize: 8, fontWeight: '900', letterSpacing: 0.5, color: rank === 'owner' ? '#E8C96A' : rank === 'admin' ? '#2FA46B' : sub }}>
                  {rank === 'owner' ? 'OWNER' : rank === 'admin' ? 'ADMIN' : 'MEMBER'}
                </T>
              </View>
            ) : null}
            {groupLabel && !group ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: `${accent}55`,
                  borderRadius: 7,
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  backgroundColor: `${accent}12`,
                }}
              >
                <FontAwesome5 name="users" size={7} color={accent} />
                <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: accent, letterSpacing: 0.4 }}>
                  {groupLabel}
                </T>
              </View>
            ) : null}
            {fieldLabel ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: dash ? `${gold}55` : hairline,
                  borderRadius: 7,
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  backgroundColor: dash ? `${gold}12` : 'transparent',
                }}
              >
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: gold }} />
                <T v="caption" style={{ fontSize: 8.5, fontWeight: '700', color: dash ? gold : sub, letterSpacing: 0.5 }}>
                  {String(fieldLabel).toUpperCase()}
                </T>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable hitSlop={10} onPress={() => setMenuOpen((v) => !v)} style={{ padding: 6, opacity: 0.6 }}>
          <T v="caption" style={{ color: faint, fontSize: 16, fontWeight: '700' }}>
            •••
          </T>
        </Pressable>
      </View>

      {/* ••• menu */}
      {menuOpen ? (
        <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }} onPress={() => { setMenuOpen(false); setConfirmDel(false); }}>
          <View
            style={{
              position: 'absolute',
              top: 30,
              right: 12,
              width: 190,
              borderRadius: 12,
              backgroundColor: card,
              borderWidth: 1,
              borderColor: hairline,
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
              overflow: 'hidden',
            }}
          >
            {onDelete ? (
              <Pressable
                onPress={() => {
                  /* pass 83-17 — owner: a proper "Are you sure?" modal, not a
                   * tap-again row. */
                  setMenuOpen(false);
                  setConfirmDel(true);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 9,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  borderBottomWidth: 1,
                  borderBottomColor: hairline,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <FontAwesome5 name="trash-alt" size={13} color={danger} />
                <T v="bodyS" style={{ fontSize: 12, fontWeight: '700', color: danger }}>
                  Delete
                </T>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                paddingHorizontal: 12,
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: hairline,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <FlagIcon size={14} color={danger} />
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '600', color: txt }}>
                Report
              </T>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                Alert.alert('Not interested', `You’ll see fewer posts like ${name}’s.`, [
                  { text: 'Undo', onPress: () => undefined },
                  { text: 'OK', onPress: () => onDismiss?.(post.id) },
                ]);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                paddingHorizontal: 12,
                paddingVertical: 11,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <FontAwesome5 name="eye-slash" size={14} color={sub} />
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '600', color: txt }}>
                Not interested
              </T>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      {/* pass 83-17 — the real "Are you sure?" confirmation modal */}
      <ConfirmDialog
        visible={confirmDel}
        title="Delete post?"
        message="Are you sure you want to delete this post? This will remove it for everyone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        icon="trash-alt"
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => { setConfirmDel(false); onDelete?.(); }}
      />

      {/* Body text — double-tap to like, Show more/less when long */}
      {fullText ? (
        <View style={{ marginBottom: 12 }}>
          <Pressable onPress={() => onTap()}>
            <T v="bodyS" style={{ fontSize: 13.5, lineHeight: 20.5, color: txt }}>
              {shownText}
            </T>
          </Pressable>
          {longText ? (
            <Pressable hitSlop={6} onPress={() => setExpanded((v) => !v)} style={{ marginTop: 3, alignSelf: 'flex-start' }}>
              <T v="caption" style={{ fontSize: 11.5, fontWeight: '700', color: dash ? gold : accent }}>
                {expanded ? 'Show less' : 'Show more'}
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Poll — pro redesign: pick / change / retract your vote */}
      {post.poll ? (
        <View style={{ marginTop: 10, marginBottom: 12 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: dash ? dash.greenBorder : hairline,
              borderRadius: 16,
              padding: 12,
              backgroundColor: dash ? dash.bgSoft : soft,
              gap: 9,
            }}
          >
            {/* poll header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  backgroundColor: isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.10)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(46,204,113,0.4)' : 'rgba(14,122,70,0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FontAwesome5 name="poll-h" size={10} color={dash ? dash.emerald : accent} />
              </View>
              {post.poll.question ? (
                <T v="body" numberOfLines={2} style={{ color: txt, fontWeight: '700', fontSize: 13, flex: 1, flexShrink: 1 }}>
                  {post.poll.question}
                </T>
              ) : (
                <T v="caption" style={{ color: faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, flex: 1 }}>
                  POLL
                </T>
              )}
              <T v="caption" style={{ color: faint, fontSize: 9.5, fontWeight: '700', flexShrink: 0 }}>
                {post.poll.duration ? `${pollDurationLabel(post.poll.duration)} left` : '2d left'}
              </T>
            </View>

            {/* options */}
            {pollState.options.map((opt) => {
              const total = pollState.options.reduce((a, b) => a + b.votes, 0);
              const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
              const mine = pollState.voted === opt.id;
              const topVotes = Math.max(...pollState.options.map((o) => o.votes));
              const leads = total > 0 && opt.votes === topVotes && opt.votes > 0;
              const fill = mine ? (dash ? `${gold}30` : `${accent}26`) : leads ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.10)') : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.05)';
              const voted = pollState.voted != null;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    haptic.selection();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    const retract = pollState.voted === opt.id;
                    setPollState((prev) => {
                      // tapping the same option again retracts the vote
                      if (prev.voted === opt.id) {
                        return { voted: null, options: prev.options.map((o) => (o.id === opt.id ? { ...o, votes: Math.max(0, o.votes - 1) } : o)) };
                      }
                      // switching: remove the old vote, add the new one
                      return {
                        voted: opt.id,
                        options: prev.options.map((o) => {
                          let votes = o.votes;
                          if (prev.voted != null && o.id === prev.voted) votes = Math.max(0, votes - 1);
                          if (o.id === opt.id) votes += 1;
                          return { ...o, votes };
                        }),
                      };
                    });
                    /* pass 66-night — live polls record the vote on the server;
                     * the response is the source of truth for counts. */
                    if (isLive() && !retract) {
                      void votePoll(post.id, opt.id).then((res) => {
                        if (!res) return;
                        setPollState({
                          voted: res.my_vote,
                          options: res.options.map((o) => ({ id: o.id, text: o.label, votes: o.votes })),
                        });
                      });
                    }
                  }}
                  style={({ pressed }) => ({
                    position: 'relative',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 9,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: mine ? (dash ? gold : accent) : 'transparent',
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                    overflow: 'hidden',
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  {/* result fill */}
                  {voted ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: fill }} /> : null}
                  {/* indicator: radio → check when yours */}
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 1.8,
                      borderColor: mine ? (dash ? gold : accent) : voted ? (leads ? dash?.emerald ?? accent : faint) : isDark ? 'rgba(255,255,255,0.25)' : 'rgba(20,36,28,0.25)',
                      backgroundColor: mine ? (dash ? gold : accent) : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {mine ? <FontAwesome5 name="check" size={9} color={isDark ? '#06230F' : '#FFFFFF'} /> : null}
                  </View>
                  <T v="bodyS" numberOfLines={1} style={{ flex: 1, width: 0, color: txt, fontSize: 12.5, fontWeight: mine ? '800' : '600' }}>
                    {opt.text}
                  </T>
                  {voted ? (
                    <T v="caption" style={{ color: mine ? (dash ? gold : accent) : sub, fontSize: 11, fontWeight: '800', flexShrink: 0 }}>
                      {pct}%
                    </T>
                  ) : null}
                </Pressable>
              );
            })}

            {/* footer */}
            <T v="caption" style={{ color: faint, fontSize: 10, marginTop: 1 }}>
              {pollState.voted != null
                ? `You voted for “${pollState.options.find((o) => o.id === pollState.voted)?.text ?? ''}” · tap another option to change · ${pollState.options.reduce((a, b) => a + b.votes, 0)} votes · ends in ${pollDurationLabel(post.poll.duration)}`
                : `${pollState.options.reduce((a, b) => a + b.votes, 0)} votes · tap an option to vote · ends in ${pollDurationLabel(post.poll.duration)}`}
            </T>
          </View>
        </View>
      ) : null}

      {/* Community video post — plays inline in the card, expand → modal */}
      {post.video_url ? (
        <View style={{ marginBottom: 12 }}>
          <VideoPostPlayer src={post.video_url} poster={post.video_poster ?? null} accent={accent} hairline={hairline} post={post} onOpenReels={onOpenReels} />
        </View>
      ) : null}

      {/* Picked photo post — opens preview on tap */}

      {/* pass 83-24 — a multi-photo post renders ONLY the carousel; this hero
          used to stack a second container holding the first image on top */}
      {post.image_url && mediaImgs.length <= 1 ? (
        <Pressable onPress={() => onTap(() => { setPreviewIdx(mediaImgs.length > 1 ? carouselPage : 0); setImgPreview(true); })} style={{ marginBottom: 12 }}>
          <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: hairline }}>
            <Image source={{ uri: post.image_url }} style={{ width: '100%', height: 280 }} resizeMode="cover" />
          </View>
        </Pressable>
      ) : null}

      {/* Media image — single tap: preview · double tap: like */}
      {mediaUrl != null && mediaImgs.length <= 1 ? (
        <Pressable onPress={() => onTap(() => { setPreviewIdx(mediaImgs.length > 1 ? carouselPage : 0); setImgPreview(true); })} style={{ marginBottom: 12 }}>
          <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: hairline }}>
            <Image
              source={typeof mediaUrl === 'number' ? mediaUrl : { uri: String(mediaUrl) }}
              style={{ width: '100%', height: 200 }}
              resizeMode="cover"
            />
          </View>
        </Pressable>
      ) : null}

      {/* pass 83-19 — 2+ photos: swipeable carousel with page dots */}
      {mediaImgs.length > 1 ? (
        <View style={{ marginBottom: 12 }} onLayout={(e) => setCarouselW(e.nativeEvent.layout.width)}>
          <ScrollView
            horizontal
            pagingEnabled
            snapToInterval={carouselW > 0 ? carouselW : undefined}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => setCarouselPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, carouselW)))}
            /* pass 83-24 — web does not fire onMomentumScrollEnd reliably, so
               the dots also track the raw scroll offset */
            onScroll={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, carouselW));
              if (i !== carouselPage && i >= 0 && i < mediaImgs.length) { setCarouselPage(i); }
            }}
          >
            {mediaImgs.map((u, i) => (
              <Pressable key={i} onPress={() => onTap(() => { setPreviewIdx(mediaImgs.length > 1 ? carouselPage : 0); setImgPreview(true); })} style={{ width: carouselW > 0 ? carouselW : Dimensions.get('window').width - 60 }}>
                <Image source={{ uri: u }} style={{ width: carouselW > 0 ? carouselW : Dimensions.get('window').width - 60, height: 260, borderRadius: 14 }} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 7 }}>
            {mediaImgs.map((_, i) => (
              <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === carouselPage ? (dash ? gold : accent) : hairline }} />
            ))}
          </View>
        </View>
      ) : null}

      {/* pass 83-10c — audio uploads play on a spinning SVG cassette */}
      {post.audio_url ? <View style={{ marginBottom: 12 }}><AudioCassette url={String(post.audio_url)} /></View> : null}

      {/* YouTube — embedded player on web (double-tap likes, tap plays in-app) */}
      {Platform.OS === 'web' && post.youtube_embed_url ? (
        /* pass 83-35 — owner: NO modal for YouTube. The iframe plays inline;
         * the old tap-overlay hijacked every click into the video modal. */
        <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: hairline, marginBottom: 12, backgroundColor: '#000' }}>
          <YouTubeFrame src={String(post.youtube_embed_url)} height={206} />
        </View>
      ) : post.youtube_embed_url ? (
        <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: hairline, marginBottom: 12, backgroundColor: '#000' }}>
          <YouTubePlayer embedUrl={String(post.youtube_embed_url)} height={206} />
        </View>
      ) : post.youtube_url ? (
        <Pressable
          onPress={() => {
            /* pass 83-36 — direct open, no 310ms double-tap wait: the row must
             * feel instant (owner: "refusing to be clicked"). */
            if (post.youtube_url) Linking.openURL(post.youtube_url).catch(() => {});
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            backgroundColor: soft,
            borderRadius: 12,
            padding: 11,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger, alignItems: 'center', justifyContent: 'center' }}>
            <PlayIcon size={15} color="#fff" />
          </View>
          <T v="bodyS" style={{ flex: 1, color: txt }}>
            Watch video
          </T>
          <T v="caption" style={{ fontWeight: '700', color: accent }}>
            Open
          </T>
        </Pressable>
      ) : null}

      {/* Scholar Q&A card */}
      {post.is_public_qa && post.public_qa ? (
        <View
          style={{
            marginTop: fullText ? 0 : 4,
            backgroundColor: soft,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: dash ? `${gold}33` : hairline,
            borderLeftWidth: 3,
            borderLeftColor: dash ? gold : accent,
            padding: 13,
            marginBottom: 12,
          }}
        >
          <T v="bodyS" style={{ fontWeight: '700', fontSize: 13.5, lineHeight: 19, color: txt }}>
            {post.public_qa.question ?? 'Question'}
          </T>
          {post.public_qa.answer ? (
            <T v="bodyS" style={{ marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: hairline, lineHeight: 19.5, color: sub }}>
              {post.public_qa.answer}
            </T>
          ) : null}
        </View>
      ) : null}

      {/* Actions — Instagram-style, larger */}
      {showActions ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: hairline }}>
          <Pressable onPress={() => { if (guestBlock('Sign in to like and react to posts.')) return; haptic.light(); onLike?.(post.id); }} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, opacity: pressed ? 0.6 : 1 })}>
            <HeartIcon size={21} filled={liked} color={liked ? '#E74C3C' : sub} />
            <T v="caption" style={{ fontWeight: '600', color: liked ? '#E74C3C' : sub, fontSize: 14 }}>
              {post.like_count ?? 0}
            </T>
          </Pressable>
          <Pressable onPress={() => { if (guestBlock('Sign in to comment on posts.')) return; onComments?.(post); }} accessibilityLabel="open comments" hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 22, opacity: pressed ? 0.6 : 1 })}>
            <ChatIcon size={21} color={sub} />
            <T v="caption" style={{ fontWeight: '600', fontSize: 14, color: sub }}>
              {post.comment_count ?? 0}
            </T>
          </Pressable>
          <Pressable onPress={sharePost} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 22, opacity: pressed ? 0.6 : 1 })}>
            <ShareIcon size={20} color={sub} />
            <T v="caption" style={{ fontWeight: '600', fontSize: 14, color: sub }}>
              Share
            </T>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.light();
              savedStore.toggle(post);
              setSavedNow(savedStore.has(post.id));
            }}
            hitSlop={8}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 'auto', opacity: pressed ? 0.6 : 1 })}
          >
            <BookmarkIcon size={20} filled={savedNow} color={savedNow ? (dash ? '#E8C96A' : '#B8860B') : sub} />
          </Pressable>
        </View>
      ) : null}

      {/* share — same sheet as the videos: friends / link / more / image */}
      <ContentShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        card={{ kind: 'post', arabic: '', meaning: post.content_text ?? `${name} on DeenLink`, ref: `@${user.username} · DeenLink`, route: post.id > 0 ? `/tools/post?id=${post.id}` : undefined }}
        link={`https://deenlink.org/post/${post.id}`}
        post={post}
      />

      {/* Double-tap heart burst (over the whole card) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          transform: [{ scale }],
        }}
      >
        <HeartIcon size={96} filled color="#fff" />
      </Animated.View>

      {/* Image preview */}
      <Modal visible={imgPreview} transparent animationType="fade" onRequestClose={() => setImgPreview(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} onPress={() => setImgPreview(false)} />
          {/* pass 83-28 — multi-photo posts get a swipeable gallery that
              STARTS on the slide you tapped; single images unchanged. */}
          {mediaImgs.length > 1 ? (
            <FlatList
              horizontal
              pagingEnabled
              data={mediaImgs}
              keyExtractor={(u, i) => `${i}-${String(u).slice(0, 24)}`}
              initialScrollIndex={Math.min(previewIdx, Math.max(0, mediaImgs.length - 1))}
              getItemLayout={(_, i) => ({ length: Dimensions.get('window').width, offset: Dimensions.get('window').width * i, index: i })}
              onMomentumScrollEnd={(e) => setPreviewIdx(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, Dimensions.get('window').width)))}
              renderItem={({ item }) => (
                <Image source={typeof item === 'number' ? item : { uri: String(item) }} style={{ width: Dimensions.get('window').width, height: 560 }} resizeMode="contain" />
              )}
              showsHorizontalScrollIndicator={false}
            />
          ) : mediaUrl != null ? (
            <Image
              source={typeof mediaUrl === 'number' ? mediaUrl : { uri: String(mediaUrl) }}
              style={{ width: '100%', height: 560, borderRadius: 4 }}
              resizeMode="contain"
            />
          ) : null}
          <Pressable
            onPress={() => setImgPreview(false)}
            hitSlop={12}
            style={{ position: 'absolute', top: 48, right: 18, zIndex: 2, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="times" size={15} color="#fff" />
          </Pressable>
        </View>
      </Modal>

      {/* Report modal */}
      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setReportOpen(false)} />
          <View
            style={{
              backgroundColor: card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: hairline,
              borderTopWidth: 0,
              padding: 18,
              paddingBottom: 26,
              maxHeight: 480,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: `${danger}1F`, alignItems: 'center', justifyContent: 'center' }}>
                <FlagIcon size={18} color={danger} />
              </View>
              <T v="body" style={{ fontWeight: '700', fontSize: 15.5, color: txt, marginTop: 10 }}>
                Report this post?
              </T>
              <T v="caption" style={{ fontSize: 11.5, color: faint, marginTop: 4, textAlign: 'center' }}>
                Tell us what happened. Reports are confidential.
              </T>
            </View>

            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {REPORT_TYPES.map((rt) => {
                const sel = reportType === rt.id;
                return (
                  <Pressable
                    key={rt.id}
                    onPress={() => setReportType(rt.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      paddingHorizontal: 12,
                      paddingVertical: 11,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: sel ? danger : hairline,
                      backgroundColor: sel ? `${danger}14` : 'transparent',
                      marginBottom: 7,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <FontAwesome5 name={rt.icon} size={14} color={sel ? danger : sub} />
                    <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: sel ? '700' : '500', color: sel ? danger : txt }}>
                      {rt.label}
                    </T>
                    <View
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 9,
                        borderWidth: 1.6,
                        borderColor: sel ? danger : faint,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {sel ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: danger }} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TextInput
              value={reportDesc}
              onChangeText={setReportDesc}
              placeholder="Add details (optional)…"
              placeholderTextColor={faint}
              multiline
              numberOfLines={3}
              style={{
                minHeight: 74,
                height: 74,
                textAlignVertical: 'top',
                backgroundColor: soft,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: hairline,
                paddingHorizontal: 12,
                paddingTop: 10,
                fontFamily: 'Poppins-Regular',
                fontSize: 16 /*12.5*/,
                color: txt,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => {
                  setReportOpen(false);
                  setReportType(null);
                  setReportDesc('');
                }}
                style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderColor: hairline, paddingVertical: 11, alignItems: 'center', opacity: 0.9 }}
              >
                <T v="bodyS" style={{ fontWeight: '600', fontSize: 12.5, color: sub }}>
                  Cancel
                </T>
              </Pressable>
              <Pressable
                onPress={submitReport}
                style={({ pressed }) => ({ flex: 1.4, borderRadius: 13, backgroundColor: danger, paddingVertical: 11, alignItems: 'center', opacity: pressed ? 0.8 : 1 })}
              >
                <T v="bodyS" style={{ fontWeight: '700', fontSize: 12.5, color: '#fff' }}>
                  Submit report
                </T>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
