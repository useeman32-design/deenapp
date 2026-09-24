import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { AvatarImage } from '@/components/FeedCard';
import { API_ORIGIN, questionMessage, questionThread, type MyQuestion, type QuestionThreadMessage } from '@/api/client';
import { haptic } from '@/lib/haptics';

type Props = {
  visible: boolean;
  question: MyQuestion | null;
  onClose: () => void;
};

function absolute(raw?: string | null): string | null {
  if (!raw) return null;
  return /^(https?:|blob:|file:|data:)/i.test(raw) ? raw : `${API_ORIGIN}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

/** The question conversation shared by the asker and scholar. A scholar's
 * clarification is a message, not a second disconnected form. */
export function QuestionThreadModal({ visible, question, onClose }: Props) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const green = isDark ? '#4AE38F' : '#1D6F42';
  const [messages, setMessages] = useState<QuestionThreadMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [canSend, setCanSend] = useState(true);

  useEffect(() => {
    if (!visible || !question || question.id <= 0) return;
    setMessages(null);
    setDraft('');
    setError('');
    setCanSend(true);
    let dead = false;
    const refresh = () => void questionThread(question.id).then((r) => { if (!dead) { setMessages(r?.messages ?? []); setCanSend(r?.can_send !== false); } }).catch(() => {});
    refresh();
    const timer = setInterval(refresh, 2800);
    return () => { dead = true; clearInterval(timer); };
  }, [visible, question?.id]);

  const send = async () => {
    if (!question || busy || !canSend || draft.trim().length < 2) return;
    setBusy(true);
    setError('');
    haptic.light();
    const sent = await questionMessage(question.id, draft.trim()).catch(() => null);
    setBusy(false);
    if (!sent) { setError('Could not send this message. Please wait for the scholar to reply before sending another follow-up.'); return; }
    setMessages((cur) => [...(cur ?? []), sent]);
    setDraft('');
  };

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ maxHeight: '92%', backgroundColor: d.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 12 }}>
          <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: d.cardBorder, marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 9 }}>
            <Pressable onPress={onClose} hitSlop={10}><FontAwesome5 name="chevron-left" size={14} color={d.text} /></Pressable>
            <View style={{ flex: 1 }}>
              <T v="h3" numberOfLines={1} style={{ fontSize: 15, fontWeight: '900', color: d.text }}>{question?.title ?? 'Question thread'}</T>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2 }}>Your question · {question?.status ?? 'pending'}</T>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><FontAwesome5 name="times" size={14} color={d.subtext} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
            <View style={{ alignSelf: 'flex-end', maxWidth: '92%', borderRadius: 15, borderTopRightRadius: 4, backgroundColor: isDark ? '#16452D' : '#E7F5EC', padding: 12, marginBottom: 9 }}>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', color: green, marginBottom: 4 }}>YOUR QUESTION</T>
              <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: d.text }}>{question?.question ?? question?.question_text ?? 'Question details unavailable.'}</T>
            </View>
            {question?.answer ? (
              <View style={{ alignSelf: 'flex-start', maxWidth: '92%', borderRadius: 15, borderTopLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(232,201,106,0.35)', backgroundColor: isDark ? 'rgba(232,201,106,0.09)' : 'rgba(232,201,106,0.11)', padding: 12, marginBottom: 10 }}>
                <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', color: '#B08B1B', marginBottom: 4 }}>SCHOLAR ANSWER</T>
                <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: d.text }}>{question.answer}</T>
            </View>
            ) : null}
            {question?.attachment_url ? <Pressable onPress={() => setPreview(absolute(question.attachment_url))}><Image source={{ uri: absolute(question.attachment_url) ?? undefined }} style={{ width: 180, height: 130, borderRadius: 10, marginBottom: 10 }} resizeMode="contain" /></Pressable> : null}
            {messages === null ? <ActivityIndicator color={green} style={{ marginVertical: 18 }} /> : messages.length === 0 ? (
              <T v="caption" style={{ color: d.faint, textAlign: 'center', paddingVertical: 16 }}>No follow-up messages yet. If the scholar asks for more detail, reply here.</T>
            ) : messages.map((m) => (
              <View key={m.id} style={{ alignSelf: m.sender_role === 'asker' ? 'flex-end' : 'flex-start', maxWidth: '92%', flexDirection: m.sender_role === 'asker' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 7, marginBottom: 8 }}>
                <AvatarImage source={m.sender_profile_image_url ?? null} name={m.sender_name} size={25} tint={d.bgSoft} border={d.cardBorder} />
                <View style={{ borderRadius: 14, borderTopLeftRadius: m.sender_role === 'asker' ? 14 : 4, borderTopRightRadius: m.sender_role === 'asker' ? 4 : 14, backgroundColor: m.sender_role === 'asker' ? (isDark ? '#16452D' : '#E7F5EC') : d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 10 }}>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: m.sender_role === 'asker' ? green : d.text }}>{m.sender_name}</T>
                  <T v="bodyS" style={{ fontSize: 12, lineHeight: 17, color: d.subtext, marginTop: 3 }}>{m.message_text}</T>
                </View>
              </View>
            ))}
            {error ? <T v="caption" style={{ color: '#E05252', textAlign: 'center', marginVertical: 5 }}>{error}</T> : null}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: 1, borderTopColor: d.cardBorder, padding: 12 }}>
            <TextInput value={draft} onChangeText={setDraft} editable={canSend && !busy} multiline placeholder={canSend ? "Reply once here while waiting for the scholar…" : "Follow-up sent — waiting for the scholar’s reply"} placeholderTextColor={d.faint} style={{ flex: 1, maxHeight: 90, minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, color: d.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12.5 }} />
            <Pressable accessibilityLabel="Send thread reply" disabled={busy || !canSend || draft.trim().length < 2} onPress={send} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: busy || !canSend || draft.trim().length < 2 ? d.cardBorder : green, alignItems: 'center', justifyContent: 'center' }}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="paper-plane" size={13} color={!canSend || draft.trim().length < 2 ? d.faint : '#fff'} />}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setPreview(null)}>
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }} centerContent>
            {preview ? <Image source={{ uri: preview }} style={{ width: 340, height: 480 }} resizeMode="contain" /> : null}
          </ScrollView>
        </Pressable>
      </Modal>
    </>
  );
}
