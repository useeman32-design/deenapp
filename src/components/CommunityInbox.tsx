import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { MOCK_ACCOUNTS } from '@/api/mocks';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

/**
 * Community INBOX (pass 22, v2) — the real inbox the user asked for:
 * receive reels / posts / duas / ayahs (in-app content ONLY — no external
 * media), CHAT BACK with text + quick in-app shares, and REACT with emojis.
 * Used two ways: modal (community bell) and standalone (/tools/inbox).
 */

const EMOJIS = ['🤍', '😂', '😮', '🤲', '🔥', '🕌'] as const;
type Kind = 'post' | 'reel' | 'ayah' | 'hadith' | 'dua' | 'profile';
type ShareItem = { id: string; kind: Kind; title: string; ago: string; dir: 'them' | 'me' };
type ChatMsg = { id: string; text: string; ago: string; dir: 'them' | 'me' };
type Thread = { friend: string; items: ShareItem[]; chat: ChatMsg[]; reactions: Record<string, string> };

const KIND_META: Record<Kind, { icon: string; label: string; tint: string }> = {
  post: { icon: 'file-alt', label: 'Post', tint: '#5BC8F5' },
  reel: { icon: 'video', label: 'Reel', tint: '#E8C96A' },
  ayah: { icon: 'book-open', label: 'Ayah', tint: '#4AE38F' },
  hadith: { icon: 'scroll', label: 'Hadith', tint: '#C8A2C8' },
  dua: { icon: 'hands-helping', label: 'Dua', tint: '#F0A8C0' },
  profile: { icon: 'user-circle', label: 'Profile', tint: '#8FD3B6' },
};

const ago = () => 'now';
const uid = () => Math.random().toString(36).slice(2, 9);

/* seed — what friends shared with you (in-app content only) */
const SEED: Thread[] = [
  { friend: 'aisha_yusuf', items: [
    { id: uid(), kind: 'post', title: 'Never underestimate a single ayah a day…', ago: '2h', dir: 'them' },
    { id: uid(), kind: 'ayah', title: 'Surah Al-Fatiha · Ayah 5', ago: '6h', dir: 'them' },
    { id: uid(), kind: 'dua', title: 'Dua before sleeping — Hisn al-Muslim', ago: '1d', dir: 'them' },
  ], chat: [
    { id: uid(), text: 'This dua changed my nights, try it tonight inshaAllah', ago: '1d', dir: 'them' },
  ], reactions: {} },
  { friend: 'alameen', items: [
    { id: uid(), kind: 'reel', title: 'Quran recitation — Al-Furqan', ago: '5h', dir: 'them' },
    { id: uid(), kind: 'post', title: 'Reminder: the dua of Yunus (as)', ago: '2d', dir: 'them' },
  ], chat: [], reactions: {} },
  { friend: 'usman_ahmad', items: [
    { id: uid(), kind: 'ayah', title: 'Ash-Sharh · Ayah 6', ago: '9h', dir: 'them' },
    { id: uid(), kind: 'reel', title: 'One ummah, one qiblah', ago: '1d', dir: 'them' },
  ], chat: [], reactions: {} },
  { friend: 'Gimba', items: [
    { id: uid(), kind: 'dua', title: 'Dua after adhan', ago: '1d', dir: 'them' },
    { id: uid(), kind: 'hadith', title: 'Bukhari · “None of you truly believes…”', ago: '1d', dir: 'them' },
  ], chat: [], reactions: {} },
  { friend: 'maryam_s', items: [
    { id: uid(), kind: 'profile', title: 'Profile — Ustādh Ibrāhīm (quran teacher)', ago: '3h', dir: 'them' },
    { id: uid(), kind: 'reel', title: 'Beautiful adhan from Makkah', ago: '8h', dir: 'them' },
    { id: uid(), kind: 'post', title: 'Jumu’ah reminder — arrive early', ago: '2d', dir: 'them' },
  ], chat: [], reactions: {} },
  { friend: 'mayanchie12', items: [
    { id: uid(), kind: 'post', title: 'Seerah quiz — how many events do you know?', ago: '2d', dir: 'them' },
  ], chat: [], reactions: {} },
];

const STORE = 'dl.inbox.v2';

export function CommunityInbox({ visible, onClose, standalone = false }: { visible: boolean; onClose: () => void; standalone?: boolean }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<Thread[]>(SEED);
  const [openFriend, setOpenFriend] = useState<string | null>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const lastTap = useRef<{ id: string; t: number }>({ id: '', t: 0 });
  const pop = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ScrollView>(null);

  /* restore persisted chats */
  useEffect(() => {
    storage.getItem(STORE).then((r) => {
      if (r)
        try {
          setThreads(JSON.parse(r));
        } catch {}
    });
  }, []);
  const persist = (next: Thread[]) => {
    setThreads(next);
    storage.setItem(STORE, JSON.stringify(next)).catch(() => {});
  };

  const popIn = () => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: false, friction: 4, tension: 70 }).start();
  };
  const onTapItem = (id: string) => {
    const now = Date.now();
    const dbl = lastTap.current.id === id && now - lastTap.current.t < 320;
    lastTap.current = { id, t: now };
    if (dbl) {
      haptic.light();
      setEmojiFor(id);
    }
  };

  const thread = threads.find((t) => t.friend === openFriend) ?? null;
  const acc = (u: string) => MOCK_ACCOUNTS.find((a) => a.username === u) ?? MOCK_ACCOUNTS[0];

  const react = (id: string, e: string) => {
    haptic.success();
    if (!thread) return;
    const reactions = { ...thread.reactions, [id]: thread.reactions[id] === e ? '' : e };
    persist(threads.map((t) => (t.friend === thread.friend ? { ...t, reactions } : t)));
    setEmojiFor(null);
    popIn();
  };

  const sendChat = () => {
    const text = draft.trim();
    if (!text || !thread) return;
    haptic.light();
    const chat = [...thread.chat, { id: uid(), text, ago: ago(), dir: 'me' as const }];
    persist(threads.map((t) => (t.friend === thread.friend ? { ...t, chat } : t)));
    setDraft('');
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
  };

  const shareBack = (kind: Kind, title: string) => {
    if (!thread) return;
    haptic.selection();
    const items = [...thread.items, { id: uid(), kind, title, ago: ago(), dir: 'me' as const }];
    persist(threads.map((t) => (t.friend === thread.friend ? { ...t, items } : t)));
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
  };

  const body = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: isDark ? '#07100C' : '#F6FAF7' }}>
      {/* header */}
      <View style={{ paddingTop: standalone ? insets.top + 8 : 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)' }}>
        <Pressable onPress={() => (thread ? setOpenFriend(null) : onClose())} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={14} color={d.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>
            {thread ? acc(thread.friend).full_name : 'Inbox'}
          </T>
          <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
            {thread ? `@${thread.friend} · in-app shares & chat` : 'Reels, posts, duas & ayahs shared with you'}
          </T>
        </View>
        <View style={{ borderRadius: 9, borderWidth: 1, borderColor: 'rgba(46,204,113,0.45)', backgroundColor: 'rgba(46,204,113,0.10)', paddingHorizontal: 8, paddingVertical: 4 }}>
          <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 9 }}>IN-APP ONLY</T>
        </View>
      </View>

      {!thread ? (
        /* ── friends who shared with you ── */
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {threads.map((t) => {
            const a = acc(t.friend);
            const unread = t.items.filter((x) => x.dir === 'them').length + t.chat.filter((c) => c.dir === 'them').length;
            return (
              <Pressable
                key={t.friend}
                onPress={() => {
                  haptic.selection();
                  setOpenFriend(t.friend);
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.18)' : 'rgba(29,111,66,0.12)', backgroundColor: isDark ? 'rgba(18,34,25,0.6)' : 'rgba(255,255,255,0.7)', padding: 12, marginBottom: 10, opacity: pressed ? 0.8 : 1, shadowColor: '#000', shadowOpacity: isDark ? 0.2 : 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 3 } })}
              >
                <View>
                  <AvatarImage source={a.photo ?? null} name={a.full_name} size={46} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                  <View style={{ position: 'absolute', right: -1, top: -1, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#1F8F5C', borderWidth: 1.5, borderColor: isDark ? '#07100C' : '#F6FAF7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <T v="caption" style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{unread}</T>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, color: d.text }}>{a.full_name}</T>
                  <T v="caption" numberOfLines={1} style={{ color: d.faint, fontSize: 10.5, marginTop: 2 }}>
                    {t.chat.length ? t.chat[t.chat.length - 1].text : `shared ${t.items.length} item${t.items.length > 1 ? 's' : ''} with you`}
                  </T>
                </View>
                <FontAwesome5 name="chevron-right" size={12} color={d.faint} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        /* ── thread: shares + chat + composer ── */
        <ScrollView ref={scroller} contentContainerStyle={{ padding: 14, paddingBottom: 26, gap: 12 }} showsVerticalScrollIndicator={false}>
          {thread.items.map((it) => {
            const meta = KIND_META[it.kind];
            const mine = it.dir === 'me';
            const reaction = thread.reactions[it.id];
            return (
              <View key={it.id} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
                {!mine ? <AvatarImage source={acc(thread.friend).photo ?? null} name={acc(thread.friend).full_name} size={28} tint="rgba(46,204,113,0.2)" border={d.cardBorder} /> : null}
                <Pressable
                  onPress={() => onTapItem(it.id)}
                  style={({ pressed }) => ({
                    maxWidth: '76%',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: mine ? 'rgba(74,227,143,0.45)' : d.cardBorder,
                    backgroundColor: mine ? 'rgba(31,143,92,0.12)' : d.card,
                    padding: 11,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <FontAwesome5 name={meta.icon as never} size={10} color={meta.tint} />
                    <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: meta.tint, letterSpacing: 0.4 }}>{meta.label.toUpperCase()}</T>
                    <View style={{ flex: 1 }} />
                    <FontAwesome5 name={mine ? 'share' : 'share-alt'} size={8} color={d.faint} />
                  </View>
                  <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: d.text }}>{it.title}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
                    <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{mine ? `you shared · ${it.ago}` : `shared with you · ${it.ago}`}</T>
                    {reaction ? (
                      <Animated.Text style={{ fontSize: 15, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>{reaction}</Animated.Text>
                    ) : (
                      <Pressable onPress={() => { haptic.light(); setEmojiFor(it.id); }} hitSlop={8}>
                        <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>React</T>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
                {mine ? <AvatarImage source={null} name="You" size={28} tint="rgba(212,175,55,0.22)" border="rgba(212,175,55,0.5)" /> : null}
              </View>
            );
          })}

          {thread.chat.map((m) => {
            const mine = m.dir === 'me';
            const reaction = thread.reactions[m.id];
            return (
              <View key={m.id} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
                <Pressable
                  onLongPress={() => {
                    haptic.light();
                    setEmojiFor(m.id);
                  }}
                  delayLongPress={260}
                  onPress={() => onTapItem(m.id)}
                  style={{ maxWidth: '76%', borderRadius: 16, borderBottomRightRadius: mine ? 5 : 16, borderBottomLeftRadius: mine ? 16 : 5, backgroundColor: mine ? '#1F8F5C' : d.card, borderWidth: 1, borderColor: mine ? 'transparent' : d.cardBorder, paddingHorizontal: 13, paddingVertical: 9 }}
                >
                  <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: mine ? '#FFFFFF' : d.text }}>{m.text}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <T v="caption" style={{ fontSize: 8.5, color: mine ? 'rgba(255,255,255,0.7)' : d.faint }}>{m.ago}</T>
                    {reaction ? <T v="caption" style={{ fontSize: 11 }}>{reaction}</T> : null}
                  </View>
                </Pressable>
              </View>
            );
          })}
          <T v="caption" style={{ color: d.faint, textAlign: 'center', fontSize: 9, fontStyle: 'italic' }}>Double-tap to react · shares are in-app content only</T>
        </ScrollView>
      )}

      {/* composer — chat back + quick in-app shares */}
      {thread ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', backgroundColor: isDark ? '#07100C' : '#F6FAF7', gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {([
              ['ayah', 'book-open', 'Share ayah'],
              ['hadith', 'scroll', 'Share hadith'],
              ['dua', 'hands-helping', 'Share dua'],
              ['post', 'file-alt', 'Share post'],
              ['reel', 'video', 'Share reel'],
              ['profile', 'user-circle', 'Share profile'],
            ] as Array<[Kind, string, string]>).map(([k, ic, label]) => (
              <Pressable
                key={k}
                onPress={() => shareBack(k, k === 'ayah' ? 'Surah Al-Kahf · Ayah 10' : k === 'hadith' ? 'Muslim 2568 — visit the sick' : k === 'dua' ? 'Dua for guidance' : k === 'post' ? 'A post you might love' : k === 'profile' ? 'Profile — Ustādh Ibrāhīm' : 'A reel worth watching')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <FontAwesome5 name={ic as never} size={9} color={KIND_META[k].tint} />
                <T v="caption" style={{ fontSize: 9.5, fontWeight: '700', color: d.subtext }}>{label}</T>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={`Message @${thread.friend}…`}
                placeholderTextColor={d.faint}
                returnKeyType="send"
                onSubmitEditing={sendChat}
                style={{ flex: 1, paddingVertical: 10, fontSize: 16, color: d.text, fontFamily: 'Poppins-Regular' }}
              />
            </View>
            <Pressable onPress={sendChat} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="paper-plane" size={13} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* emoji panel */}
      {emojiFor ? (
        <Pressable style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(4,8,6,0.55)', justifyContent: 'flex-end' }} onPress={() => setEmojiFor(null)}>
          <Pressable style={{ paddingBottom: 24 + insets.bottom, paddingHorizontal: 14 }}>
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: isDark ? '#0C1712' : '#FFFFFF', paddingVertical: 14, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
              {EMOJIS.map((e, i) => (
                <Pressable key={e} onPress={() => react(emojiFor, e)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 1.35 : 1 }] })}>
                  <Animated.Text style={{ fontSize: 30, opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), marginTop: i % 2 === 0 ? 0 : 10 }}>{e}</Animated.Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );

  if (standalone) return visible ? body : null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => (thread ? setOpenFriend(null) : onClose())}>
      {body}
    </Modal>
  );
}
