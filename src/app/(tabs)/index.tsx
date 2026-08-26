import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import * as api from '@/api/client';
import { storage } from '@/lib/storage';
import type { FeedTab, Post, Video } from '@/api/types';
import { HeroHeader } from '@/components/HeroHeader';
import { QuickGrid } from '@/components/QuickGrid';
import { FeedCard } from '@/components/FeedCard';
import { T } from '@/components/T';
import {
  BullhornIcon,
  MoonStarIcon,
  PaperPlaneIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  XIcon,
} from '@/components/Icons';

const FEED_TABS: { id: FeedTab; label: string }[] = [
  { id: 'for-you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'scholars', label: 'Scholars' },
];

export default function Home() {
  const { theme, setMode, mode } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [tab, setTab] = useState<FeedTab>('for-you');
  const [refreshing, setRefreshing] = useState(false);
  const [compose, setCompose] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [body, setBody] = useState('');
  const [youtube, setYoutube] = useState('');
  const [fabOpen, setFabOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const load = useCallback((t: FeedTab) => {
    api.feed(t).then((r) => setPosts(r.posts));
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  useEffect(() => {
    api.videos('daily').then(setVideos);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const text = await api.announcement();
      if (!text || !alive) return;
      const key = `dl.ann.dismissed.${text.slice(0, 40).replace(/\s+/g, '-')}`;
      const dismissed = await storage.getItem(key);
      if (!dismissed) setAnnouncement(text);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const dismissAnnouncement = async () => {
    if (!announcement) return;
    const key = `dl.ann.dismissed.${announcement.slice(0, 40).replace(/\s+/g, '-')}`;
    await storage.setItem(key, new Date().toISOString());
    setAnnouncement(null);
  };

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
    await api.createPost(body.trim(), youtube.trim() || undefined);
    const b = body.trim();
    setBody('');
    setYoutube('');
    load(tab);
    if (!api.isLive()) {
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

  const videoTitle = (v: Video) => v.title ?? 'Daily video';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <FeedCard post={item} onLike={like} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
        ListHeaderComponent={
          <View>
            <HeroHeader
              onSearch={() => {
                setSearchOpen(true);
                setFabOpen(false);
              }}
              onMessages={() => router.push('/(tabs)/profile')}
            />

            {/* Announcement (web order: hero → announcement → quick access) */}
            {announcement ? (
              <View style={{ paddingTop: 12, paddingLeft: 16, paddingRight: 16 }}>
                <View
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOpacity: 0.08,
                    shadowRadius: 11,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingLeft: 16, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: theme.primary,
                          opacity: 0.12,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BullhornIcon size={14} color={theme.primary} />
                      </View>
                      <T v="bodyS" color="primary" style={{ fontWeight: '600' }}>
                        Announcement
                      </T>
                    </View>
                    <Pressable onPress={dismissAnnouncement} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.cardSoft, alignItems: 'center', justifyContent: 'center' }} hitSlop={6}>
                      <XIcon size={13} color={theme.subtext} />
                    </Pressable>
                  </View>
                  <T v="bodyS" style={{ padding: 16, paddingTop: 10, lineHeight: 20 }}>
                    {announcement}
                  </T>
                </View>
              </View>
            ) : null}

            {/* Quick access */}
            <View style={{ paddingTop: 20, paddingLeft: 16, paddingRight: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <T v="h2" style={{ fontWeight: '600' }}>
                  Quick Access
                </T>
                <Pressable
                  onPress={() => setMode((mode === 'dark' ? 'light' : 'dark') as ThemeMode)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: theme.border,
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <MoonStarIcon size={15} color={theme.text} />
                  <T v="caption" style={{ fontWeight: '500', color: theme.text }}>
                    {mode === 'dark' ? 'Light' : 'Dark'}
                  </T>
                </Pressable>
              </View>
              <QuickGrid onOpenPost={() => setCompose(true)} />
            </View>

            {/* Feed tabs (web style: full-width underline tabs) */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.card,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
                marginTop: 6,
                paddingLeft: 16, paddingRight: 16,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              {FEED_TABS.map((ft) => {
                const active = tab === ft.id;
                return (
                  <Pressable
                    key={ft.id}
                    onPress={() => setTab(ft.id)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 16,
                      borderBottomWidth: 3,
                                            borderBottomColor: active ? theme.primary : 'transparent',
                    }}
                  >
                    <T v="bodyS" color={active ? 'primary' : 'subtext'} style={{ fontWeight: '500' }}>
                      {ft.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>

            {/* Daily videos (For You only) */}
            {tab === 'for-you' ? (
              <View style={{ paddingTop: 16, paddingLeft: 16, paddingRight: 16, paddingBottom: 4 }}>
                <T v="h2" style={{ fontWeight: '600', marginBottom: 12 }}>
                  Daily Videos by DeenLink
                </T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
                  {videos.map((v) => (
                    <VideoCard key={v.id} video={v} title={videoTitle(v)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Feed content padding */}
            <View style={{ paddingTop: 4, paddingLeft: 16, paddingRight: 16 }} />
          </View>
        }
        ListEmptyComponent={
          <View style={{ padding: 30, paddingHorizontal: 24, alignItems: 'center' }}>
            <T v="h3" style={{ textAlign: 'center' }}>
              No posts yet
            </T>
            <T v="caption" style={{ marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
              Be the first to share a reminder with the community.
            </T>
          </View>
        }
        ListFooterComponent={
          <T v="caption" style={{ textAlign: 'center', marginTop: 4 }}>
            {api.isLive() ? '' : 'Offline — showing demo feed'}
          </T>
        }
      />

      {/* Search overlay (web style) */}
      {searchOpen ? (
        <View style={{ position: 'absolute', top: 70, left: 16, right: 16, zIndex: 50 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.card,
              borderRadius: 30,
              paddingHorizontal: 16,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 5,
            }}
          >
            <SearchIcon size={15} color={theme.subtext} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search accounts by name or username..."
              placeholderTextColor={theme.subtext}
              autoFocus
              style={{ flex: 1, fontFamily: 'Poppins-Medium', fontSize: 14, color: theme.text, paddingVertical: 12, paddingLeft: 10 }}
            />
            <Pressable onPress={() => setSearchOpen(false)} style={{ padding: 6 }}>
              <XIcon size={15} color={theme.subtext} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* FAB menu */}
      {fabOpen ? (
        <View style={{ position: 'absolute', bottom: 165, right: 26, gap: 15, alignItems: 'center', zIndex: 40 }}>
          {[
            { label: 'Add Post', icon: <PlusIcon size={18} color={theme.text} />, onPress: () => { setFabOpen(false); setCompose(true); } },
            { label: 'Send Message', icon: <PaperPlaneIcon size={17} color={theme.text} />, onPress: () => { setFabOpen(false); router.push('/(tabs)/profile'); } },
            { label: 'AI Assistant', icon: <SparkleIcon size={17} color={theme.text} />, onPress: () => { setFabOpen(false); } },
          ].map((it) => (
            <View key={it.label} style={{ alignItems: 'center', gap: 4 }}>
              <Pressable
                onPress={it.onPress}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                {it.icon}
              </Pressable>
              <T v="caption" style={{ fontWeight: '600', color: theme.text, fontSize: 10 }}>
                {it.label}
              </T>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        onPress={() => setFabOpen((o) => !o)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 90,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: fabOpen ? '#F39C12' : theme.primary,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: fabOpen ? '45deg' : '0deg' }],
          opacity: pressed ? 0.9 : 1,
          shadowColor: theme.primary,
          shadowOpacity: 0.5,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
          zIndex: 41,
        })}
      >
        <PlusIcon size={24} color="#fff" />
      </Pressable>

      {/* Add post modal (web style) */}
      <Modal visible={compose} transparent animationType="fade" onRequestClose={() => setCompose(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: 'center', padding: 20 }} onPress={() => setCompose(false)}>
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              padding: 24,
              maxWidth: 500,
              width: '100%',
              alignSelf: 'center',
              gap: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: theme.cardSoft }}>
              <T v="h1" style={{ fontSize: 20, fontWeight: '600' }}>
                Create new post
              </T>
              <Pressable onPress={() => setCompose(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.cardSoft, alignItems: 'center', justifyContent: 'center' }}>
                <XIcon size={16} color={theme.subtext} />
              </Pressable>
            </View>
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
                minHeight: 110,
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
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: theme.primary,
                borderRadius: 12,
                padding: 14,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <PaperPlaneIcon size={15} color="#fff" />
              <T v="button" color="onPrimary">Post</T>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function VideoCard({ video, title }: { video: Video; title: string }) {
  const { theme } = useTheme();
  const router = useRouter();
  const open = () => {
    if (video.source_url) Linking.openURL(video.source_url).catch(() => {});
  };
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => ({
        width: 162,
        height: 234,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: theme.card,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {video.poster_url ? (
        <Image source={{ uri: video.poster_url }} style={{ width: '100%', height: '60%' }} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['rgba(29,111,66,0.95)', 'rgba(29,111,66,0.75)'] as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '100%', height: '60%', alignItems: 'center', justifyContent: 'center' }}
        >
          <PlayIcon size={30} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      )}
      <View style={{ padding: 10, flex: 1 }}>
        <T v="bodyS" style={{ fontWeight: '600', lineHeight: 16 }}>{title}</T>
        <T v="caption" style={{ marginTop: 4 }}>
          {[video.duration, video.view_count ? `${video.view_count.toLocaleString()} views` : 'DeenLink'].filter(Boolean).join(' · ')}
        </T>
      </View>
    </Pressable>
  );
}
