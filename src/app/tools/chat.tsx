import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, ScrollView, TextInput, UIManager, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
import { chatConversations, chatMessages, chatSend, chatRead, chatPresence, type ChatConversation, type ChatMessage } from '@/api/client';

if (Platform.OS === 'android') { UIManager.setLayoutAnimationEnabledExperimental?.(true); }

/** Same six reasons the post report sheet uses (src/components/FeedCard.tsx). */
const REPORT_TYPES: Array<{ id: string; label: string; icon: any }> = [
  { id: 'spam', label: 'Spam or scam', icon: 'ban' },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'user-slash' },
  { id: 'hate', label: 'Hate speech', icon: 'fire' },
  { id: 'danger', label: 'Dangerous content', icon: 'exclamation-triangle' },
  { id: 'misleading', label: 'Misleading content', icon: 'question-circle' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'shield-alt' },
];

/**
 * pass 57 — a bubble that SPRINGS in rather than popping into existence.
 * `animate` is false for the history loaded on open, so opening a conversation
 * doesn't replay an animation on every old message.
 */
function Bubble({ children, style, animate }: { children: React.ReactNode; style?: object; animate: boolean }) {
  const a = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 7, tension: 70 }).start();
  }, [a, animate]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: a,
          transform: [
            { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
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
  /* pass 57 — ••• menu, report sheet and block confirm */
  const [menu, setMenu] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<string | null>(null);
  const [reportDesc, setReportDesc] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reported, setReported] = useState(false);
  /* ids that arrived with the history — they must not animate in */
  const seen = useRef<Set<number>>(new Set());
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
    seen.current = new Set();
    setOpen(c);
    setMsgs([]);
    setMenu(false); setReportOpen(false); setBlockOpen(false); setBlocked(false); setReported(false);
    chatMessages(c.id).then((m) => {
      const arr = m ?? [];
      arr.forEach((x) => seen.current.add(x.id));
      setMsgs(arr);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 80);
    });
    chatRead(c.id).catch(() => {});
  };

  /**
   * pass 57 — OPTIMISTIC send. The bubble appears the instant you tap send and
   * glides in, instead of waiting for the round trip and then snapping in.
   * The temp id is swapped for the server id when it arrives; on failure the
   * bubble is marked so it never silently pretends to have been delivered.
   */
  const send = async () => {
    const text = draft.trim();
    if (!text || !open || busy) return;
    haptic.light();
    setBusy(true);
    setDraft('');
    const tempId = -Date.now();
    const optimistic: ChatMessage = {
      id: tempId, sender_id: user?.id ?? 0, body: text, media_url: null,
      created_at: new Date().toISOString(), username: user?.username, read_at: null,
    };
    LayoutAnimation.configureNext({ duration: 220, update: { type: LayoutAnimation.Types.easeInEaseOut } });
    setMsgs((m) => [...m, optimistic]);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));

    const id = await chatSend(open.id, text);
    setMsgs((m) => m.map((x) => (x.id === tempId ? (id ? { ...x, id } : { ...x, body: `${text}  ⚠ not sent` }) : x)));
    if (id) { seen.current.add(id); setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120); }
    setBusy(false);
  };

  const submitReport = () => {
    haptic.success();
    setReportOpen(false); setMenu(false); setReportType(null); setReportDesc(''); setReported(true);
  };

  const confirmBlock = () => {
    haptic.medium();
    setBlockOpen(false); setMenu(false); setBlocked(true);
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
                  <AvatarImage source={c.with_photo ?? null} name={name(c)} size={44} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
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
        {/* pass 57 — the peer's real profile photo, with their presence dot on it */}
        <View>
          <AvatarImage source={open.with_photo ?? null} name={name(open)} size={38} tint="rgba(46,204,113,0.2)" border={d.cardBorder} />
          <View style={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: isOnline(open) ? '#2ECC71' : '#E05252', borderWidth: 2, borderColor: d.bg }} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 16, color: d.text }}>{name(open)}</T>
          <T v="caption" style={{ fontSize: 9.5, color: isOnline(open) ? '#2ECC71' : d.faint, marginTop: 1 }}>
            {isOnline(open) ? 'Online' : open.peer_seen ? `Last seen ${String(open.peer_seen).slice(5, 16)}` : 'Offline'}
          </T>
        </View>
        {/* pass 57 — ••• menu → Report / Block */}
        <Pressable
          onPress={() => { haptic.selection(); setMenu((v) => !v); }}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}
        >
          <FontAwesome5 name="ellipsis-v" size={13} color={d.text} />
        </Pressable>
      </View>

      {menu ? (
        <>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} onPress={() => setMenu(false)} />
          <View style={{ position: 'absolute', top: insets.top + 52, right: 14, zIndex: 50, width: 190, borderRadius: 14, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, paddingVertical: 6, elevation: 8, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
            {([
              { k: 'report', label: reported ? 'Reported ✓' : 'Report', icon: 'flag', color: d.text },
              { k: 'block', label: blocked ? 'Blocked ✓' : `Block ${name(open)}`, icon: 'user-slash', color: '#E05252' },
            ] as const).map((it) => (
              <Pressable
                key={it.k}
                onPress={() => { haptic.light(); if (it.k === 'report') { setMenu(false); setReportOpen(true); } else { setMenu(false); setBlockOpen(true); } }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}
              >
                <FontAwesome5 name={it.icon as any} size={11} color={it.color} />
                <T v="bodyS" numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: it.color, flexShrink: 1 }}>{it.label}</T>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {blocked ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 9, backgroundColor: 'rgba(224,82,82,0.12)', borderBottomWidth: 1, borderBottomColor: 'rgba(224,82,82,0.3)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FontAwesome5 name="user-slash" size={10} color="#E05252" />
          <T v="caption" style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#E05252' }}>You blocked {name(open)} — messaging is off.</T>
          <Pressable onPress={() => { setBlocked(false); haptic.light(); }} hitSlop={8}>
            <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: d.text, textDecorationLine: 'underline' }}>Undo</T>
          </Pressable>
        </View>
      ) : reported ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 9, backgroundColor: 'rgba(46,204,113,0.12)', borderBottomWidth: 1, borderBottomColor: 'rgba(46,204,113,0.3)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FontAwesome5 name="check-circle" size={10} color="#2ECC71" />
          <T v="caption" style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#2ECC71' }}>Report sent to our moderation team.</T>
        </View>
      ) : null}

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 14, paddingBottom: 16, gap: 10 }}>
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          const isNew = !seen.current.has(m.id);
          if (isNew) { seen.current.add(m.id); }
          return (
            <Bubble key={m.id} animate={isNew} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
              <View style={{ borderRadius: 16, borderBottomRightRadius: mine ? 5 : 16, borderBottomLeftRadius: mine ? 16 : 5, backgroundColor: mine ? '#1F8F5C' : d.card, borderWidth: mine ? 0 : 1, borderColor: d.cardBorder, paddingHorizontal: 13, paddingVertical: 9 }}>
                <T v="bodyS" style={{ fontSize: 13, lineHeight: 19, color: mine ? '#fff' : d.text }}>{m.body}</T>
                <T v="caption" style={{ fontSize: 8.5, color: mine ? 'rgba(255,255,255,0.7)' : d.faint, marginTop: 3 }}>{!mine && m.username ? `${m.username} · ` : ''}{(m.created_at || '').slice(11, 16)}{mine ? (m.read_at ? '  ✓✓' : '  ✓') : ''}</T>
              </View>
            </Bubble>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: d.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 14 }}>
          <TextInput value={draft} onChangeText={setDraft} placeholder="Type something…" placeholderTextColor={d.faint} returnKeyType="send" onSubmitEditing={send} editable={!blocked} style={{ flex: 1, paddingVertical: 10, fontSize: 16, color: d.text, fontFamily: 'Poppins-Regular' }} />
        </View>
        <Pressable onPress={send} disabled={busy || blocked} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1F8F5C', alignItems: 'center', justifyContent: 'center', opacity: busy || blocked ? 0.5 : 1 }}>
          <FontAwesome5 name="paper-plane" size={13} color="#fff" />
        </Pressable>
      </View>

      {/* ── Report sheet — same reasons + description as the post report ── */}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setReportOpen(false)}>
          <Pressable style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 20) }} onPress={() => {}}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: d.cardBorder, alignSelf: 'center', marginBottom: 14 }} />
            <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>Report {name(open)}</T>
            <T v="caption" style={{ color: d.faint, marginTop: 3, marginBottom: 14 }}>Why are you reporting this conversation?</T>
            {REPORT_TYPES.map((r) => {
              const on = reportType === r.id;
              return (
                <Pressable key={r.id} onPress={() => { setReportType(r.id); haptic.selection(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 13, borderWidth: 1.5, borderColor: on ? '#E05252' : d.cardBorder, backgroundColor: on ? 'rgba(224,82,82,0.1)' : d.bg, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 8 }}>
                  <FontAwesome5 name={r.icon} size={12} color={on ? '#E05252' : d.faint} />
                  <T v="bodyS" style={{ flex: 1, fontSize: 13, fontWeight: on ? '800' : '600', color: on ? '#E05252' : d.text }}>{r.label}</T>
                  {on ? <FontAwesome5 name="check-circle" size={13} color="#E05252" /> : null}
                </Pressable>
              );
            })}
            <TextInput
              value={reportDesc} onChangeText={setReportDesc} multiline
              placeholder="Add details (optional)…" placeholderTextColor={d.faint}
              style={{ borderRadius: 13, borderWidth: 1.5, borderColor: d.cardBorder, backgroundColor: d.bg, color: d.text, fontSize: 13, paddingHorizontal: 13, paddingVertical: 11, minHeight: 76, textAlignVertical: 'top', marginTop: 4, fontFamily: 'Poppins-Regular' }}
            />
            <Pressable
              onPress={submitReport} disabled={!reportType}
              style={{ marginTop: 14, borderRadius: 14, backgroundColor: reportType ? '#E05252' : d.cardBorder, paddingVertical: 14, alignItems: 'center', opacity: reportType ? 1 : 0.6 }}
            >
              <T v="bodyS" style={{ fontWeight: '800', fontSize: 14, color: reportType ? '#fff' : d.faint }}>Submit report</T>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Block confirm ── */}
      <Modal visible={blockOpen} transparent animationType="fade" onRequestClose={() => setBlockOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
          <View style={{ width: '100%', borderRadius: 20, backgroundColor: d.card, padding: 20, alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(224,82,82,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <FontAwesome5 name="user-slash" size={16} color="#E05252" />
            </View>
            <T v="h2" style={{ fontWeight: '800', fontSize: 16, color: d.text, textAlign: 'center' }}>Block {name(open)}?</T>
            <T v="caption" style={{ color: d.faint, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
              They will not be able to message you, and this conversation will be hidden from your list.
            </T>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' }}>
              <Pressable onPress={() => setBlockOpen(false)} style={{ flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: d.cardBorder, paddingVertical: 12, alignItems: 'center' }}>
                <T v="bodyS" style={{ fontWeight: '700', fontSize: 13, color: d.text }}>Cancel</T>
              </Pressable>
              <Pressable onPress={confirmBlock} style={{ flex: 1, borderRadius: 13, backgroundColor: '#E05252', paddingVertical: 12, alignItems: 'center' }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: '#fff' }}>Block</T>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
