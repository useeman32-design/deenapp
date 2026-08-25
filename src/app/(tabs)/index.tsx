import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api, type FeedTab } from '@/api/client';
import type { Post } from '@/api/mocks';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { ComposeModal } from '@/components/ComposeModal';
import { PostCard } from '@/components/PostCard';
import { PrayerBanner } from '@/components/PrayerBanner';
import { QuickGrid } from '@/components/QuickGrid';
import { SectionHeader } from '@/components/SectionHeader';

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'foryou', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'scholars', label: 'Scholars' },
];

export default function Home() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<FeedTab>('foryou');
  const [announcement, setAnnouncement] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [compose, setCompose] = useState(false);

  useEffect(() => {
    api.feed(tab).then(setPosts);
    api.announcement().then((a) => setAnnouncement(a.text));
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
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 25, fontWeight: '800', color: theme.primary }}>🕌 DeenLink</Text>
            <Text style={{ color: theme.subtext, marginTop: 2, fontSize: 13.5 }}>
              Assalamu alaykum, {user?.name?.split(' ')[0] ?? 'friend'}
            </Text>
          </View>
          <Pressable
            onPress={() => setCompose(true)}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13.5 }}>+ Post</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 16 }}>
          <PrayerBanner />
        </View>

        {announcement ? (
          <Card
            style={{
              flexDirection: 'row',
              gap: 10,
              backgroundColor: theme.primarySoft,
              borderColor: 'transparent',
            }}
          >
            <Text style={{ fontSize: 18 }}>📢</Text>
            <Text style={{ flex: 1, color: theme.text, fontSize: 13, lineHeight: 19 }}>{announcement}</Text>
          </Card>
        ) : null}

        <SectionHeader title="Quick Access" />
        <QuickGrid />

        <SectionHeader title="Community Feed" />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: tab === t.id ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: tab === t.id ? theme.primary : theme.border,
              }}
            >
              <Text style={{ color: tab === t.id ? '#fff' : theme.subtext, fontWeight: '600', fontSize: 12.5 }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {posts.map((p) => (
          <PostCard key={p.id} post={p} onLike={like} />
        ))}
      </ScrollView>

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
