import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { DUA_CATEGORIES, DUAS } from '@/data/dua';
import { markGoal } from '@/lib/routine';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';

export default function Duas() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [cat, setCat] = useState<string>('All');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    markGoal('dua');
  }, []);
  const list = DUAS.filter((d) => cat === 'All' || d.category === cat);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar title="Duas" subtitle="From the Qur’an & Sunnah" />
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DUA_CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCat(c)}
              style={{
                paddingHorizontal: 13,
                paddingVertical: 8,
                borderRadius: 18,
                backgroundColor: cat === c ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: cat === c ? theme.primary : theme.border,
              }}
            >
              <Text
                style={{ color: cat === c ? '#fff' : theme.subtext, fontWeight: '600', fontSize: 12.5 }}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {list.map((d) => {
          const expanded = open === d.id;
          return (
            <Card key={d.id} onPress={() => setOpen(expanded ? null : d.id)} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{d.title}</Text>
                  <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 2 }}>
                    {d.category} · {d.source}
                  </Text>
                </View>
                <Text style={{ color: theme.subtext, fontSize: 16, marginLeft: 8 }}>
                  {expanded ? '−' : '+'}
                </Text>
              </View>
              {expanded ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontFamily: 'Amiri', fontSize: 23, color: theme.primary, textAlign: 'right', lineHeight: 36 }}>
                    {d.arabic}
                  </Text>
                  <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 10, fontStyle: 'italic', lineHeight: 18 }}>
                    {d.transliteration}
                  </Text>
                  <Text style={{ color: theme.text, fontSize: 13.5, marginTop: 10, lineHeight: 20 }}>
                    {d.translation}
                  </Text>
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
