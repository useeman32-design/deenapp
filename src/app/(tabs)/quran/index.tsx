import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { JUZ_NAMES, JUZ_START, OFFLINE_TEXT, QURAN, juzOfSurah, type SurahMeta } from '@/data/quran';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { ArchCard } from '@/components/ArchCard';
import { ProgressRing } from '@/components/ProgressRing';
import { Surface } from '@/components/Surface';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { BookIcon, ChevronRightIcon, FilterIcon, SearchIcon } from '@/components/Icons';

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
  const list = useMemo(
    () => QURAN.filter((s) => !query || s.english.toLowerCase().includes(query) || String(s.number) === query),
    [query],
  );

  const juzChips = [currentJuz - 1, currentJuz, currentJuz + 1].filter((j) => j >= 1 && j <= 30);

  const Row = ({ s }: { s: SurahMeta }) => (
    <Pressable
      onPress={() => openSurah(s.number)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 12,
        marginBottom: 9,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          backgroundColor: theme.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '45deg' }],
        }}
      >
        <T v="caption" color="primary" style={{ fontWeight: '800', transform: [{ rotate: '-45deg' }] }}>
          {s.number}
        </T>
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <T v="h3">{s.english}</T>
        <T v="caption" style={{ marginTop: 2 }}>
          {s.ayahs} verses · {s.revelation}
          {OFFLINE_TEXT[s.number] ? ' · offline' : ''}
        </T>
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <T v="arabic" style={{ fontSize: 18 }}>{s.name}</T>
        <ChevronRightIcon size={13} color={theme.subtext} />
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar
        title="Qur’an"
        right={
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <SearchIcon size={20} color={theme.subtext} />
            <FilterIcon size={17} color={theme.subtext} />
          </View>
        }
      />
      <FlatList
        data={list}
        keyExtractor={(s) => String(s.number)}
        renderItem={({ item }) => <Row s={item} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 34 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Search */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 14,
                marginBottom: 14,
              }}
            >
              <SearchIcon size={16} color={theme.subtext} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search surah by name or number…"
                placeholderTextColor={theme.subtext}
                style={{ flex: 1, fontFamily: 'Manrope', fontSize: 13.5, color: theme.text, paddingVertical: 12, paddingLeft: 10 }}
              />
            </View>

            {/* Reading progress */}
            <ArchCard archHeight={50} strokeColor={theme.accent} strokeWidth={1.2} padding={16}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <T v="meta" color="accent" uppercase style={{ letterSpacing: 1.2 }}>
                    Reading progress
                  </T>
                  <T v="h1" style={{ marginTop: 6 }}>
                    Juz {currentJuz}
                  </T>
                  <T v="caption" style={{ marginTop: 2 }}>{JUZ_NAMES[currentJuz - 1]}</T>
                </View>
                <ProgressRing size={58} stroke={5.5} progress={progress} color={theme.primary} trackColor={theme.border}>
                  <T v="caption" color="primary" style={{ fontWeight: '800' }}>60%</T>
                </ProgressRing>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Pressable
                  onPress={() => openSurah(last?.surah ?? 1)}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: theme.primary,
                    borderRadius: 12,
                    paddingVertical: 11,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <T v="button" color="onPrimary">Continue reading</T>
                </Pressable>
                <Pressable
                  onPress={() => openSurah(JUZ_START[currentJuz - 1])}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderWidth: 1.2,
                    borderColor: theme.primary,
                    borderRadius: 12,
                    paddingVertical: 11,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <T v="button" color="primary">Go to juz</T>
                </Pressable>
              </View>
              <T v="caption" style={{ marginTop: 10 }}>
                Last read: {lastMeta ? `${lastMeta.english} 20:97` : '—'}
              </T>
            </ArchCard>

            {/* Recents */}
            <T v="h3" style={{ marginTop: 20, marginBottom: 10 }}>Recents</T>
            {[18, 36].map((n) => {
              const s = QURAN.find((x) => x.number === n)!;
              return (
                <Pressable
                  key={n}
                  onPress={() => openSurah(n)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: 12,
                    marginBottom: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <BookIcon size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <T v="h3">Surah {s.english}</T>
                    <T v="caption" style={{ marginTop: 2 }}>Last read: Verse 12</T>
                  </View>
                  <T v="arabic" style={{ fontSize: 17 }}>{s.name}</T>
                </Pressable>
              );
            })}

            {/* Juz index */}
            <T v="h3" style={{ marginTop: 20, marginBottom: 10 }}>Juz index</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {juzChips.map((j) => (
                <Pressable
                  key={j}
                  onPress={() => openSurah(JUZ_START[j - 1])}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderRadius: 13,
                    paddingVertical: 10,
                    alignItems: 'center',
                    backgroundColor: j === currentJuz ? theme.primary : theme.card,
                    borderWidth: 1,
                    borderColor: j === currentJuz ? theme.primary : theme.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <T v="caption" color={j === currentJuz ? 'onPrimary' : 'text'} style={{ fontWeight: '700' }}>
                    Juz {j}
                  </T>
                </Pressable>
              ))}
            </View>

            <T v="h3" style={{ marginTop: 22, marginBottom: 10 }}>
              Surahs
            </T>
          </View>
        }
        ListEmptyComponent={
          <Surface style={{ padding: 24, alignItems: 'center' }}>
            <T v="bodyS" style={{ textAlign: 'center' }}>No surah matches “{q}”</T>
          </Surface>
        }
      />
    </View>
  );
}
