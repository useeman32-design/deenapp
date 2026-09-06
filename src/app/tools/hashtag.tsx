import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { FeedCard } from '@/components/FeedCard';
import { VideoModal } from '@/components/VideoModal';
import { goBack } from '@/lib/navigation';
import { haptic } from '@/lib/haptics';
import * as api from '@/api/client';
import type { Post, Video } from '@/api/types';
import { MOCK_FEED, MOCK_VIDEOS } from '@/api/mocks';

/**
 * pass 67 — the hashtag screen: everything filed under #tag — posts first
 * (full FeedCards, live likes/comments), then videos whose copy carries the
 * same tag. Reached from Search → Hashtags / Top.
 */
export default function HashtagScreen() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tag } = useLocalSearchParams<{ tag?: string }>();
  const t = (tag ?? '').replace(/^#/, '').toLowerCase();

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [videoOpen, setVideoOpen] = useState<Video | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.feed('for-you').then((r) => setPosts(r.posts && r.posts.length ? r.posts : MOCK_FEED)).catch(() => setPosts(MOCK_FEED));
    api.videos('all').then((v) => setVideos(v.length ? v : MOCK_VIDEOS)).catch(() => setVideos(MOCK_VIDEOS));
  }, []);

  const has = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(`#${t}`);
  const tagged = useMemo(() => (posts ?? []).filter((p) => has(p.content_text)), [posts, t]);
  const taggedVideos = useMemo(() => (videos ?? []).filter((v) => has(v.title) || has(v.description)), [videos, t]);

  const toggleLike = (id: number) => {
    const want = !likedPosts.has(id);
    setLikedPosts((prev) => {
      const n = new Set(prev);
      if (want) n.add(id); else n.delete(id);
      return n;
    });
    if (api.isLive()) void api.toggleLike(id, want);
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <FontAwesome5 name="hashtag" size={13} color="#D4AF37" />
        <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text, flexShrink: 1 }} numberOfLines={1}>{t}</T>
      </View>

      {!posts ? (
        <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
          <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>Loading #{t}…</T>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {posts && !tagged.length && !taggedVideos.length ? (
          <View style={{ alignItems: 'center', marginTop: 50, gap: 8 }}>
            <FontAwesome5 name="hashtag" size={24} color={d.faint} />
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5 }}>Nothing under #{t} yet — be the first to post it.</T>
          </View>
        ) : null}

        {tagged.map((p) => (
          <View key={p.id} style={{ marginBottom: 12 }}>
            <FeedCard
              post={{ ...p, liked_by_me: likedPosts.has(p.id) || p.liked_by_me, like_count: (p.like_count ?? 0) + (likedPosts.has(p.id) && !p.liked_by_me ? 1 : 0) }}
              onLike={(id) => toggleLike(id)}
            />
          </View>
        ))}

        {taggedVideos.length ? (
          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: d.faint, marginTop: 8, marginBottom: 8 }}>VIDEOS</T>
        ) : null}
        {taggedVideos.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => { haptic.light(); setVideoOpen(v); }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 11, marginBottom: 9, opacity: pressed ? 0.8 : 1 })}
          >
            <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: isDark ? 'rgba(74,227,143,0.12)' : 'rgba(14,122,70,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="play" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="bodyS" numberOfLines={2} style={{ fontWeight: '700', fontSize: 12.5, color: d.text }}>{v.title ?? 'Video'}</T>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{v.duration ? `${v.duration} · ` : ''}{v.view_count ?? 0} views</T>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <VideoModal video={videoOpen} liked={false} onLike={() => {}} onClose={() => setVideoOpen(null)} />
    </View>
  );
}
