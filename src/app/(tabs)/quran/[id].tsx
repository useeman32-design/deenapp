import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { OFFLINE_TEXT, QURAN, type Ayah } from '@/data/quran';
import { useTheme } from '@/context/ThemeContext';
import { TopBar } from '@/components/TopBar';

export default function SurahDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const n = Number(id);
  const meta = QURAN.find((s) => s.number === n);
  const { theme } = useTheme();
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    setAyahs(OFFLINE_TEXT[n] ?? null);
    setOnline(false);
    fetch(`https://api.alquran.cloud/surah/${n}/editions/quran-simple,en.asad`)
      .then((r) => r.json())
      .then((d: { data?: { name?: string; ayahs?: { numberInSurah: number; text: string }[] }[] }) => {
        if (!alive) return;
        const editions = Array.isArray(d?.data) ? d.data : [];
        const ar = editions[0]?.ayahs;
        const en = editions[1]?.ayahs;
        if (Array.isArray(ar) && ar.length > 0) {
          setAyahs(
            ar.map((a, i) => ({
              numberInSurah: a.numberInSurah,
              arabic: a.text,
              english: en?.[i]?.text ?? '',
            })),
          );
          setOnline(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [n]);

  if (!meta) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar
        showBack
        title={meta.english}
        subtitle={`${meta.name} · ${meta.ayahs} verses · ${meta.revelation}`}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ fontSize: 38, color: theme.primary }}>{meta.name}</Text>
          <Text style={{ color: theme.subtext, marginTop: 6, fontSize: 12 }}>
            {online ? 'Live from alquran.cloud' : OFFLINE_TEXT[n] ? 'Offline copy' : 'Waiting for connection…'}
          </Text>
        </View>

        {ayahs?.map((a) => (
          <View
            key={a.numberInSurah}
            style={{
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 16,
              padding: 14,
              marginBottom: 10,
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: theme.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'flex-end',
                marginBottom: 6,
              }}
            >
              <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800' }}>{a.numberInSurah}</Text>
            </View>
            <Text style={{ fontSize: 25, color: theme.text, textAlign: 'right', lineHeight: 42 }}>{a.arabic}</Text>
            {a.english ? (
              <Text style={{ color: theme.subtext, fontSize: 13.5, marginTop: 10, lineHeight: 20 }}>{a.english}</Text>
            ) : null}
          </View>
        ))}

        {!ayahs ? (
          <Text style={{ color: theme.subtext, textAlign: 'center', marginTop: 30, fontSize: 13 }}>
            Connect to the internet to read this surah.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
