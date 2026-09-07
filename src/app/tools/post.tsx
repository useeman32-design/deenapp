import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { FeedCard } from '@/components/FeedCard';
import { CommentsModal } from '@/components/CommentsModal';
import { goBack } from '@/lib/navigation';
import { haptic } from '@/lib/haptics';
import * as api from '@/api/client';
import type { Post } from '@/api/types';
import { MOCK_COMMENTS, MOCK_FEED } from '@/api/mocks';
import { useIsGuest } from '@/lib/guest';
import { LoginRequired } from '@/components/LoginRequired';

/**
 * pass 67 — single-post viewer (Search → tap a post, hashtag screen → tap).
 * The post is pulled from the feed pools; comments open in the same live
 * CommentsModal the community feed uses.
 */
function PostScreenInner() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const pid = Number(id);

  const [post, setPost] = useState<Post | null>(null);
  const [missed, setMissed] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeAdj, setLikeAdj] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(pid) || pid <= 0) { setMissed(true); return; }
    const found = MOCK_FEED.find((p) => p.id === pid);
    if (found) { setPost(found); setLiked(!!found.liked_by_me); }
    api.feed('for-you').then((r) => {
      const p = (r.posts ?? []).find((x) => x.id === pid);
      if (p) { setPost(p); setLiked(!!p.liked_by_me); }
      else if (!found) setMissed(true);
    }).catch(() => { if (!found) setMissed(true); });
  }, [pid]);

  const toggleLike = () => {
    if (!post) return;
    const want = !liked;
    setLiked(want);
    setLikeAdj((a) => a + (want ? 1 : -1));
    if (api.isLive()) void api.toggleLike(post.id, want);
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>Post</T>
      </View>

      {!post && !missed ? (
        <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
          <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>Opening post…</T>
        </View>
      ) : null}
      {missed ? (
        <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
          <FontAwesome5 name="question-circle" size={24} color={d.faint} />
          <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5 }}>This post is no longer available.</T>
        </View>
      ) : null}

      {post ? (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <FeedCard
            post={{ ...post, liked_by_me: liked, like_count: Math.max(0, (post.like_count ?? 0) + likeAdj) }}
            onLike={() => { haptic.light(); toggleLike(); }}
            onComments={() => setCommentsOpen(true)}
          />
        </ScrollView>
      ) : null}

      <CommentsModal
        visible={commentsOpen}
        post={post}
        seed={post ? MOCK_COMMENTS[post.id] ?? MOCK_COMMENTS[101] ?? [] : []}
        postId={post?.id ?? null}
        onClose={() => setCommentsOpen(false)}
      />
    </View>
  );
}

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
export default function PostScreen() {
  const guest = useIsGuest();
  if (guest) return <LoginRequired module="Posts" />;
  return <PostScreenInner />;
}
