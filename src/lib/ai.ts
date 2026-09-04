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
import { loadBook, loadDuas, loadNames99, loadSurah, type ContentHadith } from '@/lib/content';
import { QURAN } from '@/data/quran';
import { ensureQuranCorpus, searchQuranCorpus } from '@/lib/quranSearch';
import { storage } from '@/lib/storage';
import { hadithNumbers } from '@/lib/hadithNum';

const BOOK_LABEL: Record<string, string> = { buhari: 'Bukhari', muslim: 'Muslim', abudawud: 'Abu Dawud', tirmidhi: 'Tirmidhi', nasai: "An-Nasa'i", ibnmajah: 'Ibn Majah', malik: 'Muwatta Malik', darimi: 'Darimi', ahmed: 'Musnad Ahmad' };

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

export type AiSource = { kind: 'quran' | 'hadith' | 'dua' | 'name' | 'quiz' | 'fatwa' | 'prophet' | 'web'; label: string; href?: string; excerpt: string };
export type AiMsg = { role: 'user' | 'assistant'; text: string; sources?: AiSource[]; streamed?: boolean; at?: number; reasoning?: string; thinkMs?: number; nav?: string; memSaved?: boolean };
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

/* ───────────────────── greetings (pass 33 instant path) ───────────────────── */
const GREET_RE = /^(\*|\s)*(as)?s?ala?m+u?\s*(alaikum|alykum|alaykum)?|hello+|hey+|yo|hi(ya)?|good\s+(morning|afternoon|evening|night)|how\s+are\s+you|whats\s+up|what'?s\s+up|sup|salam|peace|[\u0627-\u064A\s]{2,20}$/i;
export function isGreeting(q: string): boolean {
  const t = q.trim().replace(/[!.?,]+$/g, '');
  if (!t || t.length > 40) return false;
  return GREET_RE.test(t) || /^(السلام|سلام|مرحبا|أهلا|اهلا|صباح|مساء)/.test(t);
}
export function greetingAnswer(q: string, name?: string): string {
  const m = q.trim().toLowerCase();
  const wb = /sala?m|alaikum|السلام|سلام/.test(m) || /السلام|سلام/.test(q);
  const who = name ? `, ${name}` : '';
  const open = wb ? `Wa alaikum assalam${who}! 🌙` : `Assalamu alaikum${who}! 🌙`;
  return `${open}

I'm DeenLink — your companion for the Qur'an, hadith, duas and daily ibadah.

**Try asking me:**
- What does verse 2:255 say?
- Give me a hadith about kindness
- How do I perform wudu?
- Where is the tasbeeh counter?

You can also tap any suggestion below — or add a Groq/xAI key in Settings for full AI reasoning.`;
}

/* ───────────────────── local retrieval (RAG) ───────────────────── */
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'is', 'are', 'to', 'in', 'on', 'for', 'what', 'which', 'who', 'how', 'why', 'when', 'give', 'me', 'my', 'i', 'you', 'your', 'about', 'tell', 'does', 'do', 'did', 'with', 'from', 'that', 'this', 'it', 'be', 'was', 'will', 'can', 'should', 'any', 'some', 'there', 'their', 'we', 'us', 'our']);

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z\u0621-\u064A\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

const BOOK_ALIASES: Array<[RegExp, string]> = [
  [/bukhari|buhari/i, 'buhari'],
  [/muslim/i, 'muslim'],
  [/abu\s*dawud|abudawud|aboodawud/i, 'abudawud'],
  [/tirmidhi|tirmizi/i, 'tirmidhi'],
  [/nasai|nasa'i/i, 'nasai'],
  [/ibn\s*majah|ibnmajah/i, 'ibnmajah'],
  [/muwatta|malik/i, 'malik'],
  [/darimi/i, 'darimi'],
  [/ahmad|ahmed|musnad/i, 'ahmed'],
];

/** Fetch the EXACT ayah or hadith the user cited by number — e.g. "Quran 2:255",
 * "Sahih Muslim #1115", "Bukhari 8". Fixes the "not in library" failure for
 * specific references the keyword search could not rank. */
async function directReferences(query: string): Promise<AiSource[]> {
  const res: AiSource[] = [];
  const q = ` ${query} `;
  /* ── Quran S:A ── */
  const qm =
    q.match(/(?:qur'?an|surah|surat|s\.)\s*(\d{1,3})\s*[:.]\s*(\d{1,3})/i) ||
    q.match(/(?:surah|surat)\s*(\d{1,3})\s+(?:ayah|verse|v\.?)\s*(\d{1,3})/i) ||
    q.match(/\b(\d{1,3})\s*:\s*(\d{1,3})\b/);
  if (qm) {
    const s = Number(qm[1]);
    const a = Number(qm[2]);
    if (s >= 1 && s <= 114 && a >= 1) {
      try {
        const sc = await loadSurah(s);
        const v = sc?.verses?.find((x) => x.ayah === a);
        if (v) res.push({ kind: 'quran', label: `Quran ${s}:${a}`, href: `/read/${s}?ayah=${a}`, excerpt: `${v.arabic}\n${v.english || v.hausa || ''}`.slice(0, 700) });
      } catch {}
    }
  }
  /* ── <book> #<number> ── */
  for (const [re, book] of BOOK_ALIASES) {
    const m = q.match(re);
    if (m && m.index != null) {
      const nm = q.slice(m.index + m[0].length).match(/#?\s*(\d{1,5})/);
      if (nm) {
        const num = Number(nm[1]);
        try {
          const arr = await loadBook(book);
          let nums: number[] = [];
          try { nums = await hadithNumbers(book); } catch {}
          const ix = arr.findIndex((h, i) => (h.hadith_number != null ? Number(h.hadith_number) : (nums[i] ?? i + 1)) === num);
          if (ix >= 0) {
            const h = arr[ix];
            res.push({ kind: 'hadith', label: `${BOOK_LABEL[book] ?? book} · Hadith ${num}${h.chapter_name?.english ? ' · ' + h.chapter_name.english : ''}`, href: `/tools/hadith/${book}?h=${num}`, excerpt: (h.english || h.arabic || '').slice(0, 700) });
          }
        } catch {}
        break;
      }
    }
  }
  return res;
}

export async function retrieveLocal(query: string, progress?: (done: number) => void): Promise<AiSource[]> {
  const direct = await directReferences(query);
  const toks = tokenize(query);
  /* pass 33: no content keywords ("hello", "salam", small talk) → NOTHING to
   * retrieve. This used to load the whole Quran corpus + 3 hadith books +
   * fatwas (~60MB) before answering a greeting — the 2-minute "hello". */
  if (!toks.length) return direct;
  const out: AiSource[] = [];
  const score = (text: string) => {
    const low = ' ' + text.toLowerCase() + ' ';
    let s = 0;
    for (const t of toks) if (low.includes(t)) s += t.length > 5 ? 2 : 1;
    return s;
  };
  const push = (s: AiSource, sc: number, arr: { s: AiSource; sc: number }[]) => { if (sc >= 2) arr.push({ s, sc }); };
  /* pass 29: every candidate carries its score so the FINAL list is ranked —
   * the "references" row used to show whatever loaded LAST, often off-topic */
  const all: Array<{ s: AiSource; sc: number }> = [];
  const track = (arr: Array<{ s: AiSource; sc: number }>) => { for (const r of arr) all.push(r); };

  /* pass 33: every source block runs CONCURRENTLY — they used to serialize
   * (quran corpus → 3 hadith books → duas → names → fatwas), so the first
   * real question waited for ~60MB of sequential fetches. */
  const quranBlock = async (): Promise<AiSource[]> => {
    const res: AiSource[] = [];
    try {
      const ql = query.toLowerCase().replace(/[^a-z\s]/g, ' ');
      for (const m of QURAN) {
        const nameNorm = m.english.toLowerCase().replace(/[^a-z]/g, '');
        const hit = toks.some((t) => t.length > 3 && nameNorm.includes(t.replace(/[^a-z]/g, '')));
        if (hit) {
          const sc = await loadSurah(m.number);
          const first = sc?.verses?.slice(0, 3) ?? [];
          res.push({
            kind: 'quran',
            label: `Quran ${m.number} · ${m.english}`,
            href: `/read/${m.number}`,
            excerpt: `${m.english} (${m.ayahs} verses): ` + first.map((v) => v.arabic + ' — ' + (v.english ?? '')).join(' / ').slice(0, 420),
          });
          break;
        }
      }
    } catch {}
    try {
      await ensureQuranCorpus(progress);
      const hits = searchQuranCorpus(query, 24);
      const ranked = hits
        .map((h) => ({ h, sc: score(h.translation) + score(h.arabic) }))
        .sort((a, b) => b.sc - a.sc)
        .filter((x) => x.sc >= 2)
        .slice(0, 4);
      for (const { h } of ranked)
        res.push({ kind: 'quran', label: `Quran ${h.surah}:${h.ayah}`, href: `/read/${h.surah}?ayah=${h.ayah}`, excerpt: `${h.arabic}\n${h.translation}`.slice(0, 420) });
    } catch {}
    return res;
  };

  const hadithBlock = async (): Promise<AiSource[]> => {
    const res: AiSource[] = [];
    /* pass 33 bugfix: the pack ids are 'buhari' (not 'bukhari') — the old id
     * silently failed the load, so on-device answers NEVER cited Bukhari. */
    const one = async (book: string) => {
      try {
        const arr = await loadBook(book);
        let nums: number[] = [];
        try { nums = await hadithNumbers(book); } catch {}
        const ranked: { s: AiSource; sc: number }[] = [];
        arr.forEach((h, ix) => {
          const sc = score(h.english || '') + score(h.chapter_name?.english || '');
          const hnum = h.hadith_number != null ? Number(h.hadith_number) : (nums[ix] ?? ix + 1);
          push({ kind: 'hadith', label: `${BOOK_LABEL[book] ?? book} · Hadith ${hnum}${h.chapter_name?.english ? ' · ' + h.chapter_name.english : ''}`, href: `/tools/hadith/${book}?h=${hnum}`, excerpt: (h.english || h.arabic).slice(0, 420) }, sc, ranked);
        });
        ranked.sort((a, b) => b.sc - a.sc);
        if (ranked[0]) return ranked[0].s;
      } catch {}
      return null;
    };
    for (const r of await Promise.all(['buhari', 'muslim', 'abudawud'].map(one))) if (r) res.push(r);
    return res;
  };

  const duaBlock = async (): Promise<AiSource[]> => {
    const res: AiSource[] = [];
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
      ranked.slice(0, 2).forEach((r) => res.push(r.s));
    } catch {}
    return res;
  };

  const nameBlock = async (): Promise<AiSource[]> => {
    const res: AiSource[] = [];
    try {
      const names = await loadNames99();
      const ranked: { s: AiSource; sc: number }[] = [];
      for (const n of names.data.names) {
        const sc = score(n.translation) * 2 + score(n.meaning) + score(n.transliteration) * 2;
        push({ kind: 'name', label: `${n.transliteration} — ${n.translation}`, href: `/tools/names`, excerpt: `${n.name} · ${n.transliteration}: ${n.meaning}`.slice(0, 300) }, sc, ranked);
      }
      ranked.sort((a, b) => b.sc - a.sc);
      ranked.slice(0, 2).forEach((r) => res.push(r.s));
    } catch {}
    return res;
  };

  const fatwaBlock = async (): Promise<AiSource[]> => {
    const res: AiSource[] = [];
    try {
      const fq = await searchFatwas(query);
      for (const f of fq) res.push({ kind: 'fatwa', label: `IslamQA · ${f.t}`, href: '/tools/learning?tab=fatwa', excerpt: f.a.slice(0, 400) });
    } catch {}
    return res;
  };

  /* item 9: prophets-history (Ibn Kathir) — only loads a prophet file when the
   * query actually names that prophet, so it stays cheap. */
  const prophetsBlock = async (): Promise<AiSource[]> => {
    const res: AiSource[] = [];
    try {
      const { publicBase } = await import('@/lib/gzio');
      const idx = (await (await fetch(`${publicBase()}/prophets/index.json`)).json()) as { slug: string; name: string }[];
      const q = query.toLowerCase();
      const hit = idx.find((p) => {
        const words = [p.slug, ...p.name.toLowerCase().split(/[\s()]+/)].filter((w) => w.length > 2);
        return words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(q));
      });
      if (hit) {
        const full = (await (await fetch(`${publicBase()}/prophets/${hit.slug}.json`)).json()) as { name: string; paras: string[] };
        const paras = full.paras || [];
        let best = ''; let bestSc = 0;
        for (const para of paras) { const sc = score(para); if (sc > bestSc) { bestSc = sc; best = para; } }
        if (!best && paras.length) best = paras[0];
        if (best) res.push({ kind: 'prophet', label: `${full.name} — Stories of the Prophets`, href: '/tools/prophets', excerpt: best.slice(0, 480) });
      }
    } catch {}
    return res;
  };

  const parts = await Promise.all([quranBlock(), hadithBlock(), duaBlock(), nameBlock(), fatwaBlock(), prophetsBlock()]);
  for (const part of parts) out.push(...part);

  /* Exact references the user cited (e.g. "Muslim #1115", "Quran 2:255") come
   * first, then keyword matches — deduped by label. */
  const seen = new Set<string>();
  const merged: AiSource[] = [];
  for (const s of [...direct, ...out]) {
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    merged.push(s);
  }
  return merged.slice(0, 6);
}

/* ── islamqa fatwa corpus (public/islamqa.json, ~3.4MB, fetched once) ── */
export type Fatwa = { t: string; q: string; a: string; u: string };
let fatwaCache: Fatwa[] | null = null;
let fatwaLoading: Promise<Fatwa[]> | null = null;
export async function loadFatwas(): Promise<Fatwa[]> {
  if (fatwaCache) return fatwaCache;
  if (fatwaLoading) return fatwaLoading;
  fatwaLoading = (async () => {
    const { publicBase } = await import('@/lib/gzio');
    const r = await fetch(`${publicBase()}/islamqa.json`);
    const j = (await r.json()) as Fatwa[];
    fatwaCache = j;
    return j;
  })();
  return fatwaLoading;
}
export async function searchFatwas(query: string, limit = 2): Promise<Fatwa[]> {
  const toks = query.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  if (!toks.length) return [];
  let list: Fatwa[] = [];
  try { list = await loadFatwas(); } catch { return []; }
  const scored: Array<{ f: Fatwa; sc: number }> = [];
  for (const f of list) {
    const low = (f.t + ' ' + f.q).toLowerCase();
    let sc = 0;
    for (const t of toks) if (low.includes(t)) sc += t.length > 6 ? 2 : 1;
    if (sc >= 3) scored.push({ f, sc });
  }
  scored.sort((a, b) => b.sc - a.sc);
  return scored.slice(0, limit).map((x) => x.f);
}

/** pass 32: the chips under an answer must be the sources the model ACTUALLY
 * cited — not every excerpt we retrieved (off-topic refs under a good answer
 * were the complaint). Heuristics per kind, sliced to 6. */
export function mentionedSources(sources: AiSource[], answer: string): AiSource[] {
  const a = answer.toLowerCase();
  const hit = (s: AiSource): boolean => {
    if (s.kind === 'web') return true; // streamed citations are always real
    if (s.kind === 'quran') {
      const m = s.label.match(/(\d+)[^\d]+(\d+)/);
      return m ? a.includes(`${m[1]}:${m[2]}`) : a.includes(s.label.toLowerCase().slice(0, 12));
    }
    if (s.kind === 'hadith') {
      const num = s.label.match(/#(\d+)/);
      if (num && a.includes(`#${num[1]}`)) return true;
      const words = s.excerpt.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 4);
      const phrase = words.slice(0, 6).join(' ');
      if (phrase && a.includes(phrase)) return true;
      const book = s.label.split(' ·')[0].toLowerCase();
      return a.includes(book) && a.includes(s.excerpt.toLowerCase().slice(0, 34));
    }
    /* fatwa / dua / name — ≥2 distinctive title words appear in the answer */
    const words = s.label.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 4 && !['islamqa', 'dua'].includes(w));
    if (words.length < 2) return a.includes(s.label.toLowerCase().slice(0, 20));
    let n = 0;
    for (const w of words) if (a.includes(w)) n += 1;
    return n >= 2;
  };
  return sources.filter(hit).slice(0, 6);
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
- GROUNDING (strict): quote or cite ONLY ayahs/hadiths that appear VERBATIM in the provided context excerpts. If the context has no fitting citation, answer from general knowledge WITHOUT a bracketed citation — never attach a reference that was not given to you, and never pick a loosely-related one when the context already contains the right one (prefer the MOST relevant excerpt).
- SELF / CAPABILITY questions: if the user asks about you or the app (e.g. "can you read images?", "who are you?", "what can you do?"), answer DIRECTLY and helpfully in one or two sentences. Do NOT preface with "there is no source in the provided library" — the library exists for religious citations, not for describing yourself. (For the record: you cannot see images; say so plainly and offer what you CAN do.)
- GENERAL KNOWLEDGE with care: you MAY answer from general knowledge, but conservatively. Before finalising, cross-check every SPECIFIC claim (a book's author, a person's name, dates, numbers, attributions) against the provided library excerpts. If the library contains it, use that. If it does NOT and you are not certain, do NOT invent a specific name or fact — say plainly that it is not in your verified library, give only what you are sure of, and suggest the user confirm with a qualified source. A cautious "I am not certain" is always better than a confident wrong answer.
- If web search results are available, use them for current facts and cite [web].
- Be honest when unsure; encourage asking a qualified scholar for rulings.
- Format answers with short paragraphs and bullets. Keep under ~250 words unless asked for depth.
- STYLE (the app renders your formatting — users never want to see raw * or # symbols): use **bold** for key terms and short bold labels instead of markdown headings; use "- " bullets for lists; NEVER use #, ## headings or tables; no asterisk art.
- RULINGS / FATWAS: when the context includes an IslamQA fatwa excerpt that fits the question, ground your ruling in it, cite it inline like [IslamQA · <title>], and briefly restate its question and the ruling. Never invent a fatwa attribution; if no fatwa excerpt fits, say so and advise a qualified scholar.
- When you quote the Qur'an, ALWAYS include the full Arabic text of the ayah first (with diacritics), then the English translation, then cite [Quran S:A]. When you cite a hadith, quote its English text and cite like [Bukhari · Faith #8].
- NAVIGATION MAP: you know the app's screens. When the user asks WHERE to find something (a surah reader, mushaf, prayer times, qibla compass, zakat calculator, tasbeeh, hijri calendar, duas, athkar, 99 names, hadith collections, quizzes, videos/community, AI chat, settings), answer briefly and end your reply with ONE final line of the exact form:
NAV: /read/2 | /tools/prayer | /tools/qibla | /tools/zakat | /tools/tasbeeh | /tools/calendar | /tools/dua | /tools/athkar | /tools/names | /tools/hadith | /tools/prophets | /tools/fatwa | /tools/courses | /tools/seerah | /tools/quiz | /tools/mirath | /tools/ai | /videos | /(tabs)/community | /(tabs)/quran/surah
The app turns that line into a button that opens the screen. Only add it when it genuinely helps.
- MIRATH (inheritance): whenever the user describes an estate, heirs, or asks who inherits what, give the ruling briefly and ALWAYS finish with the NAV line to the calculator so they can compute exact shares and save the report:
NAV: /tools/mirath`;

/** pretty names for NAV: routes (used for the "Open …" button) */
export const NAV_LABELS: Record<string, string> = {
  '/tools/prayer': 'Prayer times', '/tools/qibla': 'Qibla compass', '/tools/zakat': 'Zakat calculator',
  '/tools/tasbeeh': 'Digital tasbeeh', '/tools/calendar': 'Hijri calendar', '/tools/dua': 'Dua collection',
  '/tools/athkar': 'Athkar', '/tools/names': '99 Names of Allah', '/tools/hadith': 'Hadith library',
  '/tools/quiz': 'Quiz', '/tools/ai': 'DeenLink AI', '/videos': 'Videos & reels',
  '/(tabs)/community': 'Community', '(tabs)/community': 'Community', '/(tabs)/quran/surah': 'Quran · surah list',
  '/tools/charity': 'Sadaqah', '/tools/seerah': 'Seerah timeline', '/tools/courses': 'Courses',
  '/tools/prophets': 'Stories of the Prophets', '/tools/fatwa': 'Fatwa & Rulings',
  '/tools/mirath': 'Mirath — inheritance calculator',
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
    [['mirath', 'inherit', 'estate', 'heirs', 'faraid', 'fara id', 'division after death'], '/tools/mirath', 'the Mirath inheritance calculator'],
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
  signal?: AbortSignal,
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
      res = await fetch(P.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') return null; /* user tapped stop — partial text stays */
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
    /* pass 40 — gentle pacing: deltas are buffered and flushed every ~70ms
     * so the answer types a little slower and reads calmer (was token-fast). */
    let pending = '';
    const flush = () => { if (pending) { const t = pending; pending = ''; onEvent({ delta: t }); } };
    const pacer = setInterval(flush, 70);
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
        if (payload === '[DONE]') { clearInterval(pacer); flush(); onEvent({ done: true, citations }); return null; }
        try {
          const j = JSON.parse(payload);
          const delta = j?.choices?.[0]?.delta;
          if (typeof delta?.content === 'string' && delta.content) pending += delta.content;
          /* gpt-oss reasoning channel (Groq) — surfaced as "thinking" */
          if (typeof delta?.reasoning === 'string' && delta.reasoning) onEvent({ reason: delta.reasoning });
          const cit = j?.citations ?? j?.x_groq?.citations ?? undefined;
          if (Array.isArray(cit)) citations = cit.map(String).slice(0, 6);
        } catch {}
      }
    }
    clearInterval(pacer);
    flush();
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
