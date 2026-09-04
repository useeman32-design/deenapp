import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
import { chatConversations, chatMessages, chatSend, chatRead, chatPresence, type ChatConversation, type ChatMessage } from '@/api/client';

/** Smooth entrance for each bubble. */
function FadeIn({ children, style }: { children: React.ReactNode; style?: object }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [a]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Slice 9 — live Chat (DM + group) backed by the DeenLink API. */
export default function Chat() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const { user, isDemo } = useAuth();

  const [convs, setConvs] = useState<ChatConversation[] | null>(null);
  const [open, setOpen] = useState<ChatConversation | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const load = useCallback(() => {
    if (!user || isDemo) return;
    chatConversations().then((c) => setConvs(c ?? []));
  }, [user, isDemo]);

  useEffect(load, [load]);

  /* presence heartbeat — marks you online and refreshes others' status */
  useEffect(() => {
    if (!user || isDemo) return;
    chatPresence().catch(() => {});
    const iv = setInterval(() => { chatPresence().catch(() => {}); chatConversations().then((c) => setConvs((prev) => (prev ? (c ?? []) : prev))); }, 60000);
    return () => clearInterval(iv);
  }, [user, isDemo]);

  const openConvo = (c: ChatConversation) => {
    haptic.selection();
    setOpen(c);
    setMsgs([]);
    chatMessages(c.id).then((m) => setMsgs(m ?? []));
    chatRead(c.id).catch(() => {});
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !open) return;
    setBusy(true);
    const id = await chatSend(open.id, text);
    if (id) {
      setMsgs((m) => [...m, { id, sender_id: user?.id ?? 0, body: text, media_url: null, created_at: new Date().toISOString(), username: user?.username }]);
      setDraft('');
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    }
    setBusy(false);
  };

  const name = (c: ChatConversation) => c.with_username || c.peer?.username || c.title || (c.kind === 'group' ? 'Group' : 'Chat');
  const isOnline = (c: ChatConversation | null) => !!c?.peer_seen && (Date.now() - new Date(String(c.peer_seen).replace(' ', 'T')).getTime()) < 5 * 60 * 1000;

  if (!open) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <TopBar showBack title="Chat" subtitle={user && !isDemo ? 'Your conversations' : 'Sign in to chat'} right={
          <Pressable onPress={load} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="sync" size={12} color={d.text} />
          </Pressable>
        } />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {convs === null ? (
            <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>{user && !isDemo ? 'Loading chats…' : 'Chat needs a signed-in account.'}</T>
          ) : convs.length === 0 ? (
            <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>No conversations yet. Open a profile and tap Message to start one.</T>
          ) : (
            convs.map((c) => {
              const on = isOnline(c);
              return (
              <Pressable key={c.id} onPress={() => openConvo(c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 10 }}>
                <View>
                  <AvatarImage source={null} name={name(c)} size={44} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
                  {/* presence dot — green online / red offline (peer_seen within 5 min) */}
                  <View style={{ position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: on ? '#2ECC71' : '#E05252', borderWidth: 2.5, borderColor: d.card }} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', color: d.text, flexShrink: 1 }}>{name(c)}</T>
                    <T v="caption" style={{ fontSize: 9, fontWeight: '700', color: on ? '#2ECC71' : d.faint }}>{on ? 'Online' : c.peer_seen ? `Last seen ${String(c.peer_seen).slice(5, 16)}` : 'Offline'}</T>
                  </View>
                  <T v="caption" numberOfLines={1} style={{ color: d.faint, marginTop: 2 }}>{c.last_body ?? 'Say salam 👋'}</T>
                </View>
                <FontAwesome5 name={c.type === 'group' ? 'users' : 'chevron-right'} size={12} color={d.faint} />
              </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 8, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: d.cardBorder }}>
        <Pressable onPress={() => setOpen(null)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={d.text} />
        </Pressable>
        <AvatarImage source={null} name={name(open)} size={38} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 16, color: d.text }}>{name(open)}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOnline(open) ? '#2ECC71' : '#E05252' }} />
            <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{isOnline(open) ? 'Online' : open.peer_seen ? `Last seen ${String(open.peer_seen).slice(5, 16)}` : 'Offline'}</T>
          </View>
        </View>
      </View>
      <ScrollView ref={scroller} contentContainerStyle={{ padding: 14, paddingBottom: 16, gap: 10 }}>
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <FadeIn key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
              <View style={{ borderRadius: 16, borderBottomRightRadius: mine ? 5 : 16, borderBottomLeftRadius: mine ? 16 : 5, backgroundColor: mine ? '#1F8F5C' : d.card, borderWidth: mine ? 0 : 1, borderColor: d.cardBorder, paddingHorizontal: 13, paddingVertical: 9 }}>
                <T v="bodyS" style={{ fontSize: 13, lineHeight: 19, color: mine ? '#fff' : d.text }}>{m.body}</T>
                <T v="caption" style={{ fontSize: 8.5, color: mine ? 'rgba(255,255,255,0.7)' : d.faint, marginTop: 3 }}>{!mine && m.username ? `${m.username} · ` : ''}{(m.created_at || '').slice(11, 16)}{mine ? (m.read_at ? '  ✓✓' : '  ✓') : ''}</T>
              </View>
            </FadeIn>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: d.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 14 }}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Type something…" placeholderTextColor={d.faint} returnKeyType="send" onSubmitEditing={send} style={{ flex: 1, paddingVertical: 10, fontSize: 16, color: d.text, fontFamily: 'Poppins-Regular' }} />
        </View>
        <Pressable onPress={send} disabled={busy} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
          <FontAwesome5 name="paper-plane" size={13} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
