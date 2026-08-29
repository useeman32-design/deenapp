import { useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { MOCK_ACCOUNTS } from '@/api/mocks';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';

/**
 * Community inbox (pass 21) — same pattern as the videos inbox: a list of
 * friends who shared things with you → a conversation-like thread of the
 * posts / reels / ayah-clips you two shared. Emoji reactions only. NO CHAT.
 */

const EMOJIS = ['🤍', '😂', '😮', '🤲', '🔥', '🕌'] as const;
type Kind = 'post' | 'reel' | 'ayah';
type ShareItem = { id: string; kind: Kind; title: string; ago: string; dir: 'them' | 'me' };
type Thread = { friend: string; items: ShareItem[] };

const KIND_META: Record<Kind, { icon: string; label: string; tint: string }> = {
  post: { icon: 'file-alt', label: 'Post', tint: '#5BC8F5' },
  reel: { icon: 'video', label: 'Reel', tint: '#E8C96A' },
  ayah: { icon: 'book-open', label: 'Ayah clip', tint: '#4AE38F' },
};

/* demo shares — mirrors how the videos inbox is seeded */
const THREADS: Thread[] = [
  { friend: 'aisha_yusuf', items: [
    { id: 'a1', kind: 'post', title: '“Never underestimate a single ayah a day…”', ago: '2h', dir: 'them' },
    { id: 'a2', kind: 'ayah', title: 'Surah Al-Fatiha · Ayah 5 clip', ago: '6h', dir: 'them' },
    { id: 'a3', kind: 'reel', title: 'Kaaba timelapse reel', ago: '1d', dir: 'me' },
  ] },
  { friend: 'alameen', items: [
    { id: 'b1', kind: 'reel', title: 'Quran recitation — Al-Furqan', ago: '5h', dir: 'them' },
    { id: 'b2', kind: 'post', title: 'Reminder: the dua of Yunus (as)', ago: '2d', dir: 'them' },
  ] },
  { friend: 'usman_ahmad', items: [
    { id: 'c1', kind: 'ayah', title: 'Ash-Sharh · Ayah 6 clip', ago: '9h', dir: 'them' },
    { id: 'c2', kind: 'post', title: "Jumu'ah Mubarak everyone", ago: '3d', dir: 'me' },
  ] },
  { friend: 'Gimba', items: [
    { id: 'd1', kind: 'reel', title: 'One ummah, one qiblah', ago: '1d', dir: 'them' },
  ] },
  { friend: 'mayanchie12', items: [
    { id: 'e1', kind: 'post', title: 'Seerah quiz — how many events do you know?', ago: '2d', dir: 'them' },
    { id: 'e2', kind: 'ayah', title: 'Al-Kahf · Ayah 10 clip', ago: '5d', dir: 'me' },
  ] },
];

export function CommunityInbox({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [thread, setThread] = useState<Thread | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const lastTap = useRef<{ id: string; t: number }>({ id: '', t: 0 });
  const pop = useRef(new Animated.Value(0)).current;

  if (!visible) return null;

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
  const react = (id: string, e: string) => {
    haptic.success();
    setReactions((r) => ({ ...r, [id]: r[id] === e ? '' : e }));
    setEmojiFor(null);
    popIn();
  };

  const acc = (u: string) => MOCK_ACCOUNTS.find((a) => a.username === u) ?? MOCK_ACCOUNTS[0];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => (thread ? setThread(null) : onClose())}>
      <View style={{ flex: 1, backgroundColor: isDark ? '#07100C' : '#F6FAF7', paddingTop: insets.top }}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)' }}>
          <Pressable onPress={() => (thread ? setThread(null) : onClose())} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={14} color={d.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>
              {thread ? acc(thread.friend).full_name : 'Inbox'}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
              {thread ? `@${thread.friend} · shares & reactions — no chat` : 'Shared posts, reels & ayahs — react, no chat'}
            </T>
          </View>
          <View style={{ borderRadius: 9, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 8, paddingVertical: 4 }}>
            <T v="caption" style={{ color: '#E8C96A', fontWeight: '800', fontSize: 9 }}>NO CHAT</T>
          </View>
        </View>

        {!thread ? (
          /* ── level 1: friends who shared with you ── */
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {THREADS.map((t) => {
              const a = acc(t.friend);
              const newN = t.items.filter((x) => x.dir === 'them').length;
              return (
                <Pressable
                  key={t.friend}
                  onPress={() => { haptic.selection(); setThread(t); }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 10, opacity: pressed ? 0.8 : 1 })}
                >
                  <View>
                    <AvatarImage source={a.photo ?? null} name={a.full_name} size={46} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                    <View style={{ position: 'absolute', right: -1, top: -1, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#1F8F5C', borderWidth: 1.5, borderColor: isDark ? '#07100C' : '#F6FAF7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                      <T v="caption" style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{newN}</T>
                    </View>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, color: d.text }}>{a.full_name}</T>
                    <T v="caption" numberOfLines={1} style={{ color: d.faint, fontSize: 10.5, marginTop: 2 }}>
                      shared {t.items.length} item{t.items.length > 1 ? 's' : ''} with you · {t.items[0].ago}
                    </T>
                  </View>
                  <FontAwesome5 name="chevron-right" size={12} color={d.faint} />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          /* ── level 2: the shared items thread ── */
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 14 }} showsVerticalScrollIndicator={false}>
            {thread.items.map((it) => {
              const meta = KIND_META[it.kind];
              const mine = it.dir === 'me';
              const reaction = reactions[it.id];
              return (
                <View key={it.id} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
                  {!mine ? <AvatarImage source={acc(thread.friend).photo ?? null} name={acc(thread.friend).full_name} size={28} tint="rgba(46,204,113,0.2)" border={d.cardBorder} /> : null}
                  <Pressable
                    onPress={() => onTapItem(it.id)}
                    style={({ pressed }) => ({
                      maxWidth: '76%', borderRadius: 14, borderWidth: 1,
                      borderColor: mine ? 'rgba(74,227,143,0.45)' : d.cardBorder,
                      backgroundColor: mine ? 'rgba(31,143,92,0.12)' : d.card,
                      padding: 11, opacity: pressed ? 0.85 : 1,
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
            <T v="caption" style={{ color: d.faint, textAlign: 'center', fontSize: 9.5, fontStyle: 'italic' }}>Double-tap any item to react — chat is off</T>
          </ScrollView>
        )}

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
      </View>
    </Modal>
  );
}
