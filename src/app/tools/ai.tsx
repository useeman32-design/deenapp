import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import {
  AiChat, AiMsg, AiSource, PROVIDERS, SYSTEM_PROMPT, buildContext, clearChats, composeLocalAnswer,
  detectProvider, getApiKey, getModel, getWebPref, loadChats, retrieveLocal, saveChats, setApiKey, setModel, setWebPref, streamLLM, uid,
} from '@/lib/ai';

/**
 * DeenLink AI (pass 24) — full chat experience:
 * · persistent chat history (view / resume / delete past conversations)
 * · real reasoning via xAI Grok when a key is set (streamed, optional web search)
 * · retrieval over our own quran/hadith/dua/names/quiz library with source chips
 * · on-device fallback mode when no key
 */

const CATEGORIES = [
  { icon: 'book-open', label: 'Quran', color: '#1F8F5C', prompts: ['What is Surah Al-Fatiha about?', 'Explain Ayat al-Kursi', 'Which surah protects from anxiety?'] },
  { icon: 'hadith', label: 'Hadith', color: '#B8870B', prompts: ['Hadith about intentions', 'What did the Prophet ﷺ say about anger?', 'Hadith on kindness to parents'] },
  { icon: 'hands', label: 'Dua', color: '#7C5CBF', prompts: ['Give me a dua for guidance', 'Dua before sleeping', 'Morning athkar list'] },
  { icon: 'compass', label: 'Guidance', color: '#2C6E8F', prompts: ['How do I build a daily deen routine?', 'Tips to memorize Quran', 'Explain zakat simply'] },
];

const timeAgo = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  return dd === 1 ? 'yesterday' : `${dd}d`;
};

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
  const [webToggle, setWebToggle] = useState(false); // per-send web search toggle state comes from pref; this is the quick pill
  const provider = detectProvider(apiKey);
  const modelList = provider ? PROVIDERS[provider].models : PROVIDERS.groq.models;
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const scroller = useRef<ScrollView>(null);
  const webRef = useRef(false);

  /* load persisted state */
  useEffect(() => {
    loadChats().then(setChats);
    getApiKey().then((k) => { setKey(k); setKeyDraft(k); });
    getModel().then((m) => setModelState(m));
    getWebPref().then((w) => { setWebOn(w); setWebToggle(w); webRef.current = w; });
  }, []);

  useEffect(() => { webRef.current = webToggle; }, [webToggle]);

  /* if the saved model doesn't belong to the active provider, snap to its first */
  useEffect(() => {
    if (provider && !modelList.some((m) => m.id === model)) {
      setModelState(modelList[0].id);
      setModel(modelList[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId]);

  /* persist the active conversation after every change */
  useEffect(() => {
    if (!activeId || !msgs.length) return;
    setChats((prev) => {
      const title = prev.find((c) => c.id === activeId)?.title ?? msgs[0].text.slice(0, 42);
      const next = [{ id: activeId, title, at: Date.now(), msgs }, ...prev.filter((c) => c.id !== activeId)];
      saveChats(next);
      return next;
    });
  }, [msgs, activeId]);

  const scrollDown = useCallback(() => {
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  /* ── the send pipeline: retrieve → (grok stream | local compose) ── */
  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    haptic.light();
    const userMsg: AiMsg = { role: 'user', text: q, at: Date.now() };
    let chatId = activeId;
    if (!chatId) {
      chatId = uid();
      setActiveId(chatId);
    }
    setMsgs((m) => [...m, userMsg]);
    setDraft('');
    setBusy(true);
    scrollDown();

    setPhase('retrieving');
    let sources: AiSource[] = [];
    try { sources = await retrieveLocal(q); } catch {}

    const assistant: AiMsg = { role: 'assistant', text: '', at: Date.now() };
    setMsgs((m) => [...m, assistant]);

    if (apiKey) {
      setPhase('thinking');
      const history = [...msgs.filter((m) => m.text), userMsg].slice(-8).map((m) => ({ role: m.role, content: m.text }) as { role: 'user' | 'assistant'; content: string });
      const sys = SYSTEM_PROMPT + (sources.length ? '\n\n' + buildContext(sources) : '') + (webRef.current ? '\n\nWeb search is enabled — verify current facts and cite [web].' : '');
      let acc = '';
      let reasoning = '';
      const thinkStart = Date.now();
      let err = '';
      await streamLLM(
        apiKey,
        model,
        [{ role: 'system', content: sys }, ...history],
        webRef.current,
        (e) => {
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
        },
      );
      if (err) {
        const fallback = composeLocalAnswer(q, sources);
        const note = `⚠️ ${err}\n\n${fallback}`;
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: note }; return c; });
      } else if (!acc.trim()) {
        /* 200-stream with zero tokens (rate-limit artifact) — answer honestly */
        const fallback = composeLocalAnswer(q, sources);
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: `⚠️ The model returned an empty response (the free tier may be rate-limited — try again in a minute).\n\n${fallback}` }; return c; });
      }
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], sources: [...(c[c.length - 1].sources ?? []), ...sources] }; return c; });
    } else {
      /* on-device mode */
      setPhase('thinking');
      await new Promise((r) => setTimeout(r, 500));
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: composeLocalAnswer(q, sources), sources }; return c; });
      scrollDown();
    }
    setBusy(false);
    setPhase('idle');
    scrollDown();
  };

  const newChat = () => {
    haptic.selection();
    setActiveId(null);
    setMsgs([]);
    setShowHistory(false);
  };

  const openChat = (c: AiChat) => {
    haptic.selection();
    setActiveId(c.id);
    setMsgs(c.msgs);
    setShowHistory(false);
    setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 100);
  };

  const deleteChat = (id: string) => {
    haptic.selection();
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveChats(next);
      return next;
    });
    if (activeId === id) newChat();
  };

  const saveKey = async () => {
    haptic.selection();
    await setApiKey(keyDraft);
    setKey(keyDraft.trim());
    setShowSettings(false);
  };

  const bubble = (m: AiMsg, i: number) => {
    const mine = m.role === 'user';
    const thinkingHere = !mine && busy && i === msgs.length - 1 && (m.text.trim() === '' || researching(m.text));
    return (
      <View key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', marginBottom: 12 }}>
        {!mine ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <View style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: isDark ? '#12291C' : '#E8F3EC', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="robot" size={9} color={isDark ? '#4AE38F' : '#1D6F42'} />
            </View>
            <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: d.faint }}>DEENLINK {apiKey && provider ? `· ${PROVIDERS[provider].label}` : '· ON-DEVICE'}</T>
            {m.streamed ? <FontAwesome5 name="bolt" size={8} color="#E8C96A" /> : null}
          </View>
        ) : null}
        <View
          style={{
            borderRadius: 18,
            borderBottomRightRadius: mine ? 6 : 18,
            borderBottomLeftRadius: mine ? 18 : 6,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: mine ? (isDark ? '#1F8F5C' : '#1D6F42') : d.card,
            borderWidth: mine ? 0 : 1,
            borderColor: d.cardBorder,
          }}
        >
          {thinkingHere ? (
            <View style={{ paddingVertical: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
                <T v="caption" style={{ fontSize: 11, color: d.faint }}>
                  {phase === 'retrieving' ? 'Searching your library…' : m.reasoning ? 'Thinking…' : 'Thinking…'}
                </T>
              </View>
              {m.reasoning ? (
                <T v="caption" numberOfLines={3} style={{ fontSize: 9.5, fontStyle: 'italic', color: isDark ? 'rgba(242,247,243,0.35)' : 'rgba(20,36,28,0.35)', marginTop: 6, lineHeight: 14 }}>
                  {m.reasoning}…
                </T>
              ) : null}
            </View>
          ) : researching(m.text) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
              <ActivityIndicator size="small" color="#5EA7C9" />
              <T v="caption" style={{ fontSize: 11, color: '#5EA7C9' }}>🔎 researching the web…</T>
            </View>
          ) : (
            <T v="bodyS" style={{ fontSize: 13.5, lineHeight: 20, color: mine ? '#FFFFFF' : d.text }}>
              {cleanAI(m.text)}
              {m.streamed && busy && i === msgs.length - 1 ? <ActivityIndicator size="small" /> : null}
            </T>
          )}
        </View>
        {!mine && m.thinkMs != null && m.text && !thinkingHere && m.thinkMs > 800 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
            <FontAwesome5 name="bolt" size={8} color="#E8C96A" />
            <T v="caption" style={{ fontSize: 8.5, fontWeight: '700', color: d.faint }}>reasoned {(m.thinkMs / 1000).toFixed(1)}s</T>
          </View>
        ) : null}
        {/* source chips */}
        {!mine && m.sources && m.sources.length > 0 && !thinkingHere ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {dedupeSources(m.sources).slice(0, 6).map((s, j) => (
              <Pressable
                key={j}
                onPress={() => { haptic.selection(); if (s.href) router.push(s.href as never); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: s.kind === 'web' ? 'rgba(44,110,143,0.4)' : isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.25)', backgroundColor: s.kind === 'web' ? 'rgba(44,110,143,0.08)' : isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.06)' }}
              >
                <FontAwesome5 name={s.kind === 'quran' ? 'book-open' : s.kind === 'hadith' ? 'scroll' : s.kind === 'dua' ? 'hands' : s.kind === 'name' ? 'star-and-crescent' : s.kind === 'web' ? 'globe' : 'question-circle'} size={8} color={s.kind === 'web' ? '#5EA7C9' : isDark ? '#4AE38F' : '#1D6F42'} />
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
      {/* ── header ── */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: d.cardBorder, backgroundColor: d.card, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: isDark ? '#12291C' : '#E8F3EC', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="robot" size={15} color={isDark ? '#4AE38F' : '#1D6F42'} />
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
            {apiKey && provider ? `${modelList.find((m) => m.id === model)?.label ?? model} · your library + ${webToggle ? 'web' : 'model'}` : 'Answers from your library · add a Groq/Grok key for full AI'}
          </T>
        </View>
        <Pressable accessibilityLabel="Chat history" onPress={() => { haptic.selection(); setShowHistory(true); }} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="clock-rotate-left" size={13} color={d.subtext} />
        </Pressable>
        <Pressable accessibilityLabel="AI settings" onPress={() => { haptic.selection(); setShowSettings(true); }} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="sliders-h" size={13} color={d.subtext} />
        </Pressable>
        <Pressable accessibilityLabel="New chat" onPress={newChat} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="plus" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroller} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {msgs.length === 0 ? (
            /* ── empty state hero ── */
            <View>
              <View style={{ alignItems: 'center', marginTop: 18, marginBottom: 22 }}>
                <View style={{ width: 74, height: 74, borderRadius: 24, backgroundColor: isDark ? '#12291C' : '#E8F3EC', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="star-and-crescent" size={28} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
                <T v="h1" style={{ fontSize: 22, fontWeight: '800', color: d.text, marginTop: 14 }}>Assalamu alaikum</T>
                <T v="caption" style={{ fontSize: 11.5, color: d.faint, marginTop: 4, textAlign: 'center', lineHeight: 17 }}>
                  Ask anything about the Qur{'\u2019'}an, hadith, duas{'\u2014'} or life. I answer from your verified library{apiKey ? ` + ${provider ? PROVIDERS[provider].label : 'AI'} reasoning` : ''}.
                </T>
              </View>
              {CATEGORIES.map((c) => (
                <View key={c.label} style={{ marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: c.color + '1E', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name={c.icon as never} size={10} color={c.color} />
                    </View>
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4, color: d.subtext }}>{c.label.toUpperCase()}</T>
                  </View>
                  {c.prompts.map((p) => (
                    <Pressable key={p} onPress={() => send(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 11, marginBottom: 4, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder }}>
                      <FontAwesome5 name="comment-dots" size={10} color={c.color} />
                      <T v="bodyS" style={{ flex: 1, fontSize: 12.5, color: d.text }}>{p}</T>
                      <FontAwesome5 name="arrow-right" size={9} color={d.faint} />
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            msgs.map(bubble)
          )}
        </ScrollView>

        {/* ── input bar ── */}
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: d.cardBorder, backgroundColor: d.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => { haptic.selection(); setWebToggle((w) => { setWebPref(!w); return !w; }); }}
              accessibilityLabel="web search toggle"
              style={{ width: 38, height: 38, borderRadius: 13, borderWidth: 1, borderColor: webToggle ? 'rgba(44,110,143,0.5)' : d.cardBorder, backgroundColor: webToggle ? 'rgba(44,110,143,0.1)' : d.bgSoft, alignItems: 'center', justifyContent: 'center' }}
            >
              <FontAwesome5 name="globe" size={13} color={webToggle ? '#5EA7C9' : d.faint} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 13 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask about quran, hadith, dua…"
                placeholderTextColor={d.faint}
                multiline
                style={{ flex: 1, minHeight: 40, maxHeight: 96, paddingVertical: 9, fontSize: 13.5, color: d.text, fontFamily: 'Poppins-Regular' }}
                onSubmitEditing={() => send(draft)}
              />
            </View>
            <Pressable
              accessibilityLabel="Send"
              onPress={() => send(draft)}
              disabled={!draft.trim() || busy}
              style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: !draft.trim() || busy ? d.bgSoft : isDark ? '#1F8F5C' : '#1D6F42', borderWidth: 1, borderColor: !draft.trim() || busy ? d.cardBorder : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              {busy && phase !== 'retrieving' ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="paper-plane" size={13} color={!draft.trim() || busy ? d.faint : '#FFFFFF'} />}
            </Pressable>
          </View>
          <T v="caption" style={{ fontSize: 8.5, color: d.faint, textAlign: 'center', marginTop: 6 }}>
            {apiKey ? 'Verify important rulings with a qualified scholar' : 'On-device mode — tap the sliders to add a Groq API key'} · {webToggle ? 'web search ON' : 'web search off'}
          </T>
        </View>
      </KeyboardAvoidingView>

      {/* ── history sheet ── */}
      <Modal visible={showHistory} animationType="slide" transparent onRequestClose={() => setShowHistory(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowHistory(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ marginTop: insets.top + 40, marginHorizontal: 10, borderRadius: 20, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, maxHeight: 640, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: d.cardBorder }}>
              <FontAwesome5 name="clock-rotate-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="h3" style={{ flex: 1, fontWeight: '800', fontSize: 14, color: d.text }}>Chat history</T>
              <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{chats.length} saved</T>
            </View>
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 10 }}>
              {chats.length === 0 ? (
                <T v="caption" style={{ textAlign: 'center', color: d.faint, paddingVertical: 34 }}>No conversations yet — ask your first question</T>
              ) : (
                chats.map((c) => (
                  <Pressable key={c.id} onPress={() => openChat(c)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: activeId === c.id ? 'rgba(31,143,92,0.45)' : d.cardBorder, backgroundColor: activeId === c.id ? (isDark ? 'rgba(46,204,113,0.08)' : 'rgba(29,111,66,0.05)') : d.bgSoft, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 7, opacity: pressed ? 0.7 : 1 }]}>
                    <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="comment" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="bodyS" numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: d.text }}>{c.title}</T>
                      <T v="caption" numberOfLines={1} style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>
                        {timeAgo(c.at)} · {c.msgs.length} messages · {c.msgs[c.msgs.length - 1]?.text.slice(0, 40) ?? ''}
                      </T>
                    </View>
                    <Pressable hitSlop={8} onPress={() => deleteChat(c.id)} style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(220,80,80,0.08)', borderWidth: 1, borderColor: 'rgba(220,80,80,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name="trash" size={10} color="#DC5050" />
                    </Pressable>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
              <Pressable onPress={newChat} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}>
                <FontAwesome5 name="plus" size={11} color="#fff" />
                <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>New chat</T>
              </Pressable>
              {chats.length ? (
                <Pressable
                  onPress={() => { haptic.selection(); clearChats(); setChats([]); newChat(); }}
                  style={{ paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(220,80,80,0.3)', backgroundColor: 'rgba(220,80,80,0.06)' }}
                >
                  <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: '#DC5050' }}>Clear all</T>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── settings sheet ── */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowSettings(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ marginTop: insets.top + 60, marginHorizontal: 10, borderRadius: 20, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 16 }}>
            <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text }}>AI Settings</T>
            <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2, marginBottom: 14 }}>Your key stays on this device only — never uploaded or committed.</T>

            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>GROQ / XAI API KEY</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, paddingHorizontal: 12, marginBottom: 14 }}>
              <FontAwesome5 name="key" size={11} color={detectProvider(keyDraft) ? '#1F8F5C' : '#B8870B'} />
              <TextInput value={keyDraft} onChangeText={setKeyDraft} placeholder="xai-…" placeholderTextColor={d.faint} autoCapitalize="none" autoCorrect={false} secureTextEntry style={{ flex: 1, paddingVertical: 11, fontSize: 13, color: d.text, fontFamily: 'Poppins-Regular' }} />
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
              Without a key, DeenLink AI answers on-device from the app library (quran, hadith, dua, 99 names, quizzes). With a Groq or xAI key, the model reasons over your library and — if enabled — live web results. Requests go straight from this device to the provider; nothing passes through our servers. Web search uses Groq’s compound model when available and falls back to the selected model otherwise.
            </T>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const shortUrl = (u: string) => { try { return new URL(u).hostname.replace('www.', ''); } catch { return u.slice(0, 24); } };
/** hide compound's agentic <think>/<tool> blocks (incl. an open trailing one) */
const cleanAI = (t: string) =>
  t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<tool>[\s\S]*?<\/tool>/g, '').replace(/<think>[\s\S]*$/, '').replace(/<tool>[\s\S]*$/, '');
const researching = (t: string) => cleanAI(t).trim().length === 0 && t.trim().length > 0;
const dedupeSources = (list: AiSource[]) => { const seen = new Set<string>(); return list.filter((s) => { const k = s.label; if (seen.has(k)) return false; seen.add(k); return true; }); };
