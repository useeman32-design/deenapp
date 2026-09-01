import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ATHKAR } from '@/data/athkar';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';
import { ContentSearchOverlay } from '@/components/ContentSearchOverlay';
import { haptic } from '@/lib/haptics';

const GROUPS = ['Morning', 'Evening', 'After Prayer', 'General'] as const;

const GROUP_LABEL: Record<(typeof GROUPS)[number], string> = {
  Morning: '🌅 Morning',
  Evening: '🌇 Evening',
  'After Prayer': '🕌 After Prayer',
  General: '📿 General',
};

export default function Athkar() {
  const { theme } = useTheme();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar showBack
        title="Athkar"
        subtitle="Daily remembrances"
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
          ATHKAR.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.transliteration.toLowerCase().includes(q.toLowerCase()))
            .map((a) => ({ key: a.id, title: a.name, subtitle: `${a.group} · ×${a.count || '∞'}`, onPress: () => router.push(`/tools/athkar/${a.id}`) }))
        }
        contentSearch={async (q) =>
          ATHKAR.filter((a) => a.arabic.includes(q.trim()) || (a.note ?? '').toLowerCase().includes(q.toLowerCase()))
            .map((a) => ({ key: `c-${a.id}`, title: a.name, arabic: a.arabic.slice(0, 44), subtitle: (a.note ?? '').slice(0, 80), onPress: () => router.push(`/tools/athkar/${a.id}`) }))
        }
        contentLabel="In athkar texts"
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {GROUPS.map((g) => (
          <View key={g}>
            <Text style={{ fontSize: 15.5, fontWeight: '800', color: theme.text, marginTop: 14, marginBottom: 10 }}>
              {GROUP_LABEL[g]}
            </Text>
            {ATHKAR.filter((a) => a.group === g).map((a) => (
              <Card
                key={a.id}
                onPress={() => router.push(`/tools/athkar/${a.id}`)}
                style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{a.name}</Text>
                  <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>{a.transliteration}</Text>
                </View>
                <View
                  style={{
                    backgroundColor: theme.primarySoft,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginLeft: 10,
                  }}
                >
                  <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12.5 }}>
                    {a.count === 0 ? '∞' : `×${a.count}`}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
