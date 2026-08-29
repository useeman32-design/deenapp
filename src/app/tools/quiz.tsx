import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QUIZ_POOL, type QuizQ } from '@/data/quiz';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

const CATS = ['All', 'Quran', 'Hadith', 'Fiqh', 'Seerah', 'Aqidah'] as const;

/** Islamic Quiz (pass 16) — dash design, category chips, progress, streak + results. */
export default function Quiz() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [done, setDone] = useState(false);

  const pool = useMemo<QuizQ[]>(() => (cat === 'All' ? QUIZ_POOL : QUIZ_POOL.filter((q) => q.category === cat)), [cat]);
  const q = pool[i];

  const restart = (c: (typeof CATS)[number] = cat) => {
    setCat(c);
    setI(0);
    setSelected(null);
    setScore(0);
    setStreak(0);
    setDone(false);
  };

  const pick = (idx: number) => {
    if (selected !== null || !q) return;
    haptic.light();
    setSelected(idx);
    if (idx === q.answer) {
      setScore((s) => s + 1);
      setStreak((s) => {
        const n = s + 1;
        setBest((b) => Math.max(b, n));
        return n;
      });
    } else setStreak(0);
  };

  const next = () => {
    haptic.selection();
    if (i + 1 >= pool.length) setDone(true);
    else {
      setI(i + 1);
      setSelected(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => restart('All')} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>
              Islamic Quiz
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              {pool.length} questions across the deen
            </T>
          </View>
          <View style={{ borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 6 }}>
            <T v="caption" style={{ color: d.subtext, fontWeight: '800', fontSize: 10.5, letterSpacing: 0.6 }}>
              STREAK {streak}
            </T>
          </View>
        </View>
      </View>

      {/* category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        {CATS.map((c) => {
          const on = cat === c;
          return (
            <Pressable
              key={c}
              onPress={() => restart(c)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder,
                backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(29,111,66,0.08)') : d.card,
              }}
            >
              <T v="caption" style={{ color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext, fontWeight: '800', fontSize: 11 }}>
                {c}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {done || !q ? (
          /* results */
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 22, alignItems: 'center' }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, borderColor: isDark ? 'rgba(74,227,143,0.45)' : 'rgba(29,111,66,0.35)', backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
              <T v="stat" style={{ fontSize: 24, fontWeight: '800', color: d.text }}>
                {pool.length ? Math.round((score / pool.length) * 100) : 0}%
              </T>
              <T v="caption" style={{ fontSize: 8.5, color: d.faint, fontWeight: '700', letterSpacing: 0.8, marginTop: 1 }}>
                SCORE
              </T>
            </View>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20, marginTop: 14 }}>
              {score} / {pool.length}
            </T>
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, marginTop: 4, textAlign: 'center' }}>
              {score === pool.length ? 'Perfect — MashaAllah.' : score >= pool.length * 0.7 ? 'Well done. Review the misses and go again.' : 'Review the material and try again.'}
            </T>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' }}>
              <View style={{ flex: 1, borderRadius: 13, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder, paddingVertical: 10, alignItems: 'center' }}>
                <T v="stat" style={{ color: d.text, fontWeight: '800', fontSize: 15 }}>
                  {best}
                </T>
                <T v="caption" style={{ color: d.faint, fontSize: 9, fontWeight: '700' }}>
                  BEST STREAK
                </T>
              </View>
              <View style={{ flex: 1, borderRadius: 13, backgroundColor: d.bgSoft, borderWidth: 1, borderColor: d.cardBorder, paddingVertical: 10, alignItems: 'center' }}>
                <T v="stat" style={{ color: d.text, fontWeight: '800', fontSize: 15 }}>
                  {pool.length ? Math.round((score / pool.length) * 100) : 0}%
                </T>
                <T v="caption" style={{ color: d.faint, fontSize: 9, fontWeight: '700' }}>
                  SCORE
                </T>
              </View>
            </View>
            <Pressable onPress={() => restart()} style={{ marginTop: 16, alignSelf: 'stretch', alignItems: 'center', paddingVertical: 12, borderRadius: 13, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}>
              <T v="body" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                Play again
              </T>
            </Pressable>
          </View>
        ) : (
          <View>
            {/* progress */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <T v="caption" style={{ color: d.faint, fontWeight: '800', fontSize: 10.5 }}>
                {i + 1} / {pool.length}
              </T>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', overflow: 'hidden' }}>
                <View style={{ width: `${((i + (selected != null ? 1 : 0)) / pool.length) * 100}%`, height: 5, borderRadius: 3, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
              </View>
              <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 10.5 }}>
                {q.category.toUpperCase()}
              </T>
            </View>

            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 16 }}>
              <T v="body" style={{ color: d.text, fontWeight: '600', fontSize: 16, lineHeight: 24 }}>
                {q.question}
              </T>
              {q.options.map((opt, idx) => {
                const isRight = selected != null && idx === q.answer;
                const isWrong = selected === idx && idx !== q.answer;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => pick(idx)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      marginTop: 10,
                      padding: 13,
                      borderRadius: 13,
                      borderWidth: 1,
                      borderColor: isRight ? 'rgba(74,227,143,0.6)' : isWrong ? 'rgba(255,123,123,0.6)' : d.cardBorder,
                      backgroundColor: isRight ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)') : isWrong ? 'rgba(255,123,123,0.1)' : d.bgSoft,
                    }}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: isRight ? 'rgba(74,227,143,0.6)' : isWrong ? 'rgba(255,123,123,0.6)' : d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                      <T v="caption" style={{ color: d.subtext, fontWeight: '800', fontSize: 10.5 }}>
                        {String.fromCharCode(65 + idx)}
                      </T>
                    </View>
                    <T v="body" style={{ flex: 1, color: d.text, fontSize: 13 }}>
                      {opt}
                    </T>
                    {isRight ? <FontAwesome5 name="check" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
                    {isWrong ? <FontAwesome5 name="times" size={12} color="#FF7B7B" /> : null}
                  </Pressable>
                );
              })}
            </View>

            {selected != null && q.explanation ? (
              <View style={{ marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12 }}>
                <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10, letterSpacing: 0.5 }}>
                  WHY
                </T>
                <T v="caption" style={{ color: d.subtext, fontSize: 11.5, lineHeight: 16, marginTop: 4 }}>
                  {q.explanation}
                </T>
              </View>
            ) : null}

            {selected != null ? (
              <Pressable onPress={next} style={{ marginTop: 14, alignItems: 'center', paddingVertical: 13, borderRadius: 13, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <T v="body" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                  {i + 1 >= pool.length ? 'See results' : 'Next question'}
                </T>
                <FontAwesome5 name="arrow-right" size={11} color="rgba(255,255,255,0.85)" />
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
