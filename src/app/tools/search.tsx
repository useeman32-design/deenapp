import { useEffect, useMemo, useRef, useState } from 'react';
import { storage } from '@/lib/storage';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { VideoModal } from '@/components/VideoModal';
import { goBack } from '@/lib/navigation';
import { haptic } from '@/lib/haptics';
import * as api from '@/api/client';
import type { AccountResult } from '@/api/client';
import type { Post, Video } from '@/api/types';

type Tab = 'top' | 'users' | 'videos' | 'hashtags';

/** pass 67 — pull #hashtags out of post copy (live + demo alike). */
export function tagsOf(posts: Post[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of posts) {
    const m = (p.content_text ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? [];
    for (const raw of m) {
      const tag = raw.slice(1).toLowerCase();
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n));

/* pass 74 — persisted search history */
const HIST_KEY = 'dl.search.history.v1';

/* pass 68 — "breathing" skeleton: soft blocks pulsing like the app's item
 * loaders, shaped per tab so the layout never jumps when data lands. */
function Breathe({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(a, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(a, { toValue: 0.45, duration: 620, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a, delay]);
  return <Animated.View style={{ opacity: a }}>{children}</Animated.View>;
}

function Skeleton({ rows, shape, tint, card, border }: { rows: number; shape: 'user' | 'post' | 'video' | 'tag'; tint: string; card: string; border: string }) {
  const line = (w: string | number, h = 9, mt = 6) => (
    <View style={{ width: w as never, height: h, borderRadius: 5, backgroundColor: tint, marginTop: mt }} />
  );
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <Breathe key={i} delay={i * 130}>
          <View style={{ borderRadius: 15, borderWidth: 1, borderColor: border, backgroundColor: card, padding: 12, marginBottom: 9, flexDirection: shape === 'post' ? 'column' : 'row', alignItems: 'center', gap: 12 }}>
            {shape === 'user' ? <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tint }} /> : null}
            {shape === 'video' ? <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: tint }} /> : null}
            {shape === 'tag' ? <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tint }} /> : null}
            {shape === 'post' ? (
              <View style={{ width: '100%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: tint }} />
                  {line(120, 10, 0)}
                </View>
                {line('94%', 9, 11)}
                {line('78%', 9)}
                {line('40%', 9)}
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                {line(shape === 'user' ? '55%' : '70%', 10, 0)}
                {line(shape === 'user' ? '35%' : '45%', 8)}
              </View>
            )}
          </View>
        </Breathe>
      ))}
    </View>
  );
}

/* pass 68 — rows ease in with a small stagger; tab switches fade + slide. */
function RowIn({ i, children }: { i: number; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(a, { toValue: 1, duration: 240, delay: Math.min(i, 8) * 40, useNativeDriver: false }),
      Animated.timing(ty, { toValue: 0, duration: 240, delay: Math.min(i, 8) * 40, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [a, ty, i]);
  return <Animated.View style={{ opacity: a, transform: [{ translateY: ty }] }}>{children}</Animated.View>;
}

function FadeSlide({ k, children }: { k: string; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  const tx = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    a.setValue(0);
    tx.setValue(16);
    Animated.parallel([
      Animated.timing(a, { toValue: 1, duration: 210, useNativeDriver: false }),
      Animated.timing(tx, { toValue: 0, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [k, a, tx]);
  return <Animated.View style={{ opacity: a, transform: [{ translateX: tx }] }}>{children}</Animated.View>;
}

/**
 * pass 67 — the Search screen (home 🔍 lands here):
 *  · idle: RECENT POSTS — the 5 newest, "See more" pages the rest in
 *  · typing: Top / Users / Videos / Hashtags tabs; each loads its own
 *    content the first time it is opened
 *  · Top is a MIX — best account, best post, best video, best hashtag —
 *    every row tappable (profile / post viewer / video modal / hashtag screen)
 */
export default function SearchScreen() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('top');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [users, setUsers] = useState<AccountResult[] | null>(null);
  const [loading, setLoading] = useState<Record<Tab, boolean>>({ top: false, users: false, videos: false, hashtags: false });
  const [recentMore, setRecentMore] = useState(false);
  /* pass 74 — search history (persisted) with clear + show more/less */
  const [history, setHistory] = useState<string[]>([]);
  const [histMore, setHistMore] = useState(false);
  useEffect(() => {
    storage.getItem(HIST_KEY).then((raw: string | null) => {
      if (!raw) { return; }
      try { const a = JSON.parse(raw) as unknown; if (Array.isArray(a)) { setHistory(a.filter((x) => typeof x === 'string').slice(0, 20)); } } catch { /* ignore */ }
    }).catch(() => {});
  }, []);
  const pushHistory = (term: string) => {
    const t = term.trim();
    if (t.length < 2) { return; }
    setHistory((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 20);
      storage.setItem(HIST_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const clearHistory = () => { setHistory([]); storage.removeItem(HIST_KEY).catch(() => {}); };
  /* save once the user pauses on a term of 2+ chars */
  useEffect(() => {
    if (q.trim().length < 2) { return; }
    const to = setTimeout(() => pushHistory(q), 1600);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const [videoOpen, setVideoOpen] = useState<Video | null>(null);
  /* pass 68 — server-side post search + follow state for user rows */
  const [qPosts, setQPosts] = useState<Post[] | null>(null);
  /* pass 72 — real video search (server LIKE) */
  const [qVideos, setQVideos] = useState<Video[] | null>(null);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});

  /* pools — loaded once, filtered per tab */
  useEffect(() => {
    api.feed('for-you').then((r) => setPosts(r.posts ?? [])).catch(() => {});
    api.videos('all').then(setVideos).catch(() => {});
  }, []);

  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  /* pass 68 — real post search (debounced): the server LIKE-searches every
   * public post, not just the page of feed the app already holds. */
  useEffect(() => {
    if (!searching || !api.isLive()) { setQPosts(null); return; }
    let on = true;
    const t = setTimeout(() => {
      setLoading((l) => ({ ...l, top: true }));
      api.searchPosts(query, 12)
        .then((r) => { if (on) setQPosts(r); })
        .catch(() => {})
        .finally(() => { if (on) setLoading((l) => ({ ...l, top: false })); });
    }, 320);
    return () => { on = false; clearTimeout(t); };
  }, [query, searching]);

  useEffect(() => {
    if (!searching || !api.isLive()) { setQVideos(null); return; }
    let on = true;
    const t = setTimeout(() => {
      setLoading((l) => ({ ...l, videos: true }));
      api.videosSearch(query, 12)
        .then((r) => { if (on) setQVideos(r); })
        .catch(() => {})
        .finally(() => { if (on) setLoading((l) => ({ ...l, videos: false })); });
    }, 320);
    return () => { on = false; clearTimeout(t); };
  }, [query, searching]);

  const matchedPosts = useMemo(() => {
    const local = (posts ?? []).filter((p) => !searching || (p.content_text ?? '').toLowerCase().includes(query) || (p.user?.full_name ?? '').toLowerCase().includes(query) || (p.user?.username ?? '').toLowerCase().includes(query));
    if (!searching || !qPosts?.length) { return local; }
    const seen = new Set(qPosts.map((p) => p.id));
    return [...qPosts, ...local.filter((p) => !seen.has(p.id))];
  }, [posts, qPosts, query, searching]);
  const matchedVideos = useMemo(() => {
    const local = (videos ?? []).filter((v) => !searching || (v.title ?? '').toLowerCase().includes(query) || (v.description ?? '').toLowerCase().includes(query));
    if (!searching || !qVideos?.length) { return local; }
    const seen = new Set(qVideos.map((v) => v.id));
    return [...qVideos, ...local.filter((v) => !seen.has(v.id))];
  }, [videos, qVideos, query, searching]);
  const allTags = useMemo(() => tagsOf(posts ?? []), [posts]);
  const matchedTags = useMemo(
    () => allTags.filter((t) => !searching || t.tag.includes(query.replace(/^#/, ''))),
    [allTags, query, searching],
  );

  /* Users tab loads from the real account search the first time it opens (or
   * the query changes while it is open). Demo mode filters the mock roster. */
  useEffect(() => {
    /* pass 74 — the Top tab shows up to 3 account matches, so it needs the
     * account search too, not just the dedicated People tab. */
    if (!searching || (tab !== 'users' && tab !== 'top')) return;
    if (!api.isLive()) { setUsers([]); return; } /* pass 83-38 — real accounts only */
    setLoading((l) => ({ ...l, users: true }));
    api.searchAccounts(query).then((r) => setUsers(r ?? [])).finally(() => setLoading((l) => ({ ...l, users: false })));
  }, [tab, query, searching]);

  const pickTab = (t: Tab) => {
    if (t === tab) return;
    haptic.selection();
    setTab(t);
  };

  /* ── shared rows ── */
  /* pass 68 — accounts can be followed or messaged straight from search. */
  const toggleFollowOf = async (u: AccountResult) => {
    const key = u.username;
    const want = !followed[key];
    haptic.light();
    setFollowed((f) => ({ ...f, [key]: want }));
    setFollowBusy((b) => ({ ...b, [key]: true }));
    const ok = api.isLive() ? await api.toggleFollow(u.id, want).catch(() => false) : true;
    if (!ok) { setFollowed((f) => ({ ...f, [key]: !want })); }
    setFollowBusy((b) => ({ ...b, [key]: false }));
  };

  const UserRow = ({ u }: { u: AccountResult }) => {
    const isF = !!followed[u.username];
    return (
      <Pressable
        onPress={() => { haptic.light(); router.push(`/profile/${u.username}`); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 11, marginBottom: 9, opacity: pressed ? 0.8 : 1 })}
      >
        <AvatarImage source={u.profile_image_url ?? null} name={u.full_name} size={44} tint={d.bgSoft} border={d.cardBorder} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="bodyS" numberOfLines={2} style={{ fontWeight: '700', fontSize: 13, color: d.text }}>{u.full_name}</T>
          <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>@{u.username}{u.followers_count ? ` · ${fmt(u.followers_count)} followers` : ''}</T>
        </View>
        <Pressable
          onPress={() => { void toggleFollowOf(u); }}
          hitSlop={6}
          style={{ borderRadius: 999, borderWidth: 1, borderColor: isF ? d.cardBorder : (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.35)'), backgroundColor: isF ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.04)') : (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.10)'), paddingHorizontal: 12, paddingVertical: 7, minWidth: 74, alignItems: 'center', justifyContent: 'center' }}
        >
          {followBusy[u.username] ? (
            <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
          ) : (
            <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, color: isF ? d.subtext : (isDark ? '#4AE38F' : '#0E7A46') }}>{isF ? 'Following' : 'Follow'}</T>
          )}
        </Pressable>
      </Pressable>
    );
  };

  const PostRow = ({ p }: { p: Post }) => (
    <Pressable
      onPress={() => { haptic.light(); router.push({ pathname: '/tools/post', params: { id: String(p.id) } } as never); }}
      style={({ pressed }) => ({ borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 9, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 }}>
        <AvatarImage source={(p.user as { profile_image_url?: string | number | null }).profile_image_url ?? null} name={p.user?.full_name ?? p.user?.username ?? ''} size={30} tint={d.bgSoft} border={d.cardBorder} />
        <T v="caption" numberOfLines={1} style={{ flex: 1, fontWeight: '800', fontSize: 11.5, color: d.text }}>{p.user?.full_name ?? p.user?.username}</T>
        <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{p.time_ago ?? ''}</T>
      </View>
      <T v="bodyS" numberOfLines={3} style={{ fontSize: 12.5, lineHeight: 18, color: d.subtext }}>{p.content_text}</T>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <FontAwesome5 name="heart" size={9} color={d.faint} />
          <T v="caption" style={{ fontSize: 10, color: d.faint }}>{fmt(p.like_count ?? 0)}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <FontAwesome5 name="comment" size={9} color={d.faint} />
          <T v="caption" style={{ fontSize: 10, color: d.faint }}>{fmt(p.comment_count ?? 0)}</T>
        </View>
      </View>
    </Pressable>
  );

  const VideoRow = ({ v }: { v: Video }) => (
    <Pressable
      onPress={() => { haptic.light(); setVideoOpen(v); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 11, marginBottom: 9, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: isDark ? 'rgba(74,227,143,0.12)' : 'rgba(14,122,70,0.08)', alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name="play" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="bodyS" numberOfLines={2} style={{ fontWeight: '700', fontSize: 12.5, color: d.text }}>{v.title ?? 'Video'}</T>
        <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{v.duration ? `${v.duration} · ` : ''}{fmt(v.view_count ?? 0)} views</T>
      </View>
    </Pressable>
  );

  const TagRow = ({ t }: { t: { tag: string; count: number } }) => (
    <Pressable
      onPress={() => { haptic.light(); router.push({ pathname: '/tools/hashtag', params: { tag: t.tag } } as never); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 9, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name="hashtag" size={13} color="#D4AF37" />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>#{t.tag}</T>
        <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{fmt(t.count)} post{t.count === 1 ? '' : 's'}</T>
      </View>
      <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
    </Pressable>
  );

  const SectionLabel = ({ children }: { children: string }) => (
    <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: d.faint, marginTop: 6, marginBottom: 8 }}>{children.toUpperCase()}</T>
  );

  const TABS: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'top', label: 'Top', icon: 'fire' },
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'videos', label: 'Videos', icon: 'play-circle' },
    { id: 'hashtags', label: 'Hashtags', icon: 'hashtag' },
  ];

  /* the mixed "Top" list: the single best of each kind, then the rest */
  const topMix = useMemo(() => {
    const acc = users; /* pass 83-38 — real account search only */
    const bestPost = [...matchedPosts].sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))[0];
    const bestVideo = matchedVideos[0];
    const bestTag = matchedTags[0];
    const bestAcc = acc?.[0];
    return { bestAcc, bestPost, bestVideo, bestTag, restPosts: matchedPosts.filter((p) => p !== bestPost).slice(0, 4), restTags: matchedTags.filter((t) => t !== bestTag).slice(0, 3), topAccs: (acc ?? []).slice(0, 3) }; /* pass 74 — up to 3 top accounts */
  }, [users, matchedPosts, matchedVideos, matchedTags, query]);

  const recent = matchedPosts.slice(0, recentMore ? 15 : 5); /* pass 74 — 15 on show more */

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header + search field */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13 }}>
          <FontAwesome5 name="search" size={12} color={d.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search posts, people, videos, #tags…"
            placeholderTextColor={d.faint}
            autoFocus
            style={{ flex: 1, fontSize: 13.5, color: d.text, paddingVertical: 10 }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <FontAwesome5 name="times-circle" size={13} color={d.faint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* tabs — only while searching */}
      {searching ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => pickTab(t.id)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 11, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.10)') : 'transparent', borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.35)') : 'transparent' }}
              >
                <FontAwesome5 name={t.icon as never} size={9} color={on ? (isDark ? '#4AE38F' : '#0E7A46') : d.faint} />
                <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: on ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext }}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FadeSlide k={searching ? `${tab}:${query}` : 'idle'}>
        {!searching ? (
          /* ── idle: recent posts ── */
          <View>
            {history.length ? (
              <View style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <SectionLabel>Search history</SectionLabel>
                  <Pressable onPress={() => { haptic.light(); clearHistory(); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name="trash" size={10.5} color={d.faint} />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.faint }}>Clear</T>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(histMore ? history.slice(0, 15) : history.slice(0, 7)).map((h) => (
                    <Pressable key={h} onPress={() => { haptic.selection(); setQ(h); }}
                      style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 12, paddingVertical: 7 }}>
                      <T v="caption" style={{ fontWeight: '700', fontSize: 11.5, color: d.text }}>{h}</T>
                    </Pressable>
                  ))}
                </View>
                {history.length > 7 ? (
                  <Pressable onPress={() => { haptic.light(); setHistMore((v) => !v); }} hitSlop={6} style={{ marginTop: 8 }}>
                    <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: isDark ? '#4AE38F' : '#1D6F42' }}>{histMore ? 'Show less' : 'Show more'}</T>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <SectionLabel>Recent posts</SectionLabel>
            {!posts ? <Skeleton rows={4} shape="post" tint={d.bgSoft} card={d.card} border={d.cardBorder} /> : null}
            {recent.map((p, i) => <RowIn key={p.id} i={i}><PostRow p={p} /></RowIn>)}
            {posts && matchedPosts.length > 5 ? (
              <Pressable
                onPress={() => { haptic.light(); setRecentMore((v) => !v); }}
                style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', paddingVertical: 12, marginTop: 2 }}
              >
                <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: isDark ? '#4AE38F' : '#1D6F42' }}>{recentMore ? 'Show less' : 'See more posts'}</T>
              </Pressable>
            ) : null}
            {posts && !matchedPosts.length ? (
              <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 30 }}>Nothing posted yet.</T>
            ) : null}
          </View>
        ) : tab === 'top' ? (
          /* ── Top: the best of everything, mixed ── */
          <View>
            {loading.top && !topMix.bestPost && !topMix.bestAcc ? (
              <Skeleton rows={3} shape="post" tint={d.bgSoft} card={d.card} border={d.cardBorder} />
            ) : null}
            {topMix.topAccs.length ? <RowIn i={0}><SectionLabel>{`Top account${topMix.topAccs.length > 1 ? 's' : ''}`}</SectionLabel>{topMix.topAccs.map((a) => <UserRow key={`${a.id}-${a.username}`} u={a} />)}</RowIn> : null}
            {topMix.bestPost ? <RowIn i={1}><SectionLabel>Top post</SectionLabel><PostRow p={topMix.bestPost} /></RowIn> : null}
            {topMix.bestVideo ? <RowIn i={2}><SectionLabel>Top video</SectionLabel><VideoRow v={topMix.bestVideo} /></RowIn> : null}
            {topMix.bestTag ? <RowIn i={3}><SectionLabel>Top hashtag</SectionLabel><TagRow t={topMix.bestTag} /></RowIn> : null}
            {topMix.restTags.length ? <RowIn i={4}><SectionLabel>More hashtags</SectionLabel>{topMix.restTags.map((t) => <TagRow key={t.tag} t={t} />)}</RowIn> : null}
            {topMix.restPosts.length ? <RowIn i={5}><SectionLabel>More posts</SectionLabel>{topMix.restPosts.map((p, i2) => <PostRow key={p.id} p={p} />)}</RowIn> : null}
            {!loading.top && !topMix.bestAcc && !topMix.bestPost && !topMix.bestVideo && !topMix.bestTag ? (
              <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 40 }}>No matches for “{q.trim()}”.</T>
            ) : null}
          </View>
        ) : tab === 'users' ? (
          loading.users && !users ? <Skeleton rows={5} shape="user" tint={d.bgSoft} card={d.card} border={d.cardBorder} /> : users && users.length ? (
            users.map((u, i) => <RowIn key={`${u.id}-${u.username}`} i={i}><UserRow u={u} /></RowIn>)
          ) : (
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 40 }}>No users found.</T>
          )
        ) : tab === 'videos' ? (
          !videos ? <Skeleton rows={5} shape="video" tint={d.bgSoft} card={d.card} border={d.cardBorder} /> : matchedVideos.length ? (
            matchedVideos.map((v, i) => <RowIn key={v.id} i={i}><VideoRow v={v} /></RowIn>)
          ) : (
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 40 }}>No videos found.</T>
          )
        ) : (
          !posts ? <Skeleton rows={5} shape="tag" tint={d.bgSoft} card={d.card} border={d.cardBorder} /> : matchedTags.length ? (
            matchedTags.map((t, i) => <RowIn key={t.tag} i={i}><TagRow t={t} /></RowIn>)
          ) : (
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 40 }}>No hashtags found.</T>
          )
        )}
        </FadeSlide>
      </ScrollView>

      <VideoModal video={videoOpen} liked={false} onLike={() => {}} onClose={() => setVideoOpen(null)} />
    </View>
  );
}
