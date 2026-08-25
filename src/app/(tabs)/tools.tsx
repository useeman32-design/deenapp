import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { TopBar } from '@/components/TopBar';

const TOOLS = [
  { icon: '📿', label: 'Digital Tasbeeh', sub: 'Count your dhikr', href: '/tools/tasbeeh' },
  { icon: '🕌', label: 'Athkar', sub: 'Morning, evening & after prayer', href: '/tools/athkar' },
  { icon: '🤲', label: 'Duas', sub: 'Supplications with sources', href: '/tools/dua' },
  { icon: '✨', label: '99 Names of Allah', sub: 'Names, transliteration & meaning', href: '/tools/names' },
  { icon: '⏰', label: 'Prayer Times', sub: 'All five + Qibla direction', href: '/tools/prayer' },
  { icon: '📅', label: 'Islamic Calendar', sub: 'Hijri date & holidays', href: '/tools/calendar' },
  { icon: '🎯', label: 'Quiz', sub: 'Test your deen knowledge', href: '/tools/quiz' },
  { icon: '🖼️', label: 'Wallpapers', sub: 'Dhikr art for your phone', href: '/tools/wallpapers' },
  { icon: '📍', label: 'Islamic Events', sub: 'Lectures & gatherings', href: '/tools/events' },
  { icon: '🎓', label: 'Ask a Scholar', sub: 'Get guided answers', href: '/tools/scholars' },
  { icon: '💝', label: 'Donation & Charity', sub: 'Sadaqah & Zakat calculator', href: '/tools/charity' },
] as const;

export default function Tools() {
  const { theme } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Tools" subtitle="Prayer, dhikr & learning" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {TOOLS.map((t) => (
          <Pressable
            key={t.href}
            onPress={() => router.push(t.href)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 16,
                padding: 14,
                marginBottom: 9,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: theme.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 21 }}>{t.icon}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14.5 }}>{t.label}</Text>
              <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 2 }}>{t.sub}</Text>
            </View>
            <Text style={{ color: theme.subtext, fontSize: 18 }}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
