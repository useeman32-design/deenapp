import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api, type FeedTab } from '@/api/client';
import type { Post } from '@/api/mocks';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ComposeModal } from '@/components/ComposeModal';
import { PostCard } from '@/components/PostCard';
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
    setPosts((ps) =>
      ps.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
    );

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
      <View
        style={{
          paddingHorizontal: 18,
          paddingTop: 14,
          paddingBottom: 10,
          backgroundColor: theme.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Text style={{ fontSize: 19, fontWeight: '800', color: theme.heading }}>Community</Text>
        <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>Share reminders and grow together</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: tab === t.id ? theme.primary : theme.primarySoft,
                borderWidth: 1,
                borderColor: tab === t.id ? theme.primary : 'transparent',
              }}
            >
              <Text style={{ color: tab === t.id ? '#fff' : theme.primary, fontWeight: '700', fontSize: 12 }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {posts.map((p) => (
          <PostCard key={p.id} post={p} onLike={like} />
        ))}
      </ScrollView>

      <Pressable
        onPress={() => setCompose(true)}
        style={({ pressed }) => [
          {
            position: 'absolute',
            right: 20,
            bottom: 24,
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: theme.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          },
          pressed && { opacity: 0.85 },
        ]}
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
