import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ATHKAR } from '@/data/athkar';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';

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
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Athkar" subtitle="Daily remembrances" />
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
