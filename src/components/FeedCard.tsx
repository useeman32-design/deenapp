import { Image, Linking, Pressable, Share, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { DashTheme } from '@/constants/theme';
import type { Post } from '@/api/types';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { ChatIcon, FlagIcon, HeartIcon, PlayIcon, ShareIcon } from '@/components/Icons';

/** Resolves a profile image that may be a bundled asset (number) or a URL (string). */
export function AvatarImage({
  source,
  name,
  size,
  tint,
  border,
}: {
  source?: string | number | null;
  name: string;
  size: number;
  tint: string;
  border: string;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: border,
        backgroundColor: tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {source != null && source !== '' ? (
        <Image
          source={typeof source === 'number' ? source : { uri: String(source) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <T v="bodyS" style={{ color: '#fff', fontSize: size * 0.32, fontWeight: '700' }}>
          {initials}
        </T>
      )}
    </View>
  );
}

/**
 * Instagram-style feed card, tuned for the DeenLink dash palette:
 * photo avatar + name + verify + aqeedah/field chip, full body text,
 * like / comment (opens comments sheet) / share / report actions.
 */
export function FeedCard({
  post,
  onLike,
  onComments,
  showActions = true,
  dash,
  field,
}: {
  post: Post;
  onLike?: (id: number) => void;
  onComments?: (post: Post) => void;
  showActions?: boolean;
  dash?: DashTheme;
  field?: string;
}) {
  const { theme, isDark } = useTheme();
  const user = post.user;
  // color resolution: premium dash palette when provided, base theme otherwise
  const card = dash?.card ?? theme.card;
  const soft = dash ? dash.bgSoft : theme.cardSoft;
  const txt = dash?.text ?? theme.text;
  const sub = dash?.subtext ?? theme.subtext;
  const faint = dash?.faint ?? theme.subtext;
  const hairline = dash?.cardBorder ?? theme.border;
  const accent = dash?.emerald ?? theme.primary;
  const gold = dash?.gold ?? '#D4AF37';
  const danger = dash ? '#FF7B7B' : theme.danger;
  const name = user.full_name ?? user.username;
  const img = (user as { profile_image_url?: string | number | null }).profile_image_url ?? null;

  const openYouTube = () => {
    if (post.youtube_url) Linking.openURL(post.youtube_url).catch(() => {});
  };

  const sharePost = () => {
    Share.share({
      message: `${name} (@${user.username}) on DeenLink: ${post.content_text ?? ''}`,
    }).catch(() => {});
  };

  const liked = !!post.liked_by_me;
  const fieldLabel = field || (user as { fields?: string | null }).fields || user.scholar?.fields_of_knowledge || null;

  return (
    <View
      style={{
        backgroundColor: card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: hairline,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.22 : 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
        <AvatarImage source={img} name={name} size={42} tint={`${accent}26`} border={dash ? dash.greenBorder : hairline} />
        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <T v="body" style={{ fontWeight: '700', fontSize: 13.5, color: txt, flexShrink: 1 }}>
              {name}
            </T>
            {user.verification_badge ? <VerificationBadge type={user.verification_badge} size={13} /> : null}
            <T v="caption" style={{ color: faint, fontSize: 11 }}>
              · {post.time_ago ?? ''}
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <T v="caption" style={{ fontSize: 10.5, color: sub }}>
              @{user.username}
            </T>
            {fieldLabel ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: dash ? `${gold}55` : hairline,
                  borderRadius: 7,
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  backgroundColor: dash ? `${gold}12` : 'transparent',
                }}
              >
                {dash ? (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: gold }} />
                ) : null}
                <T v="caption" style={{ fontSize: 8.5, fontWeight: '700', color: dash ? gold : sub, letterSpacing: 0.5 }}>
                  {String(fieldLabel).toUpperCase()}
                </T>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable hitSlop={10} style={{ padding: 6, opacity: 0.55 }}>
          <T v="caption" style={{ color: faint, fontSize: 15, fontWeight: '700' }}>
            •••
          </T>
        </Pressable>
      </View>

      {/* Body */}
      {post.content_text ? (
        <T v="bodyS" style={{ fontSize: 13.5, lineHeight: 20.5, marginBottom: 12, color: txt }}>
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
            marginBottom: 12,
            backgroundColor: soft,
            borderRadius: 12,
            padding: 11,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger, alignItems: 'center', justifyContent: 'center' }}>
            <PlayIcon size={15} color="#fff" />
          </View>
          <T v="bodyS" style={{ flex: 1, color: txt }}>
            Watch video
          </T>
          <T v="caption" style={{ fontWeight: '700', color: accent }}>
            Open
          </T>
        </Pressable>
      ) : null}

      {/* Scholar Q&A card */}
      {post.is_public_qa && post.public_qa ? (
        <View
          style={{
            marginTop: post.content_text ? 0 : 4,
            backgroundColor: soft,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: dash ? `${gold}33` : hairline,
            borderLeftWidth: 3,
            borderLeftColor: dash ? gold : accent,
            padding: 13,
            marginBottom: 12,
          }}
        >
          <T v="bodyS" style={{ fontWeight: '700', fontSize: 13.5, lineHeight: 19, color: txt }}>
            {post.public_qa.question ?? 'Question'}
          </T>
          {post.public_qa.answer ? (
            <T v="bodyS" style={{ marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: hairline, lineHeight: 19.5, color: sub }}>
              {post.public_qa.answer}
            </T>
          ) : null}
        </View>
      ) : null}

      {/* Actions — Instagram-style */}
      {showActions ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 11, borderTopWidth: 1, borderTopColor: hairline }}>
          <Pressable onPress={() => onLike?.(post.id)} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}>
            <HeartIcon size={18} filled={liked} color={liked ? '#E74C3C' : sub} />
            <T v="caption" style={{ fontWeight: '600', color: liked ? '#E74C3C' : sub, fontSize: 12.5 }}>
              {post.like_count ?? 0}
            </T>
          </Pressable>
          <Pressable onPress={() => onComments?.(post)} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 20, opacity: pressed ? 0.6 : 1 })}>
            <ChatIcon size={18} color={sub} />
            <T v="caption" style={{ fontWeight: '600', fontSize: 12.5, color: sub }}>
              {post.comment_count ?? 0}
            </T>
          </Pressable>
          <Pressable onPress={sharePost} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 20, opacity: pressed ? 0.6 : 1 })}>
            <ShareIcon size={18} color={sub} />
            <T v="caption" style={{ fontWeight: '600', fontSize: 12.5, color: sub }}>
              Share
            </T>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <FlagIcon size={15} color="#B45309" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
