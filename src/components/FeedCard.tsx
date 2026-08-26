import { Linking, Pressable, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { Post } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { ChatIcon, FlagIcon, HeartIcon, PlayIcon, ShareIcon } from '@/components/Icons';

/**
 * Web .feed-card, 1:1 — white card, radius 16, soft shadow, 16px padding,
 * 20px gap; name 14/600 with verify badge, @handle 11px, follow pill,
 * 13px body, action row with top hairline (like · comment · share / report).
 */
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

  const liked = !!post.liked_by_me;

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Avatar name={user.full_name ?? user.username} color={theme.primary} size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T v="body" style={{ fontWeight: '600', fontSize: 14 }}>
              {user.full_name ?? user.username}
            </T>
            {user.verification_badge ? <VerificationBadge type={user.verification_badge} size={13} /> : null}
          </View>
          <T v="caption" style={{ fontSize: 11, marginTop: 2, color: theme.subtext }}>
            @{user.username} · {post.time_ago ?? ''}
          </T>
        </View>
      </View>

      {/* Body */}
      {post.content_text ? (
        <T v="bodyS" style={{ fontSize: 13, lineHeight: 19.5, marginBottom: 14 }}>
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
            marginBottom: 14,
            backgroundColor: theme.cardSoft,
            borderRadius: 12,
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
            marginTop: post.content_text ? 0 : 12,
            backgroundColor: theme.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            marginBottom: 14,
          }}
        >
          <T v="h3" style={{ fontSize: 16, lineHeight: 22 }}>
            {post.public_qa.question ?? 'Question'}
          </T>
          {post.public_qa.answer ? (
            <T v="bodyS" style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, lineHeight: 20 }}>
              {post.public_qa.answer}
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
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.cardSoft,
          }}
        >
          <Pressable onPress={() => onLike?.(post.id)} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: pressed ? 0.6 : 1 })}>
            <HeartIcon size={15} filled={liked} color={liked ? '#E74C3C' : theme.subtext} />
            <T v="caption" style={{ fontWeight: '500', color: liked ? '#E74C3C' : theme.subtext, fontSize: 13 }}>
              {post.like_count ?? 0}
            </T>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 18 }}>
            <ChatIcon size={15} color={theme.subtext} />
            <T v="caption" style={{ fontWeight: '500', fontSize: 13 }}>{post.comment_count ?? 0}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 18 }}>
            <ShareIcon size={15} color={theme.subtext} />
            <T v="caption" style={{ fontWeight: '500', fontSize: 13 }}>
              Share
            </T>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <FlagIcon size={14} color="#B45309" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
