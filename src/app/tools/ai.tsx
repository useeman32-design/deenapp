import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { loadSurah } from '@/lib/content';
import { netBus } from '@/lib/net';
import { QURAN } from '@/data/quran';
import { stopBubble } from '@/lib/press';
import { mentionedSources, 
 AiChat, AiMsg, AiSource, NAV_LABELS, PROVIDERS, SYSTEM_PROMPT, buildContext, clearChats, composeLocalAnswer, greetingAnswer, isGreeting,
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
/* pass 29: the model sometimes writes bare "Quran 2:255" (no brackets) — link those too */
const BARE_REF_RE = /(?<!\[)(?:Quran|Qur'an|Surah)\s(\d{1,3}):(\d{1,3})(?!\])/g;
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
/* card mirrors — VerseCards sits outside the component tree */
let isDarkStatic = false;
let textColStatic = '#14241C';
let subColStatic = 'rgba(20,36,28,0.62)';

/** inline formatter — **bold**, _italic_, and tappable [refs]; leftover
 * markdown symbols are consumed, never shown raw */
function inlineFormat(text: string, color: string, onNav: (r: string) => void, key = 'x') {
  const out: React.ReactNode[] = [];
  /* 1. split out [refs] first */
  const chunks: Array<{ t: 'txt' | 'ref'; s: string }> = [];
  let last = 0;
  for (const m of text.matchAll(REF_RE)) {
    const i = m.index ?? 0;
    if (i > last) chunks.push({ t: 'txt', s: text.slice(last, i) });
    chunks.push({ t: 'ref', s: m[1] });
    last = i + m[0].length;
  }
  if (last < text.length) chunks.push({ t: 'txt', s: text.slice(last) });

  chunks.forEach((c, ci) => {
    if (c.t === 'ref') {
      out.push(
        <T
          key={`${key}-${ci}`}
          v="bodyS"
          onPress={() => { const rt = refRoute(c.s); if (rt) { haptic.selection(); onNav(rt); } }}
          style={{ fontSize: 13.5, lineHeight: 20, fontWeight: '900', color: '#E8C96A', textDecorationLine: refRoute(c.s) ? 'underline' : 'none' }}
        >
          [{c.s}]
        </T>
      );
      return;
    }
    /* pass 29: bare "Quran 2:255" mentions inside plain text → tappable */
    let tk = 0;
    let bodyTxt = c.s;
    const bareRefs: Array<{ i: number; len: number; ref: string }> = [];
    for (const m of bodyTxt.matchAll(BARE_REF_RE)) {
      const i = m.index ?? 0;
      bareRefs.push({ i, len: m[0].length, ref: `Quran ${m[1]}:${m[2]}` });
    }
    if (bareRefs.length) {
      let lastIx = 0;
      for (const br of bareRefs) {
        if (br.i > lastIx) out.push(bodyTxt.slice(lastIx, br.i).replace(/\*{1,2}/g, ''));
        out.push(
          <T
            key={`${key}-${ci}-r${tk++}`}
            v="bodyS"
            onPress={() => { haptic.selection(); onNav(`/read/${br.ref.split(' ')[1].split(':')[0]}?ayah=${br.ref.split(':')[1]}`); }}
            style={{ fontSize: 13.5, lineHeight: 20, fontWeight: '900', color: '#E8C96A', textDecorationLine: 'underline' }}
          >
            {bodyTxt.slice(br.i, br.i + br.len)}
          </T>
        );
        lastIx = br.i + br.len;
      }
      if (lastIx < bodyTxt.length) out.push(bodyTxt.slice(lastIx).replace(/\*{1,2}/g, ''));
      return;
    }
    /* 2. within plain text: **bold** then _italic_ */
    const boldParts = c.s.split(/\*\*([^*]+)\*\*/g);
    boldParts.forEach((bp, bi) => {
      const isBold = bi % 2 === 1;
      if (isBold) {
        out.push(
          <T key={`${key}-${ci}-${tk++}`} v="bodyS" style={{ fontFamily: 'Manrope', fontSize: 13.5, lineHeight: 21, color, fontWeight: '800' }}>
            {bp}
          </T>
        );
        return;
      }
      const itParts = bp.split(/(?:^|\W)_([^_]+)_(?:$|\W)/g);
      itParts.forEach((ip, ii) => {
        if (ii % 2 === 1) {
          out.push(ip);
        } else if (ip) {
          out.push(ip.replace(/\*{1,2}/g, ''));
        }
      });
    });
  });
  return out;
}

type Block =
  | { k: 'h'; s: string }
  | { k: 'p'; s: string }
  | { k: 'b'; marker: string; s: string }
  | { k: 'space' };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { blocks.push({ k: 'space' }); continue; }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) { blocks.push({ k: 'h', s: h[1].replace(/[ *#]+$/, '') }); continue; }
    const b = line.match(/^\s*[-*•]\s+(.*)$/);
    if (b) { blocks.push({ k: 'b', marker: '•', s: b[1] }); continue; }
    const n = line.match(/^\s*(\d{1,2})[.)]\s+(.*)$/);
    if (n) { blocks.push({ k: 'b', marker: `${n[1]}.`, s: n[2] }); continue; }
    blocks.push({ k: 'p', s: line });
  }
  return blocks;
}

/** assistant answer renderer — headings as bold colored titles, bullets, bold
 * text and tappable refs. No raw markdown symbols ever reach the screen. */
function AnswerText({ text, color, accent, onNav }: { text: string; color: string; accent: string; onNav: (r: string) => void }) {
  const blocks = parseBlocks(text);
  return (
    <View>
      {blocks.map((bl, i) => {
        if (bl.k === 'space') return <View key={i} style={{ height: 7 }} />;
        if (bl.k === 'h') {
          return (
            <T key={i} v="bodyS" style={{ fontFamily: 'Sora', fontSize: 14, lineHeight: 20, fontWeight: '800', color: accent, letterSpacing: 0.3, marginTop: i === 0 ? 0 : 10, marginBottom: 3 }}>
              {inlineFormat(bl.s, accent, onNav, `h${i}`)}
            </T>
          );
        }
        if (bl.k === 'b') {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 7, marginTop: 3 }}>
              <T v="bodyS" style={{ fontSize: 13.5, lineHeight: 20, fontWeight: '900', color: '#E8C96A' }}>{bl.marker}</T>
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontFamily: 'Manrope', fontSize: 13.5, lineHeight: 21, color }}>
                  {inlineFormat(bl.s, color, onNav, `b${i}`)}
                </T>
              </View>
            </View>
          );
        }
        return (
          <T key={i} v="bodyS" style={{ fontFamily: 'Manrope', fontSize: 13.5, lineHeight: 21, marginTop: i === 0 ? 0 : 3, color }}>
            {inlineFormat(bl.s, color, onNav, `p${i}`)}
          </T>
        );
      })}
    </View>
  );
}

/** ayah / hadith display cards — Arabic + translation pulled from OUR dataset */
function VerseCards({ text, onOpen }: { text: string; onOpen: (r: string) => void }) {
  const [cards, setCards] = useState<Array<{ surah: number; ayah: number; arabic: string; english: string; name: string }>>([]);
  useEffect(() => {
    let alive = true;
    const seen = new Set<string>();
    const refs: Array<{ surah: number; ayah: number }> = [];
    for (const m of cleanAIStatic(text).matchAll(/\[Quran\s*(\d{1,3}):(\d{1,3})/g)) {
      const key = `${m[1]}:${m[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({ surah: Number(m[1]), ayah: Number(m[2]) });
      if (refs.length >= 3) break;
    }
    if (!refs.length) { setCards([]); return; }
    (async () => {
      const out: Array<{ surah: number; ayah: number; arabic: string; english: string; name: string }> = [];
      for (const r of refs) {
        try {
          const sc = await loadSurah(r.surah);
          const v = sc.verses[r.ayah - 1];
          if (v) out.push({ surah: r.surah, ayah: r.ayah, arabic: v.arabic, english: v.english, name: QURAN.find((q) => q.number === r.surah)?.english ?? `Surah ${r.surah}` });
        } catch {}
      }
      if (alive) setCards(out);
    })();
    return () => { alive = false; };
  }, [text]);
  if (!cards.length) return null;
  return (
    <View>
      {cards.map((c, i) => (
        <Pressable
          key={i}
          onPress={() => { haptic.selection(); onOpen(`/read/${c.surah}?ayah=${c.ayah}`); }}
          style={{ marginTop: 9, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(29,111,66,0.28)', backgroundColor: isDarkStatic ? 'rgba(46,204,113,0.07)' : 'rgba(29,111,66,0.05)', paddingTop: 9, paddingBottom: 8, paddingHorizontal: 11 }}
        >
          <T v="bodyS" style={{ fontFamily: 'Amiri', fontSize: 20, lineHeight: 34, color: textColStatic, textAlign: 'right', writingDirection: 'rtl' }}>{c.arabic}</T>
          <T v="bodyS" numberOfLines={4} style={{ fontFamily: 'Poppins-Regular', fontSize: 11, lineHeight: 16, color: subColStatic, marginTop: 5, fontStyle: 'italic' }}>{c.english}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <FontAwesome5 name="book-open" size={8} color="#B8870B" />
            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: '#B8870B' }}>{c.name} {c.surah}:{c.ayah} · tap to open</T>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const cleanAIStatic = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<tool>[\s\S]*?<\/tool>/g, '');

/** like / dislike / copy — user feedback on every AI answer */
function FeedbackRow({ text, msgKey }: { text: string; msgKey: number }) {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  const chip = (icon: string, label: string, active: boolean, tint: string, onOn: () => void) => (
    <Pressable
      onPress={() => { haptic.selection(); onOn(); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: active ? `${tint}66` : 'rgba(140,150,145,0.25)', backgroundColor: active ? `${tint}14` : 'transparent' }}
    >
      <FontAwesome5 name={icon} size={9} color={active ? tint : 'rgba(140,150,145,0.7)'} solid={icon !== 'copy'} />
      <T v="caption" style={{ fontSize: 9.5, fontWeight: '700', color: active ? tint : 'rgba(140,150,145,0.8)' }}>{label}</T>
    </Pressable>
  );
  void msgKey;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 }}>
      {chip('thumbs-up', 'Helpful', vote === 'up', '#1F8F5C', () => setVote((v) => (v === 'up' ? null : 'up')))}
      {chip('thumbs-down', 'Not helpful', vote === 'down', '#C0392B', () => setVote((v) => (v === 'down' ? null : 'down')))}
      {chip('copy', copied ? 'Copied!' : 'Copy', copied, '#2C6E8F', () => {
        /* pass 34f: navigator.clipboard is web-only — native uses the Share sheet */
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
        } else {
          Share.share({ message: text }).catch(() => {});
        }
      })}
    </View>
  );
}

export default function DeenLinkAI() {
  const { theme, isDark } = useTheme();
  isDarkStatic = isDark;
  textColStatic = theme.text;
  subColStatic = theme.subtext;
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [chats, setChats] = useState<AiChat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const busy = activeId != null && busyIds.includes(activeId);
  const [phase, setPhase] = useState<'idle' | 'retrieving' | 'thinking' | 'streaming'>('idle');
  /* pass 32: chats stream INDEPENDENTLY — leave chat A mid-answer, keep using
   * chat B; A keeps streaming into its own stored thread. Every write goes
   * through patchChat so a stream can never bleed across chats. */
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const aborts = useRef<Map<string, AbortController>>(new Map());
  const patchChat = useCallback((chatId: string, fn: (m: AiMsg[]) => AiMsg[]) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === chatId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], msgs: fn(next[idx].msgs), at: Date.now() };
      saveChats(next);
      return next;
    });
    if (activeIdRef.current === chatId) setMsgs((m) => fn(m));
  }, []);

  /* pass 33: the pass-28 corpus prewarm was REMOVED — it fetched the whole
   * Quran + 3 hadith books + fatwas (~60MB) on every screen open, which made
   * "hello" take minutes on mobile. Retrieval now loads ONLY when a question
   * has real keywords; greetings answer instantly (see isGreeting). */
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

  /* (persistence is chat-scoped in patchChat — the old effect re-saved the
   * OPEN chat on every stream delta of any other chat, corrupting threads) */

  const scrollDown = useCallback(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80); }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    let chatId = activeId;
    if (chatId && busyIds.includes(chatId)) return; /* only THIS chat blocks */
    haptic.light();
    const userMsg: AiMsg = { role: 'user', text: q, at: Date.now() };
    if (!chatId) { chatId = uid(); setActiveId(chatId); activeIdRef.current = chatId; }
    /* register the thread immediately so patchChat can stream into it even if
     * the user hops to another chat mid-answer */
    setChats((prev) => (prev.some((c) => c.id === chatId) ? prev : [{ id: chatId, title: q.slice(0, 42), at: Date.now(), msgs: [] }, ...prev]));
    if (activeIdRef.current === chatId) setMsgs((m) => [...m, userMsg]);
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === chatId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], msgs: [...next[idx].msgs, userMsg], at: Date.now() };
      return next;
    });
    setDraft('');
    setBusyIds((b) => [...b, chatId]);
    scrollDown();

    /* on-device navigation answers don't need retrieval */
    const nav = navAnswer(q);
    if (!apiKey && nav) {
      setPhase('thinking');
      await new Promise((r) => setTimeout(r, 350));
      patchChat(chatId, (m) => [...m, { role: 'assistant', text: nav.text, at: Date.now(), nav: nav.route }]);
      setBusyIds((b) => b.filter((x) => x !== chatId));
      setPhase('idle');
      scrollDown();
      return;
    }

    /* pass 33: greetings never touch the corpora — instant reply */
    if (!apiKey && isGreeting(q)) {
      patchChat(chatId, (m) => [...m, { role: 'assistant', text: greetingAnswer(q), at: Date.now() }]);
      setPhase('idle');
      scrollDown();
      setBusyIds((b) => b.filter((x) => x !== chatId));
      return;
    }

    setPhase('retrieving');
    let sources: AiSource[] = [];
    try { sources = await retrieveLocal(q); } catch {}
    patchChat(chatId, (m) => [...m, { role: 'assistant', text: '', at: Date.now() }]);

    if (apiKey) {
      setPhase('thinking');
      const history = [...msgs.filter((m) => m.text), userMsg].slice(-8).map((m) => ({ role: m.role, content: m.text }) as { role: 'user' | 'assistant'; content: string });
      const sys = SYSTEM_PROMPT + (sources.length ? '\n\n' + buildContext(sources) : '') + (webRef.current ? '\n\nWeb search is enabled — verify current facts and cite [web].' : '');
      let acc = '';
      let reasoning = '';
      const thinkStart = Date.now();
      let err = '';
      const ac = new AbortController();
      aborts.current.set(chatId, ac);
      const netTimer = setTimeout(() => netBus.slow(true), 4000);
      const netDone = () => { clearTimeout(netTimer); netBus.slow(false); };
      await streamLLM(apiKey, model, [{ role: 'system', content: sys }, ...history], webRef.current, (e) => {
        if (e.reason && !acc) {
          reasoning += e.reason;
          patchChat(chatId, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], reasoning: reasoning.slice(-300), thinkMs: Date.now() - thinkStart }; return c; });
        }
        if (e.delta) {
          acc += e.delta;
          if (activeIdRef.current === chatId) setPhase('streaming');
          patchChat(chatId, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: acc, streamed: true, thinkMs: Date.now() - thinkStart }; return c; });
          if (activeIdRef.current === chatId) scrollDown();
        }
        if (e.error) err = e.error;
        if (e.citations?.length) {
          const webSrcs: AiSource[] = e.citations.map((c) => ({ kind: 'web' as const, label: shortUrl(c), excerpt: c }));
          patchChat(chatId, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], sources: [...(c[c.length - 1].sources ?? []), ...webSrcs] }; return c; });
        }
      }, ac.signal);
      netDone();
      aborts.current.delete(chatId);
      const navRoute = acc.match(NAV_LINE)?.[1];
      if (err) {
        const fallback = composeLocalAnswer(q, sources);
        patchChat(chatId, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: `⚠️ ${err}\n\n${fallback}` }; return c; });
      } else if (!acc.trim()) {
        const fallback = composeLocalAnswer(q, sources);
        patchChat(chatId, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: `⚠️ The model returned an empty response (the free tier may be rate-limited — try again in a minute).\n\n${fallback}` }; return c; });
      } else if (navRoute) {
        patchChat(chatId, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], nav: navRoute }; return c; });
      }
      /* pass 32: only the sources the answer ACTUALLY cites become chips */
      const cited = acc.trim() ? mentionedSources(sources, acc) : sources;
      patchChat(chatId, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], sources: [...(c[c.length - 1].sources ?? []), ...cited] }; return c; });
    } else {
      setPhase('thinking');
      await new Promise((r) => setTimeout(r, 500));
      patchChat(chatId, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: composeLocalAnswer(q, sources), sources }; return c; });
      scrollDown();
    }
    setBusyIds((b) => b.filter((x) => x !== chatId));
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
            <T v="caption" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: d.faint }}>DEENLINK {apiKey && provider ? `· ${modelList.find((m) => m.id === model)?.note ?? 'deep reasoning'}` : '· ON-DEVICE'}</T>
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
            <>
              <AnswerText text={body} color={mine ? '#FFFFFF' : d.text} accent={isDark ? '#4AE38F' : '#1D6F42'} onNav={(rt) => router.push(rt as never)} />
              {!mine ? <VerseCards text={body} onOpen={(rt) => router.push(rt as never)} /> : null}
            </>
          )}
        </View>

        {/* NAV button — direct navigation */}
        {!mine && nav && !thinkingHere ? (
          <Pressable onPress={() => { haptic.light(); router.push(nav as never); }} style={{ marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}>
            <FontAwesome5 name="location-arrow" size={10} color="#fff" />
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#fff' }}>Open {NAV_LABELS[nav] ?? nav.replace('/tools/', '').replace('/', ' ')}</T>
          </Pressable>
        ) : null}

        {/* pass 29: feedback row — like / dislike / copy on every answer */}
        {!mine && !thinkingHere && m.text.trim() ? (
          <FeedbackRow text={body} msgKey={m.at ?? 0} />
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
        {/* pass 38 — back button (was missing) */}
        <Pressable accessibilityLabel="Go back" onPress={() => { haptic.selection(); if (router.canGoBack()) router.back(); }} style={{ width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: glass.border, backgroundColor: isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <Pressable accessibilityLabel="Chat history" onPress={() => { haptic.selection(); setDrawerOpen(true); }} style={{ width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: glass.border, backgroundColor: isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="bars" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: glass.border, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="robot" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </View>
        <View style={{ flex: 1 }}>
          {/* pass 41 — provider/status pill + header settings button REMOVED (user request); settings now live at the bottom of the history drawer; capability label instead of model name */}
          <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>DeenLink AI</T>
          <T v="caption" numberOfLines={1} style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>
            {apiKey && provider
              ? `${modelList.find((m) => m.id === model)?.note ?? 'deep reasoning'} · library + ${webToggle ? 'web' : 'model'}`
              : 'Your library · History ⟶ Settings for full AI'}
          </T>
        </View>
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

        {/* pass 41 — settings at the BOTTOM of the history drawer, gear icon (user request) */}
        <View style={{ borderTopWidth: 1, borderTopColor: glass.border, paddingTop: 10, paddingHorizontal: 12, paddingBottom: insets.bottom + 12 }}>
          <Pressable
            accessibilityLabel="AI settings"
            onPress={() => { haptic.selection(); setDrawerOpen(false); setShowSettings(true); }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: glass.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)', paddingHorizontal: 12, paddingVertical: 11, opacity: pressed ? 0.8 : 1 })}
          >
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="cog" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: d.text }}>Settings</T>
              <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 1 }}>{apiKey ? `${modelList.find((m) => m.id === model)?.note ?? 'deep reasoning'} · web ${webOn ? 'on' : 'off'}` : 'Add an API key for full AI'}</T>
            </View>
            <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
          </Pressable>
        </View>
      </Animated.View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroller} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {msgs.length === 0 ? (
            <View>
              <View style={{ alignItems: 'center', marginTop: 26, marginBottom: 24 }}>
                <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: glass.bg, borderWidth: 1, borderColor: glass.border, alignItems: 'center', justifyContent: 'center' }}>
                  {/* pass 41 — the real DeenLink logo (crescent is the LOADER only, never the logo) */}
                  <ExpoImage source={require('../../../assets/img/logo-badge.png')} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" />
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
                style={{ flex: 1, minHeight: 38, maxHeight: 84, paddingVertical: 8, fontSize: 15, lineHeight: 20, color: d.text }}
                onSubmitEditing={() => send(draft)}
              />
              {draft ? (
                <Pressable onPress={() => setDraft('')} hitSlop={8} style={{ paddingHorizontal: 4 }}>
                  <FontAwesome5 name="times-circle" size={15} color={d.faint} />
                </Pressable>
              ) : null}
            </View>
            {/* busy → the button becomes a loader; tapping it STOPS the stream */}
            <Pressable
              accessibilityLabel={busy ? 'stop generating' : 'Send'}
              onPress={() => { if (busy) { haptic.light(); activeId != null && aborts.current.get(activeId)?.abort(); } else send(draft); }}
              disabled={!busy && !draft.trim()}
              style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: busy ? 'rgba(220,80,80,0.16)' : !draft.trim() ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(29,111,66,0.10)') : isDark ? '#1F8F5C' : '#1D6F42', borderWidth: 1.5, borderColor: busy ? 'rgba(220,80,80,0.5)' : !draft.trim() ? glass.border : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              {busy ? <ActivityIndicator size="small" color="#DC5050" /> : <FontAwesome5 name="paper-plane" size={15} color={!draft.trim() ? d.faint : '#FFFFFF'} />}
            </Pressable>
          </View>
          <T v="caption" style={{ fontSize: 8.5, color: d.faint, textAlign: 'center', marginTop: 6 }}>
            {apiKey ? 'References like [Quran 2:255] are tappable · verify rulings with a scholar' : 'On-device mode · open History ⟶ Settings to add an API key'} · {webToggle ? 'web ON' : 'web off'}
          </T>
        </View>
      </KeyboardAvoidingView>

      {/* ── settings sheet ── */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowSettings(false)}>
          <Pressable onPress={(e) => stopBubble(e)} style={{ marginTop: insets.top + 60, marginHorizontal: 10, borderRadius: 20, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, padding: 16 }}>
            <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text }}>AI Settings</T>
            <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 2, marginBottom: 14 }}>Your key stays on this device only — never uploaded or committed.</T>

            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>API KEY</T>
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

            <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: d.faint, marginBottom: 6 }}>AI CAPABILITY</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {modelList.map((m) => {
                const on = model === m.id;
                return (
                  <Pressable key={m.id} onPress={() => { haptic.selection(); setModelState(m.id); setModel(m.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, borderWidth: 1, borderColor: on ? 'rgba(31,143,92,0.5)' : d.cardBorder, backgroundColor: on ? 'rgba(31,143,92,0.1)' : d.bgSoft }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: on ? '#1F8F5C' : d.faint }} />
                    <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{m.note ?? m.label}</T>
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
