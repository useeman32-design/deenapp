import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Post } from '@/api/mocks';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from './Avatar';

export function PostCard({ post, onLike }: { post: Post; onLike?: (id: string) => void }) {
  const { theme } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}`)}
      style={({ pressed }) => [
        {
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          marginBottom: 12,
          padding: 14,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={post.author.name} color={post.author.color} size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontWeight: '700', color: theme.text, fontSize: 14.5}}>{post.author.name}</Text>
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 1 }}>
            @{post.author.username} · {post.time}
            {post.author.mizhab ? ` · ${post.author.mizhab}` : ''}
          </Text>
        </View>
      </View>

      <Text style={{ marginTop: 10, color: theme.text, fontSize: 14.5, lineHeight: 21 }}>{post.body}</Text>

      {post.arabic ? (
        <Text style={{ marginTop: 10, fontSize: 25, color: theme.primary, textAlign: 'right', lineHeight: 38 }}>
          {post.arabic}
        </Text>
      ) : null}

      {post.image ? (
        <View
          style={{
            marginTop: 10,
            borderRadius: 12,
            height: 150,
            backgroundColor: post.image.color,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 12,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center' }}>{post.image.label}</Text>
        </View>
      ) : null}

      {post.video ? (
        <View
          style={{
            marginTop: 10,
            borderRadius: 12,
            height: 140,
            backgroundColor: '#0B1210',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 32 }}>▶</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 6 }}>
            Video · plays in the in-app player (v1.1)
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <Pressable
          onPress={() => onLike?.(post.id)}
          hitSlop={8}
          style={{ marginRight: 20 }}
        >
          <Text style={{ color: post.liked ? theme.accent : theme.subtext, fontSize: 13.5, fontWeight: '600' }}>
            {post.liked ? '★' : '☆'} {post.likes}
          </Text>
        </Pressable>
        <Text style={{ color: theme.subtext, fontSize: 13.5, fontWeight: '600' }}>💬 {post.comments.length}</Text>
      </View>
    </Pressable>
  );
}
