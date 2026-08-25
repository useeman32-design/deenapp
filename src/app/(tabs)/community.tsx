import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { api, type FeedTab } from '@/api/client';
import type { Post } from '@/api/mocks';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ComposeModal } from '@/components/ComposeModal';
import { PostCard } from '@/components/PostCard';
import { Surface } from '@/components/Surface';
import { T } from '@/components/T';
import { Chip } from '@/components/Chip';
import { PlusIcon } from '@/components/Icons';

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'foryou', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'scholars', label: 'Scholars' },
];

export default function Community() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<FeedTab>('foryou');
  const [refreshing, setRefreshing] = useState(false);
  const [compose, setCompose] = useState(false);

  useEffect(() => {
    api.feed(tab).then(setPosts);
  }, [tab]);

  const refresh = async () => {
    setRefreshing(true);
    setPosts(await api.feed(tab));
    setRefreshing(false);
  };

  const like = (id: string) =>
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)));

  const composePost = (body: string) =>
    setPosts((ps) => [
      {
        id: `local-${Date.now()}`,
        author: {
          name: user?.name ?? 'You',
          username: user?.username ?? 'you',
          mizhab: user?.mizhab,
          color: theme.primary,
        },
        time: 'just now',
        body,
        likes: 0,
        liked: false,
        comments: [],
      },
      ...ps,
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
        <T v="h1">Community</T>
        <T v="caption" style={{ marginTop: 3 }}>Share reminders and grow together</T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {TABS.map((t) => (
            <Chip key={t.id} label={t.label} active={tab === t.id} onPress={() => setTab(t.id)} />
          ))}
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} onLike={like} />}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <Surface style={{ padding: 32, alignItems: 'center' }}>
            <T v="bodyS" style={{ textAlign: 'center' }}>No posts yet in this feed</T>
          </Surface>
        }
      />

      <Pressable
        onPress={() => setCompose(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: 26,
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: theme.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
          elevation: 8,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <PlusIcon size={24} color="#fff" />
      </Pressable>

      <ComposeModal
        visible={compose}
        onClose={() => setCompose(false)}
        onSubmit={(b) => {
          composePost(b);
          setCompose(false);
        }}
      />
    </View>
  );
}
