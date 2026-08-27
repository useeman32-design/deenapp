import React, { useRef, useState } from 'react';
import { Alert, Animated, Image, Linking, Platform, Pressable, Share, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { DashTheme } from '@/constants/theme';
import type { Post } from '@/api/types';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { ChatIcon, FlagIcon, HeartIcon, PlayIcon, ShareIcon } from '@/components/Icons';

/* ------------------------------------------------------------------ */
/* Web-only iframe (react-native-web renders custom components to DOM) */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Web-only: real YouTube iframe inside the post container.
const YouTubeFrame = ({ src, height = 208, title }: { src: string; height?: number; title?: string }) => (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <iframe
    src={src}
    title={title ?? 'DeenLink video'}
    style={{ width: '100%', height, border: 'none', borderRadius: 12, display: 'block', background: '#000' } as any}
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
    referrerPolicy="strict-origin-when-cross-origin"
  />
);
export { YouTubeFrame };

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
 * Instagram-style feed card for the DeenLink dash:
 * photo avatar · name · verify · aqeedah/field chip · full text ·
 * optional image (double-tap to like) · embedded YouTube (web) ·
 * like / comment / share actions · ••• menu (report / don't want to see).
 */
export function FeedCard({
  post,
  onLike,
  onComments,
  onDismiss,
  showActions = true,
  dash,
  field,
}: {
  post: Post;
  onLike?: (id: number) => void;
  onComments?: (post: Post) => void;
  onDismiss?: (id: number) => void;
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

  const [menuOpen, setMenuOpen] = useState(false);
  const lastTap = useRef(0);
  const burst = useRef(new Animated.Value(0)).current;

  const openYouTube = () => {
    if (post.youtube_url) Linking.openURL(post.youtube_url).catch(() => {});
  };

  const sharePost = () => {
    Share.share({
      message: `${name} (@${user.username}) on DeenLink: ${post.content_text ?? ''}`,
    }).catch(() => {});
  };

  const liked = !!post.liked_by_me;

  const likeBurst = () => {
    burst.setValue(0);
    Animated.sequence([
      Animated.timing(burst, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(260),
      Animated.timing(burst, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const onImagePress = () => {
    const now = Date.now();
    const isDouble = now - lastTap.current < 300;
    lastTap.current = now;
    if (isDouble && !liked) {
      onLike?.(post.id);
      likeBurst();
    }
  };

  const fieldLabel = field || (user as { fields?: string | null }).fields || user.scholar?.fields_of_knowledge || null;
  const media = post.media?.[0];
  const mediaUrl = media?.url as string | number | null | undefined;

  const scale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.12] });
  const opacity = burst.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 0.9, 0.9, 0] });

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
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: gold }} />
                <T v="caption" style={{ fontSize: 8.5, fontWeight: '700', color: dash ? gold : sub, letterSpacing: 0.5 }}>
                  {String(fieldLabel).toUpperCase()}
                </T>
              </View>
            ) : null}
          </View>
        </View>
        <Pressable hitSlop={10} onPress={() => setMenuOpen((v) => !v)} style={{ padding: 6, opacity: 0.6 }}>
          <T v="caption" style={{ color: faint, fontSize: 16, fontWeight: '700' }}>
            •••
          </T>
        </Pressable>
      </View>

      {/* ••• menu */}
      {menuOpen ? (
        <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 40 }} onPress={() => setMenuOpen(false)}>
          <View
            style={{
              position: 'absolute',
              top: 30,
              right: 12,
              width: 196,
              borderRadius: 12,
              backgroundColor: card,
              borderWidth: 1,
              borderColor: hairline,
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
              overflow: 'hidden',
            }}
          >
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                Alert.alert('Report post', 'Thanks for letting us know. Our moderation team will review this post.');
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                paddingHorizontal: 12,
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: hairline,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <FlagIcon size={14} color={danger} />
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '600', color: txt }}>
                Report post
              </T>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                Alert.alert('Hidden', `Posts from ${name} are less likely to appear for you.`, [
                  { text: 'Undo', onPress: () => undefined },
                  { text: 'OK', onPress: () => onDismiss?.(post.id) },
                ]);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                paddingHorizontal: 12,
                paddingVertical: 11,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View style={{ width: 14, height: 10, borderRadius: 5, borderWidth: 1.4, borderColor: sub, position: 'relative' }}>
                <View style={{ position: 'absolute', top: 4, left: 1.5, right: 1.5, height: 1.4, backgroundColor: sub, transform: [{ rotate: '-24deg' }] }} />
              </View>
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '600', color: txt }}>
                Don’t want to see this
              </T>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      {/* Body */}
      {post.content_text ? (
        <T v="bodyS" style={{ fontSize: 13.5, lineHeight: 20.5, marginBottom: 12, color: txt }}>
          {post.content_text}
        </T>
      ) : null}

      {/* Media image — double tap to like */}
      {mediaUrl != null ? (
        <Pressable onPress={onImagePress} style={{ marginBottom: 12 }}>
          <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: hairline }}>
            <Image
              source={typeof mediaUrl === 'number' ? mediaUrl : { uri: String(mediaUrl) }}
              style={{ width: '100%', height: 200 }}
              resizeMode="cover"
            />
          </View>
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 200,
              alignItems: 'center',
              justifyContent: 'center',
              opacity,
              transform: [{ scale }],
            }}
          >
            <HeartIcon size={84} filled color="#fff" />
          </Animated.View>
        </Pressable>
      ) : null}

      {/* YouTube — embedded player on web, open-link card elsewhere */}
      {Platform.OS === 'web' && post.youtube_embed_url ? (
        <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: hairline, marginBottom: 12, backgroundColor: '#000' }}>
          <YouTubeFrame src={String(post.youtube_embed_url)} height={206} />
        </View>
      ) : post.youtube_url ? (
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

      {/* Actions — Instagram-style, larger */}
      {showActions ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: hairline }}>
          <Pressable onPress={() => onLike?.(post.id)} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, opacity: pressed ? 0.6 : 1 })}>
            <HeartIcon size={21} filled={liked} color={liked ? '#E74C3C' : sub} />
            <T v="caption" style={{ fontWeight: '600', color: liked ? '#E74C3C' : sub, fontSize: 14 }}>
              {post.like_count ?? 0}
            </T>
          </Pressable>
          <Pressable onPress={() => onComments?.(post)} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 22, opacity: pressed ? 0.6 : 1 })}>
            <ChatIcon size={21} color={sub} />
            <T v="caption" style={{ fontWeight: '600', fontSize: 14, color: sub }}>
              {post.comment_count ?? 0}
            </T>
          </Pressable>
          <Pressable onPress={sharePost} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 22, opacity: pressed ? 0.6 : 1 })}>
            <ShareIcon size={20} color={sub} />
            <T v="caption" style={{ fontWeight: '600', fontSize: 14, color: sub }}>
              Share
            </T>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <FlagIcon size={16} color="#B45309" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
