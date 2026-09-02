import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import type { Post } from '@/api/types';
import type { SampleComment } from '@/api/mocks';
import { NAV_LABELS, SYSTEM_PROMPT, composeLocalAnswer, detectProvider, getApiKey, getModel, navAnswer, retrieveLocal, streamLLM } from '@/lib/ai';
import { MOCK_ACCOUNTS } from '@/api/mocks';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { AvatarImage } from '@/components/FeedCard';
import { HeartIcon } from '@/components/Icons';
import { haptic } from '@/lib/haptics';
import { useRouter } from 'expo-router';

const ME = { name: 'Abdulrahman Al-Harbi', handle: 'abdalrahman' };

const EMOJIS = ['😄', '😅', '🥹', '😍', '🤲', '🕌', '✨', '🤍', '📖', '🌙', '🔥', '🕋', '', 'سُبْحَانَهُ وَتَعَالَى'];

/* pass 20: bundled animated stickers for comments */
const GIFS = {
  mashallah: require('../../assets/img/gifs/mashallah.gif'),
  subhanallah: require('../../assets/img/gifs/subhanallah.gif'),
  alhamdulillah: require('../../assets/img/gifs/alhamdulillah.gif'),
  allahuakbar: require('../../assets/img/gifs/allahuakbar.gif'),
  jazakallah: require('../../assets/img/gifs/jazakallah.gif'),
  heart: require('../../assets/img/gifs/heart.gif'),
  ameen: require('../../assets/img/gifs/ameen.gif'),
  mosque: require('../../assets/img/gifs/mosque.gif'),
  dua: require('../../assets/img/gifs/dua.gif'),
} as const;

/** Renders @mentions in comment text as colored + bold (IG-style). */
/** pass 41 — [Quran 2:255] / [Bukhari · #12] / [Dua · …] references in AI
 * replies become TAPPABLE deeplinks to the in-app source (when we have one). */
function refRoute(ref: string): string | null {
  const r = ref.trim();
  if (/^quran/i.test(r)) {
    const m = r.match(/(\d+)/);
    return m ? `/read/${m[1]}` : null;
  }
  if (/^dua/i.test(r)) return '/tools/dua';
  return '/tools/hadith';
}

function MentionText({ text, base, mention }: { text: string; base: object; mention: object }) {
  const router = useRouter();
  const parts = text.split(/(@[A-Za-z0-9_]+|\[(?:Quran\s+\d+|Bukhari|Muslim|Abu Dawud|Tirmidhi|Nasa['\u2019]?i|Ibn Majah|Dua)[^\]]*\])/g);
  return (
    <T v="bodyS" style={base as object}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          return (
            <T key={i} style={(mention as object)}>
              {part}
            </T>
          );
        }
        if (part.startsWith('[')) {
          const rt = refRoute(part.slice(1, -1));
          return (
            <T
              key={i}
              v="bodyS"
              style={{ color: '#D4AF37', fontWeight: '800', textDecorationLine: rt ? 'underline' : 'none' }}
              onPress={rt ? () => router.push(rt as never) : undefined}
            >
              {part}
            </T>
          );
        }
        return <T key={i}>{part}</T>;
      })}
    </T>
  );
}

/* pass 42 — tappable "Open <place>" chip rendered under AI comment answers */
function NavChip({ route }: { route: string }) {
  const router = useRouter();
  const label = NAV_LABELS[route.replace(/^\/+/, '/')] ?? NAV_LABELS['/' + route.replace(/^\/+/, '')] ?? 'Open in the app';
  return (
    <Pressable
      accessibilityLabel={`open ${label}`}
      onPress={() => { haptic.medium(); router.push(route as never); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 7, borderRadius: 11, backgroundColor: 'rgba(46,204,113,0.12)', borderWidth: 1, borderColor: 'rgba(74,227,143,0.4)', paddingHorizontal: 10, paddingVertical: 6 }}
    >
      <FontAwesome5 name="location-arrow" size={9} color="#4AE38F" />
      <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#4AE38F' }}>Open {label}</T>
    </Pressable>
  );
}

/**
 * Comment row — MODULE-LEVEL on purpose: defining it inside the modal
 * component remounted every row (and glitched the avatars) on each like tap.
 */
function CommentRow({
  c,
  isReply = false,
  isLiked,
  onToggleLike,
  onReply,
  onToggleReplies,
  repliesOpen,
  onOpenProfile,
  colors,
}: {
  c: SampleComment;
  isReply?: boolean;
  isLiked: (id: number) => boolean;
  onToggleLike: (id: number) => void;
  onReply: (c: SampleComment) => void;
  onToggleReplies: (id: number) => void;
  repliesOpen: boolean;
  onOpenProfile: (handle: string) => void;
  colors: {
    txt: string;
    sub: string;
    faint: string;
    hairline: string;
    bubble: string;
    emerald: string;
    isDark: boolean;
  };
}) {
  const cImg = c.avatar != null ? c.avatar : null;
  const cName = c.name ?? c.handle;
  const rowLiked = isLiked(c.id);
  const likeCount = (c.likes ?? 0) + (rowLiked && !c.liked ? 1 : 0);
  const nReplies = c.replies?.length ?? 0;
  return (
    <View style={{ flexDirection: 'row', gap: 9, marginTop: isReply ? 8 : 14 }}>
      {/* only the avatar + name open a profile — the comment body never does */}
      <Pressable onPress={() => onOpenProfile(c.handle)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <AvatarImage source={cImg} name={cName} size={isReply ? 27 : 32} tint={colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)'} border={colors.hairline} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ borderRadius: 13, backgroundColor: colors.bubble, paddingHorizontal: 11, paddingVertical: 7 }}>
          <Pressable onPress={() => onOpenProfile(c.handle)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
            <T v="caption" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '700', fontSize: 11, color: colors.txt, flexShrink: 1 }}>
              {cName}
            </T>
            {c.badge ? <VerificationBadge type={c.badge} size={11} /> : null}
          </Pressable>
          {c.text ? (
            <MentionText
              text={c.text}
              base={{ fontSize: 12.5, lineHeight: 17.5, color: colors.txt, marginTop: 2 }}
              mention={{ fontSize: 12.5, fontWeight: '800', color: colors.emerald }}
            />
          ) : null}
          {c.gif ? <Image source={c.gif} style={{ width: 96, height: 96, marginTop: 6, borderRadius: 12 }} contentFit="contain" /> : null}
          {/* pass 42 — AI answers get a DIRECT open button for the place it described */}
          {c.nav ? <NavChip route={c.nav} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 5 }}>
          <T v="caption" style={{ fontSize: 9.5, color: colors.faint, fontWeight: '600' }}>
            {c.time}
          </T>
          <Pressable hitSlop={6} onPress={() => { haptic.light(); onToggleLike(c.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <HeartIcon size={11} filled={rowLiked} color={rowLiked ? '#E74C3C' : colors.faint} />
            {likeCount > 0 ? (
              <T v="caption" style={{ fontSize: 9.5, color: rowLiked ? '#E74C3C' : colors.faint, fontWeight: '700' }}>
                {likeCount}
              </T>
            ) : null}
          </Pressable>
          <Pressable hitSlop={6} onPress={() => onReply(c)}>
            <T v="caption" style={{ fontSize: 9.5, color: colors.sub, fontWeight: '700' }}>
              Reply
            </T>
          </Pressable>
          {nReplies > 0 ? (
            <Pressable hitSlop={6} onPress={() => onToggleReplies(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <T v="caption" style={{ fontSize: 9.5, color: colors.emerald, fontWeight: '700' }}>
                {repliesOpen ? 'Hide replies' : `View ${nReplies} ${nReplies === 1 ? 'reply' : 'replies'}`}
              </T>
              <FontAwesome5 name={repliesOpen ? 'chevron-up' : 'chevron-down'} size={8} color={colors.emerald} />
            </Pressable>
          ) : null}
        </View>
        {nReplies > 0 && repliesOpen ? (
          // thread rail — a single soft emerald line under the parent avatar,
          // replies indented inside it
          <View
            style={{
              marginLeft: 3,
              marginTop: 6,
              paddingLeft: 13,
              borderLeftWidth: 2,
              borderLeftColor: colors.isDark ? 'rgba(74,227,143,0.22)' : 'rgba(14,122,70,0.16)',
              borderTopLeftRadius: 8,
              borderBottomLeftRadius: 8,
            }}
          >
            {c.replies!.map((r) => (
              <CommentRow
                key={r.id}
                c={r}
                isReply
                isLiked={isLiked}
                onToggleLike={onToggleLike}
                onReply={onReply}
                onToggleReplies={onToggleReplies}
                repliesOpen={repliesOpen}
                onOpenProfile={onOpenProfile}
                colors={colors}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Instagram-style comments sheet (theme-aware):
 * post summary → comment list (photo avatars, filling like hearts,
 * nested replies w/ thread rail) → "Replying to @user" indicator →
 * add-a-comment input at the bottom.
 *
 * `inline` renders as an absolute overlay instead of an RN Modal — needed
 * inside modal-presented routes (videos) on native where nested Modals
 * don't present reliably.
 */
export function CommentsModal({
  visible,
  post,
  seed,
  onClose,
  inline = false,
}: {
  visible: boolean;
  post: Post | null;
  seed: SampleComment[];
  onClose: () => void;
  inline?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const d = theme.dash;
  const card = isDark ? '#101B15' : '#FFFFFF';
  const bg = isDark ? 'rgba(4,8,6,0.86)' : 'rgba(15,25,19,0.42)';
  const txt = isDark ? '#F2F7F3' : '#14241C';
  const sub = isDark ? 'rgba(233,244,237,0.72)' : 'rgba(20,36,28,0.75)';
  const faint = isDark ? 'rgba(233,244,237,0.45)' : 'rgba(20,36,28,0.48)';
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.12)';
  const bubble = isDark ? 'rgba(255,255,255,0.045)' : 'rgba(20,36,28,0.055)';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.07)';
  const gold = '#D4AF37';
  const emerald = isDark ? '#4AE38F' : '#0E7A46';

  const [items, setItems] = useState<SampleComment[]>([]);
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});
  const [openReplies, setOpenReplies] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState('');
  /* pass 40 — @DeenLink AI: mentions get an in-thread AI reply (like Grok on X) */
  const [aiTyping, setAiTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; name: string; handle: string } | null>(null);
  /* pass 41 — typing "@" opens the mention picker: DeenLink AI first, then friends/search */
  const mentionMatch = /@([A-Za-z0-9_.]*)$/.exec(draft);
  const mentionQuery = (mentionMatch?.[1] ?? '').toLowerCase();
  const mentionCandidates = useMemo(() => {
    const people = MOCK_ACCOUNTS
      .filter((a) => !mentionQuery || a.username.toLowerCase().includes(mentionQuery) || a.full_name.toLowerCase().includes(mentionQuery))
      .slice(0, 6)
      .map((a) => ({ handle: a.username, name: a.full_name, ai: false }));
    return [{ handle: 'DeenLink', name: 'DeenLink AI', ai: true }, ...people];
  }, [mentionQuery]);
  const pickMention = (handle: string) => {
    setDraft((prev) => prev.replace(/@([A-Za-z0-9_.]*)$/, `@${handle} `));
    haptic.light();
  };
  const inputRef = useRef<TextInput>(null);
  const [gifOpen, setGifOpen] = useState(false);
  /* pass 28: LIVE drag-to-resize via pointer events (PanResponder was dead on
   * iOS Safari web). The sheet follows the finger; release snaps. */
  const vh = Dimensions.get('window').height;
  const H_MAX = Math.round(vh * 0.94);
  const H_TALL = Math.round(vh * 0.85);
  const H_MID = Math.round(vh * 0.7);
  const H_MIN = Math.round(vh * 0.5);
  const [sheetH, setSheetH] = useState(() => Math.round(Dimensions.get('window').height * 0.85));
  const dragStart = useRef<{ y: number; h: number } | null>(null);
  const moveBy = (pageY: number) => {
    if (!dragStart.current) return;
    const dy = dragStart.current.y - pageY;
    setSheetH(Math.min(H_MAX, Math.max(H_MIN, dragStart.current.h + dy)));
  };
  const endDrag = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setSheetH((h) => (h > H_TALL + 30 ? H_MAX : h < H_MID - 30 ? H_MID : H_TALL));
  };
  const onHandleDown = (e: any) => {
    dragStart.current = { y: e.nativeEvent.pageY, h: sheetH };
  };
  const onHandleMove = (e: any) => moveBy(e.nativeEvent.pageY ?? 0);

  /* pass 28b: RN-web (this version) doesn't map onPointerDown props — attach
   * REAL DOM pointer listeners to the handle node; RN responder stays as the
   * native fallback. The Modal's DOM mounts one frame AFTER `visible` flips. */
  const handleRef = useRef<any>(null);
  const handleEl = useRef<any>(null);
  const handlers = useRef<{ down: (e: PointerEvent) => void; move: (e: PointerEvent) => void; up: () => void } | null>(null);
  const sheetHRef = useRef(sheetH);
  sheetHRef.current = sheetH;
  const detach = () => {
    const el = handleEl.current;
    const h = handlers.current;
    if (!el || !h) return;
    el.removeEventListener('pointerdown', h.down as EventListener);
    window.removeEventListener('pointermove', h.move as EventListener);
    window.removeEventListener('pointerup', h.up);
    window.removeEventListener('pointercancel', h.up);
    handleEl.current = null;
    handlers.current = null;
  };
  const attach = (el: any) => {
    const down = (e: PointerEvent) => {
      dragStart.current = { y: e.pageY, h: sheetHRef.current };
      try { (el as unknown as { setPointerCapture: (i: number) => void }).setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    };
    const move = (e: PointerEvent) => { if (dragStart.current) { e.preventDefault(); moveBy(e.pageY); } };
    const up = () => endDrag();
    handleEl.current = el;
    handlers.current = { down, move, up };
    el.addEventListener('pointerdown', down as EventListener);
    window.addEventListener('pointermove', move as EventListener);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const bindHandle = (el: any) => {
    if (handleEl.current === el) return; /* same node — keep listeners */
    detach();
    handleRef.current = el;
    if (el && typeof el.addEventListener === 'function') attach(el);
  };

  const colors = useMemo(
    () => ({ txt: txt as string, sub: sub as string, faint: faint as string, hairline: hairline as string, bubble: bubble as string, emerald: emerald as string, isDark }),
    [txt, sub, faint, hairline, bubble, emerald, isDark],
  );

  // re-seed whenever a different post opens
  const seedKey = post?.id ?? -1;
  /* pass 36 — comments loader: shows a shimmer for a beat when the sheet
   * opens, so slow networks never present an empty sheet */
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(t);
  }, [seedKey, visible]);
  useEffect(() => {
    if (visible) {
      setItems(seed.map((c) => ({ ...c, replies: c.replies?.map((r) => ({ ...r })) })));
      const l: Record<number, boolean> = {};
      for (const c of seed) {
        if (c.liked) l[c.id] = true;
        c.replies?.forEach((r) => {
          if (r.liked) l[r.id] = true;
        });
      }
      setLikedMap(l);
      setOpenReplies(new Set());
      setDraft('');
      setReplyingTo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, visible]);

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  if (!post) return null;
  const user = post.user;
  const name = user.full_name ?? user.username;
  const img = (user as { profile_image_url?: string | number | null }).profile_image_url ?? null;

  const isLiked = (id: number) => !!likedMap[id];
  const toggleLike = (id: number) =>
    setLikedMap((m) => {
      const n = { ...m };
      if (n[id]) delete n[id];
      else n[id] = true;
      return n;
    });

  const toggleReplies = (id: number) =>
    setOpenReplies((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const startReply = (c: SampleComment) => {
    haptic.selection();
    // No @handle in the textfield — just the "Replying to …" indicator.
    setReplyingTo({ id: c.id, name: c.name ?? c.handle, handle: c.handle });
  };

  /** Opens a public profile — closes this sheet first so it never lingers. */
  const openProfile = (handle: string) => {
    haptic.selection();
    onClose();
    setTimeout(() => router.push(`/profile/${handle}`), 140);
  };

  const pushComment = (nc: SampleComment) => {
    setItems((prev) => {
      if (replyingTo) {
        return prev.map((c) => {
          if (c.id === replyingTo.id) return { ...c, replies: [...(c.replies ?? []), nc] };
          const ri = (c.replies ?? []).find((r) => r.id === replyingTo.id);
          if (ri) return { ...c, replies: [...(c.replies ?? []), nc] };
          return c;
        });
      }
      return [...prev, nc];
    });
    if (replyingTo) setOpenReplies((s) => new Set(s).add(replyingTo.id));
    setReplyingTo(null);
  };

  const sendGif = (g: number) => {
    haptic.success();
    pushComment({ id: Date.now(), name: ME.name, handle: ME.handle, avatar: null, text: '', gif: g, time: 'now', likes: 0 });
    setGifOpen(false);
  };

  const addComment = () => {
    const t = draft.trim();
    if (!t) return;
    haptic.light();
    const nc: SampleComment = { id: Date.now(), name: ME.name, handle: ME.handle, avatar: null, text: t, time: 'now', likes: 0 };
    pushComment(nc);
    setDraft('');
    /* pass 40 — mention @DeenLink (or @deenlink ai / @ai) → the AI answers
     * in-thread: it VERIFIES the post's claims against our library and
     * answers the question, grounded in what it can actually retrieve. */
    if (/@deenlink\b/i.test(t) || /^@ai\b/i.test(t)) void answerAsDeenLinkAI(t, post);
  };

  const answerAsDeenLinkAI = async (question: string, forPost: Post | null) => {
    setAiTyping(true);
    const postText = (forPost?.content_text ?? '').slice(0, 500);
    const q = question.replace(/@deenlink\b/i, '').replace(/^@ai\b/i, '').trim() || 'Is this post accurate?';
    let answer = '';
    try {
      const key = await getApiKey();
      if (key && detectProvider(key)) {
        /* keyed mode — full reasoning, then a single inserted reply */
        const sources = await retrieveLocal(`${q} ${postText.slice(0, 160)}`).catch(() => []);
        const ctx = sources.slice(0, 5).map((x) => `[${x.label}] ${x.excerpt.slice(0, 220)}`).join('\n');
        const model = await getModel();
        answer = await new Promise<string>((resolve) => {
          let acc = '';
          streamLLM(key, model, [
            { role: 'system', content: `${SYSTEM_PROMPT}\nYou are replying INLINE as a comment under a community post. In at most 90 words: (1) one line on whether the post's claims are supported by the provided context — cite what matches, flag what you cannot verify; (2) answer the user's question. No markdown headings. If the user asks WHERE something is in the app or how to do it in DeenLink, give short numbered steps and end with a final line exactly: NAV: /route (one of the routes you know).` },
            { role: 'user', content: `Post: "${postText}"\nUser asked: "${q}"\n\nLibrary context:\n${ctx || '(nothing directly on-topic retrieved)'}` },
          ], false, (e: { delta?: string; done?: boolean; error?: string }) => {
            if (e.delta) acc += e.delta;
            if (e.done || e.error) resolve(acc.trim() || 'I could not complete that check — please try again.');
          }).catch(() => resolve(''));
        });
      }
      if (!answer) {
        /* on-device fallback — grounded in the offline library */
        const sources = await retrieveLocal(`${q} ${postText.slice(0, 160)}`).catch(() => [] as never[]);
        answer = composeLocalAnswer(q, sources);
      }
    } catch {
      answer = 'I could not check this right now — please try again in a moment.';
    }
    /* let the typing dots breathe, then post the reply */
    await new Promise((r) => setTimeout(r, Math.max(0, 1100)));
    setAiTyping(false);
    /* pass 42 — pull the NAV directive OUT of the text; it becomes a button,
     * and on-device nav questions get real steps + a route too */
    const navMatch = answer.match(/^\s*NAV:\s*(\/[^\s]+)\s*$/im);
    let navRoute = navMatch?.[1];
    let clean = answer.replace(/^\s*NAV:\s*\/?[a-z0-9/()\-]*.*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!navRoute) {
      const nav = navAnswer(question);
      if (nav) { navRoute = nav.route; clean = `${clean}\n\n${nav.text}`.trim(); }
    }
    const ai: SampleComment = {
      id: Date.now() + 1,
      name: 'DeenLink AI',
      handle: 'deenlink',
      avatar: null,
      badge: 'green',
      text: `✅ ${clean}`,
      nav: navRoute,
      time: 'now',
      likes: 0,
    };
    pushComment(ai);
    haptic.success();
  };

  const total = (list: SampleComment[]) => list.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  const sheet = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      accessibilityLabel="comments sheet"
      style={{
        height: sheetH,
        maxHeight: '94%',
        backgroundColor: card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: hairline,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.4 : 0.18,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: -8 },
        elevation: 16,
      }}
    >
      {/* drag handle — pull up/down to resize (pass 28: live pointer drag) */}
      <View
        ref={bindHandle}
        accessibilityLabel="comments drag handle"
        onStartShouldSetResponder={() => Platform.OS !== 'web'}
        onResponderGrant={onHandleDown}
        onResponderMove={onHandleMove}
        onResponderRelease={endDrag}
        style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 8, touchAction: 'none' } as never}
      >
        <View style={{ width: 52, height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.2)' }} />
        <T v="meta" style={{ fontSize: 9.5, marginTop: 7, letterSpacing: 0.4, color: faint as string }}>
          drag to resize
        </T>
      </View>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: hairline }}>
        <View style={{ flex: 1 }} />
        <T v="body" style={{ fontWeight: '700', fontSize: 14, color: txt }}>
          Comments
        </T>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <FontAwesome5 name="times" size={15} color={faint} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
        {/* Post summary */}
        <View style={{ flexDirection: 'row', gap: 9, marginBottom: 4 }}>
          <AvatarImage source={img} name={name} size={32} tint={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)'} border={hairline} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T v="caption" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '700', fontSize: 11.5, color: txt, flexShrink: 1 }}>
                {name}
              </T>
              {user.verification_badge ? <VerificationBadge type={user.verification_badge} size={11} /> : null}
              <T v="caption" style={{ fontSize: 10, color: faint, flexShrink: 0 }}>
                · {post.time_ago}
              </T>
            </View>
            {post.content_text ? (
              <T v="bodyS" numberOfLines={3} ellipsizeMode="tail" style={{ fontSize: 12, lineHeight: 17, color: sub, marginTop: 3 }}>
                {post.content_text}
              </T>
            ) : null}
          </View>
        </View>
        <T v="caption" style={{ fontSize: 10, color: faint, fontWeight: '700', letterSpacing: 0.6, marginTop: 10 }}>
          {total(items)} COMMENTS
        </T>

        {loading ? (
          <View style={{ gap: 14, marginTop: 12 }} pointerEvents="none">
            {[...Array(3)].map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 9, opacity: 1 - i * 0.22 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isDark ? 'rgba(242,247,243,0.08)' : 'rgba(20,36,28,0.07)' }} />
                <View style={{ flex: 1, gap: 6, marginTop: 2 }}>
                  <View style={{ height: 9, borderRadius: 5, width: `${38 + i * 9}%`, backgroundColor: isDark ? 'rgba(242,247,243,0.08)' : 'rgba(20,36,28,0.07)' }} />
                  <View style={{ height: 9, borderRadius: 5, width: `${84 - i * 12}%`, backgroundColor: isDark ? 'rgba(242,247,243,0.06)' : 'rgba(20,36,28,0.05)' }} />
                </View>
              </View>
            ))}
            <ActivityIndicator size="small" color={emerald} style={{ marginTop: 2 }} />
          </View>
        ) : items.map((c) => (
          <CommentRow
            key={c.id}
            c={c}
            isLiked={isLiked}
            onToggleLike={toggleLike}
            onReply={startReply}
            onToggleReplies={toggleReplies}
            repliesOpen={openReplies.has(c.id)}
            onOpenProfile={openProfile}
            colors={colors}
          />
        ))}
      </ScrollView>

      {/* Reply indicator */}
      {replyingTo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${gold}14`, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
            <FontAwesome5 name="reply" size={10} color={gold} />
            <T v="caption" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1, fontSize: 10.5, fontWeight: '700', color: gold }}>
              Replying to {replyingTo.name}
            </T>
          </View>
          <Pressable onPress={() => setReplyingTo(null)} hitSlop={10} style={{ padding: 5 }}>
            <FontAwesome5 name="times-circle" size={14} color={faint} />
          </Pressable>
        </View>
      ) : null}

      {/* Emoji row (IG-style) + GIF picker (pass 20) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 36, flexGrow: 0, flexShrink: 0, paddingHorizontal: 12, paddingBottom: 4 }}>
        {EMOJIS.map((e, i) => (
          <Pressable key={`e${i}`} onPress={() => setDraft((prev) => prev + e)} hitSlop={4} style={{ padding: 4, marginRight: 2 }} onPressIn={() => haptic.selection()}>
            <T v="caption" style={{ fontSize: e.length > 2 ? 12 : 20, fontWeight: '400' }}>
              {e}
            </T>
          </Pressable>
        ))}
      </ScrollView>

      {/* GIF picker — bundled animated stickers */}
      {gifOpen ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8, maxHeight: 150 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {Object.entries(GIFS).map(([name, g]) => (
              <Pressable key={name} onPress={() => sendGif(g)} style={({ pressed }) => ({ width: 96, height: 96, borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: pressed ? emerald : hairline, opacity: pressed ? 0.75 : 1 })}>
                <Image source={g} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* pass 41 — mention picker (DeenLink AI first, then friends/search) */}
      {mentionMatch ? (
        <View style={{ maxHeight: 176, borderTopWidth: 1, borderTopColor: hairline, backgroundColor: isDark ? 'rgba(9,16,12,0.98)' : '#FFFFFF' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 2 }}>
            <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8, color: faint, paddingVertical: 4 }}>MENTION — DEENLINK AI FIRST</T>
            {mentionCandidates.map((m) => (
              <Pressable
                key={m.handle}
                onPress={() => pickMention(m.handle)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: m.ai ? 'rgba(212,175,55,0.09)' : pressed ? bubble : 'transparent', borderWidth: 1, borderColor: m.ai ? 'rgba(212,175,55,0.35)' : 'transparent' })}
              >
                <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: m.ai ? 'rgba(212,175,55,0.16)' : isDark ? 'rgba(46,204,113,0.14)' : 'rgba(14,122,70,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={m.ai ? 'robot' : 'user'} size={11} color={m.ai ? '#D4AF37' : emerald} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: m.ai ? '#D4AF37' : txt }}>{m.name}</T>
                  <T v="caption" style={{ fontSize: 9.5, color: faint }}>@{m.handle}{m.ai ? ' · answers from your library' : ''}</T>
                </View>
                <FontAwesome5 name="plus" size={9} color={faint} />
              </Pressable>
            ))}
            {!mentionCandidates.length ? <T v="caption" style={{ fontSize: 10.5, color: faint, padding: 8 }}>No matches</T> : null}
          </ScrollView>
        </View>
      ) : null}

      {/* Add a comment (font 16px → no iOS auto-zoom on focus) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: hairline }}>
        <Text
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.12)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(46,204,113,0.4)' : 'rgba(14,122,70,0.35)',
            textAlign: 'center',
            textAlignVertical: 'center',
            fontFamily: 'Poppins-Bold',
            fontSize: 12,
            fontWeight: '700',
            color: emerald,
          }}
        >
          A
        </Text>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder={replyingTo ? `Reply to ${replyingTo.name}…` : 'Add a comment…'}
          placeholderTextColor={faint}
          onSubmitEditing={addComment}
          returnKeyType="send"
          style={{
            flex: 1,
            width: 0,
            fontFamily: 'Poppins-Medium',
            fontSize: 16,
            color: txt,
            backgroundColor: inputBg,
            borderRadius: 17,
            paddingHorizontal: 13,
            paddingVertical: 9,
          }}
        />
        <Pressable
          onPress={() => { haptic.selection(); setGifOpen((o) => !o); }}
          accessibilityLabel="toggle gif picker"
          hitSlop={6}
          style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: gifOpen ? 'rgba(46,204,113,0.14)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,36,28,0.06)', borderWidth: 1, borderColor: gifOpen ? 'rgba(74,227,143,0.6)' : hairline }}
        >
          <FontAwesome5 name="photo-video" size={13} color={gifOpen ? emerald : (faint as string)} />
        </Pressable>
        <Pressable
          onPress={addComment}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            opacity: (draft.trim() ? 1 : 0.45) * (pressed ? 0.6 : 1),
          })}
        >
          <FontAwesome5 name="paper-plane" size={13} color={draft.trim() ? gold : faint} />
          <T v="caption" style={{ fontWeight: '700', fontSize: 11, color: draft.trim() ? gold : faint }}>
            Post
          </T>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  if (inline) {
    if (!visible) return null;
    return (
      <View style={{ position: 'absolute', inset: 0, zIndex: 90, backgroundColor: bg, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        {sheet}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        {sheet}
      </View>
    </Modal>
  );
}
