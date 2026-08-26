import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as api from '@/api/client';
import type { FeedTab, Post } from '@/api/types';
import { HeroHeader } from '@/components/HeroHeader';
import { QuickGrid } from '@/components/QuickGrid';
import { FeedCard } from '@/components/FeedCard';
import { Surface } from '@/components/Surface';
import { T } from '@/components/T';
import { Chip } from '@/components/Chip';
import { PlusIcon } from '@/components/Icons';

const FEED_TABS: { id: FeedTab; label: string }[] = [
  { id: 'for-you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'scholars', label: 'Scholars' },
];

export default function Home() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<FeedTab>('for-you');
  const [refreshing, setRefreshing] = useState(false);
  const [compose, setCompose] = useState(false);
  const [body, setBody] = useState('');
  const [youtube, setYoutube] = useState('');

  const load = useCallback(
    (t: FeedTab) => {
      api.feed(t).then((r) => setPosts(r.posts));
    },
    [],
  );

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const refresh = async () => {
    setRefreshing(true);
    const r = await api.feed(tab);
    setPosts(r.posts);
    setRefreshing(false);
  };

  const like = (id: number) =>
    setPosts((ps) =>
      ps.map((p) => (p.id === id ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) } : p)),
    );

  const submitPost = async () => {
    if (!body.trim() && !youtube.trim()) return;
    setCompose(false);
    const res = await api.createPost(body.trim(), youtube.trim() || undefined);
    const b = body.trim();
    setBody('');
    setYoutube('');
    if (!res.ok) {
      // Demo mode: prepend locally so the action feels alive offline.
      setPosts((ps) => [
        {
          id: Date.now(),
          content_text: b,
          youtube_url: youtube.trim() || null,
          time_ago: 'now',
          like_count: 0,
          comment_count: 0,
          liked_by_me: false,
          is_public_qa: false,
          user: {
            id: (user?.id as number) ?? 1,
            username: (user?.username as string) ?? 'you',
            full_name: (user?.full_name as string) ?? 'You',
            verification_badge: null,
          },
          media: [],
        },
        ...ps,
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <FeedCard post={item} onLike={like} />}
        contentContainerStyle={{ padding: 16, paddingTop: 14, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
        ListHeaderComponent={
          <View>
            <HeroHeader />

            {/* Quick access */}
            <T v="h3" style={{ marginTop: 20, marginBottom: 11 }}>
              Quick Access
            </T>
            <QuickGrid />

            {/* Feed */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <T v="h2">Feed</T>
              </View>
              <Pressable
                onPress={() => setCompose(true)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: theme.primary,
                  borderRadius: 999,
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <PlusIcon size={14} color="#fff" />
                <T v="caption" color="onPrimary" style={{ fontWeight: '700' }}>
                  Post
                </T>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 7, marginBottom: 13 }}>
              {FEED_TABS.map((t) => (
                <Chip key={t.id} label={t.label} active={tab === t.id} onPress={() => setTab(t.id)} />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Surface style={{ padding: 28, alignItems: 'center' }}>
            <T v="h3">No posts yet</T>
            <T v="caption" style={{ marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
              Be the first to share a reminder with the community.
            </T>
          </Surface>
        }
        ListFooterComponent={
          <T v="caption" style={{ textAlign: 'center', marginTop: 8 }}>
            {api.isLive() ? '' : 'Offline — showing demo feed'}
          </T>
        }
      />

      {/* Compose modal */}
      <Modal visible={compose} transparent animationType="slide" onRequestClose={() => setCompose(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' }} onPress={() => setCompose(false)}>
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 18,
              paddingBottom: 26,
              gap: 12,
            }}
          >
            <T v="h2">Create new post</T>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write your post description…"
              placeholderTextColor={theme.subtext}
              multiline
              numberOfLines={5}
              style={{
                backgroundColor: theme.cardSoft,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 13,
                paddingTop: 11,
                fontFamily: 'Poppins',
                fontSize: 14,
                color: theme.text,
                minHeight: 90,
                textAlignVertical: 'top',
              }}
            />
            <TextInput
              value={youtube}
              onChangeText={setYoutube}
              placeholder="YouTube link (optional)"
              placeholderTextColor={theme.subtext}
              autoCapitalize="none"
              keyboardType="url"
              style={{
                backgroundColor: theme.cardSoft,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 13,
                paddingVertical: 11,
                fontFamily: 'Poppins',
                fontSize: 13.5,
                color: theme.text,
              }}
            />
            <Pressable
              onPress={submitPost}
              style={({ pressed }) => ({
                backgroundColor: theme.primary,
                borderRadius: 12,
                padding: 13,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <T v="button" color="onPrimary">
                Post
              </T>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
