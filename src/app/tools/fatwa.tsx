import { markGoal } from '@/lib/routine';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { loadFatwas, type Fatwa } from '@/lib/ai';
import { askUnreadCount, directFatwas, isLive, myQuestions, scholars, submitQuestion, type DirectFatwa, type MyQuestion } from '@/api/client';
import type { Scholar } from '@/api/types';
import { storage } from '@/lib/storage';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useBookmarks } from '@/lib/bookmarks';

/* Sources we actually have data for. "Direct Fatwa" = questions answered by
 * DeenLink scholars (live API); IslamQA.info is bundled in-app (searchable).
 * Islam House / Islamweb were removed — we hold no crawlable copy of their
 * fatwas (see note at the bottom of the screen for how to add one). */
const SOURCES = [
  { id: 'direct', name: 'Direct Fatwa', bundled: true, note: 'DeenLink Scholars & fatwas from well-known scholars' },
  { id: 'ask', name: 'Ask a Scholar', bundled: false, note: 'Send your own question to a verified scholar' },
  { id: 'islamqa', name: 'IslamQA.info', bundled: true, note: '1,080+ rulings in-app' },
] as const;

const ASK_CATEGORIES = ['Prayer', 'Fasting', 'Zakah', 'Hajj', 'Marriage', 'Finance', 'Qur\u2019an', 'Other'];

/* Topic categories — the bundled corpus has no category field, so we bucket
 * rulings by matching keywords in the title/question. Counts are computed from
 * the real archive so they always match the data. */
const CATEGORIES: { key: string; label: string; icon: keyof typeof FontAwesome5.glyphMap; kw: string[] }[] = [
  { key: 'prayer', label: 'Prayer', icon: 'pray', kw: ['prayer', 'salah', 'salat', 'namaz', 'wudu', 'ablution', 'sujood', 'rak'] },
  { key: 'fasting', label: 'Fasting', icon: 'moon', kw: ['fast', 'ramadan', 'ramadhan', 'sawm', 'iftar', 'suhoor'] },
  { key: 'zakah', label: 'Zakah & Charity', icon: 'hand-holding-heart', kw: ['zakah', 'zakat', 'charity', 'sadaqah', 'alms'] },
  { key: 'hajj', label: 'Hajj & Umrah', icon: 'kaaba', kw: ['hajj', 'umrah', 'pilgrim', 'ihram', 'tawaf'] },
  { key: 'marriage', label: 'Marriage & Family', icon: 'ring', kw: ['marriage', 'nikah', 'divorce', 'talaq', 'wife', 'husband', 'spouse'] },
  { key: 'finance', label: 'Finance & Trade', icon: 'money-bill-wave', kw: ['riba', 'interest', 'loan', 'trade', 'business', 'insurance', 'bank'] },
  { key: 'food', label: 'Food & Drink', icon: 'utensils', kw: ['food', 'drink', 'halal', 'haram', 'meat', 'slaughter', 'alcohol'] },
  { key: 'women', label: 'Women', icon: 'female', kw: ['hijab', 'woman', 'women', 'menstruation', 'haid', 'niqab', 'khimar'] },
  { key: 'aqeedah', label: 'Belief & Aqeedah', icon: 'star-and-crescent', kw: ['allah', 'tawheed', 'shirk', 'faith', 'iman', 'angel', 'aqeedah', 'belief'] },
  { key: 'quran', label: "Qur'an & Hadith", icon: 'book-open', kw: ['quran', 'surah', 'ayah', 'tafsir', 'hadith', 'sunnah', 'recit'] },
];

function categoryOf(f: Fatwa): string | null {
  const hay = (f.t + ' ' + f.q).toLowerCase();
  for (const c of CATEGORIES) if (c.kw.some((k) => hay.includes(k))) return c.key;
  return null;
}

/** Learning — Fatwa & Rulings: hero + count, source cards (Direct Fatwa +
 * IslamQA), a category FILTER DROPDOWN, a mixed "Recent" section, and a
 * searchable rulings list with correct icons. */
export default function FatwaBrowser() {
  useEffect(() => { markGoal('fatwa').catch(() => {}); }, []);
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [all, setAll] = useState<Fatwa[] | null>(null);
  const [direct, setDirect] = useState<DirectFatwa[]>([]);
  const [source, setSource] = useState<string>('direct');
  const [cat, setCat] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  /* pass 69 — saved rulings live in the unified server-synced bookmark store
   * with STABLE keys (d<id> for live rulings, i<index> for bundled ones) */
  const bmFatwa = useBookmarks('fatwa');
  const [view, setView] = useState<'all' | 'saved'>('all');
  const [limit, setLimit] = useState(40);
  const [more, setMore] = useState(false);

  useEffect(() => { loadFatwas().then(setAll).catch(() => setAll([])); }, []);
  useEffect(() => { directFatwas(30).then(setDirect).catch(() => setDirect([])); }, []);

  /* ── pass 69 — Ask a Scholar: form state, scholar roster, my questions ── */
  const [scholarList, setScholarList] = useState<Scholar[]>([]);
  const [myQs, setMyQs] = useState<MyQuestion[]>([]);
  const [askUnread, setAskUnread] = useState(0);
  const [askScholar, setAskScholar] = useState<number | null>(null);
  const [askTitle, setAskTitle] = useState('');
  const [askDetails, setAskDetails] = useState('');
  const [askCat, setAskCat] = useState<string | null>(null);
  const [askPrivate, setAskPrivate] = useState(false);
  const [askBonus, setAskBonus] = useState(0);
  const [askBusy, setAskBusy] = useState(false);
  const [askMsg, setAskMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const live = isLive();
  const { user } = useAuth();
  useEffect(() => {
    if (!live || source !== 'ask') { return; }
    scholars().then((r) => { setScholarList(r); setAskScholar((cur) => cur ?? (r[0]?.id ?? null)); }).catch(() => {});
    myQuestions().then((r) => { if (r) { setMyQs(r.questions); } }).catch(() => {});
    askUnreadCount().then(setAskUnread).catch(() => {});
  }, [live, source]);
  const sendQuestion = async () => {
    if (askBusy || !askScholar) { return; }
    if (askTitle.trim().length < 5) { setAskMsg({ ok: false, text: 'Give your question a short title (5+ characters).' }); return; }
    if (askDetails.trim().length < 10) { setAskMsg({ ok: false, text: 'Add a few more details (10+ characters).' }); return; }
    haptic.light();
    setAskBusy(true);
    setAskMsg(null);
    const r = await submitQuestion({
      scholar_id: askScholar,
      title: askTitle.trim(),
      details: askDetails.trim(),
      privacy: askPrivate ? 'private' : 'public',
      category: askCat ?? undefined,
      additional_deenpoints: askBonus > 0 ? askBonus : undefined,
    }).catch(() => ({ ok: false }));
    setAskBusy(false);
    if (r.ok) {
      setAskMsg({ ok: true, text: 'Question sent — the scholar will answer in-app. You\u2019ll see it under My Questions.' });
      setAskTitle(''); setAskDetails(''); setAskBonus(0);
      const fresh = await myQuestions().catch(() => null);
      if (fresh) { setMyQs(fresh.questions); }
    } else {
      setAskMsg({ ok: false, text: 'Could not send your question. Check your connection and try again.' });
    }
  };
  const savedKey = (f: unknown, i: number) => { const id = (f as { id?: number })?.id; return id ? `d${id}` : `i${i}`; };
  const isSaved = (i: number) => { const f = all?.[i]; return f ? bmFatwa.has(savedKey(f, i)) : false; };
  const toggleSave = (i: number) => {
    const f = all?.[i];
    if (!f) return;
    haptic.light();
    void bmFatwa.toggle(savedKey(f, i), { t: f.t, q: f.q, a: f.a, id: (f as { id?: number })?.id });
  };

  const green = isDark ? '#4AE38F' : '#1D6F42';

  const matched = useMemo(() => {
    if (!all) return [];
    if (view === 'saved') return all.filter((f, i) => bmFatwa.has(savedKey(f, i)));
    let base = all;
    if (cat) base = all.filter((f) => categoryOf(f) === cat);
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    const toks = needle.split(/\s+/).filter((t) => t.length > 2);
    return base
      .map((f) => {
        const low = (f.t + ' ' + f.q).toLowerCase();
        let sc = 0;
        for (const t of toks) if (low.includes(t)) sc++;
        return { f, sc };
      })
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc)
      .map((x) => x.f);
  }, [all, q, view, bmFatwa.list, cat]);
  const list = matched.slice(0, limit);

  /* Recent = one fresh ruling from each category, interleaved (mixed). */
  const recent = useMemo(() => {
    if (!all) return [];
    const out: Fatwa[] = [];
    for (const c of CATEGORIES) {
      const f = all.find((x) => categoryOf(x) === c.key);
      if (f) out.push(f);
    }
    return out.slice(0, 6);
  }, [all]);

  useEffect(() => { setLimit(40); }, [q, view, cat, source]);

  const loadMore = () => {
    if (more || !all || limit >= matched.length) return;
    setMore(true);
    setTimeout(() => { setLimit((l) => l + 40); setMore(false); }, 450);
  };

  const openUrl = (url: string) => { haptic.selection(); Linking.openURL(url).catch(() => {}); };
  const total = (all?.length ?? 0) + direct.length;
  const catLabel = cat ? (CATEGORIES.find((c) => c.key === cat)?.label ?? 'Category') : 'All categories';

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title="Fatwa & Rulings" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          if (contentOffset.y + layoutMeasurement.height > contentSize.height - 420) loadMore();
        }}
        scrollEventThrottle={140}
      >
        {/* ── HERO ── */}
        <View style={{ borderRadius: 20, padding: 20, marginTop: 6, marginBottom: 16, backgroundColor: isDark ? '#12351F' : '#1D6F42' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <FontAwesome5 name="balance-scale" size={14} color="#B6F0CB" />
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, color: '#B6F0CB' }}>FATWA & RULINGS</T>
          </View>
          <T v="h2" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 26, lineHeight: 32 }}>{all ? total.toLocaleString() : '—'}</T>
          <T v="caption" style={{ fontSize: 12, color: '#D6F5E2', marginTop: 2 }}>authentic rulings · DeenLink scholars + IslamQA archive</T>
        </View>

        {/* ── pass 75 — scholars answer from their own inbox ── */}
        {live && user?.user_type === 'scholar' ? (
          <Pressable onPress={() => { haptic.selection(); router.push('/tools/scholar-inbox'); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(14,122,70,0.3)', backgroundColor: isDark ? 'rgba(74,227,143,0.08)' : 'rgba(29,111,66,0.05)', padding: 13, marginBottom: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(74,227,143,0.16)' : 'rgba(29,111,66,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="inbox" size={14} color={green} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyS" style={{ fontWeight: '800', fontSize: 13, color: d.text }}>Scholar Inbox</T>
              <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>Answer the questions sent to you</T>
            </View>
            <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
          </Pressable>
        ) : null}

        {/* ── SOURCE CARDS ── */}
        <T v="h3" style={{ fontSize: 13, fontWeight: '800', marginBottom: 8 }}>Sources</T>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {SOURCES.map((s) => {
            const on = source === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => { haptic.selection(); setSource(s.id); setCat(null); setQ(''); }}
                style={{ flex: 1, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, borderColor: on ? green : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(74,227,143,0.12)' : 'rgba(29,111,66,0.07)') : d.card }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FontAwesome5 name={s.id === 'direct' ? 'user-graduate' : s.id === 'ask' ? 'question-circle' : 'database'} size={10} color={on ? green : d.faint} />
                  <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: on ? green : d.text }}>{s.name}</T>
                </View>
                <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 3 }}>{s.note}</T>
              </Pressable>
            );
          })}
        </View>

        {source === 'ask' ? (
          /* ── pass 69 — ASK A SCHOLAR: form + my questions (live API) ── */
          <View style={{ marginBottom: 16 }}>
            {!live ? (
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 16 }}>
                <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: d.subtext }}>Ask a Scholar is available on the live app — sign in at app.deenlink.org to send your question to a verified scholar.</T>
              </View>
            ) : (
              <>
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 14, marginBottom: 12, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name="user-graduate" size={11} color={green} />
                    <T v="h3" style={{ fontSize: 13, fontWeight: '800' }}>Ask a Scholar</T>
                  </View>
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 1, color: d.faint }}>CHOOSE A SCHOLAR</T>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                    {scholarList.map((sc) => {
                      const on = askScholar === sc.id;
                      return (
                        <Pressable
                          key={sc.id}
                          onPress={() => { haptic.selection(); setAskScholar(sc.id); }}
                          style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? green : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(14,122,70,0.08)') : 'transparent', paddingHorizontal: 12, paddingVertical: 8 }}
                        >
                          <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: on ? green : d.subtext }}>{sc.display_name || sc.title || `Scholar ${sc.id}`}</T>
                        </Pressable>
                      );
                    })}
                    {scholarList.length === 0 ? <T v="caption" style={{ fontSize: 11, color: d.faint }}>Loading scholars…</T> : null}
                  </ScrollView>
                  <TextInput
                    value={askTitle}
                    onChangeText={setAskTitle}
                    placeholder="Question title (short)"
                    placeholderTextColor={d.faint}
                    maxLength={200}
                    style={{ borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(20,36,28,0.02)', paddingHorizontal: 12, paddingVertical: 11, fontSize: 12.5, color: d.text }}
                  />
                  <TextInput
                    value={askDetails}
                    onChangeText={setAskDetails}
                    placeholder="Describe your question in detail…"
                    placeholderTextColor={d.faint}
                    maxLength={5000}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={{ borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(20,36,28,0.02)', paddingHorizontal: 12, paddingVertical: 11, fontSize: 12.5, color: d.text, minHeight: 84 }}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {ASK_CATEGORIES.map((c) => {
                      const on = askCat === c;
                      return (
                        <Pressable key={c} onPress={() => { haptic.selection(); setAskCat(on ? null : c); }} style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? green : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(14,122,70,0.07)') : 'transparent', paddingHorizontal: 11, paddingVertical: 6 }}>
                          <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: on ? green : d.subtext }}>{c}</T>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {([false, true] as const).map((pv) => {
                      const on = askPrivate === pv;
                      return (
                        <Pressable key={String(pv)} onPress={() => { haptic.selection(); setAskPrivate(pv); }} style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? green : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(14,122,70,0.07)') : 'transparent', paddingHorizontal: 11, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <FontAwesome5 name={pv ? 'lock' : 'globe-africa'} size={9} color={on ? green : d.faint} />
                          <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: on ? green : d.subtext }}>{pv ? 'Private' : 'Public'}</T>
                        </Pressable>
                      );
                    })}
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => setAskBonus((b) => Math.max(0, b - 25))} hitSlop={8} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="minus" size={9} color={d.subtext} />
                    </Pressable>
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.subtext, minWidth: 92, textAlign: 'center' }}>{askBonus > 0 ? `+${askBonus} pts bonus` : 'No bonus'}</T>
                    <Pressable onPress={() => setAskBonus((b) => Math.min(500, b + 25))} hitSlop={8} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="plus" size={9} color={d.subtext} />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => { void sendQuestion(); }}
                    disabled={askBusy || !askScholar}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, backgroundColor: askBusy || !askScholar ? d.bgSoft : green, opacity: pressed ? 0.85 : 1 })}
                  >
                    {askBusy ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="paper-plane" size={11} color="#fff" />}
                    <T v="bodyS" style={{ fontWeight: '900', fontSize: 12.5, color: askBusy || !askScholar ? d.faint : '#fff' }}>{askBusy ? 'Sending…' : 'Send question'}</T>
                  </Pressable>
                  {askMsg ? <T v="caption" style={{ fontSize: 11, lineHeight: 16, color: askMsg.ok ? green : '#FF6B6B' }}>{askMsg.text}</T> : null}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <FontAwesome5 name="list" size={11} color={green} />
                  <T v="h3" style={{ fontSize: 13, fontWeight: '800' }}>My Questions</T>
                  {askUnread > 0 ? (
                    <View style={{ minWidth: 17, borderRadius: 9, backgroundColor: green, paddingHorizontal: 5, paddingVertical: 1.5, alignItems: 'center' }}>
                      <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', color: '#fff' }}>{askUnread} new</T>
                    </View>
                  ) : null}
                </View>
                {myQs.length === 0 ? (
                  <T v="caption" style={{ fontSize: 11.5, color: d.faint, textAlign: 'center', paddingVertical: 16 }}>You haven\u2019t asked anything yet.</T>
                ) : myQs.map((mq) => {
                  const answered = String(mq.status).toLowerCase() === 'answered';
                  return (
                    <View key={mq.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: answered ? (isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.28)') : d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <T v="bodyS" numberOfLines={2} style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: d.text }}>{mq.title}</T>
                        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: answered ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.10)') : 'rgba(232,201,106,0.16)' }}>
                          <T v="caption" style={{ fontSize: 9, fontWeight: '900', color: answered ? green : '#C9A227' }}>{answered ? 'ANSWERED' : String(mq.status || 'pending').toUpperCase()}</T>
                        </View>
                      </View>
                      {answered && mq.answer ? (
                        <T v="bodyS" numberOfLines={4} style={{ fontSize: 11.5, lineHeight: 17, color: d.subtext, marginTop: 7 }}>{mq.answer}</T>
                      ) : null}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        ) : source === 'direct' ? (
          /* ── DIRECT FATWAS: DeenLink scholars' answered public questions ── */
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <FontAwesome5 name="user-graduate" size={11} color={green} />
              <T v="h3" style={{ fontSize: 13, fontWeight: '800' }}>Direct Fatwas · DeenLink Scholars</T>
            </View>
            {direct.length === 0 ? (
              <Pressable onPress={() => { haptic.selection(); setSource('islamqa'); setCat(null); setQ(''); }} style={{ borderRadius: 15, borderWidth: 1, borderColor: green, backgroundColor: isDark ? 'rgba(74,227,143,0.10)' : 'rgba(29,111,66,0.06)', padding: 18, alignItems: 'center', gap: 8 }}>
                <FontAwesome5 name="compass" size={18} color={green} />
                <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: green, textAlign: 'center' }}>No direct answers yet — tap to explore IslamQA fatwas</T>
                <T v="caption" style={{ fontSize: 10, color: d.faint, textAlign: 'center' }}>1,080+ authentic rulings, searchable in-app</T>
              </Pressable>
            ) : (
              direct.map((f) => (
                <Pressable key={`d${f.id}`} onPress={() => openUrl('https://app.deenlink.org')} style={{ borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 9 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {f.scholar?.profile_image_url ? (
                      <Image source={{ uri: f.scholar.profile_image_url }} style={{ width: 26, height: 26, borderRadius: 13 }} />
                    ) : (
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(48,63,143,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name="user-graduate" size={11} color="#3F51B5" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <T v="caption" style={{ fontSize: 10.5, fontWeight: '800' }}>{f.scholar?.name || 'DeenLink Scholar'}</T>
                      <T v="caption" style={{ fontSize: 9, color: d.faint }}>answered {f.answered_time_ago}{f.category ? ` · ${f.category}` : ''}</T>
                    </View>
                    <FontAwesome5 name="check-circle" size={12} color={green} />
                  </View>
                  <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700', lineHeight: 18 }}>{f.title}</T>
                  {!!f.preview && <T v="caption" style={{ fontSize: 10.5, lineHeight: 16, color: d.subtext, marginTop: 4 }}>{f.preview.slice(0, 160)}…</T>}
                </Pressable>
              ))
            )}
          </View>
        ) : (
          <>
            {/* ── RECENT: mixed across categories ── */}
            {!cat && !q && recent.length > 0 ? (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <FontAwesome5 name="clock" size={11} color={green} />
                  <T v="h3" style={{ fontSize: 13, fontWeight: '800' }}>Recent rulings</T>
                </View>
                {recent.map((f) => {
                  const c = CATEGORIES.find((x) => x.key === categoryOf(f));
                  return (
                    <Pressable key={`r${f.t}`} onPress={() => { haptic.selection(); setQ(f.t.split(' ').slice(0, 3).join(' ')); }} style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 11, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(48,63,143,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name={c?.icon ?? 'gavel'} size={10} color="#3F51B5" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <T v="bodyS" style={{ fontSize: 12, fontWeight: '700', lineHeight: 17 }} numberOfLines={1}>{f.t}</T>
                        <T v="caption" style={{ fontSize: 9, color: d.faint }}>{c?.label ?? 'General'}</T>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* ── CATEGORY FILTER DROPDOWN ── */}
            <T v="h3" style={{ fontSize: 13, fontWeight: '800', marginBottom: 8 }}>Browse by category</T>
            <Pressable onPress={() => { haptic.selection(); setCatOpen((o) => !o); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, borderWidth: 1, borderColor: cat ? green : d.cardBorder, backgroundColor: d.card, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FontAwesome5 name={(CATEGORIES.find((c) => c.key === cat)?.icon ?? 'layers')} size={12} color={cat ? green : d.faint} />
                <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700', color: cat ? green : d.text }}>{catLabel}</T>
              </View>
              <FontAwesome5 name={catOpen ? 'chevron-up' : 'chevron-down'} size={11} color={d.faint} />
            </Pressable>
            {catOpen ? (
              <View style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 6, marginBottom: 8 }}>
                <Pressable onPress={() => { haptic.selection(); setCat(null); setCatOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: !cat ? (isDark ? 'rgba(74,227,143,0.1)' : 'rgba(29,111,66,0.06)') : 'transparent' }}>
                  <FontAwesome5 name="layers" size={11} color={!cat ? green : d.faint} />
                  <T v="caption" style={{ fontSize: 11.5, fontWeight: '700', color: !cat ? green : d.text, flex: 1 }}>All categories</T>
                  {all ? <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{all.length}</T> : null}
                </Pressable>
                {CATEGORIES.map((c) => {
                  const on = cat === c.key;
                  const count = all ? all.filter((f) => categoryOf(f) === c.key).length : 0;
                  return (
                    <Pressable key={c.key} onPress={() => { haptic.selection(); setView('all'); setCat(on ? null : c.key); setCatOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: on ? (isDark ? 'rgba(74,227,143,0.1)' : 'rgba(29,111,66,0.06)') : 'transparent' }}>
                      <FontAwesome5 name={c.icon} size={11} color={on ? green : d.faint} />
                      <T v="caption" style={{ fontSize: 11.5, fontWeight: '700', color: on ? green : d.text, flex: 1 }}>{c.label}</T>
                      {all ? <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{count}</T> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* ── SEARCH ─ */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 10, marginBottom: 8 }}>
              <FontAwesome5 name="search" size={12} color={d.faint} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search rulings — e.g. zakah, fasting, hajj…" placeholderTextColor={d.faint} style={{ flex: 1, paddingVertical: 11, fontSize: 16, fontFamily: 'Poppins-Medium', color: d.text }} />
              {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><FontAwesome5 name="times-circle" size={13} color={d.faint} /></Pressable> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              {(['all', 'saved'] as const).map((v) => (
                <Pressable key={v} onPress={() => { haptic.selection(); setView(v); setCat(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6, marginRight: 7, borderWidth: 1, borderColor: view === v ? (isDark ? 'rgba(74,227,143,0.45)' : 'rgba(29,111,66,0.35)') : d.cardBorder, backgroundColor: view === v ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : d.card }}>
                  <FontAwesome5 name={v === 'all' ? 'balance-scale' : 'bookmark'} size={9} color={view === v ? green : d.faint} />
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: view === v ? green : d.faint }}>{v === 'all' ? 'ALL RULINGS' : `SAVED (${bmFatwa.list.length})`}</T>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{view === 'all' ? (all ? `${matched.length}${cat ? ' in category' : ''} · islamqa.info` : 'Loading…') : `${list.length} saved`}</T>
            </View>

            {/* ── RULINGS LIST ── */}
            {!all ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={green} />
                <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>Loading the rulings archive…</T>
              </View>
            ) : list.length === 0 ? (
              <T v="caption" style={{ textAlign: 'center', marginTop: 30, fontSize: 11.5 }}>{view === 'saved' ? 'No saved rulings yet — tap the bookmark on any ruling.' : `No rulings match${cat ? ' this category' : ` “${q}”`}. Try a simpler word.`}</T>
            ) : (
              list.map((f, i) => {
                const isOpen = open === i;
                const idx = all ? all.indexOf(f) : -1;
                const c = CATEGORIES.find((x) => x.key === categoryOf(f));
                return (
                  <Pressable key={`${idx}-${i}`} onPress={() => { haptic.selection(); setOpen(isOpen ? null : i); }} style={{ backgroundColor: d.card, borderWidth: 1, borderColor: isOpen ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)') : d.cardBorder, borderRadius: 15, padding: 13, marginBottom: 9 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(48,63,143,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name={c?.icon ?? 'gavel'} size={11} color="#3F51B5" />
                      </View>
                      <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '700', lineHeight: 18 }}>{f.t}</T>
                      <Pressable onPress={() => { if (idx >= 0) toggleSave(idx); }} hitSlop={8} style={{ padding: 4 }}>
                        <FontAwesome5 name="bookmark" size={13} solid={isSaved(idx)} color={isSaved(idx) ? '#E8C96A' : d.faint} />
                      </Pressable>
                      <FontAwesome5 name={isOpen ? 'chevron-up' : 'chevron-down'} size={10} color={d.faint} />
                    </View>
                    {isOpen ? (
                      <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: d.cardBorder, paddingTop: 10 }}>
                        <T v="caption" style={{ fontSize: 10, lineHeight: 16, color: d.subtext }}>{(((f.q || '').replace(f.t || '', '').trim()) || f.q || '').slice(0, 420)}</T>
                        <T v="bodyS" style={{ fontSize: 11.5, lineHeight: 18, marginTop: 8 }}>{(f.a || '').slice(0, 1400)}…</T>
                        {f.u ? (
                          <Pressable onPress={() => openUrl(f.u.startsWith('http') ? f.u : `https://islamqa.info/en/answers/${f.u}`)} style={{ alignSelf: 'flex-start', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <FontAwesome5 name="link" size={9} color="#5EA7C9" />
                            <T v="caption" style={{ fontSize: 9.5, color: '#5EA7C9' }}>source: islamqa.info</T>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
            {all && list.length < matched.length ? (
              <Pressable onPress={loadMore} style={{ alignItems: 'center', paddingVertical: 16, gap: 7 }}>
                {more ? <ActivityIndicator size="small" color={green} /> : null}
                <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>{more ? 'Loading more rulings…' : `Load more (${matched.length - list.length} remaining)`}</T>
              </Pressable>
            ) : null}
          </>
        )}


      </ScrollView>
    </View>
  );
}
