import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Circle } from 'react-native-svg';
import { QUIZ_POOL, type QuizQ } from '@/data/quiz';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

const CATS = ['All', 'Quran', 'Hadith', 'Fiqh', 'Seerah', 'Aqidah'] as const;
const COUNTS = [5, 10, 20, 0] as const; // 0 = all
const SECONDS = 20;

type Phase = 'setup' | 'play' | 'results';
type Answered = { q: QuizQ; picked: number | null; correct: boolean; timedOut: boolean };

/**
 * Islamic Quiz (pass 20 redesign) — modern setup → timed play → results:
 *  · pick category + number of questions
 *  · 20s countdown ring per question (timeout = wrong, auto-advance)
 *  · results: score ring, category strengths/weaknesses, full review with
 *    correct answers + explanations
 */
export default function Quiz() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('setup');
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const [count, setCount] = useState<number>(10);
  const [deck, setDeck] = useState<QuizQ[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [left, setLeft] = useState(SECONDS);
  const [best, setBest] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lock = useRef(false);

  const pool = useMemo<QuizQ[]>(() => (cat === 'All' ? QUIZ_POOL : QUIZ_POOL.filter((q) => q.category === cat)), [cat]);

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => clearTimer, []);

  const start = (c: (typeof CATS)[number] = cat, n = count) => {
    const p = c === 'All' ? QUIZ_POOL : QUIZ_POOL.filter((q) => q.category === c);
    const shuffled = [...p].sort(() => Math.random() - 0.5).slice(0, n === 0 ? p.length : Math.min(n, p.length));
    clearTimer();
    setDeck(shuffled);
    setI(0);
    setPicked(null);
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

  const submit = (choice: number | null, timedOut = false) => {
    if (lock.current || !q) return;
    lock.current = true;
    clearTimer();
    setPicked(choice); // neutral selection only — no reveal until the end
    setAnswers((a) => [...a, { q, picked: choice, correct: choice === q.answer, timedOut }]);
    haptic.selection();
    setTimeout(() => next(), 420); // glide to the next question
  };

  const next = () => {
    if (i + 1 >= deck.length) {
      const score = answers.filter((a) => a.correct).length;
      setBest((b) => Math.max(b, score));
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

          <View style={{ gap: 10 }}>
            {q.options.map((opt, idx) => {
              const chosen = picked === idx;
              return (
                <Pressable
                  key={idx}
                  disabled={picked != null}
                  onPress={() => submit(idx)}
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


        </ScrollView>
      </View>
    );
  }

  /* ---------------- results ---------------- */
  const score = answers.filter((a) => a.correct).length;
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
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* score ring */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
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
              <T v="caption" style={{ fontSize: 11, color: '#4AE38F', marginBottom: 3 }}>✓ {a.q.options[a.q.answer]}</T>
              {!a.correct && a.picked != null ? <T v="caption" style={{ fontSize: 11, color: '#FF7B7B', marginBottom: 3 }}>✗ You: {a.q.options[a.picked]}</T> : null}
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
