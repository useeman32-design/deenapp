/**
 * DeenLink AI engine (pass 24, updated for Groq).
 * · Chat history persisted locally (dl.ai.chats.v2) — full conversations.
 * · Retrieval over OUR OWN datasets: quran corpus, hadith books, duas/athkar,
 *   99 names, quizzes → cited context.
 * · Real reasoning via Groq (gsk_… keys — gpt-oss models stream their
 *   chain-of-thought in delta.reasoning, which we surface as "thinking")
 *   or xAI Grok (xai-… keys, server-side web search). Key stored on-device
 *   only, never committed.
 * · No key → on-device mode: answers assembled from local retrieval only.
 */
import { loadBook, loadDuas, loadNames99, loadQuiz, loadSurah, type ContentHadith } from '@/lib/content';
import { QURAN } from '@/data/quran';
import { ensureQuranCorpus, searchQuranCorpus } from '@/lib/quranSearch';
import { storage } from '@/lib/storage';

export type ProviderId = 'groq' | 'xai';
export type ModelOpt = { id: string; label: string; note?: string };

export const PROVIDERS: Record<ProviderId, { label: string; endpoint: string; models: ModelOpt[]; webModel: string; keyHint: string }> = {
  groq: {
    label: 'GROQ',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    webModel: 'groq/compound', /* built-in web search; auto-falls back if the tier blocks it */
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', note: 'deep reasoning' },
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', note: 'fast reasoning' },
      { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B', note: 'balanced' },
    ],
    keyHint: 'Groq keys start with gsk_ (console.groq.com/keys).',
  },
  xai: {
    label: 'XAI',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    webModel: '',
    models: [
      { id: 'grok-4-fast-reasoning', label: 'Grok 4 Fast', note: 'reasoning' },
      { id: 'grok-4', label: 'Grok 4', note: 'flagship' },
      { id: 'grok-3-mini', label: 'Grok 3 Mini', note: 'fast' },
    ],
    keyHint: 'xAI keys start with xai- (console.x.ai).',
  },
};

/** provider from key shape: gsk_… = Groq, xai-… = xAI */
export function detectProvider(key: string): ProviderId | null {
  const k = key.trim();
  if (/^gsk[-_]/.test(k)) return 'groq';
  if (k.startsWith('xai-')) return 'xai';
  return null;
}

export type AiSource = { kind: 'quran' | 'hadith' | 'dua' | 'name' | 'quiz' | 'web'; label: string; href?: string; excerpt: string };
export type AiMsg = { role: 'user' | 'assistant'; text: string; sources?: AiSource[]; streamed?: boolean; at?: number; reasoning?: string; thinkMs?: number; nav?: string };
export type AiChat = { id: string; title: string; at: number; msgs: AiMsg[] };

const K_CHATS = 'dl.ai.chats.v2';
const K_KEY = 'dl.ai.key.v1';
const K_MODEL = 'dl.ai.model.v1';
const K_WEB = 'dl.ai.web.v1';

export const uid = () => Math.random().toString(36).slice(2, 9);

/* ───────────────────── settings ───────────────────── */
export async function getApiKey(): Promise<string> { return (await storage.getItem(K_KEY)) ?? ''; }
export async function setApiKey(k: string): Promise<void> { await storage.setItem(K_KEY, k.trim()); }
export async function getModel(): Promise<string> { return (await storage.getItem(K_MODEL)) ?? PROVIDERS.groq.models[0].id; }
export async function setModel(m: string): Promise<void> { await storage.setItem(K_MODEL, m); }
export async function getWebPref(): Promise<boolean> { return (await storage.getItem(K_WEB)) === '1'; }
export async function setWebPref(on: boolean): Promise<void> { await storage.setItem(K_WEB, on ? '1' : '0'); }

/* ───────────────────── chat history ───────────────────── */
export async function loadChats(): Promise<AiChat[]> {
  const raw = await storage.getItem(K_CHATS);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as AiChat[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
export async function saveChats(chats: AiChat[]): Promise<void> {
  /* keep the 40 most recent chats, each capped at 60 msgs */
  const trimmed = chats.slice(0, 40).map((c) => ({ ...c, msgs: c.msgs.slice(-60) }));
  await storage.setItem(K_CHATS, JSON.stringify(trimmed));
}
export async function clearChats(): Promise<void> { await storage.removeItem(K_CHATS); }

/* ───────────────────── local retrieval (RAG) ───────────────────── */
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'is', 'are', 'to', 'in', 'on', 'for', 'what', 'which', 'who', 'how', 'why', 'when', 'give', 'me', 'my', 'i', 'you', 'your', 'about', 'tell', 'does', 'do', 'did', 'with', 'from', 'that', 'this', 'it', 'be', 'was', 'will', 'can', 'should', 'any', 'some', 'there', 'their', 'we', 'us', 'our']);

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z\u0621-\u064A\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export async function retrieveLocal(query: string, progress?: (done: number) => void): Promise<AiSource[]> {
  const toks = tokenize(query);
  const out: AiSource[] = [];
  const score = (text: string) => {
    const low = ' ' + text.toLowerCase() + ' ';
    let s = 0;
    for (const t of toks) if (low.includes(t)) s += t.length > 5 ? 2 : 1;
    return s;
  };
  const push = (s: AiSource, sc: number, arr: { s: AiSource; sc: number }[]) => { if (sc >= 2) arr.push({ s, sc }); };

  /* quran — surah NAME hits first ("what is surah al-fatiha about?") */
  try {
    const ql = query.toLowerCase().replace(/[^a-z\s]/g, ' ');
    for (const m of QURAN) {
      const nameNorm = m.english.toLowerCase().replace(/[^a-z]/g, '');
      const hit = toks.some((t) => t.length > 3 && nameNorm.includes(t.replace(/[^a-z]/g, '')));
      if (hit) {
        const sc = await loadSurah(m.number);
        const first = sc?.verses?.slice(0, 3) ?? [];
        out.push({
          kind: 'quran',
          label: `Quran ${m.number} · ${m.english}`,
          href: `/read/${m.number}`,
          excerpt: `${m.english} (${m.ayahs} verses): ` + first.map((v) => v.arabic + ' — ' + (v.english ?? '')).join(' / ').slice(0, 420),
        });
        break;
      }
    }
  } catch {}

  /* quran — full corpus keyword search */
  try {
    await ensureQuranCorpus(progress);
    const hits = searchQuranCorpus(query, 24);
    const ranked = hits
      .map((h) => ({ h, sc: score(h.translation) + score(h.arabic) }))
      .sort((a, b) => b.sc - a.sc)
      .filter((x) => x.sc >= 2)
      .slice(0, 4);
    for (const { h } of ranked)
      out.push({ kind: 'quran', label: `Quran ${h.surah}:${h.ayah}`, href: `/read/${h.surah}?ayah=${h.ayah}`, excerpt: `${h.arabic}\n${h.translation}`.slice(0, 420) });
  } catch {}

  /* hadith — all books we ship */
  for (const book of ['bukhari', 'muslim', 'abudawud']) {
    try {
      const arr = await loadBook(book);
      const ranked: { s: AiSource; sc: number }[] = [];
      for (const h of arr as ContentHadith[]) {
        const sc = score(h.english || '') + score(h.chapter_name?.english || '');
        push({ kind: 'hadith', label: `${book.charAt(0).toUpperCase() + book.slice(1)} · ${h.chapter_name?.english ?? ''} ${h.hadith_number != null ? '#' + h.hadith_number : ''}`.trim(), href: `/tools/hadith/${book}`, excerpt: (h.english || h.arabic).slice(0, 420) }, sc, ranked);
      }
      ranked.sort((a, b) => b.sc - a.sc);
      if (ranked[0]) out.push(ranked[0].s);
    } catch {}
  }

  /* duas / athkar */
  try {
    const pack = await loadDuas();
    const ranked: { s: AiSource; sc: number }[] = [];
    for (const [section, list] of Object.entries(pack))
      for (const dua of list) {
        const texts = (dua.TEXT ?? []).map((t) => `${t.TRANSLATED_TEXT ?? t.ENGLISH_TEXT ?? ''}`).join(' ');
        const sc = score(dua.TITLE) * 2 + score(texts) + score(section);
        push({ kind: 'dua', label: `Dua · ${dua.TITLE} (${section})`, href: `/tools/dua`, excerpt: texts.slice(0, 360) || dua.TITLE }, sc, ranked);
      }
    ranked.sort((a, b) => b.sc - a.sc);
    ranked.slice(0, 2).forEach((r) => out.push(r.s));
  } catch {}

  /* 99 names */
  try {
    const names = await loadNames99();
    const ranked: { s: AiSource; sc: number }[] = [];
    for (const n of names.data.names) {
      const sc = score(n.translation) * 2 + score(n.meaning) + score(n.transliteration) * 2;
      push({ kind: 'name', label: `${n.transliteration} — ${n.translation}`, href: `/tools/names`, excerpt: `${n.name} · ${n.transliteration}: ${n.meaning}`.slice(0, 300) }, sc, ranked);
    }
    ranked.sort((a, b) => b.sc - a.sc);
    ranked.slice(0, 2).forEach((r) => out.push(r.s));
  } catch {}

  /* quizzes */
  try {
    const quiz = await loadQuiz();
    const ranked: { s: AiSource; sc: number }[] = [];
    for (const q of quiz) push({ kind: 'quiz', label: 'From the app quiz deck', href: `/tools/quiz`, excerpt: `${q.question}${q.explanation ? ' — ' + q.explanation : ''}`.slice(0, 300) }, score(q.question) + score(q.explanation ?? ''), ranked);
    ranked.sort((a, b) => b.sc - a.sc);
    if (ranked[0]) out.push(ranked[0].s);
  } catch {}

  return out.slice(0, 8);
}

export function buildContext(sources: AiSource[]): string {
  if (!sources.length) return '';
  return (
    "Excerpts from the user's verified in-app library (cite these inline like [Quran 2:255] when you use them):\n\n" +
    sources.map((s, i) => `[${i + 1}] ${s.label}\n${s.excerpt}`).join('\n\n')
  );
}

/* ───────────────────── Grok (xAI) client ───────────────────── */
export const SYSTEM_PROMPT = `You are DeenLink AI, the assistant inside the DeenLink Islamic app.
- Warm, professional, concise. Greet respectfully; assume good intent.
- When the context includes excerpts from the app library, prefer them and cite inline like [Quran 2:255] or [Bukhari · Faith #8]. Never fabricate ayah/hadith numbers.
- If web search results are available, use them for current facts and cite [web].
- Be honest when unsure; encourage asking a qualified scholar for rulings.
- Format answers with short paragraphs and bullets. Keep under ~250 words unless asked for depth.
- NAVIGATION MAP: you know the app's screens. When the user asks WHERE to find something (a surah reader, mushaf, prayer times, qibla compass, zakat calculator, tasbeeh, hijri calendar, duas, athkar, 99 names, hadith collections, quizzes, videos/community, AI chat, settings), answer briefly and end your reply with ONE final line of the exact form:
NAV: /read/2 | /tools/prayer | /tools/qibla | /tools/zakat | /tools/tasbeeh | /tools/calendar | /tools/dua | /tools/athkar | /tools/names | /tools/hadith | /tools/quiz | /tools/ai | /videos | /(tabs)/community | /(tabs)/quran/surah
The app turns that line into a button that opens the screen. Only add it when it genuinely helps.`;

/** pretty names for NAV: routes (used for the "Open …" button) */
export const NAV_LABELS: Record<string, string> = {
  '/tools/prayer': 'Prayer times', '/tools/qibla': 'Qibla compass', '/tools/zakat': 'Zakat calculator',
  '/tools/tasbeeh': 'Digital tasbeeh', '/tools/calendar': 'Hijri calendar', '/tools/dua': 'Dua collection',
  '/tools/athkar': 'Athkar', '/tools/names': '99 Names of Allah', '/tools/hadith': 'Hadith library',
  '/tools/quiz': 'Quiz', '/tools/ai': 'DeenLink AI', '/videos': 'Videos & reels',
  '/(tabs)/community': 'Community', '(tabs)/community': 'Community', '/(tabs)/quran/surah': 'Quran · surah list',
  '/tools/charity': 'Sadaqah', '/tools/seerah': 'Seerah timeline', '/tools/courses': 'Courses',
};

/** on-device "where is…" router — answers navigation questions without a key */
export function navAnswer(q: string): { text: string; route?: string } | null {
  const s = q.toLowerCase();
  const asksWhere = ['where', 'how do i open', 'find the', 'go to', 'navigate', 'locate'].some((x) => s.includes(x));
  if (!asksWhere) return null;
  const map: Array<[string[], string, string]> = [
    [['prayer time', 'salah time', 'prayer schedule', 'adhan'], '/tools/prayer', 'Prayer times'],
    [['qibla', 'compass', 'kaaba direction', 'makkah direction'], '/tools/qibla', 'Qibla compass'],
    [['zakat', 'nisab'], '/tools/zakat', 'Zakat calculator'],
    [['tasbeeh', 'tasbih', 'counter'], '/tools/tasbeeh', 'Digital tasbeeh'],
    [['calendar', 'hijri', 'islamic month'], '/tools/calendar', 'Hijri calendar'],
    [['athkar', 'adhkar', 'morning and evening'], '/tools/athkar', 'Athkar'],
    [['dua', 'supplication'], '/tools/dua', 'Dua collection'],
    [['99 names', 'names of allah'], '/tools/names', '99 Names of Allah'],
    [['hadith', 'bukhari', 'muslim', 'narration'], '/tools/hadith', 'Hadith library'],
    [['quiz'], '/tools/quiz', 'Quiz'],
    [['mushaf', 'read quran', 'quran page', 'surah list'], '/(tabs)/quran/surah', 'Quran · surah list'],
    [['video', 'reel', 'watch'], '/videos', 'Videos & reels'],
    [['community', 'feed', 'followers'], '/(tabs)/community', 'Community'],
    [['recite', 'memoriz', 'hifz'], '/read/1', 'the Quran reader'],
  ];
  for (const [keys, route, label] of map) {
    if (keys.some((k) => s.includes(k))) {
      return { text: `You can find that under ${label} — tap the button below and I'll take you straight there.`, route };
    }
  }
  return null;
}

export type StreamEvent = { delta?: string; reason?: string; done?: boolean; error?: string; citations?: string[] };

/** SSE chat-completion that works for both Groq and xAI (OpenAI-compatible). */
export async function streamLLM(
  key: string,
  model: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  webSearch: boolean,
  onEvent: (e: StreamEvent) => void,
): Promise<void> {
  const provider = detectProvider(key);
  if (!provider) { onEvent({ error: 'Unrecognized API key — Groq keys start with gsk_, xAI keys with xai-.' }); return; }
  const P = PROVIDERS[provider];

  const useWeb = webSearch && (provider !== 'xai' ? true : true);
  const sendModel = useWeb && provider === 'groq' ? P.webModel : model;
  const extra: Record<string, unknown> = {};
  if (sendModel.includes('gpt-oss')) extra.reasoning_effort = 'low'; /* snappy on free tiers */
  if (useWeb && provider === 'xai') extra.search_parameters = { mode: 'auto', return_citations: true };

  const run = async (m: string, web: boolean): Promise<string | null> => {
    const body: Record<string, unknown> = { model: m, messages, stream: true, temperature: 0.6, ...extra };
    let res: Response;
    try {
      res = await fetch(P.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    } catch {
      return 'NETWORK — could not reach the API (check connection)';
    }
    if (!res.ok || !res.body) {
      let detail = `HTTP ${res.status}`;
      try { const j = await res.json(); detail = j?.error?.message ?? detail; } catch {}
      return detail;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let citations: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const payload = l.slice(5).trim();
        if (payload === '[DONE]') { onEvent({ done: true, citations }); return null; }
        try {
          const j = JSON.parse(payload);
          const delta = j?.choices?.[0]?.delta;
          if (typeof delta?.content === 'string' && delta.content) onEvent({ delta: delta.content });
          /* gpt-oss reasoning channel (Groq) — surfaced as "thinking" */
          if (typeof delta?.reasoning === 'string' && delta.reasoning) onEvent({ reason: delta.reasoning });
          const cit = j?.citations ?? j?.x_groq?.citations ?? undefined;
          if (Array.isArray(cit)) citations = cit.map(String).slice(0, 6);
        } catch {}
      }
    }
    onEvent({ done: true, citations });
    return null;
  };

  const err = await run(sendModel, useWeb);
  if (err && useWeb && sendModel !== model) {
    /* web model failed (tier/limits) → retry the chosen model offline */
    const err2 = await run(model, false);
    if (err2) onEvent({ error: err2 });
    else onEvent({ delta: `\n\n⚠️ Web search was unavailable (${err.slice(0, 80)}) — answered without it.`, done: true });
    return;
  }
  if (err) onEvent({ error: err });
}

/** on-device fallback answer built purely from retrieved sources */
export function composeLocalAnswer(q: string, sources: AiSource[]): string {
  if (!sources.length)
    return `I could not find that in the offline library. Try rephrasing (e.g. name a surah, a dua topic, or a hadith theme) — or add a Grok API key in Settings for full AI answers with reasoning and web search.`;
  const byKind = sources.slice(0, 4);
  return (
    `Here is what I found in your DeenLink library for “${q.trim()}”:\n\n` +
    byKind.map((s) => `[${s.label}]\n${s.excerpt.split('\n')[s.excerpt.includes('\n') ? 1 : 0] || s.excerpt}`).join('\n\n') +
    `\n\nTap any reference to open it in context.`
  );
}
