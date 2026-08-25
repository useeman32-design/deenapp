import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MOCK_QUIZ } from '@/api/mocks';
import { useTheme } from '@/context/ThemeContext';
import { TopBar } from '@/components/TopBar';

export default function Quiz() {
  const { theme } = useTheme();
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = MOCK_QUIZ[i];

  const pick = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === q.answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (i + 1 >= MOCK_QUIZ.length) {
      setDone(true);
      return;
    }
    setI(i + 1);
    setSelected(null);
  };

  const restart = () => {
    setI(0);
    setSelected(null);
    setScore(0);
    setDone(false);
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <TopBar title="Quiz" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 56 }}>🏆</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: theme.text, marginTop: 12 }}>
            {score} / {MOCK_QUIZ.length}
          </Text>
          <Text style={{ color: theme.subtext, marginTop: 8, textAlign: 'center', fontSize: 13.5 }}>
            {score >= 8
              ? 'Excellent! May Allah increase your knowledge.'
              : score >= 5
                ? 'MashaAllah, good work!'
                : 'Keep learning — try again!'}
          </Text>
          <Pressable
            onPress={restart}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 14,
              paddingHorizontal: 26,
              paddingVertical: 13,
              marginTop: 26,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>Play again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Deen Quiz" subtitle={`Question ${i + 1} of ${MOCK_QUIZ.length}`} />
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18.5, fontWeight: '800', color: theme.text, lineHeight: 27, marginBottom: 18 }}>
          {q.question}
        </Text>
        {q.options.map((opt, idx) => {
          const isAnswer = idx === q.answer;
          const isPicked = selected === idx;
          let bg = theme.card;
          let color = theme.text;
          let border = theme.border;
          if (selected !== null && isAnswer) {
            bg = theme.primarySoft;
            color = theme.primary;
            border = theme.primary;
          } else if (isPicked && !isAnswer) {
            bg = 'rgba(214,69,69,0.10)';
            color = theme.danger;
            border = theme.danger;
          }
          return (
            <Pressable
              key={opt}
              onPress={() => pick(idx)}
              style={{
                backgroundColor: bg,
                borderWidth: 1,
                borderColor: border,
                borderRadius: 14,
                padding: 15,
                marginBottom: 10,
              }}
            >
              <Text style={{ color, fontWeight: '600', fontSize: 14 }}>{opt}</Text>
            </Pressable>
          );
        })}
        {selected !== null ? (
          <Pressable
            onPress={next}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 14,
              padding: 14,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>
              {i + 1 >= MOCK_QUIZ.length ? 'See results' : 'Next question'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
