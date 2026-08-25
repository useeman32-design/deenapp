import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { JUZ_NAMES, JUZ_START, OFFLINE_TEXT, QURAN, juzOfSurah } from '@/data/quran';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { ArchCard } from '@/components/ArchCard';
import { ProgressRing } from '@/components/ProgressRing';
import { TopBar } from '@/components/TopBar';
import { BookIcon, FilterIcon, SearchIcon } from '@/components/Icons';

type LastRead = { surah: number };

export default function QuranList() {
  const { theme } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [last, setLast] = useState<LastRead | null>(null);

  useEffect(() => {
    storage.getItem('dl.quran.last').then((raw) => {
      if (raw) {
        try {
          setLast(JSON.parse(raw));
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const openSurah = (number: number) => {
    storage.setItem('dl.quran.last', JSON.stringify({ surah: number } satisfies LastRead));
    router.push(`/(tabs)/quran/${number}`);
  };

  const currentJuz = last ? juzOfSurah(last.surah) : 12;
  const lastMeta = QURAN.find((s) => s.number === (last?.surah ?? 0));
  const progress = 0.6; // mock — will come from your /reading-progress endpoint

  const query = q.trim().toLowerCase();
  const list = QURAN.filter(
    (s) => !query || s.english.toLowerCase().includes(query) || String(s.number) === query,
  );

  const juzChips = [currentJuz - 1, currentJuz, currentJuz + 1].filter((j) => j >= 1 && j <= 30);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar
        title="Quran"
        right={
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <SearchIcon size={20} color={theme.subtext} />
            <FilterIcon size={18} color={theme.subtext} />
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        {/* Reading progress */}
        <ArchCard archHeight={48} strokeColor={theme.accent} strokeWidth={1.2}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.subtext, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>
                READING PROGRESS
              </Text>
              <Text style={{ color: theme.heading, fontSize: 18, fontWeight: '800', marginTop: 6 }}>
                Juz {currentJuz}
              </Text>
              <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 2 }}>{JUZ_NAMES[currentJuz - 1]}</Text>
            </View>
            <ProgressRing size={60} stroke={5.5} progress={progress} color={theme.primary} trackColor={theme.border}>
              <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '800' }}>60%</Text>
            </ProgressRing>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Pressable
              onPress={() => openSurah(last?.surah ?? 1)}
              style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>Continue Reading</Text>
            </Pressable>
            <Pressable
              onPress={() => openSurah(JUZ_START[currentJuz - 1])}
              style={{ flex: 1, borderWidth: 1.2, borderColor: theme.primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}
            >
              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12.5 }}>Go to Juz</Text>
            </Pressable>
          </View>
          <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 10 }}>
            Last read: {lastMeta ? lastMeta.english : '—'}
          </Text>
        </ArchCard>

        {/* Recents */}
        <Text style={{ color: theme.heading, fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 10 }}>
          Recents
        </Text>
        {[18, 36].map((n) => {
          const s = QURAN.find((x) => x.number === n)!;
          return (
            <Pressable
              key={n}
              onPress={() => openSurah(n)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 12,
                  marginBottom: 8,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <BookIcon size={19} color={theme.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13.5 }}>Surah {s.english}</Text>
                <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 2 }}>Last read: Verse 12</Text>
              </View>
              <Text style={{ color: theme.primary, fontSize: 19 }}>{s.name}</Text>
            </Pressable>
          );
        })}

        {/* Juz index */}
        <Text style={{ color: theme.heading, fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 10 }}>
          Juz Index
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {juzChips.map((j) => (
            <Pressable
              key={j}
              onPress={() => openSurah(JUZ_START[j - 1])}
              style={{
                flex: 1,
                borderRadius: 13,
                paddingVertical: 11,
                alignItems: 'center',
                backgroundColor: j === currentJuz ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: j === currentJuz ? theme.primary : theme.border,
              }}
            >
              <Text style={{ color: j === currentJuz ? '#fff' : theme.text, fontWeight: '800', fontSize: 12.5 }}>
                Juz {j}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* All surahs */}
        <Text style={{ color: theme.heading, fontSize: 15, fontWeight: '800', marginTop: 22, marginBottom: 10 }}>
          Surahs
        </Text>
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
            fontSize: 14,
            marginBottom: 12,
          }}
        />
        {list.map((s) => (
          <Pressable
            key={s.number}
            onPress={() => openSurah(s.number)}
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
              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 13.5 }}>{s.number}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{s.english}</Text>
              <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 2 }}>
                {s.ayahs} verses · {s.revelation}
                {OFFLINE_TEXT[s.number] ? ' · offline' : ''}
              </Text>
            </View>
            <Text style={{ color: theme.primary, fontSize: 20 }}>{s.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
