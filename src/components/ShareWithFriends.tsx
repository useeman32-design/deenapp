import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { FontAwesome5 } from '@expo/vector-icons';
import { MOCK_ACCOUNTS, PROFILE_PHOTOS } from '@/api/mocks';
import * as Clipboard from 'expo-clipboard';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

/**
 * pass 40 — the shared "send to friends" picker. Multi-select accounts from
 * MOCK_ACCOUNTS, then deliver: appends a "sent by me" item to each friend's
 * thread in the Community inbox store (dl.inbox.v2) — so it shows up in the
 * conversation exactly like the other shared items. Used by quiz, 99 Names,
 * riddles, jokes and the ruqyah program share.
 */

const INBOX_STORE = 'dl.inbox.v2';
const uid = () => Math.random().toString(36).slice(2, 10);

type InboxItem = { id: string; kind: string; title: string; ago: string; dir: 'me' | 'them'; sub?: string };
type Thread = { friend: string; items: InboxItem[]; chat: Array<{ id: string; text: string; ago: string; dir: 'me' | 'them' }>; reactions: Record<string, string> };

export async function deliverShareToFriends(friends: string[], title: string, sub?: string): Promise<void> {
  if (!friends.length) return;
  let threads: Thread[] = [];
  try {
    threads = JSON.parse((await storage.getItem(INBOX_STORE)) ?? '[]');
  } catch {}
  for (const f of friends) {
    const item: InboxItem = { id: uid(), kind: 'post', title, ago: 'now', dir: 'me', sub: sub ?? 'Shared in DeenLink' };
    const existing = threads.find((t) => t.friend === f);
    if (existing) existing.items = [...existing.items, item];
    else threads.push({ friend: f, items: [item], chat: [], reactions: {} });
  }
  await storage.setItem(INBOX_STORE, JSON.stringify(threads));
}

export function ShareWithFriends({
  visible,
  onClose,
  onSent,
  title,
  preview,
  link,
}: {
  visible: boolean;
  onClose: () => void;
  onSent?: (count: number) => void;
  title: string;          /* what gets delivered */
  preview?: string;       /* small sub-line under the title */
  link?: string;          /* pass 50 — preview-enabled URL for "Copy link" */
}) {
  const { theme, isDark } = useTheme();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (visible) { setQ(''); setPicked(new Set()); setSent(false); setSending(false); }
  }, [visible]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return MOCK_ACCOUNTS;
    return MOCK_ACCOUNTS.filter((a) => a.full_name.toLowerCase().includes(needle) || a.username.toLowerCase().includes(needle));
  }, [q]);

  const toggle = (u: string) => {
    haptic.selection();
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(u)) next.delete(u); else next.add(u);
      return next;
    });
  };

  const send = async () => {
    if (!picked.size || sending) return;
    haptic.light();
    setSending(true);
    await deliverShareToFriends([...picked], title, preview);
    setSending(false);
    setSent(true);
    onSent?.(picked.size);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.62)', justifyContent: 'flex-end' }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <View style={{ backgroundColor: isDark ? '#0C1712' : '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border, paddingTop: 14, paddingBottom: 30, maxHeight: '78%' }}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)' }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 10 }}>
            <FontAwesome5 name="user-friends" size={15} color={theme.accent} />
            <T v="h3" style={{ fontSize: 15, fontWeight: '800', marginLeft: 9 }}>Send to friends</T>
            <View style={{ flex: 1 }} />
            <T v="caption" style={{ fontSize: 10.5, color: theme.subtext }}>{picked.size} selected</T>
          </View>
          <T v="caption" numberOfLines={1} style={{ fontSize: 10, color: theme.subtext, paddingHorizontal: 18, marginBottom: 10 }}>“{title}”</T>

          {!sent ? (
            <>
              {link ? (
                <Pressable
                  onPress={async () => { haptic.selection(); try { await Clipboard.setStringAsync(link); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1900); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 18, marginBottom: 10, borderRadius: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', paddingHorizontal: 12, paddingVertical: 10 }}
                >
                  <FontAwesome5 name={copied ? 'check-circle' : 'link'} size={12} color={copied ? '#4AE38F' : theme.accent} />
                  <T v="caption" numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: copied ? '#4AE38F' : theme.text, flex: 1 }}>{copied ? 'Link copied — opens with a preview anywhere' : 'Copy link'}</T>
                </Pressable>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 10 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: 11, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 7 }}>
                  <FontAwesome5 name="search" size={11} color={theme.subtext} />
                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder="Search people"
                    placeholderTextColor={theme.subtext}
                    style={{ flex: 1, color: theme.text, fontSize: 12.5, padding: 0 }}
                  />
                </View>
                <Pressable
                  onPress={() => { haptic.selection(); setPicked(picked.size === list.length ? new Set() : new Set(list.map((a) => a.username))); }}
                  style={{ borderRadius: 11, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 11, paddingVertical: 9 }}
                >
                  <T v="caption" style={{ fontSize: 10, fontWeight: '800' }}>{picked.size === list.length && list.length > 0 ? 'Clear' : 'All'}</T>
                </Pressable>
              </View>
              <ScrollView style={{ paddingHorizontal: 12 }} contentContainerStyle={{ paddingBottom: 6 }} showsVerticalScrollIndicator={false}>
                {list.map((a) => {
                  const on = picked.has(a.username);
                  return (
                    <Pressable
                      key={a.username}
                      onPress={() => toggle(a.username)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 13 }}
                    >
                      <AvatarImage
                        source={a.photo != null ? PROFILE_PHOTOS[String(a.photo)] : null}
                        name={a.full_name}
                        size={38}
                        tint={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                        border={theme.border}
                      />
                      <View style={{ flex: 1 }}>
                        <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700' }}>{a.full_name}</T>
                        <T v="caption" style={{ fontSize: 10, color: theme.subtext }}>@{a.username}{a.fields ? ` · ${a.fields}` : ''}</T>
                      </View>
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: on ? '#1F8F5C' : theme.border, backgroundColor: on ? '#1F8F5C' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {on ? <FontAwesome5 name="check" size={10} color="#fff" /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                accessibilityLabel="send to friends"
                onPress={send}
                disabled={!picked.size || sending}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 18, marginTop: 12, backgroundColor: picked.size ? '#1F8F5C' : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'), borderRadius: 12, paddingVertical: 12 }}
              >
                <FontAwesome5 name={sending ? 'spinner' : 'paper-plane'} size={12} color="#fff" />
                <T v="button" style={{ fontSize: 12.5, color: '#fff' }}>{sending ? 'Sending…' : `Send${picked.size ? ` to ${picked.size}` : ''}`}</T>
              </Pressable>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 26, paddingHorizontal: 24 }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(31,143,92,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <FontAwesome5 name="check" size={20} color="#1F8F5C" />
              </View>
              <T v="h3" style={{ fontSize: 15, fontWeight: '800', marginBottom: 5 }}>Sent</T>
              <T v="caption" style={{ fontSize: 11, color: theme.subtext, textAlign: 'center' }}>Delivered in your DeenLink chats. Open the community inbox to see it.</T>
              <Pressable onPress={onClose} style={{ marginTop: 16, borderRadius: 12, backgroundColor: '#1F8F5C', paddingHorizontal: 26, paddingVertical: 10 }}>
                <T v="button" style={{ fontSize: 12.5, color: '#fff' }}>Done</T>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
