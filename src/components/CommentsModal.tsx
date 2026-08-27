import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import type { Post } from '@/api/types';
import type { SampleComment } from '@/api/mocks';
import { T } from '@/components/T';
import { VerificationBadge } from '@/components/VerificationBadge';
import { AvatarImage } from '@/components/FeedCard';

/**
 * Instagram-style comments sheet:
 * post summary → comment list (photo avatars, like, nested replies with
 * "View N replies" toggle, emoji) → add-a-comment input at the bottom.
 */
export function CommentsModal({
  visible,
  post,
  seed,
  onClose,
}: {
  visible: boolean;
  post: Post | null;
  seed: SampleComment[];
  onClose: () => void;
}) {
  const { theme, isDark } = useTheme();
  const card = '#101B15';
  const bg = 'rgba(4,8,6,0.86)';
  const txt = '#F2F7F3';
  const sub = 'rgba(233,244,237,0.72)';
  const faint = 'rgba(233,244,237,0.45)';
  const hairline = 'rgba(255,255,255,0.08)';
  const gold = '#D4AF37';

  const [items, setItems] = useState<SampleComment[]>([]);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [openReplies, setOpenReplies] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState('');

  // re-seed whenever a different post opens
  const seedKey = post?.id ?? -1;
  useMemo(() => {
    if (visible) {
      setItems(seed.map((c) => ({ ...c, replies: c.replies?.map((r) => ({ ...r })) })));
      const l = new Set<number>();
      for (const c of seed) {
        if (c.liked) l.add(c.id);
        c.replies?.forEach((r) => r.liked && l.add(r.id));
      }
      setLiked(l);
      setOpenReplies(new Set());
      setDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, visible]);

  if (!post) return null;
  const user = post.user;
  const name = user.full_name ?? user.username;
  const img = (user as { profile_image_url?: string | number | null }).profile_image_url ?? null;

  const toggleLike = (id: number) =>
    setLiked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleReplies = (id: number) =>
    setOpenReplies((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const addComment = () => {
    const t = draft.trim();
    if (!t) return;
    setItems((prev) => [
      ...prev,
      { id: Date.now(), name: 'Abdulrahman Al-Harbi', handle: 'abdalrahman', avatar: null, text: t, time: 'now', likes: 0 },
    ]);
    setDraft('');
  };

  const total = (list: SampleComment[]) => list.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  const CommentRow = ({ c, isReply = false }: { c: SampleComment; isReply?: boolean }) => {
    const cImg = c.avatar != null ? c.avatar : null;
    const cName = c.name ?? c.handle;
    const isLiked = liked.has(c.id);
    const nReplies = c.replies?.length ?? 0;
    const repliesOpen = openReplies.has(c.id);
    return (
      <View style={{ flexDirection: 'row', gap: 9, marginTop: isReply ? 0 : 14, marginLeft: isReply ? 26 : 0 }}>
        {isReply ? (
          <View style={{ position: 'absolute', left: 9, top: 12, bottom: 0, width: 1, backgroundColor: hairline }} />
        ) : null}
        <AvatarImage source={cImg} name={cName} size={isReply ? 28 : 32} tint="rgba(255,255,255,0.08)" border={hairline} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.045)', paddingHorizontal: 10, paddingVertical: 7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T v="caption" style={{ fontWeight: '700', fontSize: 11, color: txt, flexShrink: 1 }}>
                {cName}
              </T>
              {c.badge ? <VerificationBadge type={c.badge} size={11} /> : null}
            </View>
            <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 17.5, color: txt, marginTop: 2 }}>
              {c.text}
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 5 }}>
            <T v="caption" style={{ fontSize: 9.5, color: faint, fontWeight: '600' }}>
              {c.time}
            </T>
            <Pressable hitSlop={6} onPress={() => toggleLike(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <FontAwesome5 name="heart" size={10} color={isLiked ? '#FF5A5A' : faint} />
              {(c.likes ?? 0) > 0 ? (
                <T v="caption" style={{ fontSize: 9.5, color: isLiked ? '#FF5A5A' : faint, fontWeight: '700' }}>
                  {c.likes}
                </T>
              ) : null}
            </Pressable>
            <T v="caption" style={{ fontSize: 9.5, color: sub, fontWeight: '700' }}>
              Reply
            </T>
            {nReplies > 0 ? (
              <Pressable hitSlop={6} onPress={() => toggleReplies(c.id)}>
                <T v="caption" style={{ fontSize: 9.5, color: sub, fontWeight: '700' }}>
                  {repliesOpen ? 'Hide replies' : `View ${nReplies} ${nReplies === 1 ? 'reply' : 'replies'}`}
                </T>
              </Pressable>
            ) : null}
          </View>
          {nReplies > 0 && repliesOpen ? (
            <View style={{ marginTop: 2 }}>
              {c.replies!.map((r) => (
                <CommentRow key={r.id} c={r} isReply />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            maxHeight: 560,
            backgroundColor: card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: hairline,
            shadowColor: '#000',
            shadowOpacity: 0.4,
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
              <AvatarImage source={img} name={name} size={32} tint="rgba(255,255,255,0.08)" border={hairline} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <T v="caption" style={{ fontWeight: '700', fontSize: 11.5, color: txt, flexShrink: 1 }}>
                    {name}
                  </T>
                  {user.verification_badge ? <VerificationBadge type={user.verification_badge} size={11} /> : null}
                  <T v="caption" style={{ fontSize: 10, color: faint }}>
                    · {post.time_ago}
                  </T>
                </View>
                {post.content_text ? (
                  <T v="bodyS" style={{ fontSize: 12, lineHeight: 17, color: sub, marginTop: 3 }}>
                    {post.content_text}
                  </T>
                ) : null}
              </View>
            </View>
            <T v="caption" style={{ fontSize: 10, color: faint, fontWeight: '700', letterSpacing: 0.6, marginTop: 10 }}>
              {total(items)} COMMENTS
            </T>

            {items.map((c) => (
              <CommentRow key={c.id} c={c} />
            ))}
          </ScrollView>

          {/* Add a comment */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: hairline }}>
            <Text
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(46,204,113,0.16)',
                borderWidth: 1,
                borderColor: 'rgba(46,204,113,0.4)',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Poppins-Bold',
                fontSize: 12,
                fontWeight: '700',
                color: '#4AE38F',
              }}
            >
              A
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={faint}
              onSubmitEditing={addComment}
              returnKeyType="send"
              style={{
                flex: 1,
                fontFamily: 'Poppins-Medium',
                fontSize: 12.5,
                color: txt,
                backgroundColor: 'rgba(255,255,255,0.05)',
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
      </View>
    </Modal>
  );
}
