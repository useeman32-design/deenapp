import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, Image, ImageBackground, Keyboard, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, ScrollView, TextInput, UIManager, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { MOCK_ACCOUNTS } from '@/api/mocks';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { findUrl, LinkPreviewCard } from '@/components/LinkPreview';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { useRouter } from 'expo-router';

/**
 * Community INBOX (pass 22, v2) — the real inbox the user asked for:
 * receive reels / posts / duas / ayahs (in-app content ONLY — no external
 * media), CHAT BACK with text + quick in-app shares, and REACT with emojis.
 * Used two ways: modal (community bell) and standalone (/tools/inbox).
 */

const EMOJIS = ['🤍', '😂', '😮', '🤲', '🔥', '🕌'] as const;
type Kind = 'post' | 'reel' | 'ayah' | 'hadith' | 'dua' | 'profile' | 'quiz' | 'riddle' | 'group';
type ShareItem = {
  id: string;
  /* pass 83-21 — stable render key (see ChatMsg.rk) */
  rk?: string;
  kind: Kind;
  title: string;
  ago: string;
  dir: 'them' | 'me';
  /* pass 83-20 — tap target: where the shared thing lives */
  route?: string;
  /* pass 31/32 previews */
  thumb?: number;      /* reel/post preview image */
  dur?: string;        /* reel duration chip */
  arabic?: string;     /* ayah/hadith/dua arabic text */
  refLabel?: string;   /* citation under arabic */
  sub?: string;        /* post caption / profile handle */
  /* pass 62 — server timestamp "YYYY-MM-DD HH:MM:SS"; '' until the server
   * confirms, which also sorts an optimistic card to the bottom. */
  at?: string;
  /* pass 63 — soft-deleted on the server: the slot stays, the content is gone */
  deleted?: boolean;
};
/* pass 63 — the quoted row when you reply to something */
type Quote = { who: string; text: string };
/* pass 83-21 — `rk` is the render key. Optimistic rows are keyed by a temp id
 * that is swapped for the server id once the send confirms; keying the row by
 * that swapping id unmounted and remounted the bubble, which the owner saw as
 * the sent bubble "blinking". rk never changes, so the row stays mounted. */
type ChatMsg = { id: string; rk?: string; text: string; ago: string; dir: 'them' | 'me'; at?: string; deleted?: boolean; reply?: Quote | null; createdAt?: string; readAt?: string | null };
/* pass 62 — `reactions` are MY emoji per target; `others` is the newest emoji
 * somebody else left, so I can see their reaction and still add my own. */
type Thread = { friend: string; items: ShareItem[]; chat: ChatMsg[]; reactions: Record<string, string>; others?: Record<string, string>; blocked?: boolean; blocked_by?: boolean };

const KIND_META: Record<Kind, { icon: string; label: string; tint: string }> = {
  post: { icon: 'file-alt', label: 'Post', tint: '#5BC8F5' },
  reel: { icon: 'video', label: 'Reel', tint: '#E8C96A' },
  ayah: { icon: 'book-open', label: 'Ayah', tint: '#4AE38F' },
  hadith: { icon: 'scroll', label: 'Hadith', tint: '#C8A2C8' },
  dua: { icon: 'hands-helping', label: 'Dua', tint: '#F0A8C0' },
  profile: { icon: 'user-circle', label: 'Profile', tint: '#8FD3B6' },
  quiz: { icon: 'question-circle', label: 'Quiz', tint: '#5BC8F5' },
  riddle: { icon: 'puzzle-piece', label: 'Riddle', tint: '#E8C96A' },
  group: { icon: 'users', label: 'Group', tint: '#4AE38F' },
};

const ago = () => 'now';

/* pass 83-14 — owner: "Last seen 09-08T23:08" is unreadable. Format like
 * WhatsApp: minutes/hours ago · Yesterday 7:30 PM · then date + time. The
 * device locale drives 12h vs 24h via toLocaleTimeString. */
function lastSeenText(raw: string): string {
  const t = new Date(String(raw).includes('T') ? String(raw) : String(raw).replace(' ', 'T')).getTime();
  if (!t) return String(raw);
  const diff = Date.now() - t;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) { const m = Math.floor(diff / 60_000); return `${m} minute${m === 1 ? '' : 's'} ago`; }
  const dt = new Date(t);
  const hm = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff < 86_400_000) { const h = Math.floor(diff / 3_600_000); return `${h} hour${h === 1 ? '' : 's'} ago`; }
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  if (t >= startOfToday.getTime() - 86_400_000) return `Yesterday ${hm}`;
  return `${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${hm}`;
}
const uid = () => Math.random().toString(36).slice(2, 9);

/* seed — what friends shared with you (in-app content only). every
 * sharable kind previews the way it looks when shared — reels as video
 * thumbnails with a play chip, posts with their picture, ayah/hadith/dua as
 * ornate arabic text cards with their citation, profiles as a follow card. */
const THUMBS = {
  mosque: require('../../assets/img/post-mosque.jpg'),
  quran: require('../../assets/img/onboard-book.jpg'),
  mecca: require('../../assets/img/mecca.jpg'),
  medina: require('../../assets/img/medina.jpg'),
};
const SEED: Thread[] = [
  { friend: 'aisha_yusuf', items: [
    { id: uid(), kind: 'post', title: 'Never underestimate a single ayah a day…', ago: '2h', dir: 'them', thumb: THUMBS.quran, sub: 'aisha_yusuf · 214 likes · 36 comments' },
    { id: uid(), kind: 'ayah', title: 'Surah Al-Fatiha · Ayah 5', ago: '6h', dir: 'them', arabic: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', refLabel: 'Al-Fatiha 1:5 · tap to read' },
    { id: uid(), kind: 'dua', title: 'Dua before sleeping — Hisn al-Muslim', ago: '1d', dir: 'them', arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', refLabel: 'Hisn al-Muslim · sleeping dua' },
  ], chat: [
    { id: uid(), text: 'This dua changed my nights, try it tonight inshaAllah', ago: '1d', dir: 'them' },
  ], reactions: {} },
  { friend: 'alameen', items: [
    { id: uid(), kind: 'reel', title: 'Quran recitation — Al-Furqan', ago: '5h', dir: 'them', thumb: THUMBS.mecca, dur: '0:48' },
    { id: uid(), kind: 'post', title: 'Reminder: the dua of Yunus (as)', ago: '2d', dir: 'them', thumb: THUMBS.mosque, sub: 'alameen · 1.2k likes · 204 comments' },
  ], chat: [], reactions: {} },
  { friend: 'usman_ahmad', items: [
    { id: uid(), kind: 'ayah', title: 'Ash-Sharh · Ayah 6', ago: '9h', dir: 'them', arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', refLabel: 'Ash-Sharh 94:6 · tap to read' },
    { id: uid(), kind: 'reel', title: 'One ummah, one qiblah', ago: '1d', dir: 'them', thumb: THUMBS.medina, dur: '1:12' },
  ], chat: [], reactions: {} },
  { friend: 'Gimba', items: [
    { id: uid(), kind: 'dua', title: 'Dua after adhan', ago: '1d', dir: 'them', arabic: 'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ', refLabel: 'Hisn al-Muslim · after adhan' },
    { id: uid(), kind: 'hadith', title: 'Bukhari · “None of you truly believes…”', ago: '1d', dir: 'them', arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', refLabel: 'Sahih al-Bukhari 13 · tap to open' },
  ], chat: [], reactions: {} },
  { friend: 'mayanchie12', items: [
    { id: uid(), kind: 'post', title: 'Seerah quiz — how many events do you know?', ago: '2d', dir: 'them', thumb: THUMBS.mosque, sub: 'mayanchie12 · 88 likes · 41 comments' },
  ], chat: [], reactions: {} },
  { friend: 'maryam_s', items: [
    { id: uid(), kind: 'profile', title: 'Profile — Ustādh Ibrāhīm (quran teacher)', ago: '3h', dir: 'them', sub: '@ustadh_ibrahim · 4.2k followers · Quran & Tajwid' },
    { id: uid(), kind: 'reel', title: 'Beautiful adhan from Makkah', ago: '8h', dir: 'them', thumb: THUMBS.mecca, dur: '2:05' },
    { id: uid(), kind: 'post', title: 'Jumu’ah reminder — arrive early', ago: '2d', dir: 'them', thumb: THUMBS.quran, sub: 'maryam_s · 530 likes · 77 comments' },
  ], chat: [], reactions: {} },
];
const SEED_NAMES = new Set(SEED.map((t) => t.friend));

/* pass 83-28 — the inbox cache is PER-ACCOUNT now: the old single global key
 * served account A's chats to account B after a switch (owner report).
 * v3 keys carry the user id; the old v2 blob is never read again. */
const inboxStoreKey = (owner: string | number | null) => `dl.inbox.v3.${owner ?? 'anon'}`;

/* pass 58 — real presence/last-seen from the API, and the same six report
 * reasons the post report sheet uses (src/components/FeedCard.tsx). */
import { blockUser, chatConversations, chatDelete, chatPresence, chatReact, chatRead, chatRequestAction, chatSend, chatSendShare, chatStartDMByUsername, chatThread, chatTyping, getConnections, isLive, reportAccount, searchAccounts } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import * as Clipboard from 'expo-clipboard';

if (Platform.OS === 'android') { UIManager.setLayoutAnimationEnabledExperimental?.(true); }

/**
 * pass 61 — a reaction emoji that animates ON MOUNT, with its own value.
 *
 * It used to share one `pop` Animated.Value with every other reaction, and
 * `popIn()` ran before the new row was mounted — so the spring finished before
 * the node existed. The emoji attached at scale 0.3 and opacity 0.4 (tiny and
 * washed-out) and only "popped" when the NEXT reaction re-ran the animation.
 */
/* pass 68 — the three-dot "typing…" bubble content. Staggered opacity loop;
 * web animates through the style driver (native driver drops style opacity). */
function TypingDot({ delay, color }: { delay: number; color: string }) {
  const a = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(a, { toValue: 1, duration: 240, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(a, { toValue: 0.25, duration: 360, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a, delay]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: a }} />;
}

function PopEmoji({ emoji, size }: { emoji: string; size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 4, tension: 110 }).start();
  }, [a]);
  return (
    <Animated.Text style={{ fontSize: size, opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
      {emoji}
    </Animated.Text>
  );
}

/** pass 58 — a chat row that SPRINGS in. `animate` is false for rows that were
 *  already there when the thread opened, so history never replays the effect. */
function SlideIn({ children, style, animate }: { children: React.ReactNode; style?: object; animate: boolean }) {
  const a = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) { return; }
    Animated.timing(a, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, animate]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * pass 63 — the SEND animation.
 *
 * Messages never animated at all: `renderMsg` returned a plain <View>, so a new
 * bubble simply popped into existence ("it just goes directly"). Every row now
 * springs in from the side it was sent from, with the composer-side offset so it
 * reads as leaving your hand.
 */
function BubbleIn({ mine, animate, children, style }: { mine: boolean; animate: boolean; children: React.ReactNode; style?: object }) {
  const a = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) { return; }
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 7, tension: 110 }).start();
  }, [a, animate]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [
      { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [mine ? 26 : -26, 0] }) },
      { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
    ] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * pass 63 — slide a bubble right to reply (WhatsApp).
 *
 * Mouse drags are deliberately NOT claimed: on the web that same horizontal drag
 * is how you highlight text to copy it, so `pointerType === 'mouse'` opts out and
 * selection keeps working. Touch gets the swipe, the mouse gets the highlight.
 */
function SwipeReply({ onReply, children, tint, style }: { onReply: () => void; children: React.ReactNode; tint: string; style?: object }) {
  const x = useRef(new Animated.Value(0)).current;
  const cb = useRef(onReply);
  cb.current = onReply;
  const tx = x.interpolate({ inputRange: [0, 60, 84, 200], outputRange: [0, 60, 72, 84], extrapolate: 'clamp' });
  const fade = x.interpolate({ inputRange: [0, 34], outputRange: [0, 1], extrapolate: 'clamp' });

  /* pass 65 — raw touch + mouse handlers instead of PanResponder.
   * The bubble is a Pressable, and on native a Pressable claims the responder on
   * touch-start, so a wrapper PanResponder never saw the gesture (swipe "did
   * nothing"). Touch and mouse events fire no matter who wins the responder, so
   * they are the reliable path on both native and web. */
  const startX = useRef<number | null>(null);
  const lastDx = useRef(0);
  const nodeRef = useRef<{ addEventListener?: (t: string, f: (e: { clientX: number }) => void) => void; removeEventListener?: (t: string, f: (e: { clientX: number }) => void) => void } | null>(null);

  const begin = (px: number) => { startX.current = px; lastDx.current = 0; };
  const move = (px: number) => {
    if (startX.current == null) { return; }
    const dx = px - startX.current;
    lastDx.current = dx;
    if (dx > 0) { x.setValue(Math.min(dx, 200)); }
  };
  const end = () => {
    if (startX.current == null) { return; }
    const go = lastDx.current > 58;
    startX.current = null;
    lastDx.current = 0;
    Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 6, tension: 90 }).start();
    if (go) { cb.current(); }
  };

  /* web mouse: a click-drag on a bubble swipes it on desktop */
  useEffect(() => {
    if (Platform.OS !== 'web') { return; }
    const el = nodeRef.current;
    if (!el?.addEventListener) { return; }
    const md = (e: { clientX: number }) => begin(e.clientX);
    const mm = (e: { clientX: number }) => { if (startX.current != null) { move(e.clientX); } };
    const mu = () => end();
    el.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return () => {
      el.removeEventListener?.('mousedown', md);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
    };
  }, []);

  return (
    <View style={style}>
      <Animated.View
        ref={nodeRef as never}
        style={{ transform: [{ translateX: tx }] }}
        onTouchStart={(e) => begin(e.nativeEvent.touches[0]?.pageX ?? 0)}
        onTouchMove={(e) => move(e.nativeEvent.touches[0]?.pageX ?? 0)}
        onTouchEnd={end}
        onTouchCancel={end}
      >
        {/* rides WITH the bubble so it is visible on either alignment; it only
            fades in after ~34px of drag, by which point there is room for it */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -24, top: 0, bottom: 0, width: 20, alignItems: 'center', justifyContent: 'center', opacity: fade }}>
          <FontAwesome5 name="reply" size={12} color={tint} />
        </Animated.View>
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * pass 63 — one emoji in the picker, popping in on its own schedule.
 *
 * The old panel faded the whole strip in from opacity 0.4 on a SHARED
 * Animated.Value; that is what made the emojis look washed-out and "shoddy".
 * Each one now owns its value, springs from 0.2 with a stagger, and gets a real
 * lineHeight so the glyph is never clipped.
 */
function PickerEmoji({ emoji, delay, onPress }: { emoji: string; delay: number; onPress: () => void }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 4, tension: 150, delay }).start();
  }, [a, delay]);
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ transform: [{ scale: pressed ? 1.28 : 1 }], paddingHorizontal: 3, paddingVertical: 2 })}>
      <Animated.Text style={{ fontSize: 29, lineHeight: 38, textAlign: 'center', includeFontPadding: false, opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
        {emoji}
      </Animated.Text>
    </Pressable>
  );
}

/** pass 63 — a panel that springs up instead of appearing instantly. */
function SheetIn({ children, style }: { children: React.ReactNode; style?: object }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 9, tension: 120 }).start();
  }, [a]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** pass 64 — one row of the floating frosted-glass action menu. */
function MenuRow({ first, icon, label, color, line, onPress }: { first?: boolean; icon: string; label: string; color: string; line: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: line, opacity: pressed ? 0.55 : 1, backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent' })}
    >
      <FontAwesome5 name={icon as never} size={12} color={color} />
      <T v="bodyS" style={{ fontSize: 13.5, fontWeight: '600', color }}>{label}</T>
    </Pressable>
  );
}

/** pass 63 — the dimming backdrop behind a focused message. */
function FadeIn({ children, style, duration = 170 }: { children: React.ReactNode; style?: object; duration?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration, useNativeDriver: true }).start();
  }, [a, duration]);
  return <Animated.View style={[style, { opacity: a }]}>{children}</Animated.View>;
}

const REPORT_TYPES: Array<{ id: string; label: string; icon: any }> = [
  { id: 'spam', label: 'Spam or scam', icon: 'ban' },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'user-slash' },
  { id: 'hate', label: 'Hate speech', icon: 'fire' },
  { id: 'danger', label: 'Dangerous content', icon: 'exclamation-triangle' },
  { id: 'misleading', label: 'Misleading content', icon: 'question-circle' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'shield-alt' },
];

/* pass 83-18 — owner: "when chat is heavy add skeleton breathing loader too
 * to the DM incase chat is loading." Alternating bubble bars that breathe. */
function BreathingMessages({ dark }: { dark: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const rows = [
    { w: '62%', mine: false }, { w: '46%', mine: true }, { w: '70%', mine: false },
    { w: '38%', mine: true }, { w: '55%', mine: false },
  ] as const;
  return (
    <Animated.View style={{ gap: 10, paddingVertical: 8, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }}>
      {rows.map((r, i) => (
        <View
          key={i}
          style={{
            alignSelf: r.mine ? 'flex-end' : 'flex-start',
            width: r.w,
            height: 40,
            borderRadius: 17,
            backgroundColor: r.mine
              ? (dark ? 'rgba(46,204,113,0.16)' : 'rgba(29,111,66,0.10)')
              : (dark ? 'rgba(255,255,255,0.10)' : 'rgba(20,36,28,0.08)'),
          }}
        />
      ))}
    </Animated.View>
  );
}

export function CommunityInbox({ visible, onClose, onNavigateAway, standalone = false, initialFriend = null }: { visible: boolean; onClose: () => void; onNavigateAway?: () => void; standalone?: boolean; initialFriend?: string | null }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isDemo } = useAuth();
  /* pass 60 — ONE chat interface, two modes: real API on the live site,
   * bundled demo threads on gh-pages where there is no backend. */
  const live = isLive() && !!user && !isDemo;
  const [convIds, setConvIds] = useState<Record<string, number>>({});
  const lastCidError = useRef(''); /* pass 83-12 — why the last conversation-open failed */
  /* pass 81 — never show bundled demo threads once we know we're live */
  useEffect(() => {
    if (live) setThreads((prev) => prev.filter((t) => !SEED_NAMES.has(t.friend)));
  }, [live]);
  /* pass 74 — message requests: incoming (they messaged me, I don't follow
   * them back yet), outgoing (mine, capped at 3 until accepted) and declined */
  const [reqMap, setReqMap] = useState<Record<string, { convId: number; photo?: string | null; name?: string }>>({});
  const [peerMap, setPeerMap] = useState<Record<string, { id?: number; name?: string; photo?: string | null }>>({});
  const [outRequests, setOutRequests] = useState<Set<string>>(new Set());
  const [hiddenConvs, setHiddenConvs] = useState<Set<string>>(new Set());
  /* pass 83-21 — per-peer block flags from conversations.php */
  const [blockFlags, setBlockFlags] = useState<Record<string, { b: boolean; by: boolean }>>({});
  /* pass 83-23 — when my read receipt for a conversation last succeeded. A
   * conversations refresh that was already in flight can come back with a
   * stale unread count; anything read after the fetch started stays 0. */
  const readOkAt = useRef<Record<number, number>>({});
  const markRead = useCallback((cid: number) => {
    chatRead(cid).then(() => { readOkAt.current[cid] = Date.now(); }).catch(() => {});
  }, []);
  const [unblockedFlash, setUnblockedFlash] = useState<string | null>(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [reqBusy, setReqBusy] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>(() => (isLive() ? [] : SEED));
  const [openFriend, setOpenFriend] = useState<string | null>(initialFriend);
  /* pass 83-23 — leaving a thread marks it read one last time, so the list
   * badge never comes back for messages seen on the way out. */
  const prevFriendRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevFriendRef.current;
    prevFriendRef.current = openFriend;
    if (prev && prev !== openFriend) { const cid = convIds[prev]; if (cid) { markRead(cid); } }
  }, [openFriend, convIds, markRead]);
  /* pass 83-5 — the Message button on a profile pushes /tools/inbox?u=X; when
   * the inbox was ALREADY mounted the init-only state ignored the new param and
   * the owner landed on the list ("not the direct user's DM"). Keep in sync. */
  useEffect(() => { if (initialFriend) setOpenFriend(initialFriend); }, [initialFriend]);

  /* pass 83-21 — the ••• menu's Block/Unblock label has to match the peer you
   * just opened. `blocked` is one shared flag, so opening a different thread
   * used to inherit the previous person's state. */
  useEffect(() => { setBlocked(openFriend ? !!blockFlags[openFriend]?.b : false); }, [openFriend, blockFlags]);
  /* pass 83-5 — mutual-follow suggestions under the empty state */
  const [sugg, setSugg] = useState<{ username: string; name: string; photo?: string | null }[]>([]);
  /* pass 83-11 — inbox search (any user) + floating + (pick a mutual follow) */
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState<{ username: string; name: string; photo?: string | null }[]>([]);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /* pass 63 — press-and-hold focus (WhatsApp-style sheet), reply quoting,
   * forwarding, and the "copied" confirmation. */
  const [focus, setFocus] = useState<{ id: string; kind: 'msg' | 'share' } | null>(null);
  /* pass 64 — the action menu is anchored to the pressed bubble (not a bottom
   * sheet), so we record where that bubble is on screen when it is held. */
  const [focusPos, setFocusPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [focusMode, setFocusMode] = useState<'menu' | 'info'>('menu');
  const rowRefs = useRef<Record<string, { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null>>({});
  const [replyTo, setReplyTo] = useState<{ id: string; kind: 'msg' | 'share'; who: string; text: string } | null>(null);
  /* pass 64 — forward is a full screen with multi-select, not a one-tap list. */
  const [forward, setForward] = useState<{ kind: 'msg' | 'share'; text: string; kindOf?: Kind } | null>(null);
  const [forwardPicked, setForwardPicked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  /* pass 64 — track the keyboard so the composer can drop its safe-area padding
   * while it is up (that leftover padding was the white bar under the field). */
  const [kbOpen, setKbOpen] = useState(false);
  /* pass 66 — scroll position. `atBottom` drives the jump-to-latest button:
   * read an old message and the list stops auto-yanking you down, and a
   * chevron appears over the composer to glide back to the newest bubble. */
  const [atBottom, setAtBottom] = useState(true);
  const [composerH, setComposerH] = useState(96);
  /* pass 68 — realtime plumbing: peer typing dots, incremental poll cursors,
   * typing-ping throttle, and an auto-read throttle for incoming rows. */
  const [peerTyping, setPeerTyping] = useState(false);
  const lastMsgId = useRef(0);
  const lastShareId = useRef(0);
  const typingPingAt = useRef(0);
  const lastAutoRead = useRef(0);
  const atBottomRef = useRef(true);
  const smoothRef = useRef<(() => void) | null>(null);
  const [fabIn, setFabIn] = useState(new Animated.Value(0));
  /* one shared value is RIGHT here: every unfocused row dims together. (The
   * reaction bug was the opposite case — one value shared by independent rows.) */
  const dim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);
  /* pass 58 — presence from the real API + the ••• menu, report sheet and block */
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({}); /* pass 83-14 — true unread counts from the server */
  const [menu, setMenu] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<string | null>(null);
  const [reportDesc, setReportDesc] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reported, setReported] = useState(false);
  const freshIds = useRef<Set<string>>(new Set());
  const lastTap = useRef<{ id: string; t: number }>({ id: '', t: 0 });
  /* pass 63 — the old shared `pop` value is gone entirely: the picker now uses
   * per-emoji springs (PickerEmoji) and the rows use their own mount springs. */
  const scroller = useRef<ScrollView>(null);
  /* pass 83-18 — true while a thread's history is being pulled */
  const [histLoading, setHistLoading] = useState(false);

  /* pass 83-28 — restore ONLY the signed-in account's chats (see inboxStoreKey). */
  const ownerRef = useRef<string>('anon');
  const [ownerReady, setOwnerReady] = useState(false);
  useEffect(() => {
    let dead = false;
    storage.getItem('dl.user').then((u) => {
      if (dead) return;
      try {
        const parsed = JSON.parse(u ?? '{}') as { id?: number; username?: string };
        ownerRef.current = String(parsed.id ?? parsed.username ?? 'anon');
      } catch { ownerRef.current = 'anon'; }
      setOwnerReady(true);
    });
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    if (!ownerReady) return;
    storage.getItem(inboxStoreKey(ownerRef.current)).then((r) => {
      if (r)
        try {
          const parsed = JSON.parse(r) as Thread[];
          /* pass 81 — persisted state can still hold demo threads from older
           * builds/sessions: never let them back in once we're live. */
          setThreads(isLive() ? parsed.filter((t) => !SEED_NAMES.has(t.friend)) : parsed);
        } catch {}
    });
  }, [ownerReady]);
  const persist = (next: Thread[]) => {
    setThreads(next);
    storage.setItem(inboxStoreKey(ownerRef.current), JSON.stringify(next)).catch(() => {});
  };

  /* pass 64 — native keyboard show/hide (web is handled by the body background). */
  useEffect(() => {
    const on = () => setKbOpen(true);
    const off = () => setKbOpen(false);
    const subs = [Keyboard.addListener('keyboardDidShow', on), Keyboard.addListener('keyboardDidHide', off)];
    return () => subs.forEach((s) => s.remove());
  }, []);

  /* pass 63 — press and hold: dim every other row, focus this one, and offer
   * Reply / Forward / Copy / Delete exactly like WhatsApp. */
  const openFocus = (id: string, kind: 'msg' | 'share') => {
    haptic.medium();
    setFocusMode('menu');
    /* pass 64 — anchor the menu to the bubble's real on-screen position. */
    const node = rowRefs.current[id];
    if (node?.measureInWindow) {
      node.measureInWindow((x, y, w, h) => setFocusPos({ x, y, w, h }));
    } else {
      setFocusPos(null);
    }
    setFocus({ id, kind });
    Animated.timing(dim, { toValue: 0.15, duration: 180, useNativeDriver: true }).start();
  };
  const closeFocus = () => {
    setFocus(null);
    setFocusMode('menu');
    Animated.timing(dim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  };

  /** pass 63 — DOUBLE-TAP reacts instantly with the default emoji. The picker is
   *  what press-and-hold gives you, so the two gestures no longer overlap. */
  const onTapItem = (id: string) => {
    const now = Date.now();
    const dbl = lastTap.current.id === id && now - lastTap.current.t < 320;
    lastTap.current = { id: '', t: 0 };
    if (dbl) { react(id, EMOJIS[0]); }
  };

  const thread = threads.find((t) => t.friend === openFriend) ?? null;
  /* pass 59 — the draft is PER CONVERSATION. It used to be one shared string, so
   * text typed in chat A was still sitting in the box when you opened chat B. */
  const draft = thread ? (drafts[thread.friend] ?? '') : '';
  const setDraft = (v: string) => {
    if (thread) { const f = thread.friend; setDrafts((m) => ({ ...m, [f]: v })); }
    /* pass 68 — one typing ping per 2.5s while keys keep coming; the server
     * expires the flag ~6s after the last ping, so silence stops the dots. */
    if (live && v && thread) {
      const cid = convIds[thread.friend];
      if (cid && Date.now() - typingPingAt.current > 2500) {
        typingPingAt.current = Date.now();
        chatTyping(cid, true).catch(() => {});
      }
    }
  };
  /* pass 74 — real peers resolve to their server name/photo; the old
   * MOCK_ACCOUNTS[0] fallback labelled every live DM with a mock person. */
  const acc = (u: string) => MOCK_ACCOUNTS.find((a) => a.username === u)
    ?? { username: u, full_name: peerMap[u]?.name || u, photo: peerMap[u]?.photo ?? null };

  /* pass 83-21 — the blocked viewer never sees the blocker's identity: the
   * server masks with_name/with_photo, and this covers the thread header and
   * rows locally. Tapping through to their profile is disabled as well. */
  const dispName = (u: string) => (blockFlags[u]?.by ? 'DeenLink User' : acc(u).full_name);

  /** pass 62 — a client row id → its server target. `s12` is message 12, `h7` is
   *  share 7. Demo/failed rows have no server id and keep reacting locally. */
  const targetOf = (id: string): { kind: 'msg' | 'share'; id: number } | null => {
    const m = /^([sh])(\d+)$/.exec(id);
    if (!m) { return null; }
    return { kind: m[1] === 'h' ? 'share' : 'msg', id: parseInt(m[2], 10) };
  };

  /* pass 83-11 — debounced account search while typing */
  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2 || !live) { setSearchRes([]); return; }
    const iv = setTimeout(() => {
      void searchAccounts(q, 12)
        .then((rows) => setSearchRes((rows ?? [])
          .filter((r) => r.username !== user?.username)
          .map((r) => ({ username: r.username, name: (r as { full_name?: string }).full_name || r.username, photo: (r as { profile_image_url?: string | null }).profile_image_url ?? null }))))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(iv);
  }, [searchQ, live]);

  /** pass 62 — conversation id for a username, creating the DM when needed. */
  const resolveCid = async (who: string): Promise<number | null> => {
    const known = convIds[who];
    if (known) { return known; }
    /* pass 83-9 — one retry (transient 5xx on shared hosting must not look
     * like a dead chat) + record 'request' conversations the moment they are
     * created, so even a brand-new thread knows about the 3-message limit. */
    let made = await chatStartDMByUsername(who).catch(() => null);
    if (!made) {
      await new Promise((r) => setTimeout(r, 1200));
      made = await chatStartDMByUsername(who).catch(() => null);
    }
    if (made && made.cid > 0) {
      setConvIds((m) => ({ ...m, [who]: made!.cid }));
      if (made.status === 'request') { setOutRequests((prev) => new Set(prev).add(who)); }
      lastCidError.current = '';
      return made.cid;
    }
    lastCidError.current = made?.error ?? 'Could not open the conversation';
    return null;
  };

  /** Put my emoji back — a reaction that never reached the server must not
   *  pretend it did (same honesty as `markFailed` for messages). */
  const revertReaction = (who: string, id: string, prev: string) => {
    setThreads((prevT) => prevT.map((t) => (t.friend === who
      ? { ...t, reactions: { ...t.reactions, [id]: prev } }
      : t)));
  };

  const react = (id: string, e: string) => {
    haptic.success();
    if (!thread) return;
    const prev = thread.reactions[id] ?? '';
    const next = prev === e ? '' : e;
    const reactions = { ...thread.reactions, [id]: next };
    persist(threads.map((t) => (t.friend === thread.friend ? { ...t, reactions } : t)));
    if (focus) { closeFocus(); }
    /* pass 62 — the reaction is on screen instantly; now make it real so the
     * other person sees it. Tapping the same emoji again sends '' = remove. */
    if (!live) { return; }
    const who = thread.friend;
    const target = targetOf(id);
    if (!target) { return; }
    void (async () => {
      const cid = await resolveCid(who);
      if (!cid) { revertReaction(who, id, prev); return; }
      const r = await chatReact(cid, target.kind, target.id, next).catch(() => ({ ok: false, emoji: null }));
      if (!r.ok) { revertReaction(who, id, prev); }
    })();
  };

  /** pass 63 — the plain text of a row, used by Copy and by the reply quote. */
  const rowText = (id: string): string => {
    if (!thread) { return ''; }
    const m = thread.chat.find((c) => c.id === id);
    if (m) { return m.text; }
    const s = thread.items.find((x) => x.id === id);
    return s ? s.title : '';
  };

  /** pass 63 — slide-to-reply (or Reply in the sheet): quote the row above the
   *  composer and put the cursor in the box, ready to type. */
  const openReply = (id: string) => {
    if (!thread) { return; }
    const m = thread.chat.find((c) => c.id === id);
    const s = !m ? thread.items.find((x) => x.id === id) : null;
    if (!m && !s) { return; }
    const mine = m ? m.dir === 'me' : s!.dir === 'me';
    setReplyTo({
      id,
      kind: m ? 'msg' : 'share',
      who: mine ? 'You' : thread.friend,
      text: m ? m.text : s!.title,
    });
    closeFocus();
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  /** pass 63 — Copy. This is the reliable way to copy on a phone; on the web you
   *  can also just drag-select the text (mouse drags are not claimed as swipes). */
  const copyRow = (id: string) => {
    const text = rowText(id);
    Clipboard.setStringAsync(text).then(() => {
      haptic.success();
      setCopied(true);
      setTimeout(() => { setCopied(false); closeFocus(); }, 850);
    }).catch(() => { closeFocus(); });
  };

  const applyDelete = (who: string, id: string, kind: 'msg' | 'share') => {
    setThreads((prev) => prev.map((t) => (t.friend === who
      ? kind === 'msg'
        ? { ...t, chat: t.chat.map((c) => (c.id === id ? { ...c, deleted: true, text: '' } : c)) }
        : { ...t, items: t.items.map((x) => (x.id === id ? { ...x, deleted: true, title: '' } : x)) }
      : t)));
  };

  /** pass 63 — delete YOUR OWN row. Optimistic locally, then `delete.php`; the
   *  server only ever deletes a row you sent, so the two cannot disagree. */
  const deleteRow = (id: string, kind: 'msg' | 'share') => {
    if (!thread) { return; }
    const who = thread.friend;
    haptic.medium();
    closeFocus();
    applyDelete(who, id, kind);
    if (!live) { return; }
    const target = targetOf(id);
    if (!target) { return; }
    void (async () => {
      const cid = await resolveCid(who);
      if (!cid) { return; }
      await chatDelete(cid, kind, target.id).catch(() => false);
    })();
  };

  /** pass 63 — Forward: send the same content into another conversation. */
  const startForward = (id: string, kind: 'msg' | 'share') => {
    if (!thread) { return; }
    const m = thread.chat.find((c) => c.id === id);
    const s = !m ? thread.items.find((x) => x.id === id) : null;
    if (!m && !s) { return; }
    closeFocus();
    setForwardPicked(new Set());
    setForward(kind === 'msg'
      ? { kind: 'msg', text: m!.text }
      : { kind: 'share', text: s!.title, kindOf: s!.kind });
  };

  /** pass 64 — send the same payload into one conversation (optimistic then real). */
  const forwardTo = (to: string, payload: { kind: 'msg' | 'share'; text: string; kindOf?: Kind }) => {
    haptic.success();
    const tmp = uid();
    setThreads((prev) => prev.map((t) => (t.friend === to
      ? payload.kind === 'msg'
        ? { ...t, chat: [...t.chat, { id: tmp, rk: tmp, text: payload.text, ago: ago(), dir: 'me' as const, at: '' }] }
        : { ...t, items: [...t.items, { id: tmp, rk: tmp, kind: (payload.kindOf ?? 'post') as Kind, title: payload.text, ago: ago(), dir: 'me' as const, at: '' }] }
      : t)));
    if (!live) { return; }
    void (async () => {
      const cid = await resolveCid(to);
      if (!cid) { return; }
      const made = payload.kind === 'msg'
        ? await chatSend(cid, payload.text).catch(() => null)
        : await chatSendShare(cid, String(payload.kindOf ?? 'post'), payload.text).catch(() => null);
      if (!made || !('id' in made) || !made.id) { return; }
      const nid = payload.kind === 'msg' ? `s${made.id}` : `h${made.id}`;
      setThreads((prev) => prev.map((t) => (t.friend === to
        ? payload.kind === 'msg'
          ? { ...t, chat: t.chat.map((c) => (c.id === tmp ? { ...c, id: nid, rk: c.rk ?? c.id, at: made.created_at || c.at } : c)) }
          : { ...t, items: t.items.map((x) => (x.id === tmp ? { ...x, id: nid, rk: x.rk ?? x.id, at: made.created_at || x.at } : x)) }
        : t)));
    })();
  };

  /** pass 64 — forward the held payload to every picked conversation at once. */
  const doForwardMany = (friends: string[]) => {
    if (!forward || !friends.length) { return; }
    const payload = forward;
    setForward(null);
    setForwardPicked(new Set());
    friends.forEach((to) => forwardTo(to, payload));
  };

  /* pass 58 — heartbeat + pull each peer's last_seen, keyed by username.
   * pass 74 — conversations are sorted: incoming requests go to the Message
   * Requests shelf, declined ones are hidden, everything else is a thread. */
  useEffect(() => {
    if (!live) { return; }
    getConnections('following').then((r) => {
      if (!r) { return; }
      setSugg(r.items.filter((i) => i.follows_me && !i.is_me).slice(0, 6).map((i) => ({ username: i.username, name: i.name || i.username, photo: i.profile_image_url ?? null })));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const refreshConvs = () => { const startedAt = Date.now(); return chatConversations().then((cs) => {
    if (!cs) { return; }
    const m: Record<string, string> = {};
    const ids: Record<string, number> = {};
    const reqs: Record<string, { convId: number; photo?: string | null; name?: string }> = {};
    const peers: Record<string, { id?: number; name?: string; photo?: string | null }> = {};
    const mine = new Set<string>();
    const gone = new Set<string>();
    /* pass 83-21 — who blocked whom, per peer */
    const flags: Record<string, { b: boolean; by: boolean }> = {};
    cs.forEach((c) => {
      const u = c.with_username || c.peer?.username;
      if (!u) { return; }
      if (c.peer_seen) { m[u] = String(c.peer_seen); }
      peers[u] = { id: c.peer?.id, name: c.with_name || undefined, photo: c.with_photo ?? null };
      flags[u] = { b: !!c.blocked, by: !!c.blocked_by };
      const st = c.conv_status ?? 'active';
      if (st === 'declined') { gone.add(u); return; }
      if (st === 'request') {
        if (c.requested_by != null && user?.id != null && c.requested_by !== user.id) {
          reqs[u] = { convId: c.id, photo: c.with_photo ?? null, name: c.with_name || c.title || u };
          return; /* not a main-list thread until accepted */
        }
        mine.add(u); /* my outgoing request stays visible in the main list */
      }
      ids[u] = c.id;
    });
    const un: Record<string, number> = {};
    cs.forEach((c) => {
      const u2 = c.with_username || c.peer?.username;
      if (!u2) { return; }
      un[u2] = Math.max(0, Number(c.unread ?? 0));
      /* pass 83-23 — a read receipt that landed after this fetch started wins */
      if (ids[u2] && (readOkAt.current[ids[u2]] ?? 0) >= startedAt) { un[u2] = 0; }
    });
    setUnreadMap(un);
    setSeenMap(m);
    setConvIds(ids);
    setReqMap(reqs);
    setPeerMap(peers);
    setOutRequests(mine);
    setHiddenConvs(gone);
    setBlockFlags(flags);
    /* live conversations become threads; demo threads stay so shares still work */
    if (live) {
      setThreads((prev) => {
        const have = new Set(prev.map((t) => t.friend));
        const add: Thread[] = Object.keys(ids).filter((u) => !have.has(u)).map((u) => ({ friend: u, items: [], chat: [], reactions: {} }));
        /* pass 83-21 — keep each thread's block flags in sync */
        const next = [...add, ...prev].map((t) => (flags[t.friend] && (t.blocked !== flags[t.friend].b || t.blocked_by !== flags[t.friend].by)
          ? { ...t, blocked: flags[t.friend].b, blocked_by: flags[t.friend].by }
          : t));
        return next.length !== prev.length || next.some((t, i) => t !== [...add, ...prev][i]) ? next : prev;
      });
    }
  }).catch(() => {}); };
  useEffect(() => {
    chatPresence().catch(() => {});
    void refreshConvs();
    const iv = setInterval(() => { chatPresence().catch(() => {}); void refreshConvs(); }, 60000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  /* pass 74 — arriving via the profile Message button (?u=) for a peer with
   * no conversation yet: start the DM so the thread actually opens (it used
   * to sit on the bare list), and refresh so the request state lands.
   * pass 83-7 — the thread opens IMMEDIATELY: the old code waited for
   * start_username.php and silently stayed on the list whenever that call
   * failed (owner: "Message still opens the inbox, not the DM"). Sending
   * resolves the conversation lazily via resolveCid, so opening early is
   * safe; the start call runs (and retries once) in the background. */
  useEffect(() => {
    if (!live || !openFriend) { return; }
    if (threads.some((t) => t.friend === openFriend)) { return; }
    let dead = false;
    const who = openFriend;
    setThreads((prev) => (prev.some((t) => t.friend === who)
      ? prev
      : [{ friend: who, items: [], chat: [], reactions: {} }, ...prev]));
    void (async () => {
      let made = await chatStartDMByUsername(who).catch(() => null);
      if (!made) {
        await new Promise((r) => setTimeout(r, 1500));
        if (!dead) made = await chatStartDMByUsername(who).catch(() => null);
      }
      if (dead) { return; }
      if (made && made.cid > 0) {
        setConvIds((m) => ({ ...m, [who]: made!.cid }));
        if (made.status === 'request') { setOutRequests((prev) => new Set(prev).add(who)); }
      }
      await refreshConvs();
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, openFriend, threads]);

  /* pass 74 — accept / block / report a message request */
  const actOnRequest = async (uname: string, action: 'accept' | 'block' | 'report') => {
    const r = reqMap[uname];
    if (!r || reqBusy) { return; }
    haptic.light();
    setReqBusy(uname);
    const ok = await chatRequestAction(r.convId, action).catch(() => false);
    setReqBusy(null);
    if (!ok) { Alert.alert('Could not update', 'Please try again in a moment.'); return; }
    if (action === 'accept') {
      await refreshConvs();
      setOpenFriend(uname);
      setRequestsOpen(false);
    } else {
      if (action === 'report') { Alert.alert('Reported', 'JazakAllah khair — our moderation team will review this account.'); }
      await refreshConvs();
      if (Object.keys(reqMap).length <= 1) { setRequestsOpen(false); }
    }
  };

  /* pass 60/62 — opening a live thread pulls the real history (messages + shares
   * + every reaction on them) in ONE call and marks it read. */
  useEffect(() => {
    if (!live || !openFriend) { return; }
    const cid = convIds[openFriend];
    if (!cid) { return; }
    setHistLoading(true);
    chatThread(cid).catch(() => null).then((data) => {
      setHistLoading(false);
      if (!data) { return; }
      /* pass 68 — the peer's read watermark turns ✓✓ on my older rows even
       * though per-row read_at only lands on a full fetch. */
      const wm = data.peer_read_at ?? null;
      lastMsgId.current = data.messages.reduce((mx, m) => Math.max(mx, m.id), 0);
      lastShareId.current = data.shares.reduce((mx, x) => Math.max(mx, x.id), 0);
      setPeerTyping(!!data.peer_typing);
      const chat: ChatMsg[] = data.messages.map((m) => ({
        id: `s${m.id}`, text: m.body, ago: (m.created_at || '').slice(11, 16),
        dir: m.sender_id === user?.id ? 'me' as const : 'them' as const,
        at: m.created_at || '',
        deleted: !!m.deleted,
        reply: m.reply_to ? { who: m.reply_to.username ?? '', text: m.reply_to.body } : null,
        createdAt: m.created_at || '',
        readAt: m.read_at ?? (wm && m.sender_id === user?.id && m.created_at && m.created_at <= wm ? wm : null),
      }));
      /* server shares replace the bundled demo cards for this person */
      const items: ShareItem[] = data.shares.map((s) => ({
        id: `h${s.id}`,
        kind: (Object.keys(KIND_META) as Kind[]).includes(s.kind as Kind) ? (s.kind as Kind) : ('post' as Kind),
        title: s.title,
        ago: (s.created_at || '').slice(11, 16),
        dir: s.sender_id === user?.id ? 'me' as const : 'them' as const,
        at: s.created_at || '',
        deleted: !!s.deleted,
        arabic: s.payload?.arabic,
        refLabel: s.payload?.refLabel,
        sub: s.payload?.sub,
        route: typeof s.payload?.route === 'string' ? s.payload.route : undefined,
        dur: s.payload?.dur,
      }));
      const reactions: Record<string, string> = {};
      const others: Record<string, string> = {};
      data.reactions.forEach((r) => {
        const key = `${r.target_kind === 'share' ? 'h' : 's'}${r.target_id}`;
        if (r.user_id === user?.id) { reactions[key] = r.emoji; }
        else if (!others[key]) { others[key] = r.emoji; }
      });
      [...chat, ...items].forEach((c) => freshIds.current.add(c.id));
      setThreads((prev) => prev.map((t) => (t.friend === openFriend ? { ...t, chat, items, reactions, others } : t)));
      /* pass 83-28 — returning from a shared item used to leave the thread
       * scrolled to the TOP (the scroll raced the layout). Give it a few
       * frames — same recipe as the send path below. */
      [0, 60, 160, 300].forEach((t) =>
        setTimeout(() => {
          scroller.current?.scrollToEnd({ animated: false });
          if (Platform.OS === 'web') {
            const node = webScrollNode();
            if (node) node.scrollTop = node.scrollHeight;
          }
        }, t),
      );
    }).catch(() => {});
    markRead(cid);
  }, [live, openFriend, convIds, user?.id, markRead]);

  /* pass 68 — REALTIME. While a live thread is open, poll it every 3s:
   * new messages/shares append (deduped by server id), the peer's typing flag
   * drives the three-dot bubble, and their read watermark flips ✓✓ on my rows.
   * The since-cursors keep each poll to a couple of indexed rows; the poll is
   * skipped while the tab is hidden. 3s over HTTP is deliberate: shared hosting
   * (10 entry processes) cannot hold websockets or long-polls. */
  useEffect(() => {
    if (!live || !openFriend) { return; }
    const cid = convIds[openFriend];
    if (!cid) { return; }
    let busy = false;
    const tick = () => {
      if (busy) { return; }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { return; }
      busy = true;
      chatThread(cid, { msg: lastMsgId.current, share: lastShareId.current })
        .then((data) => {
          if (!data) { return; }
          const who = openFriend;
          const newMsgs = data.messages.filter((m) => m.id > lastMsgId.current);
          const newShares = data.shares.filter((x) => x.id > lastShareId.current);
          if (newMsgs.length) { lastMsgId.current = Math.max(lastMsgId.current, ...newMsgs.map((m) => m.id)); }
          if (newShares.length) { lastShareId.current = Math.max(lastShareId.current, ...newShares.map((x) => x.id)); }
          const wm = data.peer_read_at ?? null;
          const addChat: ChatMsg[] = newMsgs.map((m) => ({
            id: `s${m.id}`, text: m.body, ago: (m.created_at || '').slice(11, 16),
            dir: m.sender_id === user?.id ? 'me' as const : 'them' as const,
            at: m.created_at || '', deleted: !!m.deleted,
            reply: m.reply_to ? { who: m.reply_to.username ?? '', text: m.reply_to.body } : null,
            createdAt: m.created_at || '', readAt: m.read_at ?? null,
          }));
          const addShares: ShareItem[] = newShares.map((x) => ({
            id: `h${x.id}`,
            kind: (Object.keys(KIND_META) as Kind[]).includes(x.kind as Kind) ? (x.kind as Kind) : ('post' as Kind),
            title: x.title, ago: (x.created_at || '').slice(11, 16),
            dir: x.sender_id === user?.id ? 'me' as const : 'them' as const,
            at: x.created_at || '', deleted: !!x.deleted,
            arabic: x.payload?.arabic, refLabel: x.payload?.refLabel, sub: x.payload?.sub, dur: x.payload?.dur,
          }));
          const incoming = addChat.some((c) => c.dir === 'them') || addShares.some((c) => c.dir === 'them');
          if (incoming) {
            addChat.forEach((c) => freshIds.current.add(c.id));
            addShares.forEach((c) => freshIds.current.add(c.id));
            LayoutAnimation.configureNext({ duration: 240, update: { type: LayoutAnimation.Types.easeInEaseOut } });
          }
          if (newMsgs.length || newShares.length || wm) {
            setThreads((prev) => prev.map((t) => {
              if (t.friend !== who) { return t; }
              const have = new Set(t.chat.map((c) => c.id));
              const haveS = new Set(t.items.map((c) => c.id));
              let chat = [...t.chat, ...addChat.filter((c) => !have.has(c.id))];
              const items = [...t.items, ...addShares.filter((c) => !haveS.has(c.id))];
              if (wm) { chat = chat.map((c) => (c.dir === 'me' && !c.readAt && c.createdAt && c.createdAt <= wm ? { ...c, readAt: wm } : c)); }
              const reactions: Record<string, string> = {};
              const others: Record<string, string> = {};
              data.reactions.forEach((r) => {
                const key = `${r.target_kind === 'share' ? 'h' : 's'}${r.target_id}`;
                if (r.user_id === user?.id) { reactions[key] = r.emoji; }
                else if (!others[key]) { others[key] = r.emoji; }
              });
              return { ...t, chat, items, reactions, others };
            }));
            if (incoming && atBottomRef.current) { smoothRef.current?.(); }
            if (incoming && Date.now() - lastAutoRead.current > 2000) { /* pass 83-23 — 10s left fast messages unread server-side */
              lastAutoRead.current = Date.now();
              markRead(cid);
            }
          }
          setPeerTyping((prevDots) => (prevDots === !!data.peer_typing ? prevDots : !!data.peer_typing));
        })
        .catch(() => {})
        .finally(() => { busy = false; });
    };
    const iv = setInterval(tick, 3000);
    return () => clearInterval(iv);
  }, [live, openFriend, convIds, user?.id]);

  const isOnline = useCallback((u: string | null | undefined) => {
    if (!u) { return false; }
    /* pass 83-23 — the blocked viewer never sees the blocker's presence */
    if (blockFlags[u]?.by) { return false; }
    const t = seenMap[u];
    return !!t && (Date.now() - new Date(t.replace(' ', 'T')).getTime()) < 5 * 60 * 1000;
  }, [seenMap, blockFlags]);

  /* pass 66 — JS-driven smooth scroll on web. Browser `behavior:'smooth'` is
   * not dependable (headless shells ignore it entirely) and RN-web's animated
   * scrollToEnd measures the content on the frame it is called, so a send from
   * the very TOP of a long thread glided to where the list *was*, not to the
   * new bubble. Easing scrollTop through rAF gives the same feel everywhere
   * and always resolves against the final layout. */
  const webSmoothToBottom = (node: HTMLElement) => {
    const from = node.scrollTop;
    const dur = 340;
    const t0 = performance.now();
    const step = (t: number) => {
      const to = node.scrollHeight - node.clientHeight;
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      node.scrollTop = from + (to - from) * e;
      if (k < 1) requestAnimationFrame(step);
      else node.scrollTop = node.scrollHeight; /* content grew mid-glide */
    };
    requestAnimationFrame(step);
  };

  /* pass 64 — follow the new bubble with a smooth cascade so the send animation
   * is on screen while it plays. The old single 80ms scroll jumped past it. */
  /* pass 66 — on web the ScrollView ref comes back null in this RNW build (the
   * forwarded ref never lands on the class), so the DOM node is resolved
   * directly. pass 67 — the "tallest scrollable under #root" heuristic picked
   * the WRONG element in the live build (quick-shares rail, page body…), so
   * sends and the Latest chip silently did nothing. The thread list now
   * carries a testID and is resolved by attribute first; the heuristic is
   * only a last-resort fallback. */
  const webScrollNode = (): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    const tagged = document.querySelector('[data-testid="chat-thread-list"]') as HTMLElement | null;
    if (tagged) return tagged;
    const rootEl = document.getElementById('root');
    if (!rootEl) return null;
    const els = [...rootEl.querySelectorAll('*')].filter(
      (e) => (e as HTMLElement).scrollHeight > (e as HTMLElement).clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY),
    ) as HTMLElement[];
    return els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? null;
  };

  const smoothScrollBottom = () => {
    smoothRef.current = smoothScrollBottom;
    [0, 60, 160, 300].forEach((t) => setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), t));
    if (Platform.OS !== 'web') return;
    [0, 120, 320].forEach((t) => {
      setTimeout(() => {
        const node = webScrollNode();
        if (node) webSmoothToBottom(node);
      }, t);
    });
  };

  /* pass 66 — are we close enough to the latest row to call it "at the bottom"?
   * The state only flips at the 60px boundary, so the scroll stream is cheap. */
  const onThreadScroll = (e: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const near = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 60;
    setAtBottom((p) => (p === near ? p : near));
  };

  /* pass 66 — the jump chip fades in/out. Opacity goes through style on web, so
   * the native driver would drop the animation there; native still gets it. */
  useEffect(() => {
    Animated.timing(fabIn, {
      toValue: !!thread && !atBottom ? 1 : 0,
      duration: 170,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [thread?.friend, atBottom, fabIn]);

  /* a thread always opens at its newest message, so switching peers must not
   * inherit the other person's scroll position (and the chip must not show). */
  useEffect(() => {
    setAtBottom(true);
    setPeerTyping(false);
    lastMsgId.current = 0;
    lastShareId.current = 0;
  }, [openFriend]);
  useEffect(() => { atBottomRef.current = atBottom; }, [atBottom]);

  const sendChat = () => {
    const text = draft.trim();
    if (!text || !thread) return;
    haptic.light();
    /* pass 58 — the new row is registered as fresh so it springs in, and the
     * rest of the list eases out of the way instead of snapping. */
    const id = uid();
    freshIds.current.add(id);
    LayoutAnimation.configureNext({ duration: 220, update: { type: LayoutAnimation.Types.easeInEaseOut } });
    /* pass 63 — carry the quote into the optimistic bubble so it appears with the
     * message instead of arriving a round trip later. */
    const quote = replyTo;
    const chat = [...thread.chat, { id, rk: id, text, ago: ago(), dir: 'me' as const, at: '', reply: quote ? { who: quote.who, text: quote.text } : null }];
    persist(threads.map((t) => (t.friend === thread.friend ? { ...t, chat } : t)));
    setDrafts((m) => ({ ...m, [thread.friend]: '' }));
    setReplyTo(null);
    smoothScrollBottom();

    /* pass 60 — the bubble is already on screen; now make it real. If there is no
     * conversation with this person yet (e.g. you tapped Message on their
     * profile), one is created by username and reused next time. */
    if (live) {
      const who = thread.friend;
      /* only a row that already has a server id can be quoted server-side; a
       * demo row stays a local-only quote rather than failing the whole send. */
      const qt = quote ? targetOf(quote.id) : null;
      const replyArg = qt ? { id: qt.id, kind: quote!.kind } : undefined;
      void (async () => {
        const cid = await resolveCid(who);
        if (!cid) { markFailed(who, id, lastCidError.current); return; }
        chatTyping(cid, false).catch(() => {});
        let sent = await chatSend(cid, text, replyArg).catch(() => null);
        if (!sent || !sent.id) {
          /* pass 83-11 — one silent retry before giving up: a transient blip on
           * shared hosting must not cost the user their message. */
          await new Promise((r) => setTimeout(r, 1800));
          sent = await chatSend(cid, text, replyArg).catch(() => null);
        }
        if (!sent || !sent.id) {
          /* pass 83-9 — tell the user WHY, in the bubble itself: Alert.alert
           * is a no-op on web, and a silent "⚠ not sent" made the 3-message
           * request limit look like a broken chat (owner report). */
          const why = sent?.errorMessage;
          const short = sent?.errorCode === 'request_limit' || outRequests.has(who)
            ? `request pending · max 3 messages until @${who} accepts`
            : sent?.errorCode === 'declined' ? 'conversation closed'
            : sent?.errorCode === 'blocked' ? 'blocked'
            : why ? why.slice(0, 60) : '';
          markFailed(who, id, short);
          if (sent?.errorCode === 'request_limit' || outRequests.has(who)) {
            Alert.alert('Request pending', why ?? `You can send up to 3 messages until @${who} accepts your request.`);
          } else if (sent?.errorCode === 'declined') {
            Alert.alert('Conversation closed', why ?? 'This conversation is closed.');
          } else if (sent?.errorCode === 'blocked') {
            setBlocked(true); /* pass 83-14 — the menu now offers Unblock right here */
            Alert.alert('Cannot send', why ?? 'You can no longer message this account.');
          } else if (why) {
            Alert.alert('Message not sent', why);
          }
          return;
        }
        /* pass 83-23 — on a slow network the 3s poll can deliver my own
         * message back BEFORE this confirm lands; that copy is dropped here
         * (it used to sit next to the confirmed bubble = "bubbles twice"),
         * and the cursor advances so the next poll skips the row. */
        lastMsgId.current = Math.max(lastMsgId.current, sent.id);
        setThreads((prev) => prev.map((t) => (t.friend === who
          ? { ...t, chat: t.chat.filter((c) => c.id !== `s${sent.id}`).map((c) => (c.id === id ? { ...c, id: `s${sent.id}`, rk: c.rk ?? c.id, at: sent.created_at || c.at } : c)) }
          : t)));
        freshIds.current.delete(id);
        /* pass 83-23 — do NOT re-register the confirmed id as fresh: the row is
         * already on screen and the BubbleIn spring re-ran on the id swap, which
         * is the double-bubble the owner reported. */
      })();
    }
  };

  /** Flag a bubble that never reached the server instead of letting it lie. */
  const markFailed = (who: string, id: string, reason = '') => {
    setThreads((prev) => prev.map((t) => (t.friend === who
      ? { ...t, chat: t.chat.map((c) => (c.id === id ? { ...c, text: `${c.text}  ⚠ not sent${reason ? ' — ' + reason : ''}` } : c)) }
      : t)));
  };

  const shareBack = (kind: Kind, title: string, payload?: Record<string, unknown>) => {
    if (!thread) return;
    haptic.selection();
    const id = uid();
    freshIds.current.add(id);
    const items = [...thread.items, { id, rk: id, kind, title, ago: ago(), dir: 'me' as const, at: '', route: typeof (payload as { route?: unknown } | undefined)?.route === 'string' ? ((payload as { route?: string }).route as string) : undefined }];
    persist(threads.map((t) => (t.friend === thread.friend ? { ...t, items } : t)));
    smoothScrollBottom();

    /* pass 62 — shares are server-backed too, so the other person receives the
     * card (and can react to it) instead of it living only on my device. */
    if (live) {
      const who = thread.friend;
      void (async () => {
        const cid = await resolveCid(who);
        if (!cid) { markShareFailed(who, id, lastCidError.current); return; }
        const made = await chatSendShare(cid, kind, title, payload).catch(() => null);
        if (!made) { markShareFailed(who, id); return; }
        lastShareId.current = Math.max(lastShareId.current, made.id); /* pass 83-23 */
        setThreads((prev) => prev.map((t) => (t.friend === who
          ? { ...t, items: t.items.filter((x) => x.id !== `h${made.id}`).map((x) => (x.id === id ? { ...x, id: `h${made.id}`, rk: x.rk ?? x.id, at: made.created_at || x.at } : x)) }
          : t)));
        freshIds.current.delete(id);
        /* pass 83-23 — same as sendChat: no re-animation on confirm */
      })();
    }
  };

  /** Flag a share card that never reached the server. */
  const markShareFailed = (who: string, id: string, reason = '') => {
    setThreads((prev) => prev.map((t) => (t.friend === who
      ? { ...t, items: t.items.map((x) => (x.id === id ? { ...x, title: `${x.title}  ⚠ not sent${reason ? ' — ' + reason : ''}` } : x)) }
      : t)));
  };

  const renderShare = (th: Thread, it: ShareItem) => {

            const meta = KIND_META[it.kind];
            const mine = it.dir === 'me';
            const reaction = th.reactions[it.id];
            /* pass 62 — their reaction, so I can see it and still add my own */
            const peer = th.others?.[it.id];
            const isFocus = focus?.id === it.id;
            return (
              <Animated.View key={it.rk ?? it.id} style={{ opacity: isFocus ? 1 : dim }}>
              <SlideIn animate={freshIds.current.has(it.id)} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
                {!mine ? <AvatarImage source={acc(th.friend).photo ?? null} name={acc(th.friend).full_name} size={28} tint="rgba(46,204,113,0.2)" border={d.cardBorder} /> : null}
                {/* pass 66 — shares/posts slide to reply too. The swipe used to
                 * live only on plain message bubbles, so an app item (ayah,
                 * hadith, post, reel…) could not be replied to by sliding; the
                 * width cap moves to the wrapper so the bubble keeps its shape. */}
                <SwipeReply onReply={() => openReply(it.id)} tint={isDark ? '#4AE38F' : '#1D6F42'} style={{ maxWidth: '76%' }}>
                <Pressable
                  ref={(r) => { rowRefs.current[it.id] = r as never; }}
                  onPress={() => {
                    /* pass 83-20 — a share with a known home navigates there
                     * (owner: "if clicked in that thing it should navigate to
                     * the location of that thing"); otherwise the old preview. */
                    if (it.route) {
                      if (!standalone) { storage.setItem('dl_inbox_reopen', th.friend).catch(() => {}); onNavigateAway?.(); }
                      router.push(it.route as never);
                      return;
                    }
                    onTapItem(it.id);
                  }}
                  onLongPress={() => openFocus(it.id, 'share')}
                  delayLongPress={260}
                  style={({ pressed }) => ({
                    borderRadius: 14,
                    borderWidth: isFocus ? 1.5 : 1,
                    borderColor: isFocus ? '#4AE38F' : mine ? 'rgba(74,227,143,0.45)' : d.cardBorder,
                    backgroundColor: mine ? 'rgba(31,143,92,0.12)' : d.card,
                    padding: 11,
                    opacity: pressed ? 0.85 : 1,
                    ...(isFocus ? { shadowColor: 'rgba(74,227,143,0.5)', shadowOpacity: 0.9, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 16, transform: [{ scale: 1.03 }] } : null),
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <FontAwesome5 name={meta.icon as never} size={10} color={meta.tint} />
                    <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: meta.tint, letterSpacing: 0.4 }}>{meta.label.toUpperCase()}</T>
                    <View style={{ flex: 1 }} />
                    <FontAwesome5 name={mine ? 'share' : 'share-alt'} size={8} color={d.faint} />
                  </View>

                  {/* pass 32: each sharable type previews the way it really looks */}
                  {it.deleted ? (
                    <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, fontStyle: 'italic', color: d.faint }}>Message deleted</T>
                  ) : it.kind === 'reel' && it.thumb != null ? (
                    <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 7 }}>
                      <ImageBackground source={it.thumb} style={{ width: '100%', height: 128, justifyContent: 'center', alignItems: 'center' }} resizeMode="cover">
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesome5 name="play" size={13} color="#fff" />
                        </View>
                        <View style={{ position: 'absolute', right: 7, bottom: 7, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2 }}>
                          <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>{it.dur ?? '0:30'}</T>
                        </View>
                        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44 }} />
                        <View style={{ position: 'absolute', left: 8, bottom: 7, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <FontAwesome5 name="video" size={8} color="#E8C96A" />
                          <T v="caption" numberOfLines={1} style={{ fontSize: 9.5, fontWeight: '800', color: '#fff' }}>{it.title}</T>
                        </View>
                      </ImageBackground>
                    </View>
                  ) : it.kind === 'post' && it.thumb != null ? (
                    <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder, marginBottom: 7 }}>
                      <Image source={it.thumb} style={{ width: '100%', height: 96 }} resizeMode="cover" />
                      <View style={{ padding: 8 }}>
                        <T v="bodyS" style={{ fontSize: 12, lineHeight: 17, color: d.text }}>{it.title}</T>
                        {it.sub ? <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 4 }}>{it.sub}</T> : null}
                      </View>
                    </View>
                  ) : (it.kind === 'ayah' || it.kind === 'hadith' || it.kind === 'dua') && it.arabic ? (
                    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: it.kind === 'ayah' ? 'rgba(212,175,55,0.45)' : it.kind === 'hadith' ? 'rgba(200,162,200,0.5)' : 'rgba(240,168,192,0.5)', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)', padding: 11, marginBottom: 7, alignItems: 'center' }}>
                      <T v="arabic" style={{ fontSize: 17, lineHeight: 32, textAlign: 'center', color: d.text }}>{it.arabic}</T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                        <View style={{ width: 14, height: 1, backgroundColor: 'rgba(212,175,55,0.5)' }} />
                        <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: it.kind === 'ayah' ? '#B8870B' : d.faint, letterSpacing: 0.4 }}>{it.refLabel ?? it.title}</T>
                        <View style={{ width: 14, height: 1, backgroundColor: 'rgba(212,175,55,0.5)' }} />
                      </View>
                    </View>
                  ) : it.kind === 'profile' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(143,211,182,0.5)', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)', padding: 10, marginBottom: 7 }}>
                      <AvatarImage source={null} name={it.title} size={40} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                      <View style={{ flex: 1 }}>
                        <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: d.text }}>{it.title}</T>
                        <T v="caption" numberOfLines={2} style={{ fontSize: 9, color: d.faint, marginTop: 2 }}>{it.sub}</T>
                      </View>
                      <View style={{ borderRadius: 9, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', paddingHorizontal: 10, paddingVertical: 5 }}>
                        <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>VIEW</T>
                      </View>
                    </View>
                  ) : (
                    <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: d.text }}>{it.title}</T>
                  )}
                  {/* kinds with a rich preview still show the source line */}
                  {(it.kind === 'ayah' || it.kind === 'hadith' || it.kind === 'dua') && it.arabic ? (
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginBottom: 2 }}>{it.title}</T>
                  ) : null}
                  {(it.kind === 'reel' || it.kind === 'post' || it.kind === 'quiz' || it.kind === 'riddle' || it.kind === 'group') ? (
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginBottom: 2 }}>{it.kind === 'reel' ? 'Reel shared from Videos' : it.kind === 'quiz' ? 'Quiz score shared from Islamic Quiz' : it.kind === 'riddle' ? 'Riddle shared from Islamic Riddles' : it.kind === 'group' ? 'Group invite — tap to open and join' : 'Post shared from the community feed'}</T>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{mine ? `you shared · ${it.ago}` : `shared with you · ${it.ago}`}</T>
                    {reaction ? (
                      <PopEmoji emoji={reaction} size={15} />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {peer ? <PopEmoji emoji={peer} size={13} /> : null}
                        <Pressable onPress={() => openFocus(it.id, 'share')} hitSlop={8}>
                          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>React</T>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </Pressable>
                </SwipeReply>
                {mine ? <AvatarImage source={null} name="You" size={28} tint="rgba(212,175,55,0.22)" border="rgba(212,175,55,0.5)" /> : null}
              </SlideIn>
              </Animated.View>
            );
  };

  const renderMsg = (th: Thread, m: ChatMsg) => {
    const mine = m.dir === 'me';
    const reaction = th.reactions[m.id];
    const peer = th.others?.[m.id];
    const isFocus = focus?.id === m.id;
    return (
      /* pass 63 — unfocused rows dim while one is held; the held row stays lit */
      <Animated.View key={m.rk ?? m.id} style={{ opacity: isFocus ? 1 : dim }}>
        <BubbleIn mine={mine} animate={freshIds.current.has(m.id)}>
          <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
            <SwipeReply onReply={() => openReply(m.id)} tint={isDark ? '#4AE38F' : '#1D6F42'} style={{ maxWidth: '76%' }}>
              <Pressable
                ref={(r) => { rowRefs.current[m.id] = r as never; }}
                onLongPress={() => openFocus(m.id, 'msg')}
                delayLongPress={260}
                onPress={() => onTapItem(m.id)}
                style={{
                  borderRadius: 16,
                  borderBottomRightRadius: mine ? 5 : 16,
                  borderBottomLeftRadius: mine ? 16 : 5,
                  backgroundColor: mine ? '#1F8F5C' : d.card,
                  borderWidth: isFocus ? 1.5 : 1,
                  borderColor: isFocus ? '#4AE38F' : mine ? 'transparent' : d.cardBorder,
                  paddingHorizontal: 13,
                  paddingVertical: 9,
                  /* pass 64 — the held bubble pops: bigger, glowing, green ring */
                  ...(isFocus ? { shadowColor: 'rgba(74,227,143,0.5)', shadowOpacity: 0.9, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 16, transform: [{ scale: 1.05 }] } : null),
                }}
              >
                {/* pass 63 — the quoted row when this message is a reply */}
                {m.reply ? (
                  <View style={{ borderLeftWidth: 2.5, borderLeftColor: mine ? 'rgba(255,255,255,0.8)' : '#4AE38F', backgroundColor: mine ? 'rgba(0,0,0,0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.04)'), borderRadius: 4, paddingLeft: 7, paddingRight: 6, paddingVertical: 4, marginBottom: 6 }}>
                    <T v="caption" numberOfLines={1} style={{ fontSize: 9, fontWeight: '800', color: mine ? '#FFFFFF' : (isDark ? '#4AE38F' : '#1D6F42') }}>{m.reply.who}</T>
                    <T v="caption" numberOfLines={2} style={{ fontSize: 10, lineHeight: 14, color: mine ? 'rgba(255,255,255,0.85)' : d.subtext, marginTop: 1 }}>{m.reply.text || 'Message deleted'}</T>
                  </View>
                ) : null}
                {m.deleted ? (
                  <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, fontStyle: 'italic', color: mine ? 'rgba(255,255,255,0.8)' : d.faint }}>Message deleted</T>
                ) : (
                  /* pass 64 — NOT selectable: nothing on the page highlights (the
                   * global user-select:none does the rest). Copy lives in the sheet. */
                  <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: mine ? '#FFFFFF' : d.text }}>{m.text}</T>
                )}
                {/* pass 66-night — messages containing a URL unfold an og-preview card */}
                {!m.deleted && findUrl(m.text) ? <LinkPreviewCard url={findUrl(m.text) as string} dark={mine ? true : isDark} compact /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <T v="caption" style={{ fontSize: 8.5, color: mine ? 'rgba(255,255,255,0.7)' : d.faint }}>{m.ago}</T>
                  {reaction ? <PopEmoji emoji={reaction} size={11} /> : peer ? <PopEmoji emoji={peer} size={11} /> : null}
                  {/* pass 83-14 — owner: single tick until the peer actually
                    * VIEWS it (the old rule flipped ✓✓ the moment the server
                    * acked, because sent ids are prefixed 's'). Now:
                    * ✓ on the server · ✓✓ light-green once they've seen it. */}
                  {mine && !m.deleted ? (
                    <FontAwesome5
                      name={m.readAt ? 'check-double' : 'check'}
                      size={9}
                      color={m.readAt ? '#A7F3D0' : 'rgba(255,255,255,0.6)'}
                    />
                  ) : null}
                </View>
              </Pressable>
            </SwipeReply>
          </View>
        </BubbleIn>
      </Animated.View>
    );
  };

  /* pass 62 — with real timestamps on both sides, shares and messages are
   * interleaved by WHEN they happened instead of every share sitting above every
   * message. Rows with no timestamp (demo seed, or an optimistic card still in
   * flight) sort to the end, so demo order is unchanged. */
  const flow: Array<{ kind: 'share'; it: ShareItem; at: string } | { kind: 'msg'; m: ChatMsg; at: string }> = thread
    ? [
        ...thread.items.map((it) => ({ kind: 'share' as const, it, at: it.at || '9999' })),
        ...thread.chat.map((m) => ({ kind: 'msg' as const, m, at: m.at || '9999' })),
      ].sort((a, b) => a.at.localeCompare(b.at))
    : [];

  /* pass 63 — facts about the focused row: only my own rows can be deleted, and
   * a row that is already deleted has nothing left to delete. */
  const focusRow: ChatMsg | ShareItem | null = !thread || !focus
    ? null
    : focus.kind === 'msg'
      ? thread.chat.find((c) => c.id === focus.id) ?? null
      : thread.items.find((x) => x.id === focus.id) ?? null;
  const focusMine = focusRow?.dir === 'me';
  const deletedRow = !!focusRow?.deleted;
  const focusMsg = focus?.kind === 'msg' ? (focusRow as ChatMsg | null) : null;

  /* pass 64 — where to float the frosted-glass menu so it hugs the held bubble
   * instead of rising from the bottom. Prefer just under it; flip above when it
   * would clip the screen edge. */
  const MENU_W = 250;
  const SCREEN_W = Dimensions.get('window').width;
  const SCREEN_H = Dimensions.get('window').height;
  const glassLine = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(20,36,28,0.08)';
  const menuGlass = {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.7)',
    backgroundColor: isDark ? 'rgba(13,22,18,0.66)' : 'rgba(255,255,255,0.66)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
  };
  const menuGeom = focusPos
    ? (() => {
        const rows = 3 + (focusMine && !deletedRow && focus?.kind === 'msg' ? 1 : 0) + (focusMine && !deletedRow ? 1 : 0);
        const estH = focusMode === 'info' ? 130 : 58 + rows * 45;
        const left = Math.max(10, Math.min(focusPos.x, SCREEN_W - MENU_W - 10));
        let top = focusPos.y + focusPos.h + 10;
        if (top + estH > SCREEN_H - 10) { top = Math.max(10, focusPos.y - estH - 10); }
        return { left, top };
      })()
    : null;

  const body = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: isDark ? '#07100C' : '#F6FAF7' }}>
      {/* header */}
      <View style={{ paddingTop: standalone ? insets.top + 8 : 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)' }}>
        <Pressable onPress={() => (thread ? setOpenFriend(null) : onClose())} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={14} color={d.text} />
        </Pressable>
        {/* pass 58 — the peer's photo with their live presence dot */}
        {thread ? (
          <View>
            <Pressable onPress={() => { /* pass 83-21 — the blocked viewer cannot open the blocker's profile */ if (blockFlags[thread.friend]?.by) { return; } /* pass 83-14 — remember the chat, then HIDE the inbox so the profile doesn't render under it; the community screen reopens this exact thread on focus */ if (!standalone) { storage.setItem('dl_inbox_reopen', thread.friend).catch(() => {}); onNavigateAway?.(); } router.push(`/profile/${thread.friend}` as never); }} hitSlop={6}>
              <AvatarImage source={acc(thread.friend).photo ?? null} name={dispName(thread.friend)} size={38} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
            </Pressable>
            {/* pass 83-23 — no presence dot at all for the blocked viewer */}
            {blockFlags[thread.friend]?.by ? null : (
              <View style={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: isOnline(thread.friend) ? '#2ECC71' : '#E05252', borderWidth: 2, borderColor: d.card }} />
            )}
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable onPress={() => { if (thread) { if (blockFlags[thread.friend]?.by) { return; } /* pass 83-21 */ if (!standalone) { storage.setItem('dl_inbox_reopen', thread.friend).catch(() => {}); onNavigateAway?.(); } router.push(`/profile/${thread.friend}` as never); } }} hitSlop={6}>
            {/* pass 59 — long names truncate with an ellipsis instead of pushing
                the ••• menu off the header */}
            <T v="h2" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>
              {thread ? dispName(thread.friend) : 'Inbox'}
            </T>
            {/* pass 83-11 — the @username/status line is part of the tap target too */}
            <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
              {thread ? (outRequests.has(thread.friend) ? `Message request · 3-message limit until @${thread.friend} accepts` : isOnline(thread.friend) ? 'Online now' : seenMap[thread.friend] ? `Last seen ${lastSeenText(String(seenMap[thread.friend]))}` : `@${thread.friend}`) : 'Reels, posts, duas & ayahs shared with you'}
            </T>
          </Pressable>
        </View>
        {/* pass 83-4 — "IN-APP ONLY" pill removed per owner request */}
        {/* pass 58 — ••• menu → Report / Block */}
        {thread ? (
          <Pressable onPress={() => { haptic.selection(); setMenu((v) => !v); }} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="ellipsis-v" size={12} color={d.text} />
          </Pressable>
        ) : null}
      </View>

      {requestsOpen && !thread ? (
        /* ── pass 74: message requests — accept (they join your chats and you
           follow them), block or report ── */
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Pressable onPress={() => { haptic.selection(); setRequestsOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 11, paddingVertical: 7 }}>
              <FontAwesome5 name="chevron-left" size={11} color={d.text} />
              <T v="caption" style={{ fontWeight: '800', color: d.text }}>Back</T>
            </Pressable>
            <T v="body" style={{ fontWeight: '800', fontSize: 15, color: d.text, marginLeft: 12 }}>Message requests</T>
          </View>
          {Object.keys(reqMap).length === 0 ? (
            <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 36 }}>No pending requests.</T>
          ) : (
            Object.entries(reqMap).map(([uname, r]) => (
              <View key={uname} style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <AvatarImage source={r.photo ?? null} name={r.name || uname} size={44} tint={d.bgSoft} border={d.cardBorder} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="bodyS" numberOfLines={1} style={{ fontWeight: '800', fontSize: 13.5, color: d.text }}>{r.name || uname}</T>
                    <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>@{uname} · wants to message you</T>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 11 }}>
                  <Pressable disabled={reqBusy === uname} onPress={() => void actOnRequest(uname, 'accept')}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, backgroundColor: isDark ? '#4AE38F' : '#1D6F42', paddingVertical: 10, opacity: reqBusy === uname ? 0.6 : 1 }}>
                    {reqBusy === uname ? <ActivityIndicator size="small" color="#062312" /> : <FontAwesome5 name="check" size={11} color="#062312" />}
                    <T v="caption" style={{ fontWeight: '900', fontSize: 11.5, color: '#062312' }}>Accept & follow</T>
                  </Pressable>
                  <Pressable disabled={reqBusy === uname} onPress={() => void actOnRequest(uname, 'block')}
                    style={{ borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
                    <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: d.text }}>Block</T>
                  </Pressable>
                  <Pressable disabled={reqBusy === uname} onPress={() => Alert.alert('Report this account?', 'We will review their messages and account.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Report', style: 'destructive', onPress: () => void actOnRequest(uname, 'report') },
                    ])}
                    style={{ borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,123,123,0.5)', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
                    <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: '#FF7B7B' }}>Report</T>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : !thread ? (
        /* ── friends who shared with you ── */
        <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
          {/* pass 83-11 — search any user to start a chat */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(20,36,28,0.03)', paddingHorizontal: 12, marginBottom: 12 }}>
            <FontAwesome5 name="search" size={11} color={d.faint} />
            <TextInput
              value={searchQ}
              onChangeText={setSearchQ}
              placeholder="Search people to message…"
              placeholderTextColor={d.faint}
              style={{ flex: 1, fontSize: 13, color: d.text, paddingVertical: 10 }}
            />
            {searchQ ? (
              <Pressable onPress={() => setSearchQ('')} hitSlop={8}>
                <FontAwesome5 name="times" size={11} color={d.faint} />
              </Pressable>
            ) : null}
          </View>
          {searchQ.trim().length >= 2 ? (
            searchRes.length === 0 ? (
              <T v="caption" style={{ fontSize: 11, color: d.faint, marginBottom: 12, textAlign: 'center' }}>No one found for "{searchQ.trim()}"</T>
            ) : (
              <View style={{ marginBottom: 12, gap: 8 }}>
                {searchRes.map((sr) => (
                  <Pressable key={sr.username} onPress={() => { haptic.selection(); setSearchQ(''); setOpenFriend(sr.username); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 10 }}>
                    <AvatarImage source={sr.photo ?? null} name={sr.name} size={38} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 12.5, color: d.text }}>{sr.name}</T>
                      <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint }}>@{sr.username}</T>
                    </View>
                    <FontAwesome5 name="comment" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                  </Pressable>
                ))}
              </View>
            )
          ) : null}
          {/* pass 74 — message requests shelf */}
          {Object.keys(reqMap).length > 0 ? (
            <Pressable onPress={() => { haptic.selection(); setRequestsOpen(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)', padding: 13, marginBottom: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(212,175,55,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="user-clock" size={15} color="#B8870B" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 13.5, color: d.text }}>Message requests</T>
                <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>{Object.keys(reqMap).length} person{Object.keys(reqMap).length > 1 ? 's' : ''} waiting · tap to review</T>
              </View>
              <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
            </Pressable>
          ) : null}
          {threads.filter((t) => !hiddenConvs.has(t.friend)).map((t) => {
            const a = acc(t.friend);
            /* pass 83-14 — unread = what the SERVER says I haven't seen (was: every message they ever sent) */
            const unread = unreadMap[t.friend] ?? 0;
            return (
              <Pressable
                key={t.friend}
                onPress={() => {
                  haptic.selection();
                  setOpenFriend(t.friend);
                  setUnreadMap((prev) => (prev[t.friend] ? { ...prev, [t.friend]: 0 } : prev));
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.18)' : 'rgba(29,111,66,0.12)', backgroundColor: isDark ? 'rgba(18,34,25,0.6)' : 'rgba(255,255,255,0.7)', padding: 12, marginBottom: 10, opacity: pressed ? 0.8 : 1, shadowColor: '#000', shadowOpacity: isDark ? 0.2 : 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 3 } })}
              >
                <AvatarImage source={a.photo ?? null} name={a.full_name} size={46} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, color: d.text, flexShrink: 1 }}>{dispName(t.friend)}</T>
                    {/* pass 83-21 — blocked accounts stay listed, with a badge */}
                    {t.blocked ? (
                      <View style={{ borderRadius: 7, borderWidth: 1, borderColor: 'rgba(224,82,82,0.55)', backgroundColor: 'rgba(224,82,82,0.12)', paddingHorizontal: 6, paddingVertical: 1 }}>
                        <T v="caption" style={{ color: '#E05252', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.3 }}>BLOCKED</T>
                      </View>
                    ) : null}
                  </View>
                  <T v="caption" numberOfLines={1} style={{ color: d.faint, fontSize: 10.5, marginTop: 2 }}>
                    {t.chat.length ? t.chat[t.chat.length - 1].text : `shared ${t.items.length} item${t.items.length > 1 ? 's' : ''} with you`}
                  </T>
                </View>
                {/* pass 83-11 — unread count moved OFF the avatar to the right edge */}
                {unread > 0 ? (
                  <View style={{ minWidth: 21, height: 21, borderRadius: 11, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                    <T v="caption" style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{unread}</T>
                  </View>
                ) : null}
                <FontAwesome5 name="chevron-right" size={12} color={d.faint} />
              </Pressable>
            );
          })}
          {/* pass 83-4 — honest empty state (a bare header looked "blank") */}
          {threads.filter((t) => !hiddenConvs.has(t.friend)).length === 0 && Object.keys(reqMap).length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? 'rgba(74,227,143,0.12)' : 'rgba(29,111,66,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <FontAwesome5 name="comments" size={24} color={isDark ? '#4AE38F' : '#1D6F42'} />
              </View>
              <T v="body" style={{ fontWeight: '800', fontSize: 14, color: d.text }}>No messages yet</T>
              <T v="caption" style={{ color: d.faint, fontSize: 11.5, marginTop: 6, textAlign: 'center', lineHeight: 17 }}>
                Open someone's profile and tap Message to start a chat. Until they accept, your chat waits in their Message requests.
              </T>
              {sugg.length > 0 ? (
                <View style={{ marginTop: 22, alignSelf: 'stretch' }}>
                  <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, color: d.faint, marginBottom: 8, textAlign: 'center' }}>YOU FOLLOW EACH OTHER — SAY SALAM</T>
                  {sugg.map((sg) => (
                    <Pressable
                      key={sg.username}
                      onPress={() => { haptic.selection(); setOpenFriend(sg.username); }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 10, marginBottom: 8, opacity: pressed ? 0.8 : 1 })}
                    >
                      <AvatarImage source={sg.photo ?? null} name={sg.name} size={38} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, color: d.text }}>{sg.name}</T>
                        <T v="caption" numberOfLines={1} style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>@{sg.username}</T>
                      </View>
                      <View style={{ borderRadius: 9, backgroundColor: isDark ? '#1D6F42' : '#2ECC71', paddingHorizontal: 12, paddingVertical: 7 }}>
                        <T v="caption" style={{ color: '#fff', fontWeight: '800', fontSize: 10.5 }}>Message</T>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        {/* pass 83-11 — floating + → pick a mutual follow and start a DM */}
        <Pressable onPress={() => { haptic.medium(); setNewDmOpen(true); }}
          style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: 18, width: 54, height: 54, borderRadius: 27, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1, elevation: 7, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } })}>
          <FontAwesome5 name="plus" size={18} color="#FFFFFF" />
        </Pressable>
        <Modal visible={newDmOpen} transparent animationType="fade" onRequestClose={() => setNewDmOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setNewDmOpen(false)}>
            <Pressable onPress={() => {}} style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28, maxHeight: '72%' }}>
              <T v="body" style={{ fontWeight: '800', fontSize: 15, color: d.text }}>New message</T>
              <T v="caption" style={{ fontSize: 11, color: d.faint, marginTop: 2, marginBottom: 12 }}>Pick a mutual follow — or search above for anyone.</T>
              <ScrollView showsVerticalScrollIndicator={false}>
                {sugg.length === 0 ? (
                  <T v="bodyS" style={{ fontSize: 12, color: d.faint, textAlign: 'center', paddingVertical: 22 }}>No mutual follows yet — follow someone and they'll appear here.</T>
                ) : sugg.map((sg) => (
                  <Pressable key={sg.username} onPress={() => { haptic.selection(); setNewDmOpen(false); setOpenFriend(sg.username); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, padding: 10, marginBottom: 8 }}>
                    <AvatarImage source={sg.photo ?? null} name={sg.name} size={40} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, color: d.text }}>{sg.name}</T>
                      <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint }}>@{sg.username}</T>
                    </View>
                    <FontAwesome5 name="comment" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
        </View>
      ) : (
        /* ── thread: shares + chat + composer ── */
        <ScrollView
          ref={scroller}
          testID="chat-thread-list"
          contentContainerStyle={{ padding: 14, paddingBottom: 26, gap: 12 }}
          showsVerticalScrollIndicator={false}
          onScroll={onThreadScroll}
          scrollEventThrottle={48}
        >
          {histLoading && flow.length === 0 ? <BreathingMessages dark={isDark} /> : null}
          {flow.map((row) => (row.kind === 'share' ? renderShare(thread, row.it) : renderMsg(thread, row.m)))}

          {/* pass 83-23 — WhatsApp-style system rows for block / unblock */}
          {thread.blocked ? (
            <View style={{ alignSelf: 'center', marginVertical: 10, borderRadius: 12, backgroundColor: isDark ? 'rgba(224,82,82,0.12)' : 'rgba(224,82,82,0.08)', borderWidth: 1, borderColor: 'rgba(224,82,82,0.35)', paddingHorizontal: 13, paddingVertical: 6 }}>
              <T v="caption" style={{ color: '#E05252', fontSize: 10.5, fontWeight: '700', textAlign: 'center' }}>You blocked this chat</T>
            </View>
          ) : null}
          {unblockedFlash === thread.friend ? (
            <View style={{ alignSelf: 'center', marginVertical: 10, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.3)', paddingHorizontal: 13, paddingVertical: 6 }}>
              <T v="caption" style={{ color: isDark ? '#4AE38F' : '#0E7A46', fontSize: 10.5, fontWeight: '700', textAlign: 'center' }}>You unblocked this chat</T>
            </View>
          ) : null}

          {/* pass 68 — the peer is typing right now (server flag, ≤3s stale) */}
          {peerTyping ? (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 15, paddingVertical: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(20,36,28,0.06)' }}>
                <TypingDot delay={0} color={isDark ? '#4AE38F' : '#1D6F42'} />
                <TypingDot delay={170} color={isDark ? '#4AE38F' : '#1D6F42'} />
                <TypingDot delay={340} color={isDark ? '#4AE38F' : '#1D6F42'} />
              </View>
            </View>
          ) : null}

          <T v="caption" style={{ color: d.faint, textAlign: 'center', fontSize: 9, fontStyle: 'italic' }}>Double-tap to react · shares are in-app content only</T>
        </ScrollView>
      )}

      {/* pass 66 — jump to latest. Floating over the list, above the composer
       * (whose real height we measure, so the chip never hides the field). */}
      {thread && !atBottom ? (
        <Animated.View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: composerH + 12, alignItems: 'center', zIndex: 30, opacity: fabIn }}
        >
          <Pressable
            onPress={() => { smoothScrollBottom(); setAtBottom(true); }}
            accessibilityLabel="Jump to latest message"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.25)', backgroundColor: isDark ? 'rgba(18,34,25,0.94)' : 'rgba(255,255,255,0.96)', paddingHorizontal: 13, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 }}
          >
            <FontAwesome5 name="chevron-down" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Latest</T>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* composer — chat back + quick in-app shares */}
      {thread ? (
        <View
          onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}
          style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: kbOpen ? 8 : Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', backgroundColor: isDark ? '#07100C' : '#F6FAF7', gap: 8 }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {([
              ['ayah', 'book-open', 'Share ayah'],
              ['hadith', 'scroll', 'Share hadith'],
              ['dua', 'hands-helping', 'Share dua'],
              ['post', 'file-alt', 'Share post'],
              ['reel', 'video', 'Share reel'],
              ['profile', 'user-circle', 'Share profile'],
            ] as Array<[Kind, string, string]>).map(([k, ic, label]) => (
              <Pressable
                key={k}
                onPress={() => shareBack(k, k === 'ayah' ? 'Surah Al-Kahf · Ayah 10' : k === 'hadith' ? 'Muslim 2568 — visit the sick' : k === 'dua' ? 'Dua for guidance' : k === 'post' ? 'A post you might love' : k === 'profile' ? 'Profile — Ustādh Ibrāhīm' : 'A reel worth watching')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <FontAwesome5 name={ic as never} size={9} color={KIND_META[k].tint} />
                <T v="caption" style={{ fontSize: 9.5, fontWeight: '700', color: d.subtext }}>{label}</T>
              </Pressable>
            ))}
          </ScrollView>
          {/* pass 63 — the quote you are replying to, with a way to cancel it */}
          {replyTo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 11, paddingVertical: 7 }}>
              <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: '#4AE38F' }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="caption" numberOfLines={1} style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Replying to {replyTo.who}</T>
                <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.subtext, marginTop: 1 }}>{replyTo.text}</T>
              </View>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <FontAwesome5 name="times" size={12} color={d.faint} />
              </Pressable>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13 }}>
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder="Type something…"
                placeholderTextColor={d.faint}
                returnKeyType="send"
                onSubmitEditing={sendChat}
                style={{ flex: 1, paddingVertical: 10, fontSize: 16, color: d.text, fontFamily: 'Manrope' }}
              />
            </View>
            <Pressable onPress={sendChat} accessibilityLabel="send message" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="paper-plane" size={13} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* pass 58 — ••• dropdown */}
      {menu && thread ? (
        <>
          <Pressable style={{ position: 'absolute', inset: 0, zIndex: 40 }} onPress={() => setMenu(false)} />
          <View style={{ position: 'absolute', top: (standalone ? insets.top + 8 : 0) + 52, right: 14, zIndex: 50, width: 196, borderRadius: 14, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, paddingVertical: 6, elevation: 8, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
            {([{ k: 'report', label: reported ? 'Reported ✓' : 'Report', icon: 'flag', color: d.text },
               /* pass 83-14 — unblock right here; settings used to be the only way out */
               { k: 'block', label: (blocked ? 'Unblock ' : 'Block ') + acc(thread.friend).full_name, icon: blocked ? 'unlock' : 'user-slash', color: blocked ? (isDark ? '#4AE38F' : '#0E7A46') : '#E05252' }] as const).map((it2) => (
              <Pressable key={it2.k} onPress={() => {
                haptic.light(); setMenu(false);
                if (it2.k === 'report') { setReportOpen(true); return; }
                if (blocked) {
                  const who = thread.friend;
                  void blockUser(who, false).then((ok) => {
                    if (ok) {
                      setBlocked(false);
                      setBlockFlags((prev) => ({ ...prev, [who]: { b: false, by: prev[who]?.by ?? false } }));
                      setThreads((prev) => prev.map((t) => (t.friend === who ? { ...t, blocked: false } : t)));
                      setUnblockedFlash(who); /* pass 83-23 */
                      Alert.alert('Unblocked', `You can message @${who} again.`);
                    }
                    else { Alert.alert('Could not unblock', 'Please try again in a moment.'); }
                  });
                  return;
                }
                setBlockOpen(true);
              }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}>
                <FontAwesome5 name={it2.icon as any} size={11} color={it2.color} />
                <T v="bodyS" numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: it2.color, flexShrink: 1 }}>{it2.label}</T>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {/* pass 58 — report sheet: same reasons + description as the post report */}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setReportOpen(false)}>
          <Pressable style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 20) }} onPress={() => {}}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: d.cardBorder, alignSelf: 'center', marginBottom: 14 }} />
            <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>{thread ? `Report ${acc(thread.friend).full_name}` : 'Report'}</T>
            <T v="caption" style={{ color: d.faint, marginTop: 3, marginBottom: 14 }}>Why are you reporting this conversation?</T>
            {REPORT_TYPES.map((r) => {
              const on = reportType === r.id;
              return (
                <Pressable key={r.id} onPress={() => { setReportType(r.id); haptic.selection(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 13, borderWidth: 1.5, borderColor: on ? '#E05252' : d.cardBorder, backgroundColor: on ? 'rgba(224,82,82,0.1)' : d.bg, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 8 }}>
                  <FontAwesome5 name={r.icon} size={12} color={on ? '#E05252' : d.faint} />
                  <T v="bodyS" style={{ flex: 1, fontSize: 13, fontWeight: on ? '800' : '600', color: on ? '#E05252' : d.text }}>{r.label}</T>
                  {on ? <FontAwesome5 name="check-circle" size={13} color="#E05252" /> : null}
                </Pressable>
              );
            })}
            <TextInput value={reportDesc} onChangeText={setReportDesc} multiline placeholder="Add details (optional)…" placeholderTextColor={d.faint}
              style={{ borderRadius: 13, borderWidth: 1.5, borderColor: d.cardBorder, backgroundColor: d.bg, color: d.text, fontSize: 13, paddingHorizontal: 13, paddingVertical: 11, minHeight: 76, textAlignVertical: 'top', marginTop: 4, fontFamily: 'Poppins-Regular' }} />
            <Pressable onPress={() => {
              haptic.success();
              const who = thread?.friend;
              const pid = who ? peerMap[who]?.id : undefined;
              const label = REPORT_TYPES.find((r) => r.id === reportType)?.label ?? 'Report';
              if (live && pid) {
                void reportAccount(pid, reportDesc.trim() ? `${label}: ${reportDesc.trim()}` : label);
              }
              setReportOpen(false); setReportType(null); setReportDesc(''); setReported(true);
            }} disabled={!reportType}
              style={{ marginTop: 14, borderRadius: 14, backgroundColor: reportType ? '#E05252' : d.cardBorder, paddingVertical: 14, alignItems: 'center', opacity: reportType ? 1 : 0.6 }}>
              <T v="bodyS" style={{ fontWeight: '800', fontSize: 14, color: reportType ? '#fff' : d.faint }}>Submit report</T>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* pass 58 — block confirm */}
      <Modal visible={blockOpen} transparent animationType="fade" onRequestClose={() => setBlockOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
          <View style={{ width: '100%', borderRadius: 20, backgroundColor: d.card, padding: 20, alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(224,82,82,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <FontAwesome5 name="user-slash" size={16} color="#E05252" />
            </View>
            <T v="h2" style={{ fontWeight: '800', fontSize: 16, color: d.text, textAlign: 'center' }}>{thread ? `Block ${acc(thread.friend).full_name}?` : 'Block?'}</T>
            <T v="caption" style={{ color: d.faint, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>They will not be able to message you, and this conversation will be hidden from your inbox.</T>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' }}>
              <Pressable onPress={() => setBlockOpen(false)} style={{ flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: d.cardBorder, paddingVertical: 12, alignItems: 'center' }}>
                <T v="bodyS" style={{ fontWeight: '700', fontSize: 13, color: d.text }}>Cancel</T>
              </Pressable>
              <Pressable onPress={() => {
                haptic.medium();
                const who = thread?.friend;
                if (live && who) {
                  void blockUser(who, true).then((ok) => {
                    if (!ok) { Alert.alert('Could not block', 'Please try again in a moment.'); return; }
                    /* pass 83-21 — the thread STAYS in the list with a Blocked
                     * badge (it used to vanish, owner report). */
                    setBlockFlags((prev) => ({ ...prev, [who]: { b: true, by: false } }));
                    setThreads((prev) => prev.map((t) => (t.friend === who ? { ...t, blocked: true } : t)));
                    setOpenFriend(null);
                  });
                }
                setBlockOpen(false); setBlocked(true);
              }} style={{ flex: 1, borderRadius: 13, backgroundColor: '#E05252', paddingVertical: 12, alignItems: 'center' }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: '#fff' }}>Block</T>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* pass 63 — press and hold: everything else dims, the held row stays lit,
          and a WhatsApp-style sheet offers a reaction strip plus
          Reply / Forward / Copy / Delete. (Delete only shows on your own rows —
          the server refuses to delete anyone else's.) */}
      {focus ? (
        <>
          {/* pass 64 — transparent catcher: any tap outside dismisses, and it adds
              NO colour, so the held bubble is never covered. The other rows dim
              through `dim`, which makes the held one stand out. */}
          <Pressable style={{ position: 'absolute', inset: 0, zIndex: 60 }} onPress={closeFocus} />
          {menuGeom ? (
            <View style={{ position: 'absolute', zIndex: 70, left: menuGeom.left, top: menuGeom.top, width: MENU_W }}>
              <SheetIn>
                {/* frosted-glass card hugging the bubble */}
                <View style={menuGlass as never}>
                  {focusMode === 'menu' ? (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: glassLine }}>
                        {EMOJIS.map((e, i) => (
                          <PickerEmoji key={e} emoji={e} delay={i * 40} onPress={() => react(focus.id, e)} />
                        ))}
                      </View>
                      <MenuRow first icon="reply" label="Reply" color={d.text} line={glassLine} onPress={() => openReply(focus.id)} />
                      <MenuRow icon="share" label="Forward" color={d.text} line={glassLine} onPress={() => startForward(focus.id, focus.kind)} />
                      <MenuRow icon={copied ? 'check' : 'copy'} label={copied ? 'Copied ✓' : 'Copy'} color={copied ? '#4AE38F' : d.text} line={glassLine} onPress={() => copyRow(focus.id)} />
                      {focusMine && !deletedRow && focus.kind === 'msg' ? (
                        <MenuRow icon="info-circle" label="Info" color={d.text} line={glassLine} onPress={() => setFocusMode('info')} />
                      ) : null}
                      {focusMine && !deletedRow ? (
                        <MenuRow icon="trash" label="Delete" color="#E05252" line={glassLine} onPress={() => deleteRow(focus.id, focus.kind)} />
                      ) : null}
                    </>
                  ) : (
                    /* pass 64 — Info: when my message was delivered and seen */
                    <View style={{ paddingVertical: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
                        <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700', color: d.text }}>Message info</T>
                        <Pressable onPress={() => setFocusMode('menu')} hitSlop={8}><FontAwesome5 name="chevron-left" size={12} color={d.faint} /></Pressable>
                      </View>
                      <View style={{ height: 1, backgroundColor: glassLine, marginHorizontal: 12 }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
                        <FontAwesome5 name="check" size={12} color="#4AE38F" />
                        <T v="bodyS" style={{ flex: 1, fontSize: 12.5, color: d.text }}>Delivered</T>
                        <T v="caption" style={{ fontSize: 11, color: d.faint }}>{(focusMsg?.createdAt || '').slice(11, 16) || '—'}</T>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
                        <FontAwesome5 name="check-double" size={12} color={focusMsg?.readAt ? '#4AE38F' : d.faint} />
                        <T v="bodyS" style={{ flex: 1, fontSize: 12.5, color: d.text }}>{focusMsg?.readAt ? 'Seen' : 'Not seen yet'}</T>
                        <T v="caption" style={{ fontSize: 11, color: d.faint }}>{focusMsg?.readAt ? String(focusMsg.readAt).slice(11, 16) : ''}</T>
                      </View>
                    </View>
                  )}
                </View>
              </SheetIn>
            </View>
          ) : null}
        </>
      ) : null}

      {/* pass 64 — forward is now a full screen: tick as many people as you like,
          then send to all of them in one tap. */}
      <Modal visible={!!forward} transparent animationType="slide" onRequestClose={() => setForward(null)}>
        <View style={{ flex: 1, backgroundColor: isDark ? '#07100C' : '#F6FAF7', paddingTop: insets.top + 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10 }}>
            <Pressable onPress={() => setForward(null)} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="times" size={13} color={d.text} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="h2" numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: d.text }}>Forward message</T>
              <T v="caption" numberOfLines={1} style={{ fontSize: 10, color: d.faint }}>{forwardPicked.size} selected</T>
            </View>
          </View>
          <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint, paddingHorizontal: 16, paddingBottom: 6 }}>“{forward?.text}”</T>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 92 }}>
            {MOCK_ACCOUNTS.map((a) => {
              const on = forwardPicked.has(a.username);
              return (
                <Pressable
                  key={a.username}
                  onPress={() => { haptic.selection(); setForwardPicked((p) => { const n = new Set(p); if (n.has(a.username)) n.delete(a.username); else n.add(a.username); return n; }); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 13 }}
                >
                  <AvatarImage source={a.photo ?? null} name={a.full_name} size={38} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="bodyS" numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: d.text }}>{a.full_name}</T>
                    <T v="caption" numberOfLines={1} style={{ fontSize: 10, color: d.faint }}>@{a.username}</T>
                  </View>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: on ? '#1F8F5C' : d.cardBorder, backgroundColor: on ? '#1F8F5C' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <FontAwesome5 name="check" size={10} color="#fff" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: isDark ? 'rgba(7,16,12,0.92)' : 'rgba(246,250,247,0.92)', borderTopWidth: 1, borderTopColor: d.cardBorder }}>
            <Pressable disabled={!forwardPicked.size} onPress={() => doForwardMany([...forwardPicked])} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: forwardPicked.size ? '#1F8F5C' : d.cardBorder, paddingVertical: 13, opacity: forwardPicked.size ? 1 : 0.5 }}>
              <FontAwesome5 name="share" size={12} color="#fff" />
              <T v="bodyS" style={{ fontSize: 13.5, fontWeight: '800', color: '#fff' }}>Forward{forwardPicked.size ? ` to ${forwardPicked.size}` : ''}</T>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );

  if (standalone) return visible ? body : null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => (thread ? setOpenFriend(null) : onClose())}>
      {body}
    </Modal>
  );
}
