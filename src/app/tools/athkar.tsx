import { markGoal } from '@/lib/routine';
import { useCallback, useState, useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAllAthkar } from '@/lib/liveAthkar';
import { type Athar } from '@/data/athkar';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';
import { ContentSearchOverlay } from '@/components/ContentSearchOverlay';
import { haptic } from '@/lib/haptics';
import { readDhikrCount, getStreak, recordFullDay } from '@/lib/zikrChallenge';

const GROUPS = ['Morning', 'Evening', 'After Prayer', 'General'] as const;
const GROUP_LABEL: Record<(typeof GROUPS)[number], string> = {
  Morning: '🌅 Morning',
  Evening: '🌇 Evening',
  'After Prayer': '🕌 After Prayer',
  General: '📿 General',
};
/* The daily challenge = the morning + evening remembrances. */
const isChallenge = (a: Athar) => a.group === 'Morning' || a.group === 'Evening';
const isDone = (a: Athar, count: number) => (a.count > 0 ? count >= a.count : count > 0);

/** Learning — Daily Zikr Challenge: morning + evening adkar framed as a daily
 * challenge with progress + a completion streak; after-prayer & general adkar
 * ride along below. Counts reset each day (see lib/zikrChallenge). */
export default function Athkar() {
  useEffect(() => { markGoal('athkar').catch(() => {}); }, []);
  const { theme } = useTheme();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const list = useAllAthkar();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState(0);

  const refresh = useCallback(async () => {
    const map: Record<string, number> = {};
    await Promise.all(list.map(async (a) => { map[a.id] = await readDhikrCount(a.id); }));
    setCounts(map);
    const ch = list.filter(isChallenge);
    const done = ch.filter((a) => isDone(a, map[a.id] ?? 0));
    if (ch.length > 0 && done.length === ch.length) {
      const s = await recordFullDay();
      setStreak(s.streak);
    } else {
      const s = await getStreak();
      setStreak(s.streak);
    }
  }, [list]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const challenge = list.filter(isChallenge);
  const challengeDone = challenge.filter((a) => isDone(a, counts[a.id] ?? 0)).length;
  const total = challenge.length || 1;
  const pct = Math.round((challengeDone / total) * 100);
  const complete = challenge.length > 0 && challengeDone === challenge.length;

  const renderCard = (a: Athar) => {
    const done = isDone(a, counts[a.id] ?? 0);
    return (
      <Card
        key={a.id}
        onPress={() => router.push(`/tools/athkar/${a.id}`)}
        style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}
      >
        <FontAwesome5
          name={done ? 'check-circle' : 'circle'}
          size={18}
          color={done ? '#2FA866' : theme.border}
          solid={done}
          style={{ marginRight: 10 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{a.name}</Text>
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{a.transliteration}</Text>
        </View>
        <View style={{ backgroundColor: done ? 'rgba(47,168,102,0.14)' : theme.primarySoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 10 }}>
          <Text style={{ color: done ? '#2FA866' : theme.primary, fontWeight: '800', fontSize: 12.5 }}>
            {a.count === 0 ? '∞' : `×${a.count}`}
          </Text>
        </View>
      </Card>
    );
  };

  const sectionCount = (g: (typeof GROUPS)[number]) => {
    const items = list.filter((a) => a.group === g);
    const d = items.filter((a) => isDone(a, counts[a.id] ?? 0)).length;
    return `${d}/${items.length}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar showBack
        title="Daily Zikr Challenge"
        subtitle="Morning & evening remembrances"
        right={
          <Pressable onPress={() => { haptic.selection(); setSearchOpen(true); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 14 }}>⌕</Text>
          </Pressable>
        }
      />
      <ContentSearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        placeholder="Search athkar — name or text…"
        metaSearch={(q) =>
          list.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.transliteration.toLowerCase().includes(q.toLowerCase()))
            .map((a) => ({ key: a.id, title: a.name, subtitle: `${a.group} · ×${a.count || '∞'}`, onPress: () => router.push(`/tools/athkar/${a.id}`) }))
        }
        contentSearch={async (q) =>
          list.filter((a) => a.arabic.includes(q.trim()) || (a.note ?? '').toLowerCase().includes(q.toLowerCase()))
            .map((a) => ({ key: `c-${a.id}`, title: a.name, arabic: a.arabic.slice(0, 44), subtitle: (a.note ?? '').slice(0, 80), onPress: () => router.push(`/tools/athkar/${a.id}`) }))
        }
        contentLabel="In athkar texts"
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* ── CHALLENGE HERO ── */}
        <View style={{ borderRadius: 20, padding: 18, marginBottom: 8, backgroundColor: theme.primarySoft, borderWidth: 1, borderColor: theme.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 11, letterSpacing: 0.8 }}>TODAY&apos;S CHALLENGE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <FontAwesome5 name="fire" size={12} color={streak > 0 ? '#E8873A' : theme.subtext} />
              <Text style={{ color: streak > 0 ? '#E8873A' : theme.subtext, fontWeight: '800', fontSize: 12 }}>{streak} day{streak === 1 ? '' : 's'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 8 }}>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 34, lineHeight: 38 }}>{challengeDone}</Text>
            <Text style={{ color: theme.subtext, fontWeight: '700', fontSize: 16, marginBottom: 5 }}>/ {challenge.length} adkar</Text>
          </View>
          <View style={{ height: 9, borderRadius: 5, backgroundColor: theme.background, overflow: 'hidden', marginTop: 10 }}>
            <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: complete ? '#2FA866' : theme.primary }} />
          </View>
          <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 10, fontWeight: '600' }}>
            {complete ? '🎉 Challenge complete — may Allah accept it. Keep your streak alive tomorrow!' : 'Complete your morning & evening remembrances to finish today’s challenge.'}
          </Text>
        </View>

        {GROUPS.map((g) => {
          const items = list.filter((a) => a.group === g);
          if (!items.length) return null;
          return (
            <View key={g}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '800', color: theme.text }}>{GROUP_LABEL[g]}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.subtext }}>{sectionCount(g)}</Text>
              </View>
              {items.map(renderCard)}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
