import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
import * as api from '@/api/client';
import { MOCK_ACCOUNTS } from '@/api/mocks';
import { deliverShareToFriends } from '@/components/ShareWithFriends';

/**
 * pass 73 — the "send to friends" picker used by the post/video share sheets.
 * Multi-select (mark as many people as you want) + real account search.
 * Live: recent DM peers are suggested, the search hits the real account
 * search, and delivery is a server-backed chat share (chat/send_share) into
 * each picked person's conversation — it lands in their DeenLink inbox.
 * Demo: filters the mock roster and delivers into the local inbox store.
 */

export type FriendShare = {
  kind: 'post' | 'reel' | 'ayah' | 'hadith' | 'dua';
  title: string;
  sub?: string;
};

export type Person = { id: number | null; username: string; full_name: string; photo?: string | number | null };

export function FriendsPicker({
  share,
  onDone,
  dark = false,
}: {
  share: FriendShare;
  onDone?: (sentCount: number) => void;
  /** videos sheet is always dark-themed regardless of the app theme */
  dark?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const dk = dark || isDark;
  const text = dark ? 'rgba(242,247,243,0.92)' : theme.text;
  const faint = dark ? 'rgba(242,247,243,0.55)' : theme.subtext;
  const card = dark ? 'rgba(255,255,255,0.06)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const line = dark ? 'rgba(255,255,255,0.16)' : theme.border;
  const green = dark || isDark ? '#4AE38F' : '#1F8F5C';

  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [results, setResults] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Map<string, Person>>(new Map());
  const [sending, setSending] = useState(false);
  const [sentN, setSentN] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* recent conversations as suggestions (live only) */
  useEffect(() => {
    if (!api.isLive()) {
      setPeople(
        MOCK_ACCOUNTS.slice(0, 20).map((a) => ({
          id: null,
          username: a.username,
          full_name: a.full_name,
          photo: a.photo ?? null,
        })),
      );
      return;
    }
    void api.chatConversations().then((convs) => {
      if (!convs) return;
      const seen = new Set<string>();
      const out: Person[] = [];
      for (const c of convs) {
        if (c.type !== 'dm') continue;
        const un = c.peer?.username ?? c.with_username;
        if (!un || seen.has(un)) continue;
        seen.add(un);
        out.push({ id: c.peer?.id ?? null, username: un, full_name: c.title || un, photo: c.with_photo ?? null });
      }
      setPeople(out);
    });
  }, []);

  /* debounced real account search */
  const needle = q.trim().toLowerCase();
  useEffect(() => {
    if (!api.isLive() || needle.length < 2) { setResults([]); return; }
    let on = true;
    const t = setTimeout(() => {
      void api.searchAccounts(q.trim(), 12).then((r) => {
        if (!on || !r) return;
        setResults(
          r.map((a) => ({ id: a.id, username: a.username, full_name: a.full_name, photo: a.profile_image_url ?? null })),
        );
      });
    }, 300);
    return () => { on = false; clearTimeout(t); };
  }, [needle, q]);

  const list = useMemo(() => {
    const base = needle
      ? people.filter((p) => p.username.toLowerCase().includes(needle) || p.full_name.toLowerCase().includes(needle))
      : people;
    if (!api.isLive()) return base;
    const seen = new Set(base.map((p) => p.username));
    const extra = results.filter((r) => !seen.has(r.username));
    return needle.length >= 2 ? [...base, ...extra] : base;
  }, [people, results, needle]);

  const toggle = (p: Person) => {
    haptic.selection();
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(p.username)) next.delete(p.username);
      else next.set(p.username, p);
      return next;
    });
  };

  const send = async () => {
    if (!picked.size || sending) return;
    haptic.light();
    setSending(true);
    setError(null);
    const targets = [...picked.values()];
    let ok = 0;
    if (api.isLive()) {
      for (const p of targets) {
        try {
          const started = p.id != null ? await api.chatStartDM(p.id) : await api.chatStartDMByUsername(p.username);
          /* pass 83-9 — chatStartDMByUsername now returns { cid, status } */
          const conv = started == null ? null : typeof started === 'number' ? started : started.cid;
          if (conv == null) continue;
          const r = await api.chatSendShare(conv, share.kind, share.title, {
            sub: share.sub ?? 'Shared from DeenLink',
            refLabel: `@${p.username}`,
          });
          if (r) ok++;
        } catch {}
      }
    } else {
      await deliverShareToFriends(targets.map((p) => p.username), share.title, share.sub);
      ok = targets.length;
    }
    setSending(false);
    if (ok === 0) {
      setError('Could not deliver — check your connection and try again.');
      return;
    }
    setSentN(ok);
    onDone?.(ok);
  };

  if (sentN != null) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(31,143,92,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <FontAwesome5 name="check" size={17} color={green} />
        </View>
        <T v="body" style={{ fontWeight: '800', fontSize: 13.5, color: text }}>
          Sent to {sentN} friend{sentN > 1 ? 's' : ''}
        </T>
        <T v="caption" style={{ fontSize: 10.5, color: faint, marginTop: 3 }}>It’s waiting in their DeenLink inbox.</T>
      </View>
    );
  }

  return (
    <View>
      {/* search + all/clear */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: card, borderRadius: 11, borderWidth: 1, borderColor: line, paddingHorizontal: 10, paddingVertical: 7 }}>
          <FontAwesome5 name="search" size={11} color={faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search people"
            placeholderTextColor={faint}
            style={{ flex: 1, color: text, fontSize: 12.5, padding: 0 }}
          />
        </View>
        <Pressable
          onPress={() => {
            haptic.selection();
            const allOn = list.length > 0 && list.every((p) => picked.has(p.username));
            setPicked(allOn ? new Map() : new Map(list.map((p) => [p.username, p])));
          }}
          style={{ borderRadius: 11, borderWidth: 1, borderColor: line, paddingHorizontal: 11, paddingVertical: 9 }}
        >
          <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: text }}>
            {list.length > 0 && list.every((p) => picked.has(p.username)) ? 'Clear' : 'All'}
          </T>
        </Pressable>
      </View>

      <ScrollView style={{ maxHeight: 232, paddingHorizontal: 8 }} contentContainerStyle={{ paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? (
          <T v="caption" style={{ color: faint, textAlign: 'center', paddingVertical: 18, fontSize: 11 }}>
            {needle.length >= 2 ? 'No one found — keep typing' : 'Your recent chats will appear here'}
          </T>
        ) : (
          list.map((p) => {
            const on = picked.has(p.username);
            return (
              <Pressable
                key={p.username}
                onPress={() => toggle(p)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 13 }}
              >
                <AvatarImage source={p.photo ?? null} name={p.full_name} size={38} tint={`${green}26`} border={line} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyS" numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: text }}>{p.full_name}</T>
                  <T v="caption" numberOfLines={1} style={{ fontSize: 10, color: faint }}>@{p.username}</T>
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: on ? green : line, backgroundColor: on ? green : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <FontAwesome5 name="check" size={10} color={dark ? '#06130C' : '#fff'} /> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {error ? <T v="caption" style={{ color: '#FF7B7B', fontSize: 10.5, textAlign: 'center', marginTop: 6 }}>{error}</T> : null}

      <Pressable
        accessibilityLabel="send to selected friends"
        onPress={send}
        disabled={!picked.size || sending}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 14, marginTop: 10, backgroundColor: picked.size ? green : (dk ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'), borderRadius: 12, paddingVertical: 12 }}
      >
        {sending ? <ActivityIndicator size="small" color={dark ? '#06130C' : '#fff'} /> : <FontAwesome5 name="paper-plane" size={12} color={picked.size ? (dark ? '#06130C' : '#fff') : faint} />}
        <T v="button" style={{ fontSize: 12.5, color: picked.size ? (dark ? '#06130C' : '#fff') : faint }}>
          {sending ? 'Sending…' : `Send${picked.size ? ` to ${picked.size}` : ''}`}
        </T>
      </Pressable>
    </View>
  );
}
