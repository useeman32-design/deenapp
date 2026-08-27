import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { QURAN } from '@/data/quran';
import { storage } from '@/lib/storage';
import { markActive, markGoal } from '@/lib/routine';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { PageHero } from '@/components/PageHero';
import { BookIcon, SearchIcon } from '@/components/Icons';
import Svg, { Path } from 'react-native-svg';

function HistoryIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M4.6 10 A7.6 7.6 0 1 1 4.2 13.4 M4.6 4.8 V10 H10"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 8.4 V12 L14.8 13.8" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

type Filter = 'all' | 'meccan' | 'medinan' | 'favorites';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All Surahs' },
  { id: 'meccan', label: 'Meccan' },
  { id: 'medinan', label: 'Medinan' },
  { id: 'favorites', label: 'Favorites' },
];

export default function SurahList() {
  const { theme } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState<number[]>(() => []);
  const [recent, setRecent] = useState<number[]>([]);

  useEffect(() => {
    storage.getItem('dl.quran.recent').then((r) => {
      if (r) {
        try {
          setRecent(JSON.parse(r));
        } catch {}
      }
    });
  }, []);

  const list = useMemo(() => {
    let l = QURAN;
    if (filter === 'meccan') l = l.filter((s) => s.revelation === 'Meccan');
    else if (filter === 'medinan') l = l.filter((s) => s.revelation === 'Medinan');
    else if (filter === 'favorites') l = l.filter((s) => favs.includes(s.number));
    const query = q.trim().toLowerCase();
    if (query) l = l.filter((s) => s.english.toLowerCase().includes(query) || String(s.number) === query);
    return l;
  }, [filter, q, favs]);

  const open = (number: number) => {
    markActive();
    markGoal('surah');
    storage.setItem('dl.quran.last', JSON.stringify({ surah: number }));
    const next = [number, ...recent.filter((n) => n !== number)].slice(0, 6);
    setRecent(next);
    storage.setItem('dl.quran.recent', JSON.stringify(next));
    router.push(`/(tabs)/quran/${number}`);
  };

  const toggleFav = (number: number) =>
    setFavs((f) => (f.includes(number) ? f.filter((x) => x !== number) : [...f, number]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={list}
        keyExtractor={(s) => String(s.number)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            <PageHero title="Quran Surahs" heading="114 Surahs" sub="Divine revelation preserved for humanity" icon={BookIcon} height={220} />

            {/* Search */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderRadius: 30,
                marginTop: 16,
                paddingHorizontal: 14,
                marginLeft: 16,
                marginRight: 16,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              }}
            >
              <SearchIcon size={15} color={theme.subtext} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search surah by name or number..."
                placeholderTextColor={theme.subtext}
                style={{ flex: 1, fontFamily: 'Poppins-Medium', fontSize: 13.5, color: theme.text, paddingVertical: 11, paddingLeft: 9 }}
              />
            </View>

            {/* Recent (web .recent-section) */}
            {recent.length > 0 ? (
              <View style={{ paddingTop: 14, paddingLeft: 16, paddingRight: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <HistoryIcon color={theme.subtext} />
                    <T v="bodyS" style={{ fontWeight: '600', fontSize: 13 }}>
                      Recent
                    </T>
                  </View>
                  <Pressable
                    onPress={() => {
                      setRecent([]);
                      storage.removeItem('dl.quran.recent');
                    }}
                    hitSlop={6}
                  >
                    <T v="caption" style={{ fontSize: 12, fontWeight: '600' }}>
                      Clear
                    </T>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {recent.map((n) => {
                    const s = QURAN.find((x) => x.number === n);
                    if (!s) return null;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => open(n)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: theme.card,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: theme.border,
                          paddingLeft: 8,
                          paddingRight: 12,
                          paddingVertical: 6,
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 5,
                            backgroundColor: theme.primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: [{ rotate: '45deg' }],
                          }}
                        >
                          <T v="caption" color="onPrimary" style={{ fontSize: 9, fontWeight: '800', transform: [{ rotate: '-45deg' }] }}>
                            {n}
                          </T>
                        </View>
                        <T v="caption" style={{ fontWeight: '600' }}>
                          {s.english}
                        </T>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {/* Filter chips */}
            <View style={{ flexDirection: 'row', gap: 8, paddingTop: 12, paddingBottom: 4, paddingLeft: 16, paddingRight: 16 }}>
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: active ? theme.primary : theme.card,
                      borderWidth: 1,
                      borderColor: active ? theme.primary : theme.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <T v="caption" color={active ? 'onPrimary' : 'text'} style={{ fontWeight: '600' }}>
                      {f.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item.number)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              backgroundColor: theme.card,
              borderRadius: 12,
              padding: 16,
              marginHorizontal: 16,
              marginBottom: 10,
              opacity: pressed ? 0.8 : 1,
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: theme.primary,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: '45deg' }],
              }}
            >
              <T v="caption" color="onPrimary" style={{ fontWeight: '800', transform: [{ rotate: '-45deg' }] }}>
                {item.number}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T v="h3">{item.english}</T>
              <T v="caption" style={{ marginTop: 2 }}>
                {item.ayahs} verses · {item.revelation}
              </T>
            </View>
            <T v="arabic" style={{ fontSize: 18 }}>{item.name}</T>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <T v="h3" style={{ textAlign: 'center' }}>No surahs found</T>
          </View>
        }
      />
    </View>
  );
}
