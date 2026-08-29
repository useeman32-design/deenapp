import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { NAMES_99 } from '@/data/names99';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';

export default function Names() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const sorted = [...NAMES_99].sort((a, b) => a.transliteration.localeCompare(b.transliteration));
    const query = q.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter(
      (n) =>
        n.transliteration.toLowerCase().includes(query) ||
        n.meaning.toLowerCase().includes(query) ||
        n.arabic.includes(q.trim()),
    );
  }, [q]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar title="99 Names of Allah" subtitle={`${list.length} of ${NAMES_99.length} names`} />
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by name or meaning…"
          placeholderTextColor={theme.subtext}
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: theme.text,
            fontSize: 16 /*14.5*/,
          }}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {list.map((n) => (
          <Card key={n.transliteration} style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14.5, fontFamily: 'Poppins-SemiBold' }}>{n.transliteration}</Text>
              <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 2, fontFamily: 'Poppins' }}>{n.translation}</Text>
            </View>
            <Text style={{ fontFamily: 'Amiri', color: theme.primary, fontSize: 23, marginLeft: 10 }}>{n.arabic}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
