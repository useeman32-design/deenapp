import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OFFLINE_TEXT, QURAN } from '@/data/quran';
import { useTheme } from '@/context/ThemeContext';
import { TopBar } from '@/components/TopBar';

export default function QuranList() {
  const { theme } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const list = QURAN.filter(
    (s) => !query || s.english.toLowerCase().includes(query) || String(s.number) === query,
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Holy Qur’an" subtitle="114 surahs" />
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search surah by name or number…"
          placeholderTextColor={theme.subtext}
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: theme.text,
            fontSize: 14.5,
          }}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
        {list.map((s) => (
          <Pressable
            key={s.number}
            onPress={() => router.push(`/(tabs)/quran/${s.number}`)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: theme.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 14 }}>{s.number}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14.5 }}>{s.english}</Text>
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>
                {s.ayahs} verses · {s.revelation}
                {OFFLINE_TEXT[s.number] ? ' · offline' : ''}
              </Text>
            </View>
            <Text style={{ color: theme.primary, fontSize: 21 }}>{s.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
