import { align, isReciteRunCurrent, mergeFinal, type WordState } from '@/lib/reciteAlignment';

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
}

