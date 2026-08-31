import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { MOCK_ACCOUNTS } from '@/api/mocks';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
import { generateShareCard, shareOrSaveCard, downloadDataUrl } from '@/lib/shareCard';
import { addUserPost } from '@/lib/userPosts';

/**
 * ContentShareSheet (pass 20) — the "share like the videos" sheet, reused by
 * ayah / hadith / dua / athkar cards:
 *   1. friends row — send inside the app (toast confirmation)
 *   2. copy link
 *   3. more (system share sheet)
 *   4. share as IMAGE — styled card with background + DeenLink watermark
 *      (reuses the daily-ayah card generator)
 */
export function ContentShareSheet({
  visible,
  onClose,
  card,
  link,
  noImage = false,
}: {
  visible: boolean;
  onClose: () => void;
  /** input for the styled image card */
  card: { kind: 'ayah' | 'hadith' | 'dua' | 'athkar' | 'post'; arabic?: string; meaning: string; ref: string } | null;
  link: string;
  /** pass true to hide the "share as image" row (e.g. profiles) */
  noImage?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  if (!visible) return null;

  const shareAsPost = async () => {
    if (!card) return;
    haptic.success();
    try {
      await addUserPost(card.meaning, card.kind);
      onClose();
    } catch {}
  };

  const makeImage = async () => {
    if (busy || !card) return;
    haptic.light();
    setBusy(true);
    try {
      const url = await generateShareCard(card, 'classic');
      setImgUrl(url);
    } catch {}
    setBusy(false);
  };

  const Row = ({ icon, label, tint, onPress }: { icon: string; label: string; tint: string; onPress: () => void }) => (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: `${tint}20`, borderWidth: 1, borderColor: `${tint}45`, alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name={icon as never} size={14} color={tint} />
      </View>
      <T v="body" style={{ flex: 1, color: theme.text, fontWeight: '700', fontSize: 13.5 }}>
        {label}
      </T>
      <FontAwesome5 name="chevron-right" size={11} color={theme.subtext} />
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border, paddingBottom: 26 }}>
          <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
            <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
          </View>
          <T v="caption" style={{ color: theme.subtext, fontWeight: '800', fontSize: 10.5, letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 4 }}>
            SEND TO
          </T>
          {/* friends — ALWAYS visible (like the videos sheet, pass 22) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2, gap: 2 }}>
            {MOCK_ACCOUNTS.map((a) => (
              <Pressable
                key={a.username}
                onPress={() => {
                  haptic.success();
                  setSent(a.username);
                  setTimeout(() => {
                    onClose();
                    setSent(null);
                  }, 550);
                }}
                style={{ alignItems: 'center', width: 74, paddingVertical: 7, gap: 5, opacity: sent === a.username ? 0.45 : 1 }}
              >
                <AvatarImage source={a.photo ?? null} name={a.full_name} size={44} tint={`${theme.primary}26`} border={theme.border} />
                <T v="caption" numberOfLines={1} style={{ color: sent === a.username ? theme.primary : theme.subtext, fontSize: 9.5, fontWeight: '700' }}>
                  {sent === a.username ? 'Sent' : `@${a.username}`}
                </T>
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ paddingHorizontal: 10, marginTop: 4 }}>
            <Row icon="link" label="Copy link" tint={isDark ? '#4AE38F' : '#1D6F42'} onPress={() => { Share.share({ message: link }).catch(() => {}); }} />
            <Row icon="edit" label="Share as post" tint={isDark ? '#4AE38F' : '#1D6F42'} onPress={shareAsPost} />
            <Row icon="share-alt" label="More options…" tint="#5BC8F5" onPress={() => { Share.share({ message: `${card?.meaning ?? ''}\n\n${card?.ref ?? ''}\n${link}` }).catch(() => {}); }} />
            {!noImage ? <Row icon="image" label="Share as image" tint="#E8C96A" onPress={makeImage} /> : null}
          </View>

          {busy ? (
            <View style={{ padding: 18, alignItems: 'center' }}>
              <ActivityIndicator color={theme.primary} />
              <T v="caption" style={{ marginTop: 8 }}>Creating your card…</T>
            </View>
          ) : null}

          {imgUrl ? (
            <View style={{ paddingHorizontal: 16, alignItems: 'center', gap: 10 }}>
              <Image source={{ uri: imgUrl }} style={{ width: 250, height: 320, borderRadius: 14, borderWidth: 1, borderColor: theme.border }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => shareOrSaveCard(imgUrl, `deenlink-${card?.kind ?? 'share'}.png`, `${card?.meaning ?? ''} — ${card?.ref ?? ''}`).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <FontAwesome5 name="share" size={12} color="#fff" />
                  <T v="button" style={{ fontSize: 12.5 }}>Share</T>
                </Pressable>
                <Pressable onPress={() => downloadDataUrl(imgUrl, `deenlink-${card?.kind ?? 'share'}.png`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <FontAwesome5 name="download" size={12} color={theme.text} />
                  <T v="bodyS" style={{ fontSize: 12.5, color: theme.text }}>Save</T>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
