import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { TopBar } from '@/components/TopBar';
import {
  BeadsIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  HeartIcon,
  ImageIcon,
  MosqueIcon,
  PinIcon,
  PlayIcon,
  ScrollIcon,
  SparkleIcon,
  TargetIcon,
  UserIcon,
} from '@/components/Icons';

const TOOLS = [
  { label: 'Digital Tasbeeh', sub: 'Count your dhikr', href: '/tools/tasbeeh', icon: BeadsIcon },
  { label: 'Athkar', sub: 'Morning, evening & after prayer', href: '/tools/athkar', icon: MosqueIcon },
  { label: 'Hadith', sub: 'Sahih Bukhari, Muslim & more', href: '/tools/hadith', icon: ScrollIcon },
  { label: 'Duas', sub: 'Supplications with sources', href: '/tools/dua', icon: HeartIcon },
  { label: '99 Names of Allah', sub: 'Names, transliteration & meaning', href: '/tools/names', icon: SparkleIcon },
  { label: 'Prayer Times', sub: 'All five + Jumu’ah', href: '/tools/prayer', icon: ClockIcon },
  { label: 'Islamic Calendar', sub: 'Hijri date & holidays', href: '/tools/calendar', icon: CalendarIcon },
  { label: 'Daily Videos', sub: 'Lectures & reminders', href: '/tools/videos', icon: PlayIcon },
  { label: 'Quiz', sub: 'Test your deen knowledge', href: '/tools/quiz', icon: TargetIcon },
  { label: 'Wallpapers', sub: 'Dhikr art for your phone', href: '/tools/wallpapers', icon: ImageIcon },
  { label: 'Islamic Events', sub: 'Lectures & gatherings', href: '/tools/events', icon: PinIcon },
  { label: 'Ask a Scholar', sub: 'Get guided answers', href: '/tools/scholars', icon: UserIcon },
  { label: 'Donation & Charity', sub: 'Sadaqah & Zakat calculator', href: '/tools/charity', icon: HeartIcon },
] as const;

export default function Tools() {
  const { theme } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Tools" subtitle="Prayer, dhikr & learning" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
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
                  padding: 13,
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
                <Icon size={21} color={theme.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{t.label}</Text>
                <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>{t.sub}</Text>
              </View>
              <ChevronRightIcon size={16} color={theme.subtext} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
