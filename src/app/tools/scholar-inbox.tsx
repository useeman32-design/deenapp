import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
import {
  isLive,
  questionThread,
  scholarQueue,
  scholarRespond,
  type QuestionThreadMessage,
  type ScholarQueueRow,
} from '@/api/client';
import { useIsGuest } from '@/lib/guest';
import { LoginRequired } from '@/components/LoginRequired';

/* pass 75 (Tier 2) — the SCHOLAR side of Ask Scholars: the queue of questions
 * addressed to the signed-in scholar, with answer / reject / clarify-message
 * actions. Askers ask from Fatwa & Rulings → Ask a Scholar; scholars answer
 * here. Server: api/questions/scholar_list.php + respond.php + thread.php. */

type Tab = 'to_answer' | 'answered' | 'rejected';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'to_answer', label: 'To answer' },
  { id: 'answered', label: 'Answered' },
  { id: 'rejected', label: 'Rejected' },
];

const PRIO: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#E05252' },
  priority: { label: 'Priority', color: '#D9A441' },
  normal: { label: 'Normal', color: '#7C8B84' },
};

function ScholarInboxScreenInner() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const green = isDark ? '#4AE38F' : '#0E7A46';

  const [tab, setTab] = useState<Tab>('to_answer');
  const [rows, setRows] = useState<ScholarQueueRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<ScholarQueueRow | null>(null);
  const [thread, setThread] = useState<QuestionThreadMessage[] | null>(null);
  const [mode, setMode] = useState<'answer' | 'message' | 'reject'>('answer');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((t: Tab) => {
    if (!isLive()) { setRows([]); return; }
    scholarQueue(t).then((r) => {
      setRows(r?.questions ?? []);
      setCounts(r?.counts ?? {});
    }).catch(() => setRows([]));
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const openQuestion = (q: ScholarQueueRow) => {
    haptic.selection();
    setOpen(q);
    setDraft('');
    setMode('answer');
    setThread(null);
    if (isLive()) {
      questionThread(q.id).then((r) => setThread(r?.messages ?? [])).catch(() => setThread([]));
    }
  };

  const act = async (action: 'answer' | 'reject' | 'message') => {
    if (!open || busy) { return; }
    const text = draft.trim();
    const min = action === 'reject' ? 5 : action === 'answer' ? 10 : 2;
    if (text.length < min) {
      Alert.alert('A little more detail', action === 'answer'
        ? 'Answers need at least 10 characters.'
        : action === 'reject' ? 'Give the asker a reason (5+ characters).' : 'Type a short message first.');
      return;
    }
    haptic.light();
    setBusy(true);
    const ok = await scholarRespond(open.id, action, text).catch(() => false);
    setBusy(false);
    if (!ok) { Alert.alert('Could not send', 'Please try again in a moment.'); return; }
    haptic.success();
    setOpen(null);
    load(tab);
  };

  if (!isLive()) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <TopBar showBack title="Scholar Inbox" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 }}>
          <FontAwesome5 name="user-graduate" size={26} color={d.faint} />
          <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center' }}>
            The Scholar Inbox is available on the live app — sign in at app.deenlink.org with an approved scholar account.
          </T>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar
        showBack
        title="Scholar Inbox"
        subtitle={counts.to_answer != null ? `${counts.to_answer ?? 0} waiting for your answer` : 'Your question queue'}
      />

      {/* tabs */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          const n = counts[t.id];
          return (
            <Pressable key={t.id} onPress={() => { haptic.selection(); setTab(t.id); }}
              style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? green : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(74,227,143,0.12)' : 'rgba(29,111,66,0.07)') : d.card, paddingHorizontal: 13, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: on ? green : d.subtext }}>{t.label}</T>
              {n != null ? <T v="caption" style={{ fontWeight: '900', fontSize: 10, color: on ? green : d.faint }}>{n}</T> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {!rows ? (
          <View style={{ alignItems: 'center', paddingVertical: 50 }}>
            <ActivityIndicator color={green} />
          </View>
        ) : !rows.length ? (
          <View style={{ alignItems: 'center', paddingVertical: 50, gap: 10 }}>
            <FontAwesome5 name={tab === 'to_answer' ? 'check-circle' : 'inbox'} size={24} color={d.faint} />
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5 }}>
              {tab === 'to_answer' ? 'Nothing waiting — jazakAllah khair.' : tab === 'answered' ? 'No answered questions yet.' : 'No rejected questions.'}
            </T>
          </View>
        ) : rows.map((q) => {
          const prio = PRIO[q.priority_level ?? 'normal'] ?? PRIO.normal;
          return (
            <Pressable key={q.id} onPress={() => openQuestion(q)}
              style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AvatarImage source={q.asker_profile_image_url ?? null} name={q.asker_name} size={36} tint={d.bgSoft} border={d.cardBorder} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyS" numberOfLines={1} style={{ fontWeight: '800', fontSize: 13, color: d.text }}>{q.title}</T>
                  <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>
                    {q.asker_name} · @{q.asker_username}{q.category ? ` · ${q.category}` : ''}
                  </T>
                </View>
                {q.status === 'to_answer' || q.status === 'pending' ? (
                  <View style={{ borderRadius: 999, borderWidth: 1, borderColor: `${prio.color}66`, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <T v="caption" style={{ fontSize: 9.5, fontWeight: '900', color: prio.color }}>{prio.label}</T>
                  </View>
                ) : null}
                {q.status === 'answered' ? <FontAwesome5 name="check" size={12} color={green} /> : null}
                {q.status === 'rejected' ? <FontAwesome5 name="times" size={12} color="#E05252" /> : null}
              </View>
              {!!q.question_text ? (
                <T v="bodyS" numberOfLines={2} style={{ fontSize: 11.5, color: d.subtext, marginTop: 8, lineHeight: 16 }}>{q.question_text}</T>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* question detail + composer */}
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: d.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%', paddingTop: 12 }}>
            <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: d.cardBorder, marginBottom: 10 }} />
            {open ? (
              <>
                <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                  <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text }}>{open.title}</T>
                  <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 2 }}>
                    {open.asker_name} · @{open.asker_username}{open.category ? ` · ${open.category}` : ''} · {open.privacy === 'private' ? 'Private' : 'Public'}
                  </T>
                </View>
                <ScrollView style={{ paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
                  <View style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 10 }}>
                    <T v="bodyS" style={{ fontSize: 12.5, color: d.text, lineHeight: 18 }}>{open.question_text || open.title}</T>
                  </View>
                  {!!open.answer_text ? (
                    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(74,227,143,0.35)', backgroundColor: isDark ? 'rgba(74,227,143,0.07)' : 'rgba(29,111,66,0.05)', padding: 12, marginBottom: 10 }}>
                      <T v="caption" style={{ fontWeight: '900', fontSize: 10, letterSpacing: 1, color: green, marginBottom: 4 }}>YOUR ANSWER</T>
                      <T v="bodyS" style={{ fontSize: 12.5, color: d.text, lineHeight: 18 }}>{open.answer_text}</T>
                    </View>
                  ) : null}
                  {thread === null ? (
                    <View style={{ alignItems: 'center', paddingVertical: 14 }}><ActivityIndicator color={green} /></View>
                  ) : thread.length ? (
                    <View style={{ gap: 8, marginBottom: 10 }}>
                      {thread.map((m) => (
                        <View key={m.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                          <AvatarImage source={m.sender_profile_image_url ?? null} name={m.sender_name} size={26} tint={d.bgSoft} border={d.cardBorder} />
                          <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 10 }}>
                            <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, color: m.sender_role === 'scholar' ? green : d.text }}>
                              {m.sender_name}{m.created_time_ago ? ` · ${m.created_time_ago}` : ''}
                            </T>
                            <T v="bodyS" style={{ fontSize: 12, color: d.subtext, marginTop: 3, lineHeight: 16 }}>{m.message_text}</T>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
                {open.status === 'pending' || open.status === 'to_answer' || open.status === 'reviewing' ? (
                  <View style={{ paddingHorizontal: 16, paddingBottom: Platform.OS === 'web' ? 16 : 26, gap: 9 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['answer', 'message'] as const).map((m2) => {
                        const on = mode === m2;
                        return (
                          <Pressable key={m2} onPress={() => { haptic.selection(); setMode(m2); }}
                            style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? green : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(74,227,143,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent', paddingHorizontal: 12, paddingVertical: 7 }}>
                            <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: on ? green : d.subtext }}>{m2 === 'answer' ? 'Answer' : 'Ask for details'}</T>
                          </Pressable>
                        );
                      })}
                    </View>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      multiline
                      placeholder={mode === 'answer' ? 'Write your answer…' : mode === 'reject' ? 'Reason for the asker (5+ characters)…' : 'Ask the asker to clarify…'}
                      placeholderTextColor={d.faint}
                      style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, color: d.text, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, minHeight: 74, textAlignVertical: 'top' }}
                    />
                    <View style={{ flexDirection: 'row', gap: 9 }}>
                      <Pressable disabled={busy} onPress={() => void act(mode)}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: mode === 'reject' ? '#E05252' : green, paddingVertical: 12, opacity: busy ? 0.6 : 1 }}>
                        {busy ? <ActivityIndicator size="small" color={isDark ? '#062312' : '#fff'} /> : <FontAwesome5 name={mode === 'answer' ? 'check' : mode === 'reject' ? 'times' : 'paper-plane'} size={11} color={isDark ? '#062312' : '#fff'} />}
                        <T v="caption" style={{ fontWeight: '900', fontSize: 12, color: isDark ? '#062312' : '#fff' }}>
                          {mode === 'answer' ? 'Publish answer' : mode === 'reject' ? 'Reject question' : 'Send message'}
                        </T>
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => { haptic.selection(); setMode((m3) => (m3 === 'reject' ? 'answer' : 'reject')); }}
                        style={{ borderRadius: 13, borderWidth: 1, borderColor: mode === 'reject' ? '#E05252' : 'rgba(224,82,82,0.5)', backgroundColor: mode === 'reject' ? 'rgba(224,82,82,0.12)' : 'transparent', paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
                        <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: '#E05252' }}>Reject</T>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 16, paddingBottom: Platform.OS === 'web' ? 16 : 26 }}>
                    <Pressable onPress={() => setOpen(null)}
                      style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', paddingVertical: 12 }}>
                      <T v="caption" style={{ fontWeight: '800', fontSize: 12, color: d.text }}>Close</T>
                    </Pressable>
                  </View>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
export default function ScholarInboxScreen() {
  const guest = useIsGuest();
  if (guest) return <LoginRequired module="Scholar Inbox" />;
  return <ScholarInboxScreenInner />;
}
