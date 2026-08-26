import { Linking, Pressable, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { Post } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { HeartIcon, ShareIcon, ChatIcon, FlagIcon, PlayIcon } from '@/components/Icons';

export function FeedCard({
  post,
  onLike,
  showActions = true,
}: {
  post: Post;
  onLike?: (id: number) => void;
  showActions?: boolean;
}) {
  const { theme } = useTheme();
  const user = post.user;

  const openYouTube = () => {
    if (post.youtube_url) Linking.openURL(post.youtube_url).catch(() => {});
  };

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 14,
        marginBottom: 11,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={user.full_name ?? user.username} color={theme.primary} size={42} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <T v="h3" style={{ fontSize: 13.5 }}>
              {user.full_name ?? user.username}
            </T>
            {user.verification_badge ? <VerificationBadge type={user.verification_badge} size={14} /> : null}
          </View>
          <T v="caption" style={{ marginTop: 1 }}>
            @{user.username} · {post.time_ago ?? ''}
          </T>
        </View>
      </View>

      {/* Body */}
      {post.content_text ? (
        <T v="bodyS" style={{ marginTop: 10, lineHeight: 20 }}>
          {post.content_text}
        </T>
      ) : null}

      {/* YouTube link */}
      {post.youtube_url ? (
        <Pressable
          onPress={openYouTube}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 10,
            backgroundColor: theme.cardSoft,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 11,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: theme.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlayIcon size={15} color="#fff" />
          </View>
          <T v="bodyS" style={{ flex: 1, color: theme.text }}>
            Watch video
          </T>
          <T v="caption" color="primary" style={{ fontWeight: '700' }}>
            Open
          </T>
        </Pressable>
      ) : null}

      {/* Scholar Q&A card */}
      {post.is_public_qa && post.public_qa ? (
        <View
          style={{
            marginTop: 10,
            backgroundColor: theme.cardSoft,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 12,
          }}
        >
          <T v="meta" color="primary" uppercase style={{ letterSpacing: 1 }}>
            Scholar Q&A
          </T>
          {post.public_qa.question ? (
            <T v="bodyS" style={{ marginTop: 7, fontWeight: '600' }}>
              Q: {post.public_qa.question}
            </T>
          ) : null}
          {post.public_qa.answer ? (
            <T v="bodyS" style={{ marginTop: 6, lineHeight: 19 }}>
              A: {post.public_qa.answer}
            </T>
          ) : null}
        </View>
      ) : null}

      {/* Actions */}
      {showActions ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <Pressable onPress={() => onLike?.(post.id)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <HeartIcon
              size={17}
              color={post.liked_by_me ? theme.danger : theme.subtext}
              filled={post.liked_by_me}
            />
            <T v="caption" style={{ fontWeight: '700', color: post.liked_by_me ? theme.danger : theme.subtext }}>
              {post.like_count}
            </T>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 22 }}>
            <ChatIcon size={16} color={theme.subtext} />
            <T v="caption" style={{ fontWeight: '700' }}>{post.comment_count}</T>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={8} onPress={() => {}} style={{ marginRight: 20 }}>
            <ShareIcon size={16} color={theme.subtext} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => {}}>
            <FlagIcon size={15} color={theme.subtext} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
