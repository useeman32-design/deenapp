import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { T } from '@/components/T';
import { storage } from '@/lib/storage';
import { activeAnnouncement, isLive, type AnnouncementItem } from '@/api/client';

/* pass 83-33 — Home-screen announcement modal.
 * Admin creates announcements in the dashboard (admin/announcement.html);
 * the server picks the one active for THIS viewer (country / user-type
 * targeting, date window) and returns it with a dismiss_key. We show it a few
 * seconds after the home screen settles, and remember the dismiss_key so the
 * same announcement doesn't nag — it comes back only when the admin edits it. */

const SEEN_KEY = 'dl.announcements.seen.v1';

export function AnnouncementModal() {
  const router = useRouter();
  const [item, setItem] = useState<AnnouncementItem | null>(null);
  const [dismissKey, setDismissKey] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        try {
          if (!isLive()) return;
          const res = await activeAnnouncement();
          if (!res?.item) return;
          const seen = await storage.getItem(SEEN_KEY);
          if (res.dismissKey && seen === res.dismissKey) return;
          setItem(res.item);
          setDismissKey(res.dismissKey);
        } catch { /* announcements are best-effort */ }
      })();
    }, 4500); /* let the home screen settle first */
    return () => clearTimeout(t);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissKey) void storage.setItem(SEEN_KEY, dismissKey);
    setItem(null);
  }, [dismissKey]);

  const openAction = useCallback(() => {
    if (!item?.actionButtonUrl) return;
    const url = item.actionButtonUrl;
    if (/^https?:\/\//i.test(url)) { void Linking.openURL(url).catch(() => {}); dismiss(); return; }
    dismiss();
    router.push(url as never);
  }, [item, dismiss, router]);

  if (!item) return null;
  const youtube = item.mediaType === 'youtube';

  return (
    <Modal transparent animationType="fade" onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(10,26,18,0.62)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <View style={{ width: '100%', maxWidth: 380, borderRadius: 22, backgroundColor: '#fff', overflow: 'hidden' }}>
          {/* header strip */}
          <View style={{ backgroundColor: '#0E7A5F', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
            <T v="bodyS" style={{ color: '#fff', fontSize: 14.5, fontWeight: '800', flex: 1 }}>📢 {item.name}</T>
            <Pressable onPress={dismiss} hitSlop={10} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <T v="bodyS" style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>✕</T>
            </Pressable>
          </View>

          {/* media */}
          {item.mediaType === 'image' && item.mediaUrl ? (
            <Image source={{ uri: item.mediaUrl }} style={{ width: '100%', height: 190 }} resizeMode="cover" />
          ) : null}
          {youtube ? (
            <Pressable
              onPress={() => { if (item.mediaUrl) void Linking.openURL(item.mediaUrl).catch(() => {}); }}
              style={{ width: '100%', height: 170, backgroundColor: '#0B1F16', alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ width: 58, height: 40, borderRadius: 11, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' }}>
                <T v="bodyS" style={{ color: '#0B1F16', fontSize: 16, fontWeight: '900' }}>▶</T>
              </View>
              <T v="caption" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 8 }}>Tap to watch</T>
            </Pressable>
          ) : null}

          {/* actions */}
          <View style={{ padding: 16, gap: 10 }}>
            {item.actionButtonLabel && item.actionButtonUrl ? (
              <Pressable
                onPress={openAction}
                style={({ pressed }) => ({ backgroundColor: pressed ? '#0B5F49' : '#0E7A5F', borderRadius: 14, paddingVertical: 12, alignItems: 'center' })}
              >
                <T v="bodyS" style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{item.actionButtonLabel}</T>
              </Pressable>
            ) : null}
            <Pressable onPress={dismiss} style={{ alignItems: 'center', paddingVertical: 2 }}>
              <T v="caption" style={{ color: '#8A9A90', fontSize: 12.5, fontWeight: '600' }}>Maybe later</T>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
