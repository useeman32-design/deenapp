import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
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
import { MOCK_ACCOUNTS, MOCK_FEED, MOCK_VIDEOS } from '@/api/mocks';

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
  const [videoOpen, setVideoOpen] = useState<Video | null>(null);

  /* pools — loaded once, filtered per tab */
  useEffect(() => {
    api.feed('for-you').then((r) => setPosts(r.posts && r.posts.length ? r.posts : MOCK_FEED)).catch(() => setPosts(MOCK_FEED));
    api.videos('all').then((v) => setVideos(v.length ? v : MOCK_VIDEOS)).catch(() => setVideos(MOCK_VIDEOS));
  }, []);

  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  const matchedPosts = useMemo(
    () => (posts ?? []).filter((p) => !searching || (p.content_text ?? '').toLowerCase().includes(query) || (p.user?.full_name ?? '').toLowerCase().includes(query) || (p.user?.username ?? '').toLowerCase().includes(query)),
    [posts, query, searching],
  );
  const matchedVideos = useMemo(
    () => (videos ?? []).filter((v) => !searching || (v.title ?? '').toLowerCase().includes(query) || (v.description ?? '').toLowerCase().includes(query)),
    [videos, query, searching],
  );
  const allTags = useMemo(() => tagsOf(posts ?? []), [posts]);
  const matchedTags = useMemo(
    () => allTags.filter((t) => !searching || t.tag.includes(query.replace(/^#/, ''))),
    [allTags, query, searching],
  );

  /* Users tab loads from the real account search the first time it opens (or
   * the query changes while it is open). Demo mode filters the mock roster. */
  useEffect(() => {
    if (!searching || tab !== 'users') return;
    if (!api.isLive()) {
      setUsers(
        MOCK_ACCOUNTS.filter((a) => a.full_name.toLowerCase().includes(query) || a.username.toLowerCase().includes(query))
          .map((a) => ({ id: 0, username: a.username, full_name: a.full_name, profile_image_url: typeof a.photo === 'string' ? a.photo : null, followers_count: 0 })),
      );
      return;
    }
    setLoading((l) => ({ ...l, users: true }));
    api.searchAccounts(query).then((r) => setUsers(r ?? [])).finally(() => setLoading((l) => ({ ...l, users: false })));
  }, [tab, query, searching]);

  const pickTab = (t: Tab) => {
    if (t === tab) return;
    haptic.selection();
    setTab(t);
  };

  /* ── shared rows ── */
  const UserRow = ({ u }: { u: AccountResult }) => (
    <Pressable
      onPress={() => { haptic.light(); router.push(`/profile/${u.username}`); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 11, marginBottom: 9, opacity: pressed ? 0.8 : 1 })}
    >
      <AvatarImage source={u.profile_image_url ?? null} name={u.full_name} size={44} tint={d.bgSoft} border={d.cardBorder} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="bodyS" numberOfLines={2} style={{ fontWeight: '700', fontSize: 13, color: d.text }}>{u.full_name}</T>
        <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>@{u.username}{u.followers_count ? ` · ${fmt(u.followers_count)} followers` : ''}</T>
      </View>
      <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
    </Pressable>
  );

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

  const Spinner = () => (
    <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
      <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
      <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>Loading…</T>
    </View>
  );

  const TABS: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'top', label: 'Top', icon: 'fire' },
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'videos', label: 'Videos', icon: 'play-circle' },
    { id: 'hashtags', label: 'Hashtags', icon: 'hashtag' },
  ];

  /* the mixed "Top" list: the single best of each kind, then the rest */
  const topMix = useMemo(() => {
    const acc = users ?? (api.isLive() ? null : MOCK_ACCOUNTS.filter((a) => a.full_name.toLowerCase().includes(query) || a.username.toLowerCase().includes(query)).map((a) => ({ id: 0, username: a.username, full_name: a.full_name, profile_image_url: typeof a.photo === 'string' ? a.photo : null, followers_count: 0 })));
    const bestPost = [...matchedPosts].sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))[0];
    const bestVideo = matchedVideos[0];
    const bestTag = matchedTags[0];
    const bestAcc = acc?.[0];
    return { bestAcc, bestPost, bestVideo, bestTag, restPosts: matchedPosts.filter((p) => p !== bestPost).slice(0, 4), restTags: matchedTags.filter((t) => t !== bestTag).slice(0, 3) };
  }, [users, matchedPosts, matchedVideos, matchedTags, query]);

  const recent = matchedPosts.slice(0, recentMore ? 20 : 5);

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
        {!searching ? (
          /* ── idle: recent posts ── */
          <View>
            <SectionLabel>Recent posts</SectionLabel>
            {!posts ? <Spinner /> : null}
            {recent.map((p) => <PostRow key={p.id} p={p} />)}
            {posts && !recentMore && matchedPosts.length > 5 ? (
              <Pressable
                onPress={() => { haptic.light(); setRecentMore(true); }}
                style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', paddingVertical: 12, marginTop: 2 }}
              >
                <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: isDark ? '#4AE38F' : '#1D6F42' }}>See more posts</T>
              </Pressable>
            ) : null}
            {posts && !matchedPosts.length ? (
              <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 30 }}>Nothing posted yet.</T>
            ) : null}
          </View>
        ) : tab === 'top' ? (
          /* ── Top: the best of everything, mixed ── */
          <View>
            {topMix.bestAcc ? <><SectionLabel>Top account</SectionLabel><UserRow u={topMix.bestAcc} /></> : null}
            {topMix.bestPost ? <><SectionLabel>Top post</SectionLabel><PostRow p={topMix.bestPost} /></> : null}
            {topMix.bestVideo ? <><SectionLabel>Top video</SectionLabel><VideoRow v={topMix.bestVideo} /></> : null}
            {topMix.bestTag ? <><SectionLabel>Top hashtag</SectionLabel><TagRow t={topMix.bestTag} /></> : null}
            {topMix.restTags.length ? <><SectionLabel>More hashtags</SectionLabel>{topMix.restTags.map((t) => <TagRow key={t.tag} t={t} />)}</> : null}
            {topMix.restPosts.length ? <><SectionLabel>More posts</SectionLabel>{topMix.restPosts.map((p) => <PostRow key={p.id} p={p} />)}</> : null}
            {!topMix.bestAcc && !topMix.bestPost && !topMix.bestVideo && !topMix.bestTag ? (
              <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 40 }}>No matches for “{q.trim()}”.</T>
            ) : null}
          </View>
        ) : tab === 'users' ? (
          loading.users && !users ? <Spinner /> : users && users.length ? (
            users.map((u) => <UserRow key={`${u.id}-${u.username}`} u={u} />)
          ) : (
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 40 }}>No users found.</T>
          )
        ) : tab === 'videos' ? (
          !videos ? <Spinner /> : matchedVideos.length ? (
            matchedVideos.map((v) => <VideoRow key={v.id} v={v} />)
          ) : (
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 40 }}>No videos found.</T>
          )
        ) : (
          matchedTags.length ? (
            matchedTags.map((t) => <TagRow key={t.tag} t={t} />)
          ) : (
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center', marginTop: 40 }}>No hashtags found.{posts ? '' : ' (loading posts…)'}</T>
          )
        )}
      </ScrollView>

      <VideoModal video={videoOpen} liked={false} onLike={() => {}} onClose={() => setVideoOpen(null)} />
    </View>
  );
}
