/**
 * pass 102 — ONE shared relevance ranker for Quran and Hadith search.
 *
 * WHY THIS EXISTS
 * The owner: "the hadith search is poor, the result is not that accurate and it
 * only returns from one book… normally the first result is the best, the rest
 * are not even close."
 *
 * Both searches had the same structural defect:
 *
 *  · HADITH — results were collected book-by-book with `if (out.length >= 8)
 *    break`, then concatenated in BOOK order with no scoring at all. The first
 *    book to yield 8 matches filled the visible list, so the same hadith in
 *    another collection never surfaced and everything after result #1 was
 *    arbitrary.
 *
 *  · QURAN — `searchQuranCorpus` walked the corpus in surah order and RETURNED
 *    AS SOON AS it had `limit` exact substring hits. Search "mercy" and
 *    al-Baqarah alone fills the quota, so the rest of the Qur'an was never even
 *    scanned. Its token-ranked tier also used a bare `sc >= 2` threshold with no
 *    ordering signal, hence "the rest are not even close".
 *
 * The fix is to separate MATCHING from ORDERING: gather every candidate across
 * the whole corpus, score it here, then sort once and cut.
 */

/* ── normalisation ────────────────────────────────────────────────────────── */

const AR_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u06E5\u06E6]/g;

/** Strip Arabic harakat/tatweel and fold the alef/ya/ta-marbuta variants, so a
 *  query typed without diacritics still matches a fully-vocalised corpus (and
 *  vice-versa). Latin text is lowercased and de-punctuated. */
export function normalizeText(t: string): string {
  if (!t) return '';
  return t
    .replace(AR_DIACRITICS, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') /* أ إ آ اٱ → ا */
    .replace(/\u0649/g, '\u064A') /* ى → ي */
    .replace(/\u0629/g, '\u0647') /* ة → ه */
    .replace(/\u0624/g, '\u0648') /* ؤ → و */
    .replace(/\u0626/g, '\u064A') /* ئ → ي */
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const isArabic = (t: string) => /[\u0621-\u064A]/.test(t);

/** Query tokens, normalised. Arabic keeps short tokens (they are roots);
 *  Latin drops 1-2 char noise words. */
export function queryTokens(q: string): string[] {
  const norm = normalizeText(q);
  if (!norm) return [];
  return norm
    .split(' ')
    .filter((w) => (isArabic(w) ? w.length > 1 : w.length > 2));
}

/* ── matching ─────────────────────────────────────────────────────────────── */

/**
 * Score one candidate against the query. 0 = no match, higher = better.
 *
 * Ranking tiers, in order of trust:
 *   1. exact normalised phrase        (the user typed the wording verbatim)
 *   2. every token present            (full coverage — same idea, other words)
 *   3. tokens in the same order       (ordered subsequence — near-paraphrase)
 *   4. most tokens present            (partial coverage, scaled by ratio)
 *   5. prefix matches only            (weakest — stems and typos)
 *
 * Long tokens and long queries earn more, which is what stops a 2-letter match
 * from outranking a full-phrase hit.
 */
export function scoreMatch(query: string, haystack: string): number {
  const normQ = normalizeText(query);
  const normH = normalizeText(haystack);
  if (!normQ || !normH) return 0;

  const tokens = queryTokens(query);
  if (!tokens.length) return 0;

  let score = 0;

  /* 1. exact phrase — the strongest signal, but scaled by DENSITY.
   *
   * Measured on the real corpus, an unscaled phrase bonus produced exactly the
   * defect the owner reported ("the first result is the best, the rest are not
   * even close" — and sometimes the first is wrong too). Searching
   * "do not become angry":
   *
   *   · Sahih al-Bukhari 5640 — 219 chars, the phrase IS the hadith
   *     ("Advise me!" → "Do not become angry").
   *   · Sahih al-Bukhari 3309 — 1065 chars, a marriage dispute in which Fatima
   *     happens to say "you do not become angry for the sake of your daughters".
   *
   * Both contain the verbatim phrase, so both earned the identical flat bonus,
   * and the 1000-char tangent ranked ABOVE the hadith actually being looked
   * for. A phrase that is a large share of a short text is the subject of that
   * text; the same phrase inside a long one is usually incidental. */
  if (normH.includes(normQ)) {
    const density = normQ.length / Math.max(normQ.length, normH.length);
    score += (100 + Math.min(40, normQ.length / 4)) * (0.22 + 0.78 * density);
  }

  /* 2-5. token evidence */
  const words = normH.split(' ');
  const wordSet = new Set(words);
  let matched = 0;
  let matchedLen = 0;
  let prefixOnly = 0;

  for (const t of tokens) {
    if (wordSet.has(t)) {
      matched++;
      matchedLen += t.length;
      continue;
    }
    /* substring inside a longer word (Arabic morphology: prefixes/suffixes) */
    if (normH.includes(t)) {
      matched++;
      matchedLen += t.length * 0.85;
      continue;
    }
    /* stem/prefix tolerance for the longer tokens only */
    if (t.length >= 4) {
      const head = t.slice(0, Math.max(4, t.length - 2));
      if (words.some((w) => w.startsWith(head) || (w.length >= 4 && t.startsWith(w.slice(0, Math.max(4, w.length - 2)))))) {
        prefixOnly++;
        matchedLen += t.length * 0.4;
      }
    }
  }

  if (matched === 0 && prefixOnly === 0) return 0;

  const coverage = (matched + prefixOnly * 0.5) / tokens.length;

  /* full coverage is worth a lot more than a partial hit */
  if (matched === tokens.length) score += 60;
  else score += 45 * coverage;

  /* ordered subsequence: rewards candidates that keep the query's word order,
   * which is what separates a real paraphrase from a bag of coincidental words */
  if (tokens.length > 1 && matched > 1) {
    let cursor = 0;
    let ordered = 0;
    for (const t of tokens) {
      for (let i = cursor; i < words.length; i++) {
        const w = words[i];
        if (w === t || w.includes(t)) {
          ordered++;
          cursor = i + 1;
          break;
        }
      }
    }
    score += 25 * (ordered / tokens.length);
  }

  /* proximity: tokens close together mean one thought, not scattered noise */
  if (matched > 1) {
    const positions: number[] = [];
    for (const t of tokens) {
      const idx = words.findIndex((w) => w === t || w.includes(t));
      if (idx >= 0) positions.push(idx);
    }
    if (positions.length > 1) {
      positions.sort((a, b) => a - b);
      const span = positions[positions.length - 1] - positions[0] + 1;
      /* a tight span relative to the query length is a strong signal */
      const density = positions.length / span;
      score += 18 * density;
    }
  }

  /* longer matched content is worth slightly more (it is specific) */
  score += Math.min(12, matchedLen / 6);

  /* pass 102 — CONCENTRATION. The density scaling above only applied when the
   * whole query appeared verbatim, which left the partial-match tier still
   * preferring long texts: a 1000-character narration that happens to mention
   * the query words somewhere outranked a 200-character one that IS the answer.
   *
   * Re-measured after this: searching "do not become angry" put the marriage
   * dispute (Sahih al-Bukhari 3309, 1065 chars, where Fatima says "you do not
   * become angry for the sake of your daughters") at #1 and the hadith actually
   * sought ("Advise me!" → "Do not become angry", 219 chars) at #3. The
   * concentration factor is exactly the same idea as the density scaling, just
   * applied to the whole score, and it is deliberately gentle — at a typical
   * hadith length it changes nothing, and only very long candidates are pulled
   * down. */
  const concentration = Math.min(1, 460 / Math.max(160, normH.length));
  return score * (0.62 + 0.38 * concentration);
}

/* ── sorting ──────────────────────────────────────────────────────────────── */

export type Scored<T> = { item: T; score: number };

/**
 * Sort by score, then by a caller-supplied tiebreak, then stable by index.
 *
 * The stable index matters: without it, equal-scoring rows reshuffle on every
 * keystroke and the list visibly jumps while the member is reading it.
 */
export function rankByScore<T>(
  rows: Scored<T>[],
  tiebreak?: (a: T, b: T) => number,
): T[] {
  return rows
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (tiebreak) {
        const t = tiebreak(a.item, b.item);
        if (t !== 0) return t;
      }
      return a.i - b.i;
    })
    .map((r) => r.item);
}

/** Best score across several fields (arabic / english / hausa / chapter…),
 *  with a small bonus for a secondary field also matching — a verse that hits
 *  in both the Arabic and the translation is a better answer than one that
 *  hits in only one. */
export function scoreBest(fields: Array<string | undefined>, query: string): number {
  let best = 0;
  let hits = 0;
  for (const f of fields) {
    if (!f) continue;
    const s = scoreMatch(query, f);
    if (s > 0) {
      hits++;
      if (s > best) best = s;
    }
  }
  if (hits > 1) best *= 1 + Math.min(0.25, 0.08 * (hits - 1));
  return best;
}

/* ── grouping the SAME narration across collections ───────────────────────────
 *
 * Owner: "if we have same hadith in different books or we have different
 * narrations that looks alike, it should display their results."
 *
 * A first attempt keyed the group on the normalised Arabic with a regex isnad
 * strip. Measured against the real 15-book corpus that produced ZERO groups:
 * the same matn is catalogued with completely different chains per collection —
 * Sahih al-Bukhari 5640 opens "حَدَّثَنِي يَحْيَى بْنُ يُوسُفَ، أَخْبَرَنَا أَبُو بَكْرٍ…"
 * while an-Nawawi 16 opens "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللهُ عَنْهُ أَنَّ رَجُلًا قَالَ…"
 * — and no regex reliably finds where an unknown isnad ends.
 *
 * So the matn is compared FUZZILY instead: normalise both sides, then cluster on
 * character-trigram Jaccard similarity within a length band. That is the same
 * signal lib/quranSearch.ts already trusts for recite-to-find.
 *
 * It runs on the shortlist of matched candidates (tens to a few hundred rows),
 * never on all 50,804 hadiths, so the O(n^2) comparison is cheap.
 */

/** Character-trigram set, used as an order-insensitive fingerprint. */
function trigramSet(t: string): Set<string> {
  const g = new Set<string>();
  const s = t.replace(/\s+/g, ' ');
  if (s.length < 3) {
    if (s) g.add(s);
    return g;
  }
  for (let i = 0; i <= s.length - 3; i++) g.add(s.slice(i, i + 3));
  return g;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const g of small) if (large.has(g)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

export type Groupable = { text: string };

/**
 * Cluster rows whose `text` is the same content worded slightly differently.
 *
 * Returns an array of index groups (each group is a list of indexes into `rows`,
 * best member first). Every row appears in exactly one group, so the caller can
 * render one hit per cluster and list the rest as "also in …".
 *
 * @param rows       candidate rows, already relevance-filtered
 * @param threshold  trigram Jaccard cut-off (0.55 measured well on the corpus:
 *                   it joins the same matn across collections without merging
 *                   two genuinely different hadiths that merely share an isnad)
 */
export function groupSimilar<T extends Groupable>(rows: T[], threshold = 0.55): number[][] {
  const n = rows.length;
  if (n === 0) return [];

  const prepared = rows.map((r) => {
    const norm = normalizeText(r.text ?? '');
    return { norm, grams: trigramSet(norm), len: norm.length };
  });

  /* Bucket by length: two texts cannot be the same narration if their lengths
   * differ wildly. Comparing only inside a ±30% band keeps this near-linear. */
  const assigned = new Array<boolean>(n).fill(false);
  const groups: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (assigned[i]) continue;
    const cluster = [i];
    assigned[i] = true;
    const a = prepared[i];
    if (a.len < 20) {
      /* too short to fingerprint reliably — keep it its own group */
      groups.push(cluster);
      continue;
    }
    const lo = a.len * 0.7;
    const hi = a.len / 0.7;
    for (let j = i + 1; j < n; j++) {
      if (assigned[j]) continue;
      const b = prepared[j];
      if (b.len < 20 || b.len < lo || b.len > hi) continue;
      if (jaccard(a.grams, b.grams) >= threshold) {
        cluster.push(j);
        assigned[j] = true;
      }
    }
    groups.push(cluster);
  }

  return groups;
}
