import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { QURAN, JUZ_START } from '@/data/quran';
import { storage } from '@/lib/storage';
import { ContentSearchOverlay } from '@/components/ContentSearchOverlay';
import { ensureQuranCorpus, findAyahFuzzy, searchQuranCorpus } from '@/lib/quranSearch';
import { markActive, markGoal } from '@/lib/routine';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

type Filter = 'all' | 'meccan' | 'medinan' | 'bookmarks';
const FILTERS: { id: Filter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'list-ul' },
  { id: 'meccan', label: 'Meccan', icon: 'kaaba' },
  { id: 'medinan', label: 'Medinan', icon: 'mosque' },
  { id: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' },
];

/** Juz number for a surah (based on juz-start table). */
function juzOf(surah: number) {
  let j = 1;
  for (let i = 0; i < JUZ_START.length; i++) if (surah >= JUZ_START[i]) j = i + 1;
  return j;
}

function timeAgo(iso: string | null) {
  if (!iso) return '2h ago';
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function SurahList() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState<number[]>([]);
  const [ayahMarks, setAyahMarks] = useState<Array<{ surah: number; ayah: number }>>([]);
  const [deepSearch, setDeepSearch] = useState(false);
  const [recent, setRecent] = useState<number[]>([]);
  const [lastRead, setLastRead] = useState<{ surah: number; ayah?: number; at?: string } | null>(null);

  useEffect(() => {
    storage.getItem('dl.quran.recent').then((r) => {
      if (r)
        try {
          setRecent(JSON.parse(r));
        } catch {}
    });
    storage.getItem('dl.quran.last').then((r) => {
      if (r)
        try {
          setLastRead(JSON.parse(r));
        } catch {}
    });
    storage.getItem('dl.quran.ayahMarks').then((r) => {
      if (r)
        try {
          const all: Record<string, number[]> = JSON.parse(r);
          setAyahMarks(Object.entries(all).flatMap(([sn, ayahs]) => ayahs.map((a) => ({ surah: Number(sn), ayah: a }))));
        } catch {}
    });
    storage.getItem('dl.quran.favs').then((r) => {
      if (r)
        try {
          setFavs(JSON.parse(r));
        } catch {}
    });
  }, []);

  // reading-progress hero (defaults: Al-Yusuf, Juz 12, 60%)
  const cur = QURAN.find((s) => s.number === (lastRead?.surah ?? 12)) ?? QURAN[11];
  const curJuz = juzOf(cur.number);
  const curAyah = lastRead?.ayah ?? 40;
  const pct = Math.min(99, Math.max(4, Math.round((cur.number / 114) * 52 + (curAyah / cur.ayahs) * 8 + 4)));

  const toggleFav = (number: number) => {
    haptic.light();
    setFavs((f) => {
      const next = f.includes(number) ? f.filter((x) => x !== number) : [...f, number];
      storage.setItem('dl.quran.favs', JSON.stringify(next));
      return next;
    });
  };

  const open = (number: number) => {
    markActive();
    markGoal('surah');
    storage.setItem('dl.quran.last', JSON.stringify({ surah: number, ayah: 1, at: new Date().toISOString() }));
    const next = [number, ...recent.filter((n) => n !== number)].slice(0, 8);
    setRecent(next);
    storage.setItem('dl.quran.recent', JSON.stringify(next));
    router.push(`/read/${number}` as never);
  };

  const list = useMemo(() => {
    let l = QURAN;
    if (filter === 'meccan') l = l.filter((s) => s.revelation === 'Meccan');
    else if (filter === 'medinan') l = l.filter((s) => s.revelation === 'Medinan');
    else if (filter === 'bookmarks') l = l.filter((s) => favs.includes(s.number));
    const query = q.trim().toLowerCase();
    if (query) l = l.filter((s) => s.english.toLowerCase().includes(query) || s.name.includes(query) || String(s.number) === query);
    return l;
  }, [filter, q, favs]);

  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* fixed header — never scrolls away */}
      <View style={{ paddingHorizontal: 18, paddingTop: insets.top + 12, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="chevron-left" size={14} color={d.emerald} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>
              The Holy Qur'an
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              114 Surahs · 6,236 Verses · 30 Juz
            </T>
          </View>
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(s) => String(s.number)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View>
            {/* ── Reading Progress hero card ── */}
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 14,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(74,227,143,0.25)' : 'rgba(29,111,66,0.2)',
                backgroundColor: d.card,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: isDark ? 0.25 : 0.06,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
                {/* circular progress ring */}
                <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={100} height={100} style={{ position: 'absolute' }} viewBox="0 0 100 100">
                    <Circle cx={50} cy={50} r={40} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)'} strokeWidth={7} fill="none" />
                  </Svg>
                  <Svg width={100} height={100} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }} viewBox="0 0 100 100">
                    <Circle
                      cx={50}
                      cy={50}
                      r={40}
                      stroke="#2ECC71"
                      strokeWidth={7}
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={`${(pct / 100) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                    />
                  </Svg>
                  <View style={{ alignItems: 'center' }}>
                    <T v="stat" style={{ fontSize: 22, fontWeight: '800', color: d.text }}>
                      {pct}%
                    </T>
                    <T v="caption" style={{ fontSize: 8.5, color: d.faint, fontWeight: '700', letterSpacing: 0.5 }}>
                      COMPLETE
                    </T>
                  </View>
                </View>

                {/* where you are */}
                <View style={{ flex: 1 }}>
                  <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 9.5, letterSpacing: 1.2 }}>
                    READING PROGRESS
                  </T>
                  <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 21, marginTop: 3 }}>
                    Juz {curJuz}
                  </T>
                  <T v="body" style={{ color: d.subtext, fontSize: 13, marginTop: 1 }}>
                    {cur.english} · Ayah {curAyah}
                  </T>
                  <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 2 }}>
                    Last read {timeAgo(lastRead?.at ?? null)}
                  </T>
                </View>
              </View>

              <Pressable
                onPress={() => router.push({ pathname: '/read/[id]', params: { id: String(cur.number), ayah: String(curAyah) } } as never)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginHorizontal: 16,
                  marginBottom: 14,
                  paddingVertical: 12,
                  borderRadius: 13,
                  backgroundColor: isDark ? '#1F8F5C' : '#1D6F42',
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <FontAwesome5 name="book-open" size={13} color="#FFFFFF" />
                <T v="body" style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                  Continue Reading
                </T>
                <FontAwesome5 name="arrow-right" size={11} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </View>

            {/* search */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: d.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: d.cardBorder,
                marginTop: 14,
                marginHorizontal: 16,
                paddingHorizontal: 13,
              }}
            >
              <FontAwesome5 name="search" size={13} color={d.faint} />
              <Pressable
                onPress={() => { haptic.selection(); setDeepSearch(true); }}
                style={{ flex: 1, paddingVertical: 11, paddingLeft: 9 }}
              >
                <T v="caption" style={{ color: d.faint, fontSize: 13.5 }}>Search surah or ayah…</T>
              </Pressable>
              {q ? (
                <Pressable onPress={() => setQ('')} hitSlop={8}>
                  <FontAwesome5 name="times-circle" size={14} color={d.faint} />
                </Pressable>
              ) : null}
            </View>

            {/* recent */}
            {recent.length > 0 ? (
              <View style={{ paddingTop: 14, paddingLeft: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <FontAwesome5 name="history" size={11} color={d.faint} />
                  <T v="caption" style={{ color: d.faint, fontWeight: '800', fontSize: 10, letterSpacing: 0.8 }}>
                    RECENT
                  </T>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
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
                          gap: 7,
                          backgroundColor: d.card,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: d.cardBorder,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 10 }}>
                          {n}
                        </T>
                        <T v="caption" style={{ color: d.text, fontWeight: '700', fontSize: 11 }}>
                          {s.english}
                        </T>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {/* filters */}
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
              {FILTERS.map((f) => {
                const on = filter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      haptic.selection();
                      setFilter(f.id);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder,
                      backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(29,111,66,0.08)') : d.card,
                    }}
                  >
                    <FontAwesome5 name={f.icon as never} size={10} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} solid={f.id === 'bookmarks' && on} />
                    <T v="caption" style={{ color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext, fontWeight: '800', fontSize: 11 }}>
                      {f.label}
                      {f.id === 'bookmarks' && (favs.length + ayahMarks.length) ? ` (${favs.length + ayahMarks.length})` : ''}
                    </T>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Saved ayahs — shown in the BOOKMARKS tab (pass 22) ── */}
            {filter === 'bookmarks' && ayahMarks.length > 0 ? (
              <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 6 }}>
                <T v="caption" style={{ color: d.faint, fontWeight: '800', fontSize: 10, letterSpacing: 0.6, marginBottom: 8 }}>
                  SAVED AYAHS · {ayahMarks.length}
                </T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingRight: 8 }}>
                  {ayahMarks.map((m) => {
                    const sm = QURAN.find((x) => x.number === m.surah);
                    return (
                      <Pressable
                        key={`${m.surah}:${m.ayah}`}
                        onPress={() => router.push({ pathname: '/read/[id]', params: { id: String(m.surah), ayah: String(m.ayah) } } as never)}
                        style={({ pressed }) => ({ minWidth: 132, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 11, gap: 3, opacity: pressed ? 0.75 : 1 })}
                      >
                        <T v="arabic" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontSize: 18 }}>{sm?.name ?? ''}</T>
                        <T v="caption" numberOfLines={1} style={{ color: d.text, fontWeight: '800', fontSize: 11 }}>{sm?.english}</T>
                        <T v="caption" style={{ color: d.faint, fontSize: 9.5 }}>Ayah {m.ayah}</T>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {favs.length > 0 ? <T v="caption" style={{ color: d.faint, fontSize: 9.5, marginTop: 8, marginBottom: 4 }}>Bookmarked surahs below ↓</T> : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: s }) => (
          <Pressable
            onPress={() => open(s.number)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginHorizontal: 16,
              marginBottom: 8,
              padding: 13,
              borderRadius: 16,
              backgroundColor: d.card,
              borderWidth: 1,
              borderColor: d.cardBorder,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {/* number medallion */}
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.3)',
                backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)',
              }}
            >
              <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 12 }}>
                {s.number}
              </T>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T v="body" style={{ color: d.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                  {s.english}
                </T>
                <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,36,28,0.05)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <T v="caption" style={{ color: d.faint, fontSize: 8.5, fontWeight: '700' }}>
                    Juz {juzOf(s.number)}
                  </T>
                </View>
              </View>
              <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
                {s.revelation} · {s.ayahs} verses
              </T>
            </View>

            {/* bookmark */}
            <Pressable onPress={() => toggleFav(s.number)} hitSlop={8} style={{ padding: 6 }}>
              <FontAwesome5 name="bookmark" size={15} solid={favs.includes(s.number)} color={favs.includes(s.number) ? '#E8C96A' : d.faint} />
            </Pressable>

            <T v="arabic" style={{ color: d.text, fontSize: 23, lineHeight: 32 }}>
              {s.name}
            </T>
          </Pressable>
        )}
      />

      {/* deep search — surah names instantly + full corpus content scan */}
      <ContentSearchOverlay
        visible={deepSearch}
        onClose={() => setDeepSearch(false)}
        placeholder="Search the Qur'an — surah or ayah text…"
        metaSearch={(qq) => {
          const needle = qq.toLowerCase();
          return QURAN.filter((x) => x.english.toLowerCase().includes(needle) || x.name.includes(qq.trim()) || String(x.number) === needle)
            .slice(0, 12)
            .map((x) => ({ key: `s${x.number}`, title: `${x.number}. ${x.english}`, subtitle: `${x.ayahs} verses · ${x.revelation}`, arabic: x.name, onPress: () => router.push({ pathname: '/read/[id]', params: { id: String(x.number) } } as never) }));
        }}
        contentSearch={async (qq) => {
          await ensureQuranCorpus();
          const direct = searchQuranCorpus(qq).map((h) => ({
            key: `a${h.surah}:${h.ayah}`,
            title: `${QURAN[h.surah - 1]?.english ?? h.surah} ${h.surah}:${h.ayah}`,
            subtitle: h.translation.slice(0, 90),
            arabic: h.arabic.slice(0, 46),
            onPress: () => router.push({ pathname: '/read/[id]', params: { id: String(h.surah), ayah: String(h.ayah) } } as never),
          }));
          /* pass 24: recited arabic rarely substring-matches — fuzzy-find it */
          if (direct.length < 3 && /[\u0621-\u064A]/.test(qq)) {
            const fuzzy = findAyahFuzzy(qq, 5).map((h) => ({
              key: `f${h.surah}:${h.ayah}`,
              title: `${h.surahName} ${h.surah}:${h.ayah} · ${Math.round(h.score * 100)}% match`,
              subtitle: h.translation.slice(0, 90),
              arabic: h.arabic.slice(0, 60),
              onPress: () => router.push({ pathname: '/read/[id]', params: { id: String(h.surah), ayah: String(h.ayah) } } as never),
            }));
            return [...fuzzy, ...direct];
          }
          return direct;
        }}
        contentLabel="In the whole Qur'an (EN · HA · Arabic)"
      />
    </View>
  );
}
