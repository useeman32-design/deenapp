import { align, foldAlif, isReciteRunCurrent, marksConflict, mergeFinal, spokenHasMarks, waslViolated, type WordState } from '@/lib/reciteAlignment';

/**
 * Deterministic regression checks for the speech-buffer/alignment contract.
 * The repository has no test runner dependency, so this is an exported
 * runner that can be invoked by a host test harness without mocking React or
 * a microphone. Keeping these cases beside the engine prevents the four
 * reported regressions from being edited independently again.
 */
export function runReciteEngineRegressionChecks(): void {
  const assert = (condition: unknown, message: string): void => {
    if (!condition) throw new Error(`Recite regression: ${message}`);
  };
  const ok = (result: WordState[], expected: WordState[], label: string) => {
    assert(JSON.stringify(result) === JSON.stringify(expected), label);
  };

  /* First word: a one-character recognition slip is accepted only at the
   * opening token; the second word is still strict. */
  ok(
    align(['الحمد', 'لله'], ['الحمد', 'لله']).states,
    ['ok', 'ok'],
    'first word must not be dropped',
  );
  ok(
    align(['الكتاب', 'نور'], ['لكتاب', 'نور']).states,
    ['ok', 'ok'],
    'first-word clipping grace',
  );
  ok(
    align(['الحمد', 'لله', 'الرحمن'], ['الحمد', 'الرحمن']).states,
    ['ok', 'wrong', 'ok'],
    'a later omitted word must remain visible',
  );

  /* Partial transcript: the words already received align before Stop/settle;
   * the unspoken tail is what becomes wrong, not the received first word. */
  ok(
    align(['بسم', 'الله', 'الرحمن'], ['بسم']).states,
    ['ok', 'hidden', 'hidden'],
    'partial transcript must preserve received words',
  );

  /* Full-page/continuous stream: repeated words are real content, not an
   * overlap to deduplicate. */
  const full = align(['الله', 'أحد', 'الله', 'الصمد'], ['الله', 'أحد', 'الله', 'الصمد']);
  ok(full.states, ['ok', 'ok', 'ok', 'ok'], 'full page must align through repetition');
  assert(full.reached === 4, 'full page reached count');

  /* A browser that resends a growing final segment is deduped, while a
   * legitimate one-word repetition at a segment boundary is retained. */
  assert(mergeFinal('بسم الله', 'بسم الله الرحمن') === 'بسم الله الرحمن', 'growing final segment');
  assert(mergeFinal('الله أحد', 'الله الصمد') === 'الله أحد الله الصمد', 'repeated final word');

  /* Reset/stop increments the run generation; a late callback from the old
   * recognition session must be ignored instead of repopulating the reset UI. */
  assert(isReciteRunCurrent(4, 4), 'current recognition run');
  assert(!isReciteRunCurrent(5, 4), 'stale recognition run after reset');

  /* pass 104 — hamzat wasl must count as a mistake.
   *
   * U+0671 (ٱ) is hamzat wasl; U+0623 (أ) is hamzat qat', a real glottal stop.
   * Reciting a wasl word with a glottal stop is a tajweed error and must be
   * marked wrong. The converse must NOT be: a speech engine transcribes a
   * correct wasl recitation as a bare alif (U+0627), so punishing that would
   * fail every correct reading of every wasl word.
   *
   * These cases are positional on purpose. "ٱقْرَأْ" carries BOTH a wasl at the
   * start and a legitimate hamzat qat' at the end, which is exactly the shape
   * that made a naive "any qat' anywhere" test mark a perfect recitation wrong.
   */
  const WASL = '\u0671', QAT = '\u0623', BARE = '\u0627';
  const iqraWasl = WASL + '\u0642\u0652\u0631\u064E\u0623\u0652';   /* ٱقْرَأْ */
  const iqraQat  = QAT  + '\u0642\u0652\u0631\u064E\u0623\u0652';   /* أَقْرَأْ */
  const iqraBare = BARE + '\u0642\u0652\u0631\u064E\u0623\u0652';   /* اقْرَأْ */

  assert(waslViolated(iqraWasl, iqraQat), "wasl expected, hamzat qat' spoken -> error");
  assert(!waslViolated(iqraWasl, iqraBare), 'wasl expected, bare alif spoken -> not an error');
  assert(!waslViolated(iqraWasl, iqraWasl), 'exact wasl match must not be flagged');
  assert(!waslViolated('\u0627\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F', QAT + '\u062D\u0652\u0645\u064E\u062F'),
    'no wasl in the expected text -> rule never fires');
  assert(!waslViolated(iqraWasl, QAT + '\u0643\u0652\u062A\u064E\u0628\u064E'),
    'two different words are not a wasl problem');

  ok(align([iqraWasl], [iqraQat]).states, ['wrong'], "reciting iqra' with a glottal stop is wrong");
  ok(align([iqraWasl], [iqraBare]).states, ['ok'], 'reciting iqra\' correctly is not penalised');
  ok(align([iqraWasl], [iqraWasl]).states, ['ok'], 'exact wasl recitation is correct');

  /* Folding the alif family must free strictEq's substitution budget, so a
   * wasl word no longer competes with genuine recognition noise. */
  assert(foldAlif(iqraWasl) === foldAlif(iqraQat), 'foldAlif collapses the alif family');
  const alHamduWasl = WASL + '\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F';
  const alHamduBare = BARE + '\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F';
  ok(
    align([alHamduWasl, '\u0644\u0650\u0644\u0651\u064E\u0647\u0650'],
          [alHamduBare, '\u0644\u0650\u0644\u0651\u064E\u0647\u0650']).states,
    ['ok', 'ok'],
    'a wasl opening plus a clean second word both align',
  );

  /* The rescue loop must not promote a tajweed error back to correct. */
  ok(
    align([alHamduWasl, '\u0644\u0650\u0644\u0651\u064E\u0647\u0650'],
          [QAT + '\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F', '\u0644\u0650\u0644\u0651\u064E\u0647\u0650']).states,
    ['wrong', 'ok'],
    "hamzat qat' on the first word of a phrase is still caught",
  );
  /* ===================== PASS 105 — harakat (short vowels) =====================
   * The owner's report: saying "rasuula" where the text has "rasuulu" must be
   * flagged. It was NOT, for three reasons, each covered below:
   *   1. the comparison loop skipped the final letter — and the final vowel is
   *      the case ending, exactly where fatha/damma/kasra errors live;
   *   2. it required TWO marked positions before any error counted;
   *   3. marks were compared as raw strings, so shadda+vowel ordering read as
   *      a conflict.
   * ============================================================================= */
  const F = '\u064E', D = '\u064F', K = '\u0650';
  const FT = '\u064B', DT = '\u064C', KT = '\u064D', SH = '\u0651', SK = '\u0652';
  const R = '\u0631', S = '\u0633', W = '\u0648', LL = '\u0644', M = '\u0645', N = '\u0646';
  const rasulu  = R + F + S + D + W + LL + D;    /* correct          */
  const rasula  = R + F + S + D + W + LL + F;    /* WRONG final F    */
  const rasuli  = R + F + S + D + W + LL + K;    /* WRONG final K    */
  const rasulan = R + F + S + D + W + LL + FT;   /* WRONG tanwin     */
  const rasulun = R + F + S + D + W + LL + DT;   /* WRONG tanwin     */
  const bare    = R + S + W + LL;                /* unvocalised      */

  /* the reported failure */
  assert(marksConflict(rasulu, rasula), 'final damma -> fatha is a harakat conflict');
  ok(align([rasulu], [rasula], [rasulu], [rasula]).states, ['wrong'], 'rasuula for rasuulu is marked wrong');
  assert(marksConflict(rasulu, rasuli), 'final damma -> kasra is a harakat conflict');
  ok(align([rasulu], [rasuli], [rasulu], [rasuli]).states, ['wrong'], 'rasuuli for rasuulu is marked wrong');

  /* every tanwin form is distinct from its single vowel */
  assert(marksConflict(rasulu, rasulan), 'damma vs fathatan is a conflict');
  assert(marksConflict(rasulu, rasulun), 'damma vs dammatan is a conflict');
  assert(marksConflict(M + F, M + FT), 'fatha vs fathatan is a conflict');
  assert(marksConflict(M + D, M + DT), 'damma vs dammatan is a conflict');
  assert(marksConflict(M + K, M + KT), 'kasra vs kasratan is a conflict');
  assert(marksConflict(M + SK, M + F), 'sukun vs fatha is a conflict');

  /* non-final vowels, and one error is enough (the old rule demanded two) */
  assert(marksConflict(S + D + LL + D, S + F + LL + D), 'a middle damma -> fatha is a conflict');
  assert(marksConflict(M + K, M + D), 'a single wrong harakah is a conflict');

  /* must NOT invent errors */
  assert(!marksConflict(rasulu, rasulu), 'identical vocalisation is not a conflict');
  ok(align([rasulu], [rasulu], [rasulu], [rasulu]).states, ['ok'], 'a perfect vocalised recitation stays ok');
  assert(!marksConflict(M + SH + F, M + F + SH), 'shadda+fatha and fatha+shadda are the same recitation');
  /* either side silent on the vowel means we cannot judge — NOT an error */
  assert(!marksConflict(rasulu, bare), 'unvocalised speech is not a harakat conflict');
  assert(!marksConflict(bare, rasula), 'unvocalised source text is not a harakat conflict');
  ok(align([rasulu], [bare], [rasulu], [bare]).states, ['ok'], 'unvocalised speech is not marked wrong');
  assert(!marksConflict(rasulu, R + F + S + D + N + D), 'different letters are not a mark conflict');
  assert(!marksConflict(rasulu, ''), 'empty spoken is not a conflict');

  /* capability signal: is vowel checking possible on this device at all? */
  assert(spokenHasMarks(rasula), 'spokenHasMarks sees a vocalised word');
  assert(!spokenHasMarks(bare), 'spokenHasMarks rejects bare consonants');
  assert(!spokenHasMarks('\u0642\u0644 \u0647\u0648 \u0627\u0644\u0644\u0647'), 'spokenHasMarks rejects a real unvocalised sentence');
  assert(spokenHasMarks('\u0642\u064F\u0644\u0652 \u0647\u064F\u0648\u064E \u0627\u0644\u0644\u0651\u064E\u0647\u064F'), 'spokenHasMarks sees a real vocalised sentence');

  /* the Stop path must score vowels too — it used to call align() with no marks */
  ok(align([rasulu], [rasula], [rasulu], [rasula]).states, ['wrong'], 'stop path passes marks through align');

}

