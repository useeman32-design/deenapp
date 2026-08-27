import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import type { DashTheme } from '@/constants/theme';
import type { Post } from '@/api/types';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { haptic } from '@/lib/haptics';
import { ChatIcon, FlagIcon, HeartIcon, PlayIcon, ShareIcon } from '@/components/Icons';

/* ------------------------------------------------------------------ */
/* Web-only iframe (react-native-web renders custom components to DOM) */
/* ------------------------------------------------------------------ */
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

const REPORT_TYPES: Array<{ id: string; label: string; icon: any }> = [
  { id: 'spam', label: 'Spam or scam', icon: 'ban' },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'user-slash' },
  { id: 'hate', label: 'Hate speech', icon: 'fire' },
  { id: 'danger', label: 'Dangerous content', icon: 'exclamation-triangle' },
  { id: 'misleading', label: 'Misleading content', icon: 'question-circle' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'shield-alt' },
];

/**
 * Instagram-style feed card for the DeenLink dash:
 * photo avatar · name (1-line, ellipsis) · verify · aqeedah chip ·
 * text (Show more/less when long) · image (tap = preview, double-tap = like) ·
 * YouTube in-container (double-tap = like, tap = in-app player) ·
 * like / comment / share actions · ••• menu (Report modal / Not interested).
 */
export function FeedCard({
  post,
  onLike,
  onComments,
  onDismiss,
  onPlayVideo,
  showActions = true,
  dash,
  field,
}: {
  post: Post;
  onLike?: (id: number) => void;
  onComments?: (post: Post) => void;
  onDismiss?: (id: number) => void;
  onPlayVideo?: (post: Post) => void;
  showActions?: boolean;
  dash?: DashTheme;
  field?: string;
}) {
  const { theme, isDark } = useTheme();
  const router = useRouter();
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
  const [reportOpen, setReportOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [imgPreview, setImgPreview] = useState(false);
  const [pollState, setPollState] = useState<{ voted: number | null; options: Array<{ id: number; text: string; votes: number }> }>(() => ({
    voted: null,
    options: post.poll?.options ?? [],
  }));
  const [reportType, setReportType] = useState<string | null>(null);
  const [reportDesc, setReportDesc] = useState('');
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  const sharePost = () => {
    Share.share({
      message: `${name} (@${user.username}) on DeenLink: ${post.content_text ?? ''}`,
    }).catch(() => {});
  };

  const liked = !!post.liked_by_me;

  const likeBurst = () => {
    haptic.medium();
    burst.setValue(0);
    const anim = Animated.sequence([
      // quick pop-in with a springy overshoot, hold, then a soft fade
      Animated.timing(burst, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.9)), useNativeDriver: true }),
      Animated.delay(140),
      Animated.timing(burst, { toValue: 0, duration: 260, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]);
    // guaranteed clean end-state (prevents any residual "shade" on the post)
    // guaranteed clean end-state (prevents any residual "shade" on the post)
    anim.start(() => {
      burst.setValue(0);
    });
  };

  /** One tap detector: double-tap anywhere on the post = like;
   *  an optional single-tap action fires after a short grace window. */
  const onTap = (single?: () => void) => {
    const now = Date.now();
    const isDouble = now - lastTap.current < 300;
    lastTap.current = now;
    if (isDouble) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      if (!liked) {
        onLike?.(post.id);
        likeBurst();
      }
    } else if (single) {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        single();
      }, 310);
    }
  };

  const fieldLabel = field || (user as { fields?: string | null }).fields || user.scholar?.fields_of_knowledge || null;
  const media = post.media?.[0];
  const mediaUrl = media?.url as string | number | null | undefined;

  const fullText = post.content_text ?? '';
  const longText = fullText.length > 230;
  const cutAt = longText ? Math.max(fullText.lastIndexOf(' ', 230), 180) : fullText.length;
  const shownText = expanded || !longText ? fullText : `${fullText.slice(0, cutAt).trimEnd()}…`;

  const scale = burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.22, 1.02, 1.3] });
  const opacity = burst.interpolate({ inputRange: [0, 0.12, 0.72, 1], outputRange: [0, 0.95, 0.95, 0] });

  const submitReport = () => {
    setReportOpen(false);
    setReportType(null);
    setReportDesc('');
    Alert.alert('Report submitted', 'JazakAllah khair — our moderation team will review this post.');
  };

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
      {/* Header (avatar + name open the public profile) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 11 }}>
        <Pressable
          hitSlop={8}
          onPress={() => {
            haptic.selection();
            router.push(`/profile/${user.username}`);
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <AvatarImage source={img} name={name} size={42} tint={`${accent}26`} border={dash ? dash.greenBorder : hairline} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <Pressable hitSlop={4} onPress={() => router.push(`/profile/${user.username}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <T v="body" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '700', fontSize: 13.5, color: txt, flexShrink: 1 }}>
                {name}
              </T>
              {user.verification_badge ? <VerificationBadge type={user.verification_badge} size={13} /> : null}
              <T v="caption" style={{ color: faint, fontSize: 11, flexShrink: 0 }}>
                · {post.time_ago ?? ''}
              </T>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <T v="caption" numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 10.5, color: sub, flexShrink: 1, maxWidth: 150 }}>
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
              width: 190,
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
                setReportOpen(true);
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
                Report
              </T>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                Alert.alert('Not interested', `You’ll see fewer posts like ${name}’s.`, [
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
              <FontAwesome5 name="eye-slash" size={14} color={sub} />
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '600', color: txt }}>
                Not interested
              </T>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      {/* Body text — double-tap to like, Show more/less when long */}
      {fullText ? (
        <View style={{ marginBottom: longText ? 4 : 12 }}>
          <Pressable onPress={() => onTap()}>
            <T v="bodyS" style={{ fontSize: 13.5, lineHeight: 20.5, color: txt }}>
              {shownText}
            </T>
          </Pressable>
          {longText ? (
            <Pressable hitSlop={6} onPress={() => setExpanded((v) => !v)} style={{ marginTop: 3, alignSelf: 'flex-start' }}>
              <T v="caption" style={{ fontSize: 11.5, fontWeight: '700', color: dash ? gold : accent }}>
                {expanded ? 'Show less' : 'Show more'}
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Poll */}
      {post.poll ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          <View
            style={{
              gap: 6,
              borderWidth: 1,
              borderColor: dash ? dash.greenBorder : hairline,
              borderRadius: 14,
              padding: 12,
              backgroundColor: dash ? dash.bgSoft : soft,
            }}
          >
            {post.poll.question ? (
              <T v="body" style={{ color: txt, fontWeight: '700', fontSize: 13 }}>
                {post.poll.question}
              </T>
            ) : null}
            {pollState.options.map((opt) => {
              const total = pollState.options.reduce((a, b) => a + b.votes, 0) || 1;
              const pct = Math.round((opt.votes / total) * 100);
              const mine = pollState.voted === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    if (pollState.voted != null) return;
                    haptic.selection();
                    setPollState((prev) => ({
                      voted: opt.id,
                      options: prev.options.map((o) => (o.id === opt.id ? { ...o, votes: o.votes + 1 } : o)),
                    }));
                  }}
                  style={({ pressed }) => ({
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: mine ? (dash ? gold : accent) : 'transparent',
                    backgroundColor: mine ? (dash ? `${gold}14` : `${accent}0f`) : 'transparent',
                    opacity: pressed && pollState.voted == null ? 0.7 : 1,
                  })}
                >
                  {pollState.voted != null ? (
                    <View style={{ gap: 5 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <T v="body" numberOfLines={1} style={{ color: mine ? (dash ? gold : accent) : txt, fontWeight: '700', fontSize: 12, flexShrink: 1 }}>
                          {opt.text}
                        </T>
                        <T v="caption" style={{ color: sub, fontSize: 11, fontWeight: '700' }}>
                          {pct}%
                        </T>
                      </View>
                      <View style={{ height: 5, borderRadius: 3, backgroundColor: dash ? dash.greenBorder : hairline, overflow: 'hidden' }}>
                        <View
                          style={{
                            width: `${pct}%`,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: mine ? (dash ? gold : accent) : dash ? dash.emerald : '#9DB2A8',
                          }}
                        />
                      </View>
                    </View>
                  ) : (
                    <T v="body" numberOfLines={1} style={{ color: txt, fontSize: 12.5, fontWeight: '600' }}>
                      {opt.text}
                    </T>
                  )}
                </Pressable>
              );
            })}
            <T v="caption" style={{ color: faint, fontSize: 10.5, marginTop: 2 }}>
              {pollState.voted != null
                ? `Thanks for voting · ${pollState.options.reduce((a, b) => a + b.votes, 0)} votes · Poll ends in 2 days`
                : `${pollState.options.reduce((a, b) => a + b.votes, 0)} votes · Tap an option to vote · Poll ends in 2 days`}
            </T>
          </View>
        </View>
      ) : null}

      {/* Media image — single tap: preview · double tap: like */}
      {mediaUrl != null ? (
        <Pressable onPress={() => onTap(() => setImgPreview(true))} style={{ marginBottom: 12 }}>
          <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: hairline }}>
            <Image
              source={typeof mediaUrl === 'number' ? mediaUrl : { uri: String(mediaUrl) }}
              style={{ width: '100%', height: 200 }}
              resizeMode="cover"
            />
          </View>
        </Pressable>
      ) : null}

      {/* YouTube — embedded player on web (double-tap likes, tap plays in-app) */}
      {Platform.OS === 'web' && post.youtube_embed_url ? (
        <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: hairline, marginBottom: 12, backgroundColor: '#000' }}>
          <YouTubeFrame src={String(post.youtube_embed_url)} height={206} />
          <Pressable
            onPress={() => onTap(() => onPlayVideo?.(post))}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </View>
      ) : post.youtube_url ? (
        <Pressable
          onPress={() =>
            onTap(() => {
              if (onPlayVideo) onPlayVideo(post);
              else if (post.youtube_url) Linking.openURL(post.youtube_url).catch(() => {});
            })
          }
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
            marginTop: fullText ? 0 : 4,
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
          <Pressable onPress={() => { haptic.light(); onLike?.(post.id); }} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, opacity: pressed ? 0.6 : 1 })}>
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
        </View>
      ) : null}

      {/* Double-tap heart burst (over the whole card) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          transform: [{ scale }],
        }}
      >
        <HeartIcon size={96} filled color="#fff" />
      </Animated.View>

      {/* Image preview */}
      <Modal visible={imgPreview} transparent animationType="fade" onRequestClose={() => setImgPreview(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} onPress={() => setImgPreview(false)} />
          {mediaUrl != null ? (
            <Image
              source={typeof mediaUrl === 'number' ? mediaUrl : { uri: String(mediaUrl) }}
              style={{ width: '100%', height: 560, borderRadius: 4 }}
              resizeMode="contain"
            />
          ) : null}
          <Pressable
            onPress={() => setImgPreview(false)}
            hitSlop={12}
            style={{ position: 'absolute', top: 48, right: 18, zIndex: 2, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="times" size={15} color="#fff" />
          </Pressable>
        </View>
      </Modal>

      {/* Report modal */}
      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setReportOpen(false)} />
          <View
            style={{
              backgroundColor: card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: hairline,
              borderTopWidth: 0,
              padding: 18,
              paddingBottom: 26,
              maxHeight: 480,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: `${danger}1F`, alignItems: 'center', justifyContent: 'center' }}>
                <FlagIcon size={18} color={danger} />
              </View>
              <T v="body" style={{ fontWeight: '700', fontSize: 15.5, color: txt, marginTop: 10 }}>
                Report this post?
              </T>
              <T v="caption" style={{ fontSize: 11.5, color: faint, marginTop: 4, textAlign: 'center' }}>
                Tell us what happened. Reports are confidential.
              </T>
            </View>

            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {REPORT_TYPES.map((rt) => {
                const sel = reportType === rt.id;
                return (
                  <Pressable
                    key={rt.id}
                    onPress={() => setReportType(rt.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 11,
                      paddingHorizontal: 12,
                      paddingVertical: 11,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: sel ? danger : hairline,
                      backgroundColor: sel ? `${danger}14` : 'transparent',
                      marginBottom: 7,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <FontAwesome5 name={rt.icon} size={14} color={sel ? danger : sub} />
                    <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: sel ? '700' : '500', color: sel ? danger : txt }}>
                      {rt.label}
                    </T>
                    <View
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 9,
                        borderWidth: 1.6,
                        borderColor: sel ? danger : faint,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {sel ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: danger }} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <TextInput
              value={reportDesc}
              onChangeText={setReportDesc}
              placeholder="Add details (optional)…"
              placeholderTextColor={faint}
              multiline
              numberOfLines={3}
              style={{
                minHeight: 74,
                height: 74,
                textAlignVertical: 'top',
                backgroundColor: soft,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: hairline,
                paddingHorizontal: 12,
                paddingTop: 10,
                fontFamily: 'Poppins-Regular',
                fontSize: 12.5,
                color: txt,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => {
                  setReportOpen(false);
                  setReportType(null);
                  setReportDesc('');
                }}
                style={{ flex: 1, borderRadius: 13, borderWidth: 1, borderColor: hairline, paddingVertical: 11, alignItems: 'center', opacity: 0.9 }}
              >
                <T v="bodyS" style={{ fontWeight: '600', fontSize: 12.5, color: sub }}>
                  Cancel
                </T>
              </Pressable>
              <Pressable
                onPress={submitReport}
                style={({ pressed }) => ({ flex: 1.4, borderRadius: 13, backgroundColor: danger, paddingVertical: 11, alignItems: 'center', opacity: pressed ? 0.8 : 1 })}
              >
                <T v="bodyS" style={{ fontWeight: '700', fontSize: 12.5, color: '#fff' }}>
                  Submit report
                </T>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
