import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import type { Post } from '@/api/types';
import type { SampleComment } from '@/api/mocks';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { AvatarImage } from '@/components/FeedCard';
import { HeartIcon } from '@/components/Icons';
import { haptic } from '@/lib/haptics';
import { useRouter } from 'expo-router';

const ME = { name: 'Abdulrahman Al-Harbi', handle: 'abdalrahman' };

const EMOJIS = ['😄', '😅', '🥹', '😍', '🤲', '🕌', '✨', '🤍', '📖', '🌙', '🔥', '🕋'];

/** Renders @mentions in comment text as colored + bold (IG-style). */
function MentionText({ text, base, mention }: { text: string; base: object; mention: object }) {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);
  return (
    <T v="bodyS" style={base as object}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <T key={i} style={(mention as object)}>
            {part}
          </T>
        ) : (
          <T key={i}>{part}</T>
        ),
      )}
    </T>
  );
}

/**
 * Comment row — MODULE-LEVEL on purpose: defining it inside the modal
 * component remounted every row (and glitched the avatars) on each like tap.
 */
function CommentRow({
  c,
  isReply = false,
  isLiked,
  onToggleLike,
  onReply,
  onToggleReplies,
  repliesOpen,
  onOpenProfile,
  colors,
}: {
  c: SampleComment;
  isReply?: boolean;
  isLiked: (id: number) => boolean;
  onToggleLike: (id: number) => void;
  onReply: (c: SampleComment) => void;
  onToggleReplies: (id: number) => void;
  repliesOpen: boolean;
  onOpenProfile: (handle: string) => void;
  colors: {
    txt: string;
    sub: string;
    faint: string;
    hairline: string;
    bubble: string;
    emerald: string;
    isDark: boolean;
  };
}) {
  const cImg = c.avatar != null ? c.avatar : null;
  const cName = c.name ?? c.handle;
  const rowLiked = isLiked(c.id);
  const likeCount = (c.likes ?? 0) + (rowLiked && !c.liked ? 1 : 0);
  const nReplies = c.replies?.length ?? 0;
  return (
    <View style={{ flexDirection: 'row', gap: 9, marginTop: isReply ? 8 : 14 }}>
      {/* only the avatar + name open a profile — the comment body never does */}
      <Pressable onPress={() => onOpenProfile(c.handle)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <AvatarImage source={cImg} name={cName} size={isReply ? 27 : 32} tint={colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)'} border={colors.hairline} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ borderRadius: 13, backgroundColor: colors.bubble, paddingHorizontal: 11, paddingVertical: 7 }}>
          <Pressable onPress={() => onOpenProfile(c.handle)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
            <T v="caption" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '700', fontSize: 11, color: colors.txt, flexShrink: 1 }}>
              {cName}
            </T>
            {c.badge ? <VerificationBadge type={c.badge} size={11} /> : null}
          </Pressable>
          <MentionText
            text={c.text}
            base={{ fontSize: 12.5, lineHeight: 17.5, color: colors.txt, marginTop: 2 }}
            mention={{ fontSize: 12.5, fontWeight: '800', color: colors.emerald }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 5 }}>
          <T v="caption" style={{ fontSize: 9.5, color: colors.faint, fontWeight: '600' }}>
            {c.time}
          </T>
          <Pressable hitSlop={6} onPress={() => { haptic.light(); onToggleLike(c.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <HeartIcon size={11} filled={rowLiked} color={rowLiked ? '#E74C3C' : colors.faint} />
            {likeCount > 0 ? (
              <T v="caption" style={{ fontSize: 9.5, color: rowLiked ? '#E74C3C' : colors.faint, fontWeight: '700' }}>
                {likeCount}
              </T>
            ) : null}
          </Pressable>
          <Pressable hitSlop={6} onPress={() => onReply(c)}>
            <T v="caption" style={{ fontSize: 9.5, color: colors.sub, fontWeight: '700' }}>
              Reply
            </T>
          </Pressable>
          {nReplies > 0 ? (
            <Pressable hitSlop={6} onPress={() => onToggleReplies(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <T v="caption" style={{ fontSize: 9.5, color: colors.emerald, fontWeight: '700' }}>
                {repliesOpen ? 'Hide replies' : `View ${nReplies} ${nReplies === 1 ? 'reply' : 'replies'}`}
              </T>
              <FontAwesome5 name={repliesOpen ? 'chevron-up' : 'chevron-down'} size={8} color={colors.emerald} />
            </Pressable>
          ) : null}
        </View>
        {nReplies > 0 && repliesOpen ? (
          // thread rail — a single soft emerald line under the parent avatar,
          // replies indented inside it
          <View
            style={{
              marginLeft: 3,
              marginTop: 6,
              paddingLeft: 13,
              borderLeftWidth: 2,
              borderLeftColor: colors.isDark ? 'rgba(74,227,143,0.22)' : 'rgba(14,122,70,0.16)',
              borderTopLeftRadius: 8,
              borderBottomLeftRadius: 8,
            }}
          >
            {c.replies!.map((r) => (
              <CommentRow
                key={r.id}
                c={r}
                isReply
                isLiked={isLiked}
                onToggleLike={onToggleLike}
                onReply={onReply}
                onToggleReplies={onToggleReplies}
                repliesOpen={repliesOpen}
                onOpenProfile={onOpenProfile}
                colors={colors}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Instagram-style comments sheet (theme-aware):
 * post summary → comment list (photo avatars, filling like hearts,
 * nested replies w/ thread rail) → "Replying to @user" indicator →
 * add-a-comment input at the bottom.
 *
 * `inline` renders as an absolute overlay instead of an RN Modal — needed
 * inside modal-presented routes (videos) on native where nested Modals
 * don't present reliably.
 */
export function CommentsModal({
  visible,
  post,
  seed,
  onClose,
  inline = false,
}: {
  visible: boolean;
  post: Post | null;
  seed: SampleComment[];
  onClose: () => void;
  inline?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const d = theme.dash;
  const card = isDark ? '#101B15' : '#FFFFFF';
  const bg = isDark ? 'rgba(4,8,6,0.86)' : 'rgba(15,25,19,0.42)';
  const txt = isDark ? '#F2F7F3' : '#14241C';
  const sub = isDark ? 'rgba(233,244,237,0.72)' : 'rgba(20,36,28,0.75)';
  const faint = isDark ? 'rgba(233,244,237,0.45)' : 'rgba(20,36,28,0.48)';
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.12)';
  const bubble = isDark ? 'rgba(255,255,255,0.045)' : 'rgba(20,36,28,0.055)';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(20,36,28,0.07)';
  const gold = '#D4AF37';
  const emerald = isDark ? '#4AE38F' : '#0E7A46';

  const [items, setItems] = useState<SampleComment[]>([]);
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});
  const [openReplies, setOpenReplies] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: number; name: string; handle: string } | null>(null);
  const inputRef = useRef<TextInput>(null);

  const colors = useMemo(
    () => ({ txt: txt as string, sub: sub as string, faint: faint as string, hairline: hairline as string, bubble: bubble as string, emerald: emerald as string, isDark }),
    [txt, sub, faint, hairline, bubble, emerald, isDark],
  );

  // re-seed whenever a different post opens
  const seedKey = post?.id ?? -1;
  useEffect(() => {
    if (visible) {
      setItems(seed.map((c) => ({ ...c, replies: c.replies?.map((r) => ({ ...r })) })));
      const l: Record<number, boolean> = {};
      for (const c of seed) {
        if (c.liked) l[c.id] = true;
        c.replies?.forEach((r) => {
          if (r.liked) l[r.id] = true;
        });
      }
      setLikedMap(l);
      setOpenReplies(new Set());
      setDraft('');
      setReplyingTo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, visible]);

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  if (!post) return null;
  const user = post.user;
  const name = user.full_name ?? user.username;
  const img = (user as { profile_image_url?: string | number | null }).profile_image_url ?? null;

  const isLiked = (id: number) => !!likedMap[id];
  const toggleLike = (id: number) =>
    setLikedMap((m) => {
      const n = { ...m };
      if (n[id]) delete n[id];
      else n[id] = true;
      return n;
    });

  const toggleReplies = (id: number) =>
    setOpenReplies((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const startReply = (c: SampleComment) => {
    haptic.selection();
    // No @handle in the textfield — just the "Replying to …" indicator.
    setReplyingTo({ id: c.id, name: c.name ?? c.handle, handle: c.handle });
  };

  /** Opens a public profile — closes this sheet first so it never lingers. */
  const openProfile = (handle: string) => {
    haptic.selection();
    onClose();
    setTimeout(() => router.push(`/profile/${handle}`), 140);
  };

  const addComment = () => {
    const t = draft.trim();
    if (!t) return;
    haptic.light();
    const nc: SampleComment = { id: Date.now(), name: ME.name, handle: ME.handle, avatar: null, text: t, time: 'now', likes: 0 };
    setItems((prev) => {
      if (replyingTo) {
        return prev.map((c) => {
          if (c.id === replyingTo.id) {
            return { ...c, replies: [...(c.replies ?? []), nc] };
          }
          const ri = (c.replies ?? []).find((r) => r.id === replyingTo.id);
          if (ri) {
            return { ...c, replies: [...(c.replies ?? []), nc] };
          }
          return c;
        });
      }
      return [...prev, nc];
    });
    if (replyingTo) setOpenReplies((s) => new Set(s).add(replyingTo.id));
    setDraft('');
    setReplyingTo(null);
  };

  const total = (list: SampleComment[]) => list.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  const sheet = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        flex: 1,
        maxHeight: 580,
        minHeight: 430,
        backgroundColor: card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: hairline,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.4 : 0.18,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: -8 },
        elevation: 16,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: hairline }}>
        <View style={{ flex: 1 }} />
        <T v="body" style={{ fontWeight: '700', fontSize: 14, color: txt }}>
          Comments
        </T>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <FontAwesome5 name="times" size={15} color={faint} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
        {/* Post summary */}
        <View style={{ flexDirection: 'row', gap: 9, marginBottom: 4 }}>
          <AvatarImage source={img} name={name} size={32} tint={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)'} border={hairline} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T v="caption" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '700', fontSize: 11.5, color: txt, flexShrink: 1 }}>
                {name}
              </T>
              {user.verification_badge ? <VerificationBadge type={user.verification_badge} size={11} /> : null}
              <T v="caption" style={{ fontSize: 10, color: faint, flexShrink: 0 }}>
                · {post.time_ago}
              </T>
            </View>
            {post.content_text ? (
              <T v="bodyS" numberOfLines={3} ellipsizeMode="tail" style={{ fontSize: 12, lineHeight: 17, color: sub, marginTop: 3 }}>
                {post.content_text}
              </T>
            ) : null}
          </View>
        </View>
        <T v="caption" style={{ fontSize: 10, color: faint, fontWeight: '700', letterSpacing: 0.6, marginTop: 10 }}>
          {total(items)} COMMENTS
        </T>

        {items.map((c) => (
          <CommentRow
            key={c.id}
            c={c}
            isLiked={isLiked}
            onToggleLike={toggleLike}
            onReply={startReply}
            onToggleReplies={toggleReplies}
            repliesOpen={openReplies.has(c.id)}
            onOpenProfile={openProfile}
            colors={colors}
          />
        ))}
      </ScrollView>

      {/* Reply indicator */}
      {replyingTo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${gold}14`, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
            <FontAwesome5 name="reply" size={10} color={gold} />
            <T v="caption" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1, fontSize: 10.5, fontWeight: '700', color: gold }}>
              Replying to {replyingTo.name}
            </T>
          </View>
          <Pressable onPress={() => setReplyingTo(null)} hitSlop={10} style={{ padding: 5 }}>
            <FontAwesome5 name="times-circle" size={14} color={faint} />
          </Pressable>
        </View>
      ) : null}

      {/* Emoji row (IG-style) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 36, flexGrow: 0, flexShrink: 0, paddingHorizontal: 12, paddingBottom: 4 }}>
        {EMOJIS.map((e, i) => (
          <Pressable key={`e${i}`} onPress={() => setDraft((prev) => prev + e)} hitSlop={4} style={{ padding: 4, marginRight: 2 }} onPressIn={() => haptic.selection()}>
            <T v="caption" style={{ fontSize: 20, fontWeight: '400' }}>
              {e}
            </T>
          </Pressable>
        ))}
      </ScrollView>

      {/* Add a comment (font 16px → no iOS auto-zoom on focus) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: hairline }}>
        <Text
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.12)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(46,204,113,0.4)' : 'rgba(14,122,70,0.35)',
            textAlign: 'center',
            textAlignVertical: 'center',
            fontFamily: 'Poppins-Bold',
            fontSize: 12,
            fontWeight: '700',
            color: emerald,
          }}
        >
          A
        </Text>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder={replyingTo ? `Reply to ${replyingTo.name}…` : 'Add a comment…'}
          placeholderTextColor={faint}
          onSubmitEditing={addComment}
          returnKeyType="send"
          style={{
            flex: 1,
            width: 0,
            fontFamily: 'Poppins-Medium',
            fontSize: 16,
            color: txt,
            backgroundColor: inputBg,
            borderRadius: 17,
            paddingHorizontal: 13,
            paddingVertical: 9,
          }}
        />
        <Pressable
          onPress={addComment}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            opacity: (draft.trim() ? 1 : 0.45) * (pressed ? 0.6 : 1),
          })}
        >
          <FontAwesome5 name="paper-plane" size={13} color={draft.trim() ? gold : faint} />
          <T v="caption" style={{ fontWeight: '700', fontSize: 11, color: draft.trim() ? gold : faint }}>
            Post
          </T>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  if (inline) {
    if (!visible) return null;
    return (
      <View style={{ position: 'absolute', inset: 0, zIndex: 90, backgroundColor: bg, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        {sheet}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        {sheet}
      </View>
    </Modal>
  );
}
