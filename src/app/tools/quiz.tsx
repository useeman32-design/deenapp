import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScoreShareSheet, type ScoreCard } from '@/components/ScoreShareSheet';
import { ShareWithFriends } from '@/components/ShareWithFriends';
import { CrescentLoader } from '@/components/CrescentLoader';
import { BackButton } from '@/components/BackButton';
import { addUserPost } from '@/lib/userPosts';
import { recordQuiz, listQuizzes, agoOf, type QuizAttempt } from '@/lib/quizHistory';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Circle } from 'react-native-svg';
import { QUIZ_POOL, QUIZ_POOL_EXTRA, type QuizQ } from '@/data/quiz';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

const CATS = ['All', 'Quran', 'Hadith', 'Fiqh', 'Seerah', 'Aqidah'] as const;
const COUNTS = [5, 10, 20, 0] as const; // 0 = all
const SECONDS = 20;

type Phase = 'setup' | 'play' | 'results';
type Answered = { q: QuizQ; picked: number | null; pickedMulti?: number[]; correct: boolean; timedOut: boolean };
const correctOf = (q: QuizQ, picked: number | null, multi: number[] | undefined) =>
  q.answers ? !!multi && multi.length === q.answers.length && q.answers.every((x) => multi.includes(x)) : picked === q.answer;

/**
 * Islamic Quiz (pass 20 redesign) — modern setup → timed play → results:
 *  · pick category + number of questions
 *  · 20s countdown ring per question (timeout = wrong, auto-advance)
 *  · results: score ring, category strengths/weaknesses, full review with
 *    correct answers + explanations
 */
export default function Quiz() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('setup');
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  /* quiz history (setup screen) */
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  useEffect(() => { listQuizzes().then(setHistory).catch(() => {}); }, []);
  /* score sharing (results phase) */
  /* pass 38 — square generated-art score card (5 shuffling SVG designs) */
  const [scoreCard, setScoreCard] = useState<ScoreCard | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [count, setCount] = useState<number>(10);
  const [deck, setDeck] = useState<QuizQ[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [multi, setMulti] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [left, setLeft] = useState(SECONDS);
  const [best, setBest] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lock = useRef(false);

  const FULL = useMemo(() => [...QUIZ_POOL, ...QUIZ_POOL_EXTRA], []);
  const pool = useMemo<QuizQ[]>(() => (cat === 'All' ? FULL : FULL.filter((q) => q.category === cat)), [cat, FULL]);

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => clearTimer, []);

  const start = (c: (typeof CATS)[number] = cat, n = count) => {
    const p = c === 'All' ? FULL : FULL.filter((q) => q.category === c);
    const shuffled = [...p].sort(() => Math.random() - 0.5).slice(0, n === 0 ? p.length : Math.min(n, p.length));
    clearTimer();
    setDeck(shuffled);
    setI(0);
    setPicked(null);
    setMulti([]);
    setAnswers([]);
    setPhase('play');
    armTimer();
  };

  const armTimer = () => {
    setLeft(SECONDS);
    lock.current = false;
    clearTimer();
    timer.current = setInterval(() => {
      setLeft((t) => {
        if (t <= 1) {
          clearTimer();
          if (!lock.current) submit(null, true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const q = deck[i];

  const submit = (choice: number | null, timedOut = false, multiPick?: number[]) => {
    if (lock.current || !q) return;
    lock.current = true;
    clearTimer();
    setPicked(choice); // neutral selection only — no reveal until the end
    setAnswers((a) => [...a, { q, picked: choice, pickedMulti: multiPick, correct: correctOf(q, choice, multiPick), timedOut }]);
    haptic.selection();
    setTimeout(() => next(), 420); // glide to the next question
  };

  const next = () => {
    setMulti([]);
    if (i + 1 >= deck.length) {
      const score = answers.filter((a) => a.correct).length;
      setBest((b) => Math.max(b, score));
      void recordQuiz({ cat, score, total: deck.length, pct: deck.length ? Math.round((score / deck.length) * 100) : 0 });
      setPhase('results');
      return;
    }
    setI((x) => x + 1);
    setPicked(null);
    armTimer();
  };

  /* ---------------- setup ---------------- */
  if (phase === 'setup') {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <View style={{ paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BackButton />
            <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: isDark ? 'rgba(212,175,55,0.14)' : 'rgba(212,175,55,0.1)', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="brain" size={18} color="#E8C96A" />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h2" style={{ fontWeight: '800', fontSize: 21 }}>Islamic Quiz</T>
              <T v="caption" style={{ fontSize: 11, marginTop: 1 }}>{QUIZ_POOL.length} questions · {CATS.length - 1} categories · {SECONDS}s each</T>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.7, marginBottom: 10 }}>CATEGORY</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
            {CATS.map((c) => {
              const on = cat === c;
              const n = c === 'All' ? QUIZ_POOL.length : QUIZ_POOL.filter((x) => x.category === c).length;
              return (
                <Pressable
                  key={c}
                  onPress={() => { haptic.selection(); setCat(c); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: on ? (isDark ? 'rgba(74,227,143,0.55)' : 'rgba(29,111,66,0.45)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.07)') : d.card, paddingHorizontal: 13, paddingVertical: 9 }}
                >
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.text }}>{c}</T>
                  <View style={{ borderRadius: 7, backgroundColor: on ? 'rgba(74,227,143,0.2)' : d.bgSoft, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint }}>{n}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.7, marginBottom: 10 }}>QUESTIONS</T>
          <View style={{ flexDirection: 'row', gap: 9, marginBottom: 26 }}>
            {COUNTS.map((cn) => {
              const on = count === cn;
              const label = cn === 0 ? 'All' : String(cn);
              const disabled = cn !== 0 && cn > pool.length;
              return (
                <Pressable
                  key={cn}
                  disabled={disabled}
                  onPress={() => { haptic.selection(); setCount(cn); }}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: on ? (isDark ? 'rgba(74,227,143,0.55)' : 'rgba(29,111,66,0.45)') : disabled ? d.cardBorder : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.07)') : d.card, opacity: disabled ? 0.4 : 1 }}
                >
                  <T v="h3" style={{ fontWeight: '800', fontSize: 17, color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.text }}>{label}</T>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => start()}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 16, paddingVertical: 15, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1, shadowColor: '#1D6F42', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 })}
          >
            <FontAwesome5 name="bolt" size={14} color="#FFFFFF" />
            <T v="button" style={{ fontWeight: '800', fontSize: 14 }}>Start quiz</T>
          </Pressable>

          {/* pass 32: quiz history — every finished attempt, newest first */}
          {history.length ? (
            <View style={{ marginTop: 18 }}>
              <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.7, marginBottom: 8 }}>RECENT QUIZZES</T>
              <View style={{ gap: 8 }}>
                {history.slice(0, 5).map((h, k) => (
                  <View key={h.at} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: h.pct >= 70 ? 'rgba(74,227,143,0.4)' : h.pct >= 40 ? 'rgba(212,175,55,0.4)' : 'rgba(255,123,123,0.35)', backgroundColor: d.card, padding: 12 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: h.pct >= 70 ? 'rgba(74,227,143,0.5)' : h.pct >= 40 ? 'rgba(212,175,55,0.5)' : 'rgba(255,123,123,0.45)' }}>
                      <T v="caption" style={{ fontSize: 10, fontWeight: '900', color: h.pct >= 70 ? '#4AE38F' : h.pct >= 40 ? '#B8870B' : '#FF7B7B' }}>{h.pct}%</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyS" style={{ fontWeight: '700', fontSize: 12.5 }}>{h.cat} quiz</T>
                      <T v="caption" style={{ fontSize: 10, marginTop: 1 }}>{h.score}/{h.total} correct · {agoOf(h.at)}</T>
                    </View>
                    <FontAwesome5 name={h.pct >= 70 ? 'check-circle' : 'redo'} size={13} color={h.pct >= 70 ? '#4AE38F' : d.faint} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {best > 0 ? (
            <T v="caption" style={{ textAlign: 'center', marginTop: 14, color: d.faint }}>Best score this session: {best}/{deck.length || count}</T>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  /* ---------------- play ---------------- */
  if (phase === 'play' && q) {
    const R = 17;
    const C = 2 * Math.PI * R;
    return (
      <View style={{ flex: 1, backgroundColor: d.bg }}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
          {/* progress dots + timer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => { clearTimer(); setPhase('setup'); }} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="times" size={13} color={d.subtext} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
              {deck.map((_, k) => (
                <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k < i ? (isDark ? '#4AE38F' : '#1D6F42') : k === i ? 'rgba(74,227,143,0.45)' : d.bgSoft }} />
              ))}
            </View>
            {/* countdown ring */}
            <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
              <Svg style={{ position: 'absolute' }} width={42} height={42}>
                <Circle cx={21} cy={21} r={R} fill="none" stroke={d.bgSoft} strokeWidth={3.5} />
                <Circle cx={21} cy={21} r={R} fill="none" stroke={left <= 5 ? '#FF7B7B' : isDark ? '#4AE38F' : '#1D6F42'} strokeWidth={3.5} strokeDasharray={C} strokeDashoffset={C * (1 - left / SECONDS)} strokeLinecap="round" transform="rotate(-90 21 21)" />
              </Svg>
              <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: left <= 5 ? '#FF7B7B' : d.text }}>{left}</T>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.8, color: isDark ? '#E8C96A' : '#8C6D1F', marginBottom: 9 }}>
            QUESTION {i + 1} OF {deck.length} · {q.category.toUpperCase()}
          </T>
          <T v="h3" style={{ fontWeight: '800', fontSize: 17, lineHeight: 25, marginBottom: 20 }}>{q.question}</T>

          {q.answers && q.answers.length > 1 ? (
            <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: '#5EA7C9', marginBottom: 10 }}>
              PICK {q.answers.length} ANSWERS
            </T>
          ) : null}
          <View style={{ gap: 10 }}>
            {q.options.map((opt, idx) => {
              const isMulti = !!q.answers && q.answers.length > 1;
              const chosen = isMulti ? multi.includes(idx) : picked === idx;
              const full = isMulti && multi.length >= (q.answers?.length ?? 1) && !chosen;
              return (
                <Pressable
                  key={idx}
                  disabled={picked != null || full}
                  onPress={() => {
                    if (isMulti) {
                      haptic.selection();
                      setMulti((m) => (m.includes(idx) ? m.filter((x) => x !== idx) : m.length >= (q.answers?.length ?? 1) ? m : [...m, idx]));
                    } else submit(idx);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15,
                    borderWidth: 1.5,
                    borderColor: chosen ? (isDark ? 'rgba(74,227,143,0.7)' : 'rgba(29,111,66,0.6)') : d.cardBorder,
                    backgroundColor: chosen ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : d.card,
                    paddingHorizontal: 14, paddingVertical: 13, opacity: picked == null && pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ width: 30, height: 30, borderRadius: 10, borderWidth: 1.5, borderColor: chosen ? (isDark ? '#4AE38F' : '#1D6F42') : d.cardBorder, backgroundColor: chosen ? 'rgba(46,204,113,0.18)' : d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: chosen ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{String.fromCharCode(65 + idx)}</T>
                  </View>
                  <T v="bodyS" style={{ flex: 1, fontSize: 13.5, lineHeight: 19 }}>{opt}</T>
                </Pressable>
              );
            })}
          </View>

          {q.answers && q.answers.length > 1 ? (
            <Pressable
              disabled={picked != null || multi.length < q.answers.length}
              onPress={() => submit(null, false, [...multi].sort((a, b) => a - b))}
              style={({ pressed }) => ({ marginTop: 16, borderRadius: 15, paddingVertical: 13, alignItems: 'center', backgroundColor: multi.length === q.answers?.length ? (isDark ? '#1F8F5C' : '#1D6F42') : d.bgSoft, opacity: pressed ? 0.85 : 1 })}
            >
              <T v="button" style={{ fontWeight: '800', fontSize: 13, color: multi.length === q.answers?.length ? '#FFFFFF' : d.faint }}>
                Confirm {multi.length}/{q.answers.length}
              </T>
            </Pressable>
          ) : null}

        </ScrollView>
      </View>
    );
  }

  /* ---------------- results ---------------- */
  const score = answers.filter((a) => a.correct).length;
  const allCorrect = answers.length > 0 && score === answers.length;
  const pct = answers.length ? Math.round((score / answers.length) * 100) : 0;
  const R2 = 62;
  const C2 = 2 * Math.PI * R2;
  const byCat = new Map<string, { right: number; total: number }>();
  answers.forEach((a) => {
    const e = byCat.get(a.q.category) ?? { right: 0, total: 0 };
    e.total += 1;
    if (a.correct) e.right += 1;
    byCat.set(a.q.category, e);
  });

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingLeft: 14, flexDirection: 'row' }}>
        <BackButton />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* pass 41 — inspiration BEFORE the score (user request) */}
        {(() => {
          const INSPI = pct >= 70
            ? { ar: 'يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ', en: 'Allah will raise those who have believed among you and those who were given knowledge, by degrees.', ref: 'Qur’an 58:11' }
            : pct >= 40
              ? { ar: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ', en: 'Whoever travels a path seeking knowledge, Allah will make easy for him a path to Paradise.', ref: 'Muslim 2699' }
              : { ar: 'رَّبِّ زِدْنِي عِلْمًا', en: 'My Lord, increase me in knowledge.', ref: 'Qur’an 20:114' };
          return (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.05)', padding: 14, marginBottom: 16 }}>
              <T v="bodyS" style={{ fontFamily: 'Amiri-Bold', fontSize: 19, lineHeight: 34, color: d.text, textAlign: 'right' }}>{INSPI.ar}</T>
              <T v="caption" style={{ fontSize: 11, color: d.subtext, lineHeight: 16.5, marginTop: 8, fontStyle: 'italic' }}>{INSPI.en}</T>
              <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#E8C96A', marginTop: 7 }}>— {INSPI.ref}</T>
            </View>
          );
        })()}
        {/* trophy — always shown on results; confetti when ALL correct */}
        <Confetti fire={allCorrect} />
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 22,
              borderWidth: 1.5,
              borderColor: allCorrect ? 'rgba(212,175,55,0.75)' : pct >= 70 ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.35)',
              backgroundColor: allCorrect ? 'rgba(212,175,55,0.14)' : 'rgba(46,204,113,0.10)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              shadowColor: allCorrect ? '#D4AF37' : '#1F8F5C',
              shadowOpacity: allCorrect ? 0.55 : 0.3,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 10,
            }}
          >
            <FontAwesome5 name="trophy" size={30} color={allCorrect ? '#E8C96A' : pct >= 70 ? '#4AE38F' : isDark ? '#4AE38F' : '#1D6F42'} />
          </View>
          <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
            <Svg style={{ position: 'absolute' }} width={150} height={150}>
              <Circle cx={75} cy={75} r={R2} fill="none" stroke={d.bgSoft} strokeWidth={10} />
              <Circle cx={75} cy={75} r={R2} fill="none" stroke={pct >= 70 ? '#4AE38F' : pct >= 40 ? '#E8C96A' : '#FF7B7B'} strokeWidth={10} strokeDasharray={C2} strokeDashoffset={C2 * (1 - pct / 100)} strokeLinecap="round" transform="rotate(-90 75 75)" />
            </Svg>
            <T v="display" style={{ fontWeight: '800', fontSize: 34 }}>{pct}%</T>
            <T v="caption" style={{ fontSize: 10.5, marginTop: 2 }}>{score} of {answers.length} correct</T>
          </View>
          <T v="h3" style={{ fontWeight: '800', fontSize: 17, marginTop: 6 }}>
            {pct >= 90 ? 'Mashallah — outstanding! 🏆' : pct >= 70 ? 'Great work — keep going!' : pct >= 40 ? 'Good effort — review and retry.' : 'Keep learning — you’ll get there.'}
          </T>
        </View>

        {/* category strengths */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.7, marginBottom: 9 }}>YOUR PERFORMANCE</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
          {[...byCat.entries()].map(([c, e]) => {
            const p = Math.round((e.right / e.total) * 100);
            const good = p >= 70;
            return (
              <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: good ? 'rgba(74,227,143,0.45)' : p >= 40 ? 'rgba(212,175,55,0.45)' : 'rgba(255,123,123,0.4)', backgroundColor: good ? 'rgba(46,204,113,0.1)' : p >= 40 ? 'rgba(212,175,55,0.08)' : 'rgba(255,123,123,0.08)', paddingHorizontal: 11, paddingVertical: 8 }}>
                <FontAwesome5 name={good ? 'check-circle' : p >= 40 ? 'minus-circle' : 'times-circle'} size={12} color={good ? '#4AE38F' : p >= 40 ? '#E8C96A' : '#FF7B7B'} />
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 12 }}>{c}</T>
                <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>{e.right}/{e.total}</T>
              </View>
            );
          })}
        </View>

        {/* pass 32: share the score — as a community post, to friends, or as
         * a saved image card (the watermark lives in the image, not the label) */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.7, marginBottom: 9 }}>SHARE YOUR SCORE</T>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22 }}>
          {[
            { icon: 'edit', label: 'As post', tint: '#4AE38F', act: async () => { setShareBusy(true); await addUserPost(`I scored ${score}/${answers.length} (${pct}%) on the DeenLink Islamic Quiz${cat !== 'All' ? ` — ${cat}` : ''}. Can you beat me? 🏆`, 'quiz'); await new Promise((r) => setTimeout(r, 650)); setShareBusy(false); setShareToast('Posted to your feed ✓'); } },
            { icon: 'paper-plane', label: 'To friends', tint: '#5BC8F5', act: async () => { setFriendsOpen(true); } },
            { icon: 'image', label: 'Save photo', tint: '#E8C96A', act: async () => { setScoreCard({ kind: 'quiz', metric: `${pct}%`, title: 'Islamic Quiz', subtitle: `${score} of ${answers.length} correct${cat !== 'All' ? ` · ${cat}` : ''}`, link: 'https://deenlink.org/tools/quiz' }); } },
          ].map((b) => (
            <Pressable key={b.label} onPress={() => { haptic.light(); b.act(); }} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: `${b.tint}55`, backgroundColor: `${b.tint}14`, opacity: pressed ? 0.8 : 1 })}>
              {shareBusy ? <CrescentLoader size={22} /> : <FontAwesome5 name={b.icon as never} size={13} color={b.tint} />}
              <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: b.tint }}>{b.label}</T>
            </Pressable>
          ))}
        </View>
        {shareToast ? <T v="caption" style={{ fontSize: 10.5, color: '#4AE38F', marginBottom: 16, textAlign: 'center' }}>{shareToast}</T> : null}
        <ScoreShareSheet visible={!!scoreCard} onClose={() => setScoreCard(null)} card={scoreCard} />
        <ShareWithFriends visible={friendsOpen} onClose={() => setFriendsOpen(false)} onSent={() => setShareToast('Sent to your friends ✓')} title={`Islamic Quiz — I scored ${pct}% (${score}/${answers.length})${cat !== 'All' ? ` · ${cat}` : ''}`} preview="Can you beat me? · deenlink.org/tools/quiz" />

        {/* review */}
        <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, letterSpacing: 0.7, marginBottom: 9 }}>REVIEW ANSWERS</T>
        <View style={{ gap: 10 }}>
          {answers.map((a, k) => (
            <View key={k} style={{ borderRadius: 15, borderWidth: 1, borderColor: a.correct ? 'rgba(74,227,143,0.35)' : 'rgba(255,123,123,0.35)', backgroundColor: d.card, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <FontAwesome5 name={a.correct ? 'check-circle' : 'times-circle'} size={14} color={a.correct ? '#4AE38F' : '#FF7B7B'} />
                <T v="caption" style={{ fontWeight: '800', fontSize: 10, color: d.faint }}>Q{k + 1} · {a.q.category.toUpperCase()}{a.timedOut ? ' · TIMED OUT' : ''}</T>
              </View>
              <T v="bodyS" style={{ fontWeight: '700', fontSize: 12.5, lineHeight: 18, marginBottom: 7 }}>{a.q.question}</T>
              <T v="caption" style={{ fontSize: 11, color: '#4AE38F', marginBottom: 3 }}>
                ✓ {a.q.answers ? a.q.answers.map((x) => a.q.options[x]).join(' + ') : a.q.options[a.q.answer]}
              </T>
              {!a.correct && a.pickedMulti ? <T v="caption" style={{ fontSize: 11, color: '#FF7B7B', marginBottom: 3 }}>✗ You: {a.pickedMulti.map((x) => a.q.options[x]).join(' + ') || '—'}</T> : null}
              {!a.correct && !a.pickedMulti && a.picked != null ? <T v="caption" style={{ fontSize: 11, color: '#FF7B7B', marginBottom: 3 }}>✗ You: {a.q.options[a.picked]}</T> : null}
              {!a.correct && a.timedOut ? <T v="caption" style={{ fontSize: 11, color: '#FF7B7B', marginBottom: 3 }}>✗ Ran out of time</T> : null}
              {a.q.explanation ? <T v="caption" style={{ fontSize: 10.5, lineHeight: 15.5, color: d.faint, marginTop: 4 }}>{a.q.explanation}</T> : null}
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <Pressable onPress={() => start(cat, count)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 15, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', opacity: pressed ? 0.85 : 1 })}>
            <T v="button" style={{ fontWeight: '800', fontSize: 13.5 }}>Play again</T>
          </Pressable>
          <Pressable onPress={() => setPhase('setup')} style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 15, borderWidth: 1.5, borderColor: d.cardBorder, backgroundColor: d.card, opacity: pressed ? 0.8 : 1 })}>
            <T v="button" style={{ fontWeight: '800', fontSize: 13.5, color: d.text }}>Change setup</T>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}


/* Celebration confetti — fires only when the user nailed every question. */
function Confetti({ fire }: { fire: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        x: Math.random() * (Dimensions.get('window').width - 20),
        delay: Math.random() * 700,
        dur: 1700 + Math.random() * 1400,
        size: 6 + Math.random() * 7,
        color: ['#4AE38F', '#E8C96A', '#5BC8F5', '#F0A8C0', '#D4AF37'][i % 5],
        drift: (Math.random() - 0.5) * 90,
        round: Math.random() > 0.5,
      })),
    [],
  );
  const vals = useRef<Animated.Value[]>([]);
  if (vals.current.length === 0) vals.current = pieces.map(() => new Animated.Value(0));

  useEffect(() => {
    if (!fire) return;
    haptic.success();
    vals.current.forEach((v, i) => {
      Animated.sequence([
        Animated.delay(pieces[i].delay),
        Animated.timing(v, { toValue: 1, duration: pieces[i].dur, easing: Easing.in(Easing.poly(2)), useNativeDriver: false }),
      ]).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire]);

  if (!fire) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 90, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <Animated.View
          key={p.id}
          style={{
            position: 'absolute',
            top: -14,
            left: p.x,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            borderRadius: p.round ? p.size / 2 : 2,
            backgroundColor: p.color,
            opacity: vals.current[i].interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: vals.current[i].interpolate({ inputRange: [0, 1], outputRange: [0, Dimensions.get('window').height + 40] }) },
              { translateX: vals.current[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: vals.current[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.drift * 4}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
