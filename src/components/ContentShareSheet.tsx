import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { FriendsPicker, type FriendShare } from '@/components/SendToFriends';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
import { generateShareCard, generatePostShareCard, shareOrSaveCard, downloadDataUrl, type PostShareCardInput } from '@/lib/shareCard';
import { ShareCardSvg } from '@/components/ShareCardSvg';
import { PostShareCardSvg } from '@/components/PostShareCardSvg';
import { canSaveImages, saveSvgRefAsJpg, shareSvgRef, svgRefToPng, pngDataUrlToJpegFile, shareImage, type SvgRefHandle } from '@/lib/svgExport';
import { buildShareUrl } from '@/lib/share';
import { addUserPost } from '@/lib/userPosts';
import { createPost, isLive, API_ORIGIN } from '@/api/client';
import type { Post } from '@/api/types';

/**
 * ContentShareSheet (pass 20) — the "share like the videos" sheet, reused by
 * ayah / hadith / dua / athkar cards and (pass 83-31) feed posts:
 *   1. friends row — send inside the app (toast confirmation)
 *   2. copy link
 *   3. repost (posts only) — server-backed repost of the original
 *   4. more (system share sheet)
 *   5. share as IMAGE — styled card with DeenLink watermark + QR
 *
 * pass 83-31 UX fix (owner: "sheet gets so long and can't be dragged"):
 * choosing "Share as image" now SWAPS the whole sheet to the image preview
 * (friends + rows hidden) with a Cancel button that returns to the rows.
 * The image for posts is a faithful replica of the post card — avatar, name,
 * @username, content, photo, like + comment counts — plus DeenLink logo + QR.
 */
export function ContentShareSheet({
  visible,
  onClose,
  card,
  link,
  noImage = false,
  post = null,
}: {
  visible: boolean;
  onClose: () => void;
  /** input for the styled image card */
  card: { kind: 'ayah' | 'hadith' | 'dua' | 'athkar' | 'post' | 'profile'; arabic?: string; meaning: string; ref: string; route?: string } | null;
  link: string;
  /** pass true to hide the "share as image" row (e.g. profiles) */
  noImage?: boolean;
  /** pass 83-31 — the feed post being shared (enables Repost + replica image) */
  post?: Post | null;
}) {
  const { theme, isDark } = useTheme();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [reposted, setReposted] = useState(false);
  /* pass 83-31 — full-swap image view (rows hidden while it is up) */
  const [imageMode, setImageMode] = useState(false);
  const [imgRatio, setImgRatio] = useState(0.78);
  /* pass 35 — native share-as-image: the same card rendered as SVG (web keeps the canvas path) */
  const svgMode = Platform.OS !== 'web' && imageMode;
  const exportRef = useRef<SvgRefHandle>(null);
  /* pass 37 — saving to the gallery is a privilege (needs photo permission);
   * sharing via the native sheet is for everyone */
  const [canSave, setCanSave] = useState(false);
  useEffect(() => { canSaveImages().then(setCanSave).catch(() => setCanSave(false)); }, []);
  /* pass 83-31 — reset swap view + repost state whenever the sheet reopens */
  useEffect(() => {
    if (visible) { setImageMode(false); setImgUrl(null); setReposted(false); }
  }, [visible]);
  const [sent, setSent] = useState<string | null>(null);
  /* pass 49 — route the shared link through /share.php so external apps render a preview card */
  const KIND_MAP: Record<string, 'verse' | 'hadith' | 'dua' | 'post'> = { ayah: 'verse', hadith: 'hadith', dua: 'dua', athkar: 'dua', post: 'post', profile: 'post' };
  /* pass 83-28 — the link preview carries a taste of the ARABIC when the
   * shared item has it (share.php caps the description at 160 chars). */
  const previewText = card ? (card.arabic ? `${card.arabic}\n${card.meaning}` : card.meaning) : '';
  const previewUrl = card ? buildShareUrl(KIND_MAP[card.kind] ?? 'dua', undefined, card.ref || 'DeenLink', previewText) : link;

  if (!visible) return null;
  /* pass 83-26 — styled-image cards have no profile layout; render as a post card */
  const imgCard = card ? { arabic: card.arabic, meaning: card.meaning, ref: card.ref, route: card.route, kind: (card.kind === 'profile' ? 'post' : card.kind) as 'ayah' | 'hadith' | 'dua' | 'athkar' | 'post' } : null;

  /* pass 83-31 — input for the POST replica card (avatar, name, @username,
   * content, photo, like + comment counts) */
  const postCardInput = (): PostShareCardInput | null => {
    if (!post) return null;
    const u = post.user ?? ({} as Post['user']);
    const xu = u as Record<string, unknown>;
    const abs = (v: unknown): string | null => {
      const s = typeof v === 'number' ? null : (v as string | null | undefined);
      if (!s) return null;
      if (s.startsWith('http') || s.startsWith('data:')) return s;
      return `${API_ORIGIN}${s.startsWith('/') ? '' : '/'}${s}`;
    };
    const rp = post.repost ?? null;
    const isRepost = !!(rp && !post.content_text);
    const bodyText = isRepost && rp
      ? `↻ Reposted @${rp.user.username}\n\n${rp.content_text ?? ''}`
      : (post.content_text ?? '');
    const xm = post.media ?? ([] as NonNullable<Post['media']>);
    const mediaImg = xm.find((m) => (String((m as Record<string, unknown>).media_type ?? m.type ?? 'image')) === 'image');
    const img = abs((mediaImg as unknown as { image_url_1080?: string } | undefined)?.image_url_1080)
      ?? abs((mediaImg as unknown as { image_url?: string } | undefined)?.image_url)
      ?? abs(post.image_url)
      ?? abs(rp?.image_url);
    const name = String(xu.name ?? u.full_name ?? u.username ?? 'DeenLink user');
    const badge = u.user_type === 'scholar' ? 'gold' : u.verification_badge ? 'green' : null;
    return {
      name,
      username: u.username ?? 'user',
      photoUrl: abs(xu.profile_image_url ?? u.profile_image),
      badge,
      text: bodyText,
      imageUrl: img,
      likeCount: post.like_count ?? 0,
      commentCount: post.comment_count ?? 0,
      link: post.id > 0 ? `https://deenlink.org/post/${post.id}` : 'https://deenlink.org',
      timeAgo: post.time_ago,
    };
  };

  /* REPOST — replaces the old mock "Share as post": creates a real caption-only
   * repost server-side (posts.repost_of), so the original author's photo, name
   * and username ride along on the card. Falls back to a local copy offline. */
  const doRepost = async () => {
    if (!post || posting || reposted) return;
    haptic.success();
    setPosting(true);
    try {
      let ok = false;
      if (isLive() && post.id > 0) {
        const res = await createPost('', undefined, undefined, undefined, undefined, undefined, post.id);
        ok = !!res.ok;
      }
      if (!ok) {
        /* offline / non-live: keep the old behaviour so nothing silently dies */
        await addUserPost(post.content_text ?? `@${post.user?.username ?? ''} on DeenLink`, 'post');
      }
      setReposted(true);
      await new Promise((r) => setTimeout(r, 700));
      onClose();
    } catch {} finally { setPosting(false); }
  };

  const shareAsPost = async () => {
    if (!card || posting) return;
    haptic.success();
    setPosting(true);
    try {
      // hold the "Posting…" state briefly so the action feels deliberate
      await Promise.all([addUserPost(card.meaning, card.kind), new Promise((r) => setTimeout(r, 700))]);
      onClose();
    } catch {} finally { setPosting(false); }
  };

  const makeImage = async () => {
    if (busy || !card) return;
    haptic.light();
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        const pin = postCardInput();
        const url = post ? await generatePostShareCard(pin!) : await generateShareCard(imgCard!, 'classic');
        setImgUrl(url);
        setImageMode(true);
      } else {
        /* native: render the SVG replica in the swapped view; rasterize on Share/Save */
        setImageMode(true);
      }
    } catch {}
    setBusy(false);
  };

  const cancelImage = () => { setImageMode(false); setImgUrl(null); };

  const shareNativeSvg = async () => {
    if (post) {
      const data = await svgRefToPng(exportRef, { width: 1080, height: 1280 });
      const file = await pngDataUrlToJpegFile(data, `deenlink-post-${post.id}`, 0.92);
      await shareImage(file, `deenlink-post-${post.id}`, `@${post.user?.username ?? ''} on DeenLink`);
    } else if (card) {
      await shareSvgRef(exportRef, `deenlink-${card.kind}`, `${card.meaning} — ${card.ref}`);
    }
  };

  const saveNativeSvg = async () => {
    if (post) {
      const data = await svgRefToPng(exportRef, { width: 1080, height: 1280 });
      const MediaLibrary = (await import('expo-media-library')).default;
      const file = await pngDataUrlToJpegFile(data, `deenlink-post-${post.id}`, 0.92);
      await MediaLibrary.createAssetAsync(file);
    } else if (card) {
      await saveSvgRefAsJpg(exportRef, `deenlink-${card.kind}`);
    }
  };

  const Row = ({ icon, label, tint, onPress, done }: { icon: string; label: string; tint: string; onPress: () => void; done?: boolean }) => (
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
      {done ? <FontAwesome5 name="check-circle" size={14} color="#27AE60" /> : <FontAwesome5 name="chevron-right" size={11} color={theme.subtext} />}
    </Pressable>
  );

  /* ── image swap view (pass 83-31): the whole sheet becomes the preview ── */
  if (imageMode) {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={cancelImage}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={cancelImage} />
          <View style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border, paddingBottom: 26 }}>
            <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
              <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
            </View>
            <T v="caption" style={{ color: theme.subtext, fontWeight: '800', fontSize: 10.5, letterSpacing: 0.8, textAlign: 'center', marginBottom: 10 }}>
              SHARE AS IMAGE
            </T>
            {busy ? (
              <View style={{ height: 300, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={theme.primary} />
                <T v="caption" style={{ marginTop: 10 }}>Creating your card…</T>
              </View>
            ) : Platform.OS === 'web' && imgUrl ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                <Image source={{ uri: imgUrl }} style={{ width: 280, height: 280 / imgRatio, maxHeight: 420, borderRadius: 14, borderWidth: 1, borderColor: theme.border }} contentFit="contain" onLoad={(e) => { const src = (e as unknown as { source?: { width?: number; height?: number } }).source; if (src?.width && src?.height) setImgRatio(src.width / src.height); }} />
              </View>
            ) : svgMode ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                <View style={{ width: 280, height: 360, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, backgroundColor: '#fff' }}>
                  {post ? <PostShareCardSvg input={postCardInput()!} ref={exportRef as never} /> : <ShareCardSvg input={imgCard!} ref={exportRef} />}
                </View>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => { haptic.light(); (Platform.OS === 'web' && imgUrl ? shareOrSaveCard(imgUrl, `deenlink-${post ? `post-${post.id}` : card?.kind ?? 'share'}.png`, `${card?.meaning ?? ''} — ${card?.ref ?? ''}`).catch(() => {}) : shareNativeSvg().catch(() => {})); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 }}>
                <FontAwesome5 name="share" size={12} color="#fff" />
                <T v="button" style={{ fontSize: 12.5 }}>Share</T>
              </Pressable>
              <Pressable onPress={() => { haptic.light(); (Platform.OS === 'web' && imgUrl ? downloadDataUrl(imgUrl, `deenlink-${post ? `post-${post.id}` : card?.kind ?? 'share'}.png`) : saveNativeSvg().catch(() => {})); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 18, paddingVertical: 11 }}>
                <FontAwesome5 name="download" size={12} color={theme.text} />
                <T v="bodyS" style={{ fontSize: 12.5, color: theme.text }}>Save</T>
              </Pressable>
              <Pressable onPress={() => { haptic.light(); cancelImage(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 18, paddingVertical: 11 }}>
                <FontAwesome5 name="times" size={12} color={theme.subtext} />
                <T v="bodyS" style={{ fontSize: 12.5, color: theme.subtext }}>Cancel</T>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.6)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '82%', backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border }}>
          <View style={{ paddingBottom: 26 }}>
            <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
              <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
            </View>
            <T v="caption" style={{ color: theme.subtext, fontWeight: '800', fontSize: 10.5, letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 4 }}>
              SEND TO
            </T>
            {/* pass 73 — multi-select + real search, delivered as a server-backed
                chat share (was single-tap mock rows that delivered nothing) */}
            {card ? (
              <View style={{ paddingTop: 8 }}>
                <FriendsPicker
                  share={{
                    kind: (card.kind === 'profile' ? 'profile' : KIND_MAP[card.kind] === 'verse' ? 'ayah' : KIND_MAP[card.kind] === 'post' ? 'post' : KIND_MAP[card.kind] === 'hadith' ? 'hadith' : 'dua') as FriendShare['kind'],
                    title: (card.meaning ?? '').slice(0, 160) || 'Shared from DeenLink',
                    sub: card.ref || undefined,
                    route: card.route,
                  }}
                  onDone={() => setTimeout(onClose, 1400)}
                />
              </View>
            ) : null}

            <View style={{ paddingHorizontal: 10, marginTop: 4 }}>
              <Row icon="link" label="Copy link" tint={isDark ? '#4AE38F' : '#1D6F42'} onPress={() => { Share.share({ message: previewUrl }).catch(() => {}); }} />
              {post ? (
                /* pass 83-31 — REPOST replaces "share as post" for feed posts */
                <Row
                  icon={posting ? 'circle-notch' : 'retweet'}
                  label={posting ? 'Reposting…' : reposted ? 'Reposted' : 'Repost'}
                  tint={isDark ? '#4AE38F' : '#1D6F42'}
                  onPress={doRepost}
                />
              ) : (
                <Row icon={posting ? 'circle-notch' : 'edit'} label={posting ? 'Posting…' : 'Share as post'} tint={isDark ? '#4AE38F' : '#1D6F42'} onPress={shareAsPost} />
              )}
              <Row icon="share-alt" label="More options…" tint="#5BC8F5" onPress={() => { Share.share({ message: `${card?.meaning ?? ''}\n\n${card?.ref ?? ''}\n${previewUrl}` }).catch(() => {}); }} />
              {!noImage ? <Row icon="image" label="Share as image" tint="#E8C96A" onPress={makeImage} /> : null}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
