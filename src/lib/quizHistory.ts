import { storage } from '@/lib/storage';

/**
 * Quiz history (pass 32) — every finished quiz is recorded and shown on the
 * setup screen so learners can track their progress over time.
 */
export type QuizAttempt = { at: number; cat: string; score: number; total: number; pct: number };
const KEY = 'dl.quiz.history.v1';

export async function recordQuiz(a: Omit<QuizAttempt, 'at'>): Promise<void> {
  try {
    const all = await listQuizzes();
    const next = [{ ...a, at: Date.now() }, ...all].slice(0, 50);
    await storage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export async function listQuizzes(): Promise<QuizAttempt[]> {
  try {
    const raw = await storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QuizAttempt[]) : [];
  } catch {
    return [];
  }
}

export const agoOf = (t: number): string => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
