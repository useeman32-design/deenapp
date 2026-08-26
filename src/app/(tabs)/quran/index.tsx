import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { JUZ_NAMES, JUZ_START, OFFLINE_TEXT, QURAN, juzOfSurah, type SurahMeta } from '@/data/quran';
import { HADITH_CATEGORIES, HADITHS } from '@/data/hadith';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { ArchCard } from '@/components/ArchCard';
import { ProgressRing } from '@/components/ProgressRing';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { Chip } from '@/components/Chip';
import { BookIcon, ChevronRightIcon, HeartIcon, HomeIcon, MosqueIcon, SearchIcon, ShieldIcon, ScrollIcon } from '@/components/Icons';

type LastRead = { surah: number };
const CAT_ICON: Record<string, (p: { size?: number; color?: string }) => React.ReactNode> = {
  shield: ShieldIcon,
  mosque: MosqueIcon,
  heart: HeartIcon,
  home: HomeIcon,
};

export default function QuranHadith() {
  const { theme } = useTheme();
  const router = useRouter();
  const [section, setSection] = useState<'quran' | 'hadith'>('quran');
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
  const progress = 0.6; // mock — from /api/quran/streak.php when wired

  const query = q.trim().toLowerCase();
  const list = useMemo(
    () => QURAN.filter((s) => !query || s.english.toLowerCase().includes(query) || String(s.number) === query),
    [query],
  );
  const juzChips = [currentJuz - 1, currentJuz, currentJuz + 1].filter((j) => j >= 1 && j <= 30);
  const [h0] = HADITHS;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Quran & Hadith" />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <Chip label="Quran" active={section === 'quran'} onPress={() => setSection('quran')} />
        <Chip label="Hadith" active={section === 'hadith'} onPress={() => setSection('hadith')} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        {section === 'quran' ? (
          <View>
            {/* Search */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderRadius: 30,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 14,
                marginBottom: 14,
              }}
            >
              <SearchIcon size={15} color={theme.subtext} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search surah by name or number…"
                placeholderTextColor={theme.subtext}
                style={{ flex: 1, fontFamily: 'Poppins-Medium', fontSize: 13.5, color: theme.text, paddingVertical: 11, paddingLeft: 9 }}
              />
            </View>

            {/* Reading progress */}
            <ArchCard archHeight={50} strokeColor={theme.goldBright} strokeWidth={1.2} padding={16}>
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
                Last read: {lastMeta ? lastMeta.english : '—'}
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

            {/* All surahs */}
            <T v="h3" style={{ marginTop: 22, marginBottom: 10 }}>Surahs</T>
            {list.map((s) => (
              <Pressable
                key={s.number}
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
            ))}
          </View>
        ) : (
          <View>
            {/* Daily hadith */}
            <ArchCard archHeight={48} strokeColor={theme.goldBright} strokeWidth={1.2} padding={16}>
              <T v="meta" color="accent" uppercase style={{ textAlign: 'center', letterSpacing: 1.2 }}>
                Daily hadith
              </T>
              <T v="arabicL" style={{ textAlign: 'center', marginTop: 14 }}>
                {h0.arabic}
              </T>
              <T v="bodyS" style={{ marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>
                {h0.translation}
              </T>
              <T v="caption" style={{ marginTop: 6, textAlign: 'center' }}>
                {h0.source} {h0.number}
              </T>
            </ArchCard>

            {/* Categories */}
            <T v="h3" style={{ marginTop: 20, marginBottom: 10 }}>Categories</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HADITH_CATEGORIES.map((c) => {
                const Icon = CAT_ICON[c.icon];
                const count = HADITHS.filter((h) => h.category === c.id).length;
                return (
                  <View
                    key={c.id}
                    style={{
                      flex: 1,
                      minWidth: '46%',
                      backgroundColor: theme.card,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={17} color={theme.primary} />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <T v="bodyS" style={{ fontWeight: '700' }}>{c.label}</T>
                      <T v="caption" style={{ marginTop: 1 }}>{count} hadiths</T>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* List */}
            <T v="h3" style={{ marginTop: 20, marginBottom: 10 }}>Hadiths</T>
            {HADITHS.map((h) => (
              <View
                key={h.id}
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <T v="arabic" style={{ textAlign: 'right', fontSize: 18 }}>
                  {h.arabic}
                </T>
                <T v="bodyS" style={{ marginTop: 9, lineHeight: 19 }}>
                  {h.translation}
                </T>
                <T v="caption" style={{ marginTop: 7 }}>
                  {h.source} {h.number}
                </T>
              </View>
            ))}
            <T v="caption" style={{ textAlign: 'center', marginTop: 6 }}>
              Demo set — full collections stream from your backend.
            </T>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
