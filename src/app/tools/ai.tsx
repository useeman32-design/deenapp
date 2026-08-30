import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import {
  AiChat, AiMsg, AiSource, NAV_LABELS, PROVIDERS, SYSTEM_PROMPT, buildContext, clearChats, composeLocalAnswer,
  detectProvider, getApiKey, getModel, getWebPref, loadChats, navAnswer, retrieveLocal, saveChats, setApiKey, setModel, setWebPref, streamLLM, uid,
} from '@/lib/ai';

/**
 * DeenLink AI (pass 25 redesign):
 * · hamburger (top-left) → glassy slide-in history drawer
 * · glass bubbles; references [Quran 2:255] / [Bukhari · …] / [Dua · …] render
 *   BOLD and are tappable → jump straight to that ayah / book / dua
 * · NAV: answers add an "Open screen" button (AI = navigation map)
 * · Groq/xAI streaming, reasoning preview, source chips, web toggle
 * · clean minimal suggestions (3 prompts)
 */

const SUGGESTIONS = [
  { icon: 'book-open', color: '#1F8F5C', q: 'What is Surah Al-Fatiha about?' },
  { icon: 'hands-helping', color: '#7C5CBF', q: 'Give me a dua for guidance' },
  { icon: 'compass', color: '#2C6E8F', q: 'Where can I find the qibla compass?' },
];

const timeAgo = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

/* ── reference parsing: [Quran 2:255] · [Bukhari · Faith #8] · [Dua · …] · [web] ── */
const REF_RE = /\[(Quran\s*\d{1,3}:\d{1,3}(?:\s*[-–]\s*\d{1,3})?|[A-Za-z][^\]]*·[^\]]*|web)\]/g;
const HADITH_ROUTES: Array<[RegExp, string]> = [
  [/bukhari/i, '/tools/hadith/bukhari'], [/muslim/i, '/tools/hadith/muslim'], [/abu\s*dawud|abudawud/i, '/tools/hadith/abudawud'],
  [/nawawi/i, '/tools/hadith/nawawi40'], [/shamail/i, '/tools/hadith/shamail_muhammadiyah'], [/riyad/i, '/tools/hadith/riyad_assalihin'], [/malik/i, '/tools/hadith/malik'],
];

function refRoute(ref: string): string | null {
  const r = ref.trim();
  const q = r.match(/^Quran\s*(\d{1,3}):(\d{1,3})/i);
  if (q) return `/read/${q[1]}?ayah=${q[2]}`;
  for (const [re, route] of HADITH_ROUTES) if (re.test(r)) return route;
  if (/^dua/i.test(r)) return '/tools/dua';
  if (/athkar|adhkar/i.test(r)) return '/tools/athkar';
  if (/quiz/i.test(r)) return '/tools/quiz';
  return null;
}

const NAV_LINE = /^NAV:\s*(\/[^\s]+)\s*$/m;

/** message body with bold, tappable references */
function RichText({ text, color, onNav }: { text: string; color: string; onNav: (route: string) => void }) {
  const parts: Array<{ t: 'txt' | 'ref'; s: string }> = [];
  let last = 0;
  for (const m of text.matchAll(REF_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ t: 'txt', s: text.slice(last, i) });
    parts.push({ t: 'ref', s: m[1] });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ t: 'txt', s: text.slice(last) });
  return (
    <T v="bodyS" style={{ fontSize: 13.5, lineHeight: 20 }}>
      {parts.map((p, i) =>
        p.t === 'txt' ? (
          <T key={i} v="bodyS" style={{ fontSize: 13.5, lineHeight: 20, color }}>
            {p.s}
          </T>
        ) : (
          <T
            key={i}
            v="bodyS"
            onPress={() => { const rt = refRoute(p.s); if (rt) { haptic.selection(); onNav(rt); } }}
            style={{ fontSize: 13.5, lineHeight: 20, fontWeight: '900', color: '#E8C96A', textDecorationLine: refRoute(p.s) ? 'underline' : 'none' }}
          >
            [{p.s}]
          </T>
        ),
      )}
    </T>
  );
}

export default function DeenLinkAI() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [chats, setChats] = useState<AiChat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'retrieving' | 'thinking' | 'streaming'>('idle');
  const [apiKey, setKey] = useState('');
  const [model, setModelState] = useState<string>(PROVIDERS.groq.models[0].id);
  const [webOn, setWebOn] = useState(false);
  const [webToggle, setWebToggle] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const scroller = useRef<ScrollView>(null);
  const webRef = useRef(false);
  const drawerX = useRef(new Animated.Value(0)).current;

  const provider = detectProvider(apiKey);
  const modelList = provider ? PROVIDERS[provider].models : PROVIDERS.groq.models;

  useEffect(() => {
    loadChats().then(setChats);
    getApiKey().then((k) => { setKey(k); setKeyDraft(k); });
    getModel().then((m) => setModelState(m));
    getWebPref().then((w) => { setWebOn(w); setWebToggle(w); webRef.current = w; });
  }, []);
  useEffect(() => { webRef.current = webToggle; }, [webToggle]);
  useEffect(() => {
    if (provider && !modelList.some((m) => m.id === model)) { setModelState(modelList[0].id); setModel(modelList[0].id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);
  useEffect(() => { Animated.timing(drawerX, { toValue: drawerOpen ? 1 : 0, duration: 260, easing: Easing.out(Easing.poly(4)), useNativeDriver: false }).start(); }, [drawerOpen]);

  /* persist conversation */
  useEffect(() => {
    if (!activeId || !msgs.length) return;
    setChats((prev) => {
      const title = prev.find((c) => c.id === activeId)?.title ?? msgs[0].text.slice(0, 42);
      const next = [{ id: activeId, title, at: Date.now(), msgs }, ...prev.filter((c) => c.id !== activeId)];
      saveChats(next);
      return next;
    });
  }, [msgs, activeId]);

  const scrollDown = useCallback(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80); }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    haptic.light();
    const userMsg: AiMsg = { role: 'user', text: q, at: Date.now() };
    let chatId = activeId;
    if (!chatId) { chatId = uid(); setActiveId(chatId); }
    setMsgs((m) => [...m, userMsg]);
    setDraft('');
    setBusy(true);
    scrollDown();

    /* on-device navigation answers don't need retrieval */
    const nav = navAnswer(q);
    if (!apiKey && nav) {
      setPhase('thinking');
      await new Promise((r) => setTimeout(r, 350));
      setMsgs((m) => [...m, { role: 'assistant', text: nav.text, at: Date.now(), nav: nav.route }]);
      setBusy(false);
      setPhase('idle');
      scrollDown();
      return;
    }

    setPhase('retrieving');
    let sources: AiSource[] = [];
    try { sources = await retrieveLocal(q); } catch {}
    setMsgs((m) => [...m, { role: 'assistant', text: '', at: Date.now() }]);

    if (apiKey) {
      setPhase('thinking');
      const history = [...msgs.filter((m) => m.text), userMsg].slice(-8).map((m) => ({ role: m.role, content: m.text }) as { role: 'user' | 'assistant'; content: string });
      const sys = SYSTEM_PROMPT + (sources.length ? '\n\n' + buildContext(sources) : '') + (webRef.current ? '\n\nWeb search is enabled — verify current facts and cite [web].' : '');
      let acc = '';
      let reasoning = '';
      const thinkStart = Date.now();
      let err = '';
      await streamLLM(apiKey, model, [{ role: 'system', content: sys }, ...history], webRef.current, (e) => {
        if (e.reason && !acc) {
          reasoning += e.reason;
          setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], reasoning: reasoning.slice(-300), thinkMs: Date.now() - thinkStart }; return c; });
        }
        if (e.delta) {
          acc += e.delta;
          setPhase('streaming');
          setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: acc, streamed: true, thinkMs: Date.now() - thinkStart }; return c; });
          scrollDown();
        }
        if (e.error) err = e.error;
        if (e.citations?.length) {
          const webSrcs: AiSource[] = e.citations.map((c) => ({ kind: 'web' as const, label: shortUrl(c), excerpt: c }));
          setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], sources: [...(c[c.length - 1].sources ?? []), ...webSrcs] }; return c; });
        }
      });
      const navRoute = acc.match(NAV_LINE)?.[1];
      if (err) {
        const fallback = composeLocalAnswer(q, sources);
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: `⚠️ ${err}\n\n${fallback}` }; return c; });
      } else if (!acc.trim()) {
        const fallback = composeLocalAnswer(q, sources);
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: `⚠️ The model returned an empty response (the free tier may be rate-limited — try again in a minute).\n\n${fallback}` }; return c; });
      } else if (navRoute) {
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], nav: navRoute }; return c; });
      }
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], sources: [...(c[c.length - 1].sources ?? []), ...sources] }; return c; });
    } else {
      setPhase('thinking');
      await new Promise((r) => setTimeout(r, 500));
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: composeLocalAnswer(q, sources), sources }; return c; });
      scrollDown();
    }
    setBusy(false);
    setPhase('idle');
    scrollDown();
  };

  const newChat = () => { haptic.selection(); setActiveId(null); setMsgs([]); setDrawerOpen(false); };
  const openChat = (c: AiChat) => { haptic.selection(); setActiveId(c.id); setMsgs(c.msgs); setDrawerOpen(false); setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 120); };
  const deleteChat = (id: string) => {
    haptic.selection();
    setChats((prev) => { const next = prev.filter((c) => c.id !== id); saveChats(next); return next; });
    if (activeId === id) newChat();
  };
  const saveKey = async () => { haptic.selection(); await setApiKey(keyDraft); setKey(keyDraft.trim()); setShowSettings(false); };

  const glass = isDark ? { bg: 'rgba(18,34,25,0.72)', border: 'rgba(74,227,143,0.25)' } : { bg: 'rgba(255,255,255,0.78)', border: 'rgba(29,111,66,0.18)' };
  const cleanAI = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<tool>[\s\S]*?<\/tool>/g, '').replace(/<think>[\s\S]*$/, '').replace(/<tool>[\s\S]*$/, '');
  const researching = (t: string) => cleanAI(t).trim().length === 0 && t.trim().length > 0;

  const bubble = (m: AiMsg, i: number) => {
    const mine = m.role === 'user';
    const thinkingHere = !mine && busy && i === msgs.length - 1 && (m.text.trim() === '' || researching(m.text));
    const body = cleanAI(m.text).replace(NAV_LINE, '').trim();
    const nav = m.nav;
    return (
      <View key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%', marginBottom: 12 }}>
        {!mine ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <View style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: glass.bg, borderWidth: 1, borderColor: glass.border, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="robot" size={9} color={isDark ? '#4AE38F' : '#1D6F42'} />
            </View>
            <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: d.faint }}>DEENLINK {apiKey && provider ? `· ${PROVIDERS[provider].label}` : '· ON-DEVICE'}</T>
            {m.thinkMs != null && m.thinkMs > 800 && m.text ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <FontAwesome5 name="bolt" size={7} color="#E8C96A" />
                <T v="caption" style={{ fontSize: 8, fontWeight: '700', color: d.faint }}>{(m.thinkMs / 1000).toFixed(1)}s</T>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={{ borderRadius: 18, borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: mine ? (isDark ? '#1F8F5C' : '#1D6F42') : glass.bg, borderWidth: mine ? 0 : 1, borderColor: glass.border }}>
          {thinkingHere ? (
            <View style={{ paddingVertical: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <ThinkingDots color={researching(m.text) ? '#5EA7C9' : isDark ? '#4AE38F' : '#1D6F42'} />
                <T v="caption" style={{ fontSize: 11, color: d.faint }}>{m.reasoning ? 'Thinking…' : researching(m.text) ? 'researching the web…' : phase === 'retrieving' ? 'Searching your library…' : 'Thinking…'}</T>
              </View>
              {m.reasoning ? <T v="caption" numberOfLines={3} style={{ fontSize: 9.5, fontStyle: 'italic', color: isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)', marginTop: 6, lineHeight: 14 }}>{m.reasoning}…</T> : null}
            </View>
          ) : (
            <RichText text={body} color={mine ? '#FFFFFF' : d.text} onNav={(rt) => router.push(rt as never)} />
          )}
        </View>

        {/* NAV button — direct navigation */}
        {!mine && nav && !thinkingHere ? (
          <Pressable onPress={() => { haptic.light(); router.push(nav as never); }} style={{ marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}>
            <FontAwesome5 name="location-arrow" size={10} color="#fff" />
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#fff' }}>Open {NAV_LABELS[nav] ?? nav.replace('/tools/', '').replace('/', ' ')}</T>
          </Pressable>
        ) : null}

        {/* source chips */}
        {!mine && m.sources && m.sources.length > 0 && !thinkingHere ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {dedupeSources(m.sources).slice(0, 6).map((s, j) => (
              <Pressable key={j} onPress={() => { haptic.selection(); if (s.href) router.push(s.href as never); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: s.kind === 'web' ? 'rgba(44,110,143,0.4)' : glass.border, backgroundColor: s.kind === 'web' ? 'rgba(44,110,143,0.08)' : isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.06)' }}>
                <FontAwesome5 name={s.kind === 'quran' ? 'book-open' : s.kind === 'hadith' ? 'scroll' : s.kind === 'dua' ? 'hands-helping' : s.kind === 'name' ? 'star-and-crescent' : s.kind === 'web' ? 'globe' : 'question-circle'} size={8} color={s.kind === 'web' ? '#5EA7C9' : isDark ? '#4AE38F' : '#1D6F42'} />
                <T v="caption" style={{ fontSize: 9, fontWeight: '700', color: s.kind === 'web' ? '#5EA7C9' : isDark ? '#4AE38F' : '#1D6F42' }}>{s.label}</T>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* ── glassy header ── */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: glass.border, backgroundColor: glass.bg, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <Pressable accessibilityLabel="Chat history" onPress={() => { haptic.selection(); setDrawerOpen(true); }} style={{ width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: glass.border, backgroundColor: isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="bars" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: glass.border, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="robot" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>DeenLink AI</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: apiKey ? 'rgba(31,143,92,0.12)' : 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: apiKey ? 'rgba(31,143,92,0.4)' : 'rgba(212,175,55,0.4)' }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: apiKey ? '#1F8F5C' : '#D4AF37' }} />
              <T v="caption" style={{ fontSize: 8, fontWeight: '800', color: apiKey ? (isDark ? '#4AE38F' : '#1D6F42') : '#B8870B' }}>{apiKey ? (provider ? PROVIDERS[provider].label : 'LIVE') : 'ON-DEVICE'}</T>
            </View>
          </View>
          <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>
            {apiKey && provider ? `${modelList.find((m) => m.id === model)?.label ?? model} · library + ${webToggle ? 'web' : 'model'}` : 'Your library · tap ⟶ Settings for full AI'}
          </T>
        </View>
        <Pressable accessibilityLabel="AI settings" onPress={() => { haptic.selection(); setShowSettings(true); }} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: glass.border, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="sliders-h" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <Pressable accessibilityLabel="New chat" onPress={newChat} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="plus" size={13} color="#fff" />
        </Pressable>
      </View>

      {/* ── history drawer (left slide) ── */}
      {drawerOpen ? <Pressable style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 40 }} onPress={() => setDrawerOpen(false)} /> : null}
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 302, zIndex: 50, backgroundColor: glass.bg, borderRightWidth: 1, borderRightColor: glass.border, paddingTop: insets.top + 12, transform: [{ translateX: drawerX.interpolate({ inputRange: [0, 1], outputRange: [-312, 0] }) }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, marginBottom: 12 }}>
          <FontAwesome5 name="history" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="h3" style={{ flex: 1, fontWeight: '800', fontSize: 14.5, color: d.text }}>History</T>
          <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{chats.length}</T>
          <Pressable onPress={() => setDrawerOpen(false)} hitSlop={8} style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="times" size={11} color={d.subtext} />
          </Pressable>
        </View>
        <Pressable onPress={newChat} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 10, paddingVertical: 11, borderRadius: 13, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', justifyContent: 'center' }}>
          <FontAwesome5 name="plus" size={11} color="#fff" />
          <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: '#fff' }}>New chat</T>
        </Pressable>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          {chats.length === 0 ? (
            <T v="caption" style={{ textAlign: 'center', color: d.faint, paddingVertical: 30 }}>No conversations yet</T>
          ) : (
            chats.map((c) => (
              <Pressable key={c.id} onPress={() => openChat(c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: activeId === c.id ? 'rgba(31,143,92,0.45)' : glass.border, backgroundColor: activeId === c.id ? (isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)') : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)', paddingHorizontal: 11, paddingVertical: 10, marginBottom: 7 }}>
                <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="comment" size={10} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyS" numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: d.text }}>{c.title}</T>
                  <T v="caption" numberOfLines={1} style={{ fontSize: 9, color: d.faint, marginTop: 1 }}>{timeAgo(c.at)} · {c.msgs.length} msgs</T>
                </View>
                <Pressable hitSlop={8} onPress={() => deleteChat(c.id)} style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: 'rgba(220,80,80,0.08)', borderWidth: 1, borderColor: 'rgba(220,80,80,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="trash" size={9} color="#DC5050" />
                </Pressable>
              </Pressable>
            ))
          )}
        </ScrollView>
        {chats.length ? (
          <Pressable onPress={() => { haptic.selection(); clearChats(); setChats([]); newChat(); }} style={{ margin: 12, marginTop: 0, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(220,80,80,0.3)', backgroundColor: 'rgba(220,80,80,0.06)' }}>
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#DC5050' }}>Clear all history</T>
          </Pressable>
        ) : null}
      </Animated.View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroller} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {msgs.length === 0 ? (
            <View>
              <View style={{ alignItems: 'center', marginTop: 26, marginBottom: 24 }}>
                <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: glass.bg, borderWidth: 1, borderColor: glass.border, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="star-and-crescent" size={26} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                <T v="h1" style={{ fontSize: 21, fontWeight: '800', color: d.text, marginTop: 14 }}>Assalamu alaikum</T>
                <T v="caption" style={{ fontSize: 11.5, color: d.faint, marginTop: 4, textAlign: 'center', lineHeight: 17, maxWidth: 280 }}>
                  Ask about the Qur{'\u2019'}an, hadith & duas — or where anything lives in the app. I answer from your library{apiKey ? ' + AI reasoning' : ''}.
                </T>
              </View>
              {/* clean, minimal suggestions */}
              <View style={{ gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s.q} onPress={() => send(s.q)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: glass.border, backgroundColor: pressed ? glass.bg : isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.6)', paddingHorizontal: 14, paddingVertical: 13 }]}>
                    <View style={{ width: 32, height: 32, borderRadius: 11, backgroundColor: `${s.color}1A`, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name={s.icon as never} size={12} color={s.color} />
                    </View>
                    <T v="bodyS" style={{ flex: 1, fontSize: 13, fontWeight: '700', color: d.text }}>{s.q}</T>
                    <FontAwesome5 name="arrow-right" size={10} color={d.faint} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            msgs.map(bubble)
          )}
        </ScrollView>

        {/* ── input bar (glassy) ── */}
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: glass.border, backgroundColor: glass.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Pressable onPress={() => { haptic.selection(); setWebToggle((w) => { setWebPref(!w); return !w; }); }} accessibilityLabel="web search toggle" style={{ width: 44, height: 46, borderRadius: 16, borderWidth: 1, borderColor: webToggle ? 'rgba(44,110,143,0.55)' : glass.border, backgroundColor: webToggle ? 'rgba(44,110,143,0.12)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.65)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="globe" size={14} color={webToggle ? '#5EA7C9' : d.faint} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, borderColor: draft ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.45)') : glass.border, backgroundColor: isDark ? 'rgba(10,22,15,0.65)' : 'rgba(255,255,255,0.92)', paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask anything…"
                placeholderTextColor={d.faint}
                multiline
                style={{ flex: 1, minHeight: 46, maxHeight: 100, paddingVertical: 12, fontSize: 16, lineHeight: 21, color: d.text }}
                onSubmitEditing={() => send(draft)}
              />
              {draft ? (
                <Pressable onPress={() => setDraft('')} hitSlop={8} style={{ paddingHorizontal: 4 }}>
                  <FontAwesome5 name="times-circle" size={15} color={d.faint} />
                </Pressable>
              ) : null}
            </View>
            <Pressable accessibilityLabel="Send" onPress={() => send(draft)} disabled={!draft.trim() || busy} style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: !draft.trim() || busy ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(29,111,66,0.10)') : isDark ? '#1F8F5C' : '#1D6F42', borderWidth: 1.5, borderColor: !draft.trim() || busy ? glass.border : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {busy && phase !== 'retrieving' ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="paper-plane" size={15} color={!draft.trim() || busy ? d.faint : '#FFFFFF'} />}
            </Pressable>
          </View>
          <T v="caption" style={{ fontSize: 8.5, color: d.faint, textAlign: 'center', marginTop: 6 }}>
            {apiKey ? 'References like [Quran 2:255] are tappable · verify rulings with a scholar' : 'On-device mode · tap the sliders to add a Groq key'} · {webToggle ? 'web ON' : 'web off'}
          </T>
        </View>
      </KeyboardAvoidingView>

      {/* ── settings sheet ── */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowSettings(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ marginTop: insets.top + 60, marginHorizontal: 10, borderRadius: 20, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 16 }}>
            <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text }}>AI Settings</T>
            <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2, marginBottom: 14 }}>Your key stays on this device only — never uploaded or committed.</T>

            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>GROQ / XAI API KEY</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 12, marginBottom: 14 }}>
              <FontAwesome5 name="key" size={11} color={detectProvider(keyDraft) ? '#1F8F5C' : '#B8870B'} />
              <TextInput value={keyDraft} onChangeText={setKeyDraft} placeholder="gsk_… or xai-…" placeholderTextColor={d.faint} autoCapitalize="none" autoCorrect={false} secureTextEntry style={{ flex: 1, paddingVertical: 11, fontSize: 13, color: d.text, fontFamily: 'Poppins-Regular' }} />
              <Pressable onPress={saveKey} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}>
                <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Save</T>
              </Pressable>
            </View>
            {keyDraft && !detectProvider(keyDraft) ? (
              <T v="caption" style={{ fontSize: 9, color: '#DC5050', marginBottom: 10 }}>Unrecognized key — Groq keys start with gsk_ (console.groq.com), xAI keys with xai-.</T>
            ) : null}

            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>MODEL</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {modelList.map((m) => {
                const on = model === m.id;
                return (
                  <Pressable key={m.id} onPress={() => { haptic.selection(); setModelState(m.id); setModel(m.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, borderWidth: 1, borderColor: on ? 'rgba(31,143,92,0.5)' : d.cardBorder, backgroundColor: on ? 'rgba(31,143,92,0.1)' : d.bgSoft }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: on ? '#1F8F5C' : d.faint }} />
                    <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{m.label}{m.note ? ` · ${m.note}` : ''}</T>
                  </Pressable>
                );
              })}
            </View>

            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>DEFAULT WEB SEARCH</T>
            <Pressable onPress={() => { haptic.selection(); const nx = !webOn; setWebOn(nx); setWebPref(nx); setWebToggle(nx); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 14 }}>
              <FontAwesome5 name="globe" size={12} color={webOn ? '#5EA7C9' : d.faint} />
              <T v="bodyS" style={{ flex: 1, fontSize: 12, color: d.text }}>Let the AI search the internet for current facts</T>
              <View style={{ width: 38, height: 22, borderRadius: 11, backgroundColor: webOn ? '#2C6E8F' : d.cardBorder, padding: 2 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', marginLeft: webOn ? 16 : 0 }} />
              </View>
            </Pressable>

            <T v="caption" style={{ fontSize: 9, color: d.faint, lineHeight: 14 }}>
              Without a key, DeenLink AI answers on-device from the app library and navigates you anywhere in the app. With a Groq or xAI key, the model reasons over your library and — if enabled — live web results. Requests go straight from this device to the provider.
            </T>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** three bouncing dots — the classic "AI is thinking" signal (staggered) */
function ThinkingDots({ color }: { color: string }) {
  const vals = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const loops = vals.map((v, i) => {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ]));
      setTimeout(() => loop.start(), i * 160);
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 18 }}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: 0.45, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }} />
      ))}
    </View>
  );
}

const shortUrl = (u: string) => { try { return new URL(u).hostname.replace('www.', ''); } catch { return u.slice(0, 24); } };
const dedupeSources = (list: AiSource[]) => { const seen = new Set<string>(); return list.filter((s) => { if (seen.has(s.label)) return false; seen.add(s.label); return true; }); };
