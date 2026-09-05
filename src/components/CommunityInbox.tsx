import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, ImageBackground, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, ScrollView, TextInput, UIManager, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { MOCK_ACCOUNTS } from '@/api/mocks';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
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
type Kind = 'post' | 'reel' | 'ayah' | 'hadith' | 'dua' | 'profile';
type ShareItem = {
  id: string;
  kind: Kind;
  title: string;
  ago: string;
  dir: 'them' | 'me';
  /* pass 31/32 previews */
  thumb?: number;      /* reel/post preview image */
  dur?: string;        /* reel duration chip */
  arabic?: string;     /* ayah/hadith/dua arabic text */
  refLabel?: string;   /* citation under arabic */
  sub?: string;        /* post caption / profile handle */
  /* pass 62 — server timestamp "YYYY-MM-DD HH:MM:SS"; '' until the server
   * confirms, which also sorts an optimistic card to the bottom. */
  at?: string;
};
type ChatMsg = { id: string; text: string; ago: string; dir: 'them' | 'me'; at?: string };
/* pass 62 — `reactions` are MY emoji per target; `others` is the newest emoji
 * somebody else left, so I can see their reaction and still add my own. */
type Thread = { friend: string; items: ShareItem[]; chat: ChatMsg[]; reactions: Record<string, string>; others?: Record<string, string> };

const KIND_META: Record<Kind, { icon: string; label: string; tint: string }> = {
  post: { icon: 'file-alt', label: 'Post', tint: '#5BC8F5' },
  reel: { icon: 'video', label: 'Reel', tint: '#E8C96A' },
  ayah: { icon: 'book-open', label: 'Ayah', tint: '#4AE38F' },
  hadith: { icon: 'scroll', label: 'Hadith', tint: '#C8A2C8' },
  dua: { icon: 'hands-helping', label: 'Dua', tint: '#F0A8C0' },
  profile: { icon: 'user-circle', label: 'Profile', tint: '#8FD3B6' },
};

const ago = () => 'now';
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

const STORE = 'dl.inbox.v2';

/* pass 58 — real presence/last-seen from the API, and the same six report
 * reasons the post report sheet uses (src/components/FeedCard.tsx). */
import { chatConversations, chatPresence, chatReact, chatRead, chatSend, chatSendShare, chatStartDMByUsername, chatThread, isLive } from '@/api/client';
import { useAuth } from '@/context/AuthContext';

if (Platform.OS === 'android') { UIManager.setLayoutAnimationEnabledExperimental?.(true); }

/**
 * pass 61 — a reaction emoji that animates ON MOUNT, with its own value.
 *
 * It used to share one `pop` Animated.Value with every other reaction, and
 * `popIn()` ran before the new row was mounted — so the spring finished before
 * the node existed. The emoji attached at scale 0.3 and opacity 0.4 (tiny and
 * washed-out) and only "popped" when the NEXT reaction re-ran the animation.
 */
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

const REPORT_TYPES: Array<{ id: string; label: string; icon: any }> = [
  { id: 'spam', label: 'Spam or scam', icon: 'ban' },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'user-slash' },
  { id: 'hate', label: 'Hate speech', icon: 'fire' },
  { id: 'danger', label: 'Dangerous content', icon: 'exclamation-triangle' },
  { id: 'misleading', label: 'Misleading content', icon: 'question-circle' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'shield-alt' },
];

export function CommunityInbox({ visible, onClose, standalone = false, initialFriend = null }: { visible: boolean; onClose: () => void; standalone?: boolean; initialFriend?: string | null }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isDemo } = useAuth();
  /* pass 60 — ONE chat interface, two modes: real API on the live site,
   * bundled demo threads on gh-pages where there is no backend. */
  const live = isLive() && !!user && !isDemo;
  const [convIds, setConvIds] = useState<Record<string, number>>({});
  const [threads, setThreads] = useState<Thread[]>(SEED);
  const [openFriend, setOpenFriend] = useState<string | null>(initialFriend);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /* pass 58 — presence from the real API + the ••• menu, report sheet and block */
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<string | null>(null);
  const [reportDesc, setReportDesc] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reported, setReported] = useState(false);
  const freshIds = useRef<Set<string>>(new Set());
  const lastTap = useRef<{ id: string; t: number }>({ id: '', t: 0 });
  const pop = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ScrollView>(null);

  /* restore persisted chats */
  useEffect(() => {
    storage.getItem(STORE).then((r) => {
      if (r)
        try {
          setThreads(JSON.parse(r));
        } catch {}
    });
  }, []);
  const persist = (next: Thread[]) => {
    setThreads(next);
    storage.setItem(STORE, JSON.stringify(next)).catch(() => {});
  };

  const popIn = () => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: false, friction: 4, tension: 70 }).start();
  };
  const onTapItem = (id: string) => {
    const now = Date.now();
    const dbl = lastTap.current.id === id && now - lastTap.current.t < 320;
    lastTap.current = { id, t: now };
    if (dbl) {
      haptic.light();
      setEmojiFor(id);
    }
  };

  const thread = threads.find((t) => t.friend === openFriend) ?? null;
  /* pass 59 — the draft is PER CONVERSATION. It used to be one shared string, so
   * text typed in chat A was still sitting in the box when you opened chat B. */
  const draft = thread ? (drafts[thread.friend] ?? '') : '';
  const setDraft = (v: string) => { if (thread) { const f = thread.friend; setDrafts((m) => ({ ...m, [f]: v })); } };
  const acc = (u: string) => MOCK_ACCOUNTS.find((a) => a.username === u) ?? MOCK_ACCOUNTS[0];

  /** pass 62 — a client row id → its server target. `s12` is message 12, `h7` is
   *  share 7. Demo/failed rows have no server id and keep reacting locally. */
  const targetOf = (id: string): { kind: 'msg' | 'share'; id: number } | null => {
    const m = /^([sh])(\d+)$/.exec(id);
    if (!m) { return null; }
    return { kind: m[1] === 'h' ? 'share' : 'msg', id: parseInt(m[2], 10) };
  };

  /** pass 62 — conversation id for a username, creating the DM when needed. */
  const resolveCid = async (who: string): Promise<number | null> => {
    const known = convIds[who];
    if (known) { return known; }
    const made = await chatStartDMByUsername(who).catch(() => null);
    if (made) { setConvIds((m) => ({ ...m, [who]: made })); }
    return made;
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
    setEmojiFor(null);
    popIn();
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

  /* pass 58 — heartbeat + pull each peer's last_seen, keyed by username */
  useEffect(() => {
    chatPresence().catch(() => {});
    const pull = () => chatConversations().then((cs) => {
      if (!cs) { return; }
      const m: Record<string, string> = {};
      const ids: Record<string, number> = {};
      cs.forEach((c) => {
        const u = c.with_username || c.peer?.username;
        if (!u) { return; }
        ids[u] = c.id;
        if (c.peer_seen) { m[u] = String(c.peer_seen); }
      });
      setSeenMap(m);
      setConvIds(ids);
      /* live conversations become threads; demo threads stay so shares still work */
      if (live) {
        setThreads((prev) => {
          const have = new Set(prev.map((t) => t.friend));
          const add: Thread[] = Object.keys(ids).filter((u) => !have.has(u)).map((u) => ({ friend: u, items: [], chat: [], reactions: {} }));
          return add.length ? [...add, ...prev] : prev;
        });
      }
    }).catch(() => {});
    pull();
    const iv = setInterval(() => { chatPresence().catch(() => {}); pull(); }, 60000);
    return () => clearInterval(iv);
  }, [live]);

  /* pass 60/62 — opening a live thread pulls the real history (messages + shares
   * + every reaction on them) in ONE call and marks it read. */
  useEffect(() => {
    if (!live || !openFriend) { return; }
    const cid = convIds[openFriend];
    if (!cid) { return; }
    chatThread(cid).then((data) => {
      if (!data) { return; }
      const chat: ChatMsg[] = data.messages.map((m) => ({
        id: `s${m.id}`, text: m.body, ago: (m.created_at || '').slice(11, 16),
        dir: m.sender_id === user?.id ? 'me' as const : 'them' as const,
        at: m.created_at || '',
      }));
      /* server shares replace the bundled demo cards for this person */
      const items: ShareItem[] = data.shares.map((s) => ({
        id: `h${s.id}`,
        kind: (Object.keys(KIND_META) as Kind[]).includes(s.kind as Kind) ? (s.kind as Kind) : ('post' as Kind),
        title: s.title,
        ago: (s.created_at || '').slice(11, 16),
        dir: s.sender_id === user?.id ? 'me' as const : 'them' as const,
        at: s.created_at || '',
        arabic: s.payload?.arabic,
        refLabel: s.payload?.refLabel,
        sub: s.payload?.sub,
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
      setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 60);
    }).catch(() => {});
    chatRead(cid).catch(() => {});
  }, [live, openFriend, convIds, user?.id]);

  const isOnline = useCallback((u: string | null | undefined) => {
    if (!u) { return false; }
    const t = seenMap[u];
    return !!t && (Date.now() - new Date(t.replace(' ', 'T')).getTime()) < 5 * 60 * 1000;
  }, [seenMap]);

  const sendChat = () => {
    const text = draft.trim();
    if (!text || !thread) return;
    haptic.light();
    /* pass 58 — the new row is registered as fresh so it springs in, and the
     * rest of the list eases out of the way instead of snapping. */
    const id = uid();
    freshIds.current.add(id);
    LayoutAnimation.configureNext({ duration: 220, update: { type: LayoutAnimation.Types.easeInEaseOut } });
    const chat = [...thread.chat, { id, text, ago: ago(), dir: 'me' as const, at: '' }];
    persist(threads.map((t) => (t.friend === thread.friend ? { ...t, chat } : t)));
    setDrafts((m) => ({ ...m, [thread.friend]: '' }));
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);

    /* pass 60 — the bubble is already on screen; now make it real. If there is no
     * conversation with this person yet (e.g. you tapped Message on their
     * profile), one is created by username and reused next time. */
    if (live) {
      const who = thread.friend;
      void (async () => {
        const cid = await resolveCid(who);
        if (!cid) { markFailed(who, id); return; }
        const sent = await chatSend(cid, text).catch(() => null);
        if (!sent) { markFailed(who, id); return; }
        setThreads((prev) => prev.map((t) => (t.friend === who
          ? { ...t, chat: t.chat.map((c) => (c.id === id ? { ...c, id: `s${sent.id}`, at: sent.created_at || c.at } : c)) }
          : t)));
        freshIds.current.delete(id);
        freshIds.current.add(`s${sent.id}`);
      })();
    }
  };

  /** Flag a bubble that never reached the server instead of letting it lie. */
  const markFailed = (who: string, id: string) => {
    setThreads((prev) => prev.map((t) => (t.friend === who
      ? { ...t, chat: t.chat.map((c) => (c.id === id ? { ...c, text: `${c.text}  ⚠ not sent` } : c)) }
      : t)));
  };

  const shareBack = (kind: Kind, title: string, payload?: Record<string, unknown>) => {
    if (!thread) return;
    haptic.selection();
    const id = uid();
    freshIds.current.add(id);
    const items = [...thread.items, { id, kind, title, ago: ago(), dir: 'me' as const, at: '' }];
    persist(threads.map((t) => (t.friend === thread.friend ? { ...t, items } : t)));
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);

    /* pass 62 — shares are server-backed too, so the other person receives the
     * card (and can react to it) instead of it living only on my device. */
    if (live) {
      const who = thread.friend;
      void (async () => {
        const cid = await resolveCid(who);
        if (!cid) { markShareFailed(who, id); return; }
        const made = await chatSendShare(cid, kind, title, payload).catch(() => null);
        if (!made) { markShareFailed(who, id); return; }
        setThreads((prev) => prev.map((t) => (t.friend === who
          ? { ...t, items: t.items.map((x) => (x.id === id ? { ...x, id: `h${made.id}`, at: made.created_at || x.at } : x)) }
          : t)));
        freshIds.current.delete(id);
        freshIds.current.add(`h${made.id}`);
      })();
    }
  };

  /** Flag a share card that never reached the server. */
  const markShareFailed = (who: string, id: string) => {
    setThreads((prev) => prev.map((t) => (t.friend === who
      ? { ...t, items: t.items.map((x) => (x.id === id ? { ...x, title: `${x.title}  ⚠ not sent` } : x)) }
      : t)));
  };

  const renderShare = (th: Thread, it: ShareItem) => {

            const meta = KIND_META[it.kind];
            const mine = it.dir === 'me';
            const reaction = th.reactions[it.id];
            /* pass 62 — their reaction, so I can see it and still add my own */
            const peer = th.others?.[it.id];
            return (
              <SlideIn key={it.id} animate={freshIds.current.has(it.id)} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
                {!mine ? <AvatarImage source={acc(th.friend).photo ?? null} name={acc(th.friend).full_name} size={28} tint="rgba(46,204,113,0.2)" border={d.cardBorder} /> : null}
                <Pressable
                  onPress={() => onTapItem(it.id)}
                  style={({ pressed }) => ({
                    maxWidth: '76%',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: mine ? 'rgba(74,227,143,0.45)' : d.cardBorder,
                    backgroundColor: mine ? 'rgba(31,143,92,0.12)' : d.card,
                    padding: 11,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <FontAwesome5 name={meta.icon as never} size={10} color={meta.tint} />
                    <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: meta.tint, letterSpacing: 0.4 }}>{meta.label.toUpperCase()}</T>
                    <View style={{ flex: 1 }} />
                    <FontAwesome5 name={mine ? 'share' : 'share-alt'} size={8} color={d.faint} />
                  </View>

                  {/* pass 32: each sharable type previews the way it really looks */}
                  {it.kind === 'reel' && it.thumb != null ? (
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
                      <AvatarImage source={null} name="UI" size={40} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                      <View style={{ flex: 1 }}>
                        <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: d.text }}>Ustādh Ibrāhīm</T>
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
                  {(it.kind === 'reel' || it.kind === 'post') ? (
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginBottom: 2 }}>{it.kind === 'reel' ? 'Reel shared from Videos' : 'Post shared from the community feed'}</T>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{mine ? `you shared · ${it.ago}` : `shared with you · ${it.ago}`}</T>
                    {reaction ? (
                      <PopEmoji emoji={reaction} size={15} />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {peer ? <PopEmoji emoji={peer} size={13} /> : null}
                        <Pressable onPress={() => { haptic.light(); setEmojiFor(it.id); }} hitSlop={8}>
                          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>React</T>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </Pressable>
                {mine ? <AvatarImage source={null} name="You" size={28} tint="rgba(212,175,55,0.22)" border="rgba(212,175,55,0.5)" /> : null}
              </SlideIn>
            );
  };

  const renderMsg = (th: Thread, m: ChatMsg) => {

            const mine = m.dir === 'me';
            const reaction = th.reactions[m.id];
            const peer = th.others?.[m.id];
            return (
              <View key={m.id} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
                <Pressable
                  onLongPress={() => {
                    haptic.light();
                    setEmojiFor(m.id);
                  }}
                  delayLongPress={260}
                  onPress={() => onTapItem(m.id)}
                  style={{ maxWidth: '76%', borderRadius: 16, borderBottomRightRadius: mine ? 5 : 16, borderBottomLeftRadius: mine ? 16 : 5, backgroundColor: mine ? '#1F8F5C' : d.card, borderWidth: 1, borderColor: mine ? 'transparent' : d.cardBorder, paddingHorizontal: 13, paddingVertical: 9 }}
                >
                  <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: mine ? '#FFFFFF' : d.text }}>{m.text}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <T v="caption" style={{ fontSize: 8.5, color: mine ? 'rgba(255,255,255,0.7)' : d.faint }}>{m.ago}</T>
                    {reaction ? <PopEmoji emoji={reaction} size={11} /> : peer ? <PopEmoji emoji={peer} size={11} /> : null}
                  </View>
                </Pressable>
              </View>
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
            <Pressable onPress={() => router.push(`/profile/${thread.friend}` as never)} hitSlop={6}>
              <AvatarImage source={acc(thread.friend).photo ?? null} name={acc(thread.friend).full_name} size={38} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
            </Pressable>
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: isOnline(thread.friend) ? '#2ECC71' : '#E05252', borderWidth: 2, borderColor: d.card }} />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable onPress={() => { if (thread) { router.push(`/profile/${thread.friend}` as never); } }} hitSlop={6}>
            {/* pass 59 — long names truncate with an ellipsis instead of pushing
                the ••• menu off the header */}
            <T v="h2" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>
              {thread ? acc(thread.friend).full_name : 'Inbox'}
            </T>
          </Pressable>
          <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
            {thread ? (isOnline(thread.friend) ? 'Online now' : seenMap[thread.friend] ? `Last seen ${String(seenMap[thread.friend]).slice(5, 16)}` : `@${thread.friend}`) : 'Reels, posts, duas & ayahs shared with you'}
          </T>
        </View>
        <View style={{ borderRadius: 9, borderWidth: 1, borderColor: 'rgba(46,204,113,0.45)', backgroundColor: 'rgba(46,204,113,0.10)', paddingHorizontal: 8, paddingVertical: 4 }}>
          <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 9 }}>IN-APP ONLY</T>
        </View>
        {/* pass 58 — ••• menu → Report / Block */}
        {thread ? (
          <Pressable onPress={() => { haptic.selection(); setMenu((v) => !v); }} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="ellipsis-v" size={12} color={d.text} />
          </Pressable>
        ) : null}
      </View>

      {!thread ? (
        /* ── friends who shared with you ── */
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {threads.map((t) => {
            const a = acc(t.friend);
            const unread = t.items.filter((x) => x.dir === 'them').length + t.chat.filter((c) => c.dir === 'them').length;
            return (
              <Pressable
                key={t.friend}
                onPress={() => {
                  haptic.selection();
                  setOpenFriend(t.friend);
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.18)' : 'rgba(29,111,66,0.12)', backgroundColor: isDark ? 'rgba(18,34,25,0.6)' : 'rgba(255,255,255,0.7)', padding: 12, marginBottom: 10, opacity: pressed ? 0.8 : 1, shadowColor: '#000', shadowOpacity: isDark ? 0.2 : 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 3 } })}
              >
                <View>
                  <AvatarImage source={a.photo ?? null} name={a.full_name} size={46} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                  <View style={{ position: 'absolute', right: -1, top: -1, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#1F8F5C', borderWidth: 1.5, borderColor: isDark ? '#07100C' : '#F6FAF7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <T v="caption" style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{unread}</T>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, color: d.text }}>{a.full_name}</T>
                  <T v="caption" numberOfLines={1} style={{ color: d.faint, fontSize: 10.5, marginTop: 2 }}>
                    {t.chat.length ? t.chat[t.chat.length - 1].text : `shared ${t.items.length} item${t.items.length > 1 ? 's' : ''} with you`}
                  </T>
                </View>
                <FontAwesome5 name="chevron-right" size={12} color={d.faint} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        /* ── thread: shares + chat + composer ── */
        <ScrollView ref={scroller} contentContainerStyle={{ padding: 14, paddingBottom: 26, gap: 12 }} showsVerticalScrollIndicator={false}>
          {flow.map((row) => (row.kind === 'share' ? renderShare(thread, row.it) : renderMsg(thread, row.m)))}

          <T v="caption" style={{ color: d.faint, textAlign: 'center', fontSize: 9, fontStyle: 'italic' }}>Double-tap to react · shares are in-app content only</T>
        </ScrollView>
      )}

      {/* composer — chat back + quick in-app shares */}
      {thread ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', backgroundColor: isDark ? '#07100C' : '#F6FAF7', gap: 8 }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type something…"
                placeholderTextColor={d.faint}
                returnKeyType="send"
                onSubmitEditing={sendChat}
                style={{ flex: 1, paddingVertical: 10, fontSize: 16, color: d.text, fontFamily: 'Poppins-Regular' }}
              />
            </View>
            <Pressable onPress={sendChat} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}>
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
               { k: 'block', label: blocked ? 'Blocked ✓' : 'Block ' + acc(thread.friend).full_name, icon: 'user-slash', color: '#E05252' }] as const).map((it2) => (
              <Pressable key={it2.k} onPress={() => { haptic.light(); setMenu(false); if (it2.k === 'report') { setReportOpen(true); } else { setBlockOpen(true); } }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}>
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
            <Pressable onPress={() => { haptic.success(); setReportOpen(false); setReportType(null); setReportDesc(''); setReported(true); }} disabled={!reportType}
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
              <Pressable onPress={() => { haptic.medium(); setBlockOpen(false); setBlocked(true); }} style={{ flex: 1, borderRadius: 13, backgroundColor: '#E05252', paddingVertical: 12, alignItems: 'center' }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: '#fff' }}>Block</T>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* emoji panel */}
      {emojiFor ? (
        <Pressable style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,8,6,0.55)', justifyContent: 'flex-end' }} onPress={() => setEmojiFor(null)}>
          <Pressable style={{ paddingBottom: 24 + insets.bottom, paddingHorizontal: 14 }}>
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: isDark ? '#0C1712' : '#FFFFFF', paddingVertical: 14, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
              {EMOJIS.map((e, i) => (
                <Pressable key={e} onPress={() => react(emojiFor, e)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 1.35 : 1 }] })}>
                  <Animated.Text style={{ fontSize: 30, opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), marginTop: i % 2 === 0 ? 0 : 10 }}>{e}</Animated.Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );

  if (standalone) return visible ? body : null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => (thread ? setOpenFriend(null) : onClose())}>
      {body}
    </Modal>
  );
}
