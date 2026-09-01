import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';
import { MOCK_SCHOLARS } from '@/api/mocks';
import { DPIcon } from '@/components/DeenPoints';

/**
 * Ask Scholars (pass 34):
 *  · BROWSE — scholars + specialties, search & field filter → ask a scholar
 *  · MY QUESTIONS — track progress (processing / answered / rejected)
 *  · PUBLIC — answered public questions from the community
 *  · DeenPoints only set URGENCY priority — they never buy fatwas (note at
 *    the bottom of the category screen, per the user's clarification text).
 */

const FIELDS = ['Fiqh', 'Aqeedah', 'Hadith', 'Tafsir', 'Taharah', 'Salah', 'Zakah', 'Marriage', 'Inheritance'];
/* pass 35 — every category gets an icon (browse grid + ask multi-select) */
const CAT_META: Record<string, { icon: string; tint: string }> = {
  Fiqh: { icon: 'balance-scale', tint: '#5BC8F5' },
  Aqeedah: { icon: 'landmark', tint: '#E8C96A' },
  Hadith: { icon: 'scroll', tint: '#4AE38F' },
  Tafsir: { icon: 'book-open', tint: '#D4A5F5' },
  Taharah: { icon: 'tint', tint: '#7FD8F5' },
  Salah: { icon: 'mosque', tint: '#4AE38F' },
  Zakah: { icon: 'hand-holding-heart', tint: '#E8C96A' },
  Marriage: { icon: 'heart', tint: '#F58FB0' },
  Inheritance: { icon: 'sitemap', tint: '#F5B971' },
  Youth: { icon: 'user-friends', tint: '#7FD86F' },
  Other: { icon: 'ellipsis-h', tint: '#9AA8A0' },
};
const QCATS = ['Aqeedah', 'Fiqh', 'Hadith', 'Tafsir', 'Zakah', 'Marriage', 'Inheritance', 'Youth', 'Other'];
const POINTS_KEY = 'dl.scholars.questions.v1';
const AV = ['https://i.pravatar.cc/120?img=11', 'https://i.pravatar.cc/120?img=12', 'https://i.pravatar.cc/120?img=32'];

type Question = {
  id: string;
  scholarId: number;
  scholarName: string;
  title: string;
  body: string;
  cat: string;
  urgency: number; /* deenpoints pledged */
  isPublic: boolean;
  photo?: string;
  at: number;
  status: 'processing' | 'answered' | 'rejected';
  answer?: string;
};

/* a couple of seeded public answers so the tab is never empty */
const SEED_PUBLIC: Question[] = [
  { id: 'seed1', scholarId: 1, scholarName: 'Sheikh Abdurrahman Al-Ameen', title: 'Is my wudu valid if I wash quickly?', body: '…', cat: 'Fiqh', urgency: 0, isPublic: true, at: Date.now() - 86400000 * 3, status: 'answered', answer: 'Wudu is valid as long as each limb is washed completely once — thoroughness is sunnah, speed does not invalidate it. Allahu a\'lam.' },
  { id: 'seed2', scholarId: 2, scholarName: 'Ustadh Usman Ahmad', title: 'Can I combine prayers while travelling?', body: '…', cat: 'Fiqh', urgency: 0, isPublic: true, at: Date.now() - 86400000 * 6, status: 'answered', answer: 'Yes — a traveller may combine Dhuhr with Asr and Maghrib with Isha according to the majority. Allahu a\'lam.' },
];

const timeAgo = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function Scholars() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<'browse' | 'mine' | 'public'>('browse');
  const [q, setQ] = useState('');
  const [field, setField] = useState<string | null>(null);
  const [catScreen, setCatScreen] = useState<string | null>(null);
  const [asking, setAsking] = useState<number | null>(null); /* scholar id */
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [points, setPoints] = useState(1250);

  useEffect(() => {
    storage.getItem('dl.scholars.questions.v1').then((r) => {
      try { setQuestions(JSON.parse(r ?? '[]') as Question[]); } catch { setQuestions([]); }
    }).catch(() => setQuestions([]));
    storage.getItem('dl.deenpoints').then((r) => { if (r) setPoints(Number(r) || 1250); }).catch(() => {});
  }, []);

  const save = (list: Question[]) => {
    setQuestions(list);
    storage.setItem('dl.scholars.questions.v1', JSON.stringify(list)).catch(() => {});
    storage.setItem('dl.deenpoints', String(points)).catch(() => {});
  };

  const scholar = MOCK_SCHOLARS.find((s) => s.id === asking) ?? null;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return MOCK_SCHOLARS.filter((s) => {
      const f = field ?? catScreen;
      if (f && !(s.fields_of_knowledge ?? '').includes(f)) return false;
      if (!needle) return true;
      return ((s.display_name ?? '') + (s.institute ?? '') + (s.fields_of_knowledge ?? '') + (s.madhhab ?? '')).toLowerCase().includes(needle);
    });
  }, [q, field, catScreen]);

  const publicQs = useMemo(
    () => [...(questions ?? []).filter((x) => x.isPublic && x.status === 'answered'), ...SEED_PUBLIC].sort((a, b) => b.at - a.at),
    [questions],
  );

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar title="Ask Scholars" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* tabs */}
        <View style={{ flexDirection: 'row', gap: 7, marginBottom: 14 }}>
          {([['browse', 'Scholars', 'user-graduate'], ['mine', 'My Questions', 'inbox'], ['public', 'Public', 'globe-africa']] as const).map(([id, label, icon]) => {
            const on = tab === id;
            return (
              <Pressable key={id} accessibilityLabel={`tab ${label}`} onPress={() => { haptic.selection(); setTab(id); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent', paddingVertical: 9 }}>
                <FontAwesome5 name={icon} size={11} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{label}</T>
              </Pressable>
            );
          })}
        </View>

        {/* ── BROWSE ── */}
        {tab === 'browse' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 10, marginBottom: 10 }}>
              <FontAwesome5 name="search" size={12} color={d.faint} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search scholars, institutes, specialties…" placeholderTextColor={d.faint} style={{ flex: 1, paddingVertical: 11, fontSize: 15, fontFamily: 'Poppins-Medium', color: d.text }} />
            </View>
            {/* pass 35 — categories are a dedicated screen: tap a card → its scholars */}
            {!catScreen ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 }}>
                {[null, ...FIELDS].map((f) => {
                  const meta = f ? (CAT_META[f] ?? { icon: 'ellipsis-h', tint: '#9AA8A0' }) : { icon: 'globe-africa', tint: '#E8C96A' };
                  return (
                    <Pressable
                      key={f ?? 'all'}
                      accessibilityLabel={f ? `category ${f}` : 'all fields'}
                      onPress={() => { haptic.selection(); setCatScreen(f); }}
                      style={{ width: '31%', flexGrow: 1, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 6, gap: 7 }}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${meta.tint}18`, alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name={meta.icon as never} size={13} color={meta.tint} />
                      </View>
                      <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: d.subtext, textAlign: 'center' }}>{f ?? 'All fields'}</T>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Pressable onPress={() => { haptic.selection(); setCatScreen(null); }} hitSlop={10}>
                  <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '700' }}>‹ Categories</T>
                </Pressable>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <FontAwesome5 name={(CAT_META[catScreen]?.icon ?? 'globe-africa') as never} size={11} color={CAT_META[catScreen]?.tint ?? '#E8C96A'} />
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>{catScreen}</T>
                </View>
                <View style={{ width: 60 }} />
              </View>
            )}

            {list.map((s) => (
              <Pressable
                key={s.id}
                accessibilityLabel={`ask ${s.display_name}`}
                onPress={() => { haptic.selection(); setAsking(s.id); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14, marginBottom: 9, opacity: pressed ? 0.85 : 1 })}
              >
                <Image source={{ uri: AV[(s.id - 1) % AV.length] }} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)' }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name="certificate" size={10} color="#E8C96A" />
                    <T v="body" style={{ fontWeight: '800', fontSize: 13.5, color: d.text }} numberOfLines={1}>{s.display_name}</T>
                  </View>
                  <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2 }} numberOfLines={1}>{s.institute} · {s.madhhab}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {(s.fields_of_knowledge ?? '').split(', ').map((f) => (
                      <View key={f} style={{ borderRadius: 7, backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.2)', paddingHorizontal: 7, paddingVertical: 2 }}>
                        <T v="caption" style={{ fontSize: 8.5, fontWeight: '700', color: isDark ? '#4AE38F' : '#1D6F42' }}>{f}</T>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={{ borderRadius: 10, backgroundColor: isDark ? '#4AE38F' : '#1D6F42', paddingHorizontal: 11, paddingVertical: 7 }}>
                  <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Ask</T>
                </View>
              </Pressable>
            ))}
            {!list.length ? <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>No scholars match that search.</T> : null}

            {/* DeenPoints clarification — bottom of the selection screen */}
            <View style={{ borderRadius: 17, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.05)', padding: 15, marginTop: 16 }}>
              <T v="h3" style={{ fontWeight: '800', fontSize: 13.5, color: '#E8C96A' }}>⚠️ Important clarification</T>
              <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.text, marginTop: 8, fontWeight: '700' }}>
                DeenPoints do not buy fatwas or Islamic opinions.
              </T>
              <T v="bodyS" style={{ fontSize: 11, lineHeight: 17, color: d.subtext, marginTop: 4 }}>
                They are used for purchases in DeenLink, unlocking app content, and setting the priority of questions sent to scholars.
              </T>
              <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginTop: 10 }}>EARN DEENPOINTS BY</T>
              {[
                'Participating in app activities — reading Qur’an, prayer times and more',
                'Contributing to the community',
                'Supporting the DeenLink project',
              ].map((x) => (
                <View key={x} style={{ flexDirection: 'row', gap: 7, marginTop: 6 }}>
                  <FontAwesome5 name="check-circle" size={10} color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginTop: 3 }} />
                  <T v="caption" style={{ flex: 1, fontSize: 10.5, lineHeight: 15, color: d.subtext }}>{x}</T>
                </View>
              ))}
              <T v="caption" style={{ fontSize: 10, color: d.faint, fontStyle: 'italic', marginTop: 10 }}>🤍 This system ensures fairness, respect and sustainability.</T>
            </View>
          </>
        ) : null}

        {/* ── MY QUESTIONS ── */}
        {tab === 'mine' ? (
          questions == null ? (
            <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginTop: 30 }} />
          ) : !questions.length ? (
            <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 40 }}>You haven{"'"}t asked anything yet — pick a scholar and ask your first question.</T>
          ) : (
            questions.map((x) => (
              <View key={x.id} style={{ borderRadius: 17, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14, marginBottom: 9 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ borderRadius: 999, backgroundColor: x.status === 'answered' ? 'rgba(74,227,143,0.15)' : x.status === 'rejected' ? 'rgba(224,80,80,0.12)' : 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: x.status === 'answered' ? '#4AE38F' : x.status === 'rejected' ? '#E05050' : '#E8C96A', paddingHorizontal: 9, paddingVertical: 3 }}>
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4, color: x.status === 'answered' ? '#4AE38F' : x.status === 'rejected' ? '#E05050' : '#E8C96A' }}>{x.status.toUpperCase()}</T>
                  </View>
                  <T v="caption" style={{ flex: 1, fontSize: 9.5, color: d.faint, textAlign: 'right' }}>{timeAgo(x.at)} · {x.isPublic ? 'Public' : 'Private'}</T>
                </View>
                <T v="body" style={{ fontWeight: '800', fontSize: 13, color: d.text, marginTop: 8 }}>{x.title}</T>
                <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2 }}>to {x.scholarName} · {x.cat}{x.urgency ? ` · ⚡ ${x.urgency} DP priority` : ''}</T>
                {x.status === 'answered' && x.answer ? (
                  <View style={{ marginTop: 9, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.07)' : 'rgba(29,111,66,0.05)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.25)' : 'rgba(29,111,66,0.15)', padding: 11 }}>
                    <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: isDark ? '#4AE38F' : '#1D6F42' }}>ANSWER</T>
                    <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.subtext, marginTop: 4 }}>{x.answer}</T>
                  </View>
                ) : null}
                {x.status === 'processing' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }}>
                    <ActivityIndicator size="small" color="#E8C96A" />
                    <T v="caption" style={{ fontSize: 10, color: d.faint }}>The scholar is reviewing your question…</T>
                  </View>
                ) : null}
              </View>
            ))
          )
        ) : null}

        {/* ── PUBLIC ── */}
        {tab === 'public' ? (
          publicQs.map((x) => (
            <View key={x.id} style={{ borderRadius: 17, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14, marginBottom: 9 }}>
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: isDark ? '#4AE38F' : '#1D6F42' }}>{x.cat.toUpperCase()} · {timeAgo(x.at)}</T>
              <T v="body" style={{ fontWeight: '800', fontSize: 13.5, color: d.text, marginTop: 5 }}>{x.title}</T>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 3 }}>asked by a community member · answered by {x.scholarName}</T>
              <View style={{ marginTop: 9, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.07)' : 'rgba(29,111,66,0.05)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.25)' : 'rgba(29,111,66,0.15)', padding: 11 }}>
                <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: isDark ? '#4AE38F' : '#1D6F42' }}>ANSWER</T>
                <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, color: d.subtext, marginTop: 4 }}>{x.answer}</T>
              </View>
            </View>
          ))
        ) : null}
      </ScrollView>

      {/* ── ASK SHEET ── */}
      <Modal visible={asking != null} transparent animationType="slide" onRequestClose={() => setAsking(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)' }} onPress={() => setAsking(null)} />
        <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, maxHeight: '92%' }}>
          <AskSheet
            scholarName={scholar?.display_name ?? ''}
            fields={scholar?.fields_of_knowledge ?? ''}
            points={points}
            onClose={() => setAsking(null)}
            onSubmit={(payload) => {
              const entry: Question = { ...payload, id: `q${Date.now()}`, scholarId: asking ?? 0, at: Date.now(), status: 'processing' };
              const next = [entry, ...(questions ?? [])];
              /* simulate the scholar answering shortly (or keep processing) */
              setTimeout(() => {
                setQuestions((cur) => {
                  const upd = (cur ?? []).map((x) => (x.id === entry.id ? { ...x, status: 'answered' as const, answer: 'JazakAllahu khairan for your question. Based on the Qur’an and Sunnah: ' + (payload.body.length > 40 ? 'the general ruling here is that which is closest to the prophetic guidance — please consult local specifics with a qualified scholar in person. Allahu a\'lam.' : '…') } : x));
                  storage.setItem('dl.scholars.questions.v1', JSON.stringify(upd)).catch(() => {});
                  return upd;
                });
              }, 9000);
              save(next);
              setAsking(null);
              setTab('mine');
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

function AskSheet({ scholarName, fields, points, onClose, onSubmit }: { scholarName: string; fields: string; points: number; onClose: () => void; onSubmit: (p: Omit<Question, 'id' | 'scholarId' | 'at' | 'status'>) => void }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [urgency, setUrgency] = useState('0');
  const [isPublic, setIsPublic] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);

  const pledged = Math.min(Number(urgency) || 0, points);
  const valid = title.trim().length > 4 && body.trim().length > 9;

  return (
    <ScrollView style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: (insets.bottom ?? 0) + 18 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <T v="h3" style={{ fontWeight: '800', fontSize: 15 }}>Ask your question</T>
          <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>to {scholarName} · {fields}</T>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="times" size={12} color={d.subtext} />
        </Pressable>
      </View>

      {/* deenpoints balance */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.07)' : 'rgba(212,175,55,0.05)', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 }}>
        <DPIcon size={13} />
        <T v="bodyS" style={{ flex: 1, fontWeight: '800', fontSize: 12.5, color: d.text }}>{points.toLocaleString()} DeenPoints</T>
        <T v="caption" style={{ fontSize: 9, color: d.faint }}>balance</T>
      </View>

      <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>TITLE</T>
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Ruling on combining prayers while travelling" placeholderTextColor={d.faint} style={{ borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, fontSize: 14, fontFamily: 'Poppins-Medium', color: d.text, marginBottom: 12 }} />

      <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>YOUR QUESTION</T>
      <TextInput value={body} onChangeText={setBody} placeholder="Describe your situation with the details that affect the ruling…" placeholderTextColor={d.faint} multiline style={{ borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, fontSize: 13.5, minHeight: 110, textAlignVertical: 'top', fontFamily: 'Poppins-Regular', color: d.text, marginBottom: 12 }} />

      <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>CATEGORY — PICK UP TO 3</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
        {QCATS.map((c) => {
          const on = cats.includes(c);
          const meta = CAT_META[c] ?? CAT_META.Other;
          return (
            <Pressable
              key={c}
              accessibilityLabel={`category ${c}`}
              onPress={() => { haptic.selection(); setCats((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : cur.length >= 3 ? cur : [...cur, c]); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent', paddingHorizontal: 11, paddingVertical: 7 }}
            >
              <FontAwesome5 name={meta.icon as never} size={10} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : meta.tint} />
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{c}</T>
              {on ? <FontAwesome5 name="check" size={8} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
            </Pressable>
          );
        })}
      </View>

      <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>URGENCY — PAY DEENPOINTS TO PRIORITIZE</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, paddingHorizontal: 12, marginBottom: 4 }}>
        <FontAwesome5 name="bolt" size={12} color="#E8C96A" />
        <TextInput value={urgency} onChangeText={(t) => setUrgency(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" style={{ flex: 1, paddingVertical: 11, fontSize: 14, fontWeight: '700', fontFamily: 'Poppins-Medium', color: d.text }} placeholder="0" placeholderTextColor={d.faint} />
        <DPIcon size={10} color="#E8C96A" /><T v="caption" style={{ fontSize: 9.5, color: d.faint }}>max {points.toLocaleString()}</T>
      </View>
      <T v="caption" style={{ fontSize: 9, color: d.faint, marginBottom: 12 }}>Paying DeenPoints only moves your question up the queue — it never changes the answer. {pledged ? `${pledged.toLocaleString()} DP will be pledged.` : ''}</T>

      {/* public / private */}
      <Pressable onPress={() => { haptic.selection(); setIsPublic((p) => !p); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, marginBottom: 12 }}>
        <FontAwesome5 name={isPublic ? 'globe-africa' : 'lock'} size={13} color={isPublic ? (isDark ? '#4AE38F' : '#1D6F42') : '#E8C96A'} />
        <View style={{ flex: 1 }}>
          <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{isPublic ? 'Public question' : 'Private question'}</T>
          <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{isPublic ? 'Posted to Public Questions once answered' : 'Visible only to you and the scholar'}</T>
        </View>
        <View style={{ width: 40, height: 22, borderRadius: 12, backgroundColor: isPublic ? '#1F8F5C' : d.bgSoft, borderWidth: 1, borderColor: isPublic ? '#1F8F5C' : d.cardBorder, padding: 2 }}>
          <View style={{ width: 16, height: 16, borderRadius: 9, backgroundColor: '#FFFFFF', marginLeft: isPublic ? 18 : 0 }} />
        </View>
      </Pressable>

      {/* attach photo (simulated) */}
      <Pressable onPress={() => { haptic.selection(); setPhoto((p) => (p ? null : 'attached')); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: 1, borderColor: photo ? 'rgba(74,227,143,0.4)' : d.cardBorder, backgroundColor: d.bg, padding: 12, marginBottom: 16 }}>
        <FontAwesome5 name={photo ? 'check-circle' : 'camera'} size={13} color={photo ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
        <T v="bodyS" style={{ flex: 1, fontSize: 12, fontWeight: '700', color: photo ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{photo ? 'Photo attached' : 'Attach a photo (optional)'}</T>
      </Pressable>

      <Pressable
        accessibilityLabel="send question"
        onPress={() => { if (valid) { haptic.success(); onSubmit({ scholarName, title: title.trim(), body: body.trim(), cat: cats.join(' · ') || 'Other', urgency: pledged, isPublic, photo: photo ?? undefined }); } }}
        disabled={!valid}
        style={({ pressed }) => ({ borderRadius: 14, backgroundColor: valid ? (isDark ? '#4AE38F' : '#1D6F42') : d.cardBorder, alignItems: 'center', paddingVertical: 14, opacity: pressed ? 0.85 : 1 })}
      >
        <T v="bodyS" style={{ fontWeight: '900', fontSize: 13, color: valid ? '#06140D' : d.faint }}>Send question{pledged ? ` · ⚡ ${pledged.toLocaleString()} DP` : ''}</T>
      </Pressable>
      <T v="caption" style={{ fontSize: 9, color: d.faint, textAlign: 'center', marginTop: 10, lineHeight: 14 }}>
        Scholars answer according to the Qur{"'"}an and Sunnah. DeenPoints never buy fatwas — they only set priority.
      </T>
    </ScrollView>
  );
}
