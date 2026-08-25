import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/api/client';
import type { Post } from '@/api/mocks';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { TopBar } from '@/components/TopBar';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const [post, setPost] = useState<Post | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    api.post(id ?? '').then(setPost);
  }, [id]);

  const sendComment = () => {
    const body = draft.trim();
    if (!body || !post) return;
    setPost({
      ...post,
      comments: [
        ...post.comments,
        {
          id: `c-${Date.now()}`,
          author: 'You',
          color: theme.primary,
          body,
          time: 'just now',
        },
      ],
    });
    setDraft('');
  };

  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <TopBar showBack title="Post" />
        <Text style={{ color: theme.subtext, textAlign: 'center', marginTop: 40, fontSize: 13.5 }}>Loading post…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar showBack title={post.author.name} subtitle={`@${post.author.username} · ${post.time}`} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Avatar name={post.author.name} color={post.author.color} size={44} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 15 }}>{post.author.name}</Text>
            <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 1 }}>
              @{post.author.username}
              {post.author.mizhab ? ` · ${post.author.mizhab}` : ''}
            </Text>
          </View>
        </View>

        <Text style={{ color: theme.text, fontSize: 15.5, lineHeight: 23 }}>{post.body}</Text>
        {post.arabic ? (
          <Text style={{ fontSize: 27, color: theme.primary, textAlign: 'right', lineHeight: 42, marginTop: 12 }}>
            {post.arabic}
          </Text>
        ) : null}
        {post.image ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 14,
              height: 190,
              backgroundColor: post.image.color,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, textAlign: 'center', padding: 14 }}>
              {post.image.label}
            </Text>
          </View>
        ) : null}
        {post.video ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 14,
              height: 180,
              backgroundColor: '#0B1210',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 40 }}>▶</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>
              Video · in-app player in v1.1
            </Text>
          </View>
        ) : null}

        <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text, marginTop: 22, marginBottom: 12 }}>
          Comments ({post.comments.length})
        </Text>
        {post.comments.length === 0 ? (
          <Text style={{ color: theme.subtext, fontSize: 13 }}>Be the first to comment.</Text>
        ) : null}
        {post.comments.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', marginBottom: 14 }}>
            <Avatar name={c.author} color={c.color} size={34} />
            <View
              style={{
                flex: 1,
                marginLeft: 10,
                backgroundColor: theme.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 10,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12.5 }}>{c.author}</Text>
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 3, lineHeight: 18 }}>{c.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          gap: 8,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={theme.subtext}
          style={{
            flex: 1,
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            paddingHorizontal: 13,
            paddingVertical: 10,
            color: theme.text,
            fontSize: 13.5,
          }}
        />
        <Pressable
          onPress={sendComment}
          disabled={!draft.trim()}
          style={{
            backgroundColor: theme.primary,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 11,
            opacity: draft.trim() ? 1 : 0.5,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13.5 }}>Post</Text>
        </Pressable>
      </View>
    </View>
  );
}
