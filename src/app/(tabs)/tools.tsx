import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
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

const GROUPS = [
  {
    title: 'Dhikr & worship',
    items: [
      { label: 'Digital Tasbeeh', sub: 'Count your dhikr', href: '/tools/tasbeeh', icon: BeadsIcon },
      { label: 'Athkar', sub: 'Morning, evening & after prayer', href: '/tools/athkar', icon: MosqueIcon },
      { label: 'Prayer Times', sub: 'All five + Jumu’ah', href: '/tools/prayer', icon: ClockIcon },
      { label: 'Islamic Calendar', sub: 'Hijri date & holidays', href: '/tools/calendar', icon: CalendarIcon },
    ],
  },
  {
    title: 'Learning',
    items: [
      { label: 'Hadith', sub: 'Sahih Bukhari, Muslim & more', href: '/tools/hadith', icon: ScrollIcon },
      { label: 'Duas', sub: 'Supplications with sources', href: '/tools/dua', icon: HeartIcon },
      { label: '99 Names of Allah', sub: 'Transliteration & meaning', href: '/tools/names', icon: SparkleIcon },
      { label: 'Quiz', sub: 'Test your deen knowledge', href: '/tools/quiz', icon: TargetIcon },
    ],
  },
  {
    title: 'Media & community',
    items: [
      { label: 'Daily Videos', sub: 'Lectures & reminders', href: '/tools/videos', icon: PlayIcon },
      { label: 'Wallpapers', sub: 'Dhikr art for your phone', href: '/tools/wallpapers', icon: ImageIcon },
      { label: 'Islamic Events', sub: 'Lectures & gatherings', href: '/tools/events', icon: PinIcon },
      { label: 'Ask a Scholar', sub: 'Get guided answers', href: '/tools/scholars', icon: UserIcon },
      { label: 'Donation & Charity', sub: 'Sadaqah & Zakat calculator', href: '/tools/charity', icon: HeartIcon },
    ],
  },
] as const;

export default function Tools() {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Tools" subtitle="Prayer, dhikr & learning" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {GROUPS.map((g) => (
          <View key={g.title} style={{ marginBottom: 20 }}>
            <T v="meta" uppercase style={{ marginBottom: 10, letterSpacing: 1.2 }}>{g.title}</T>
            {g.items.map((t) => {
              const Icon = t.icon;
              return (
                <Pressable
                  key={t.href}
                  onPress={() => router.push(t.href)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 16,
                    padding: 13,
                    marginBottom: 9,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <T v="bodyS" style={{ fontWeight: '700' }}>{t.label}</T>
                    <T v="caption" style={{ marginTop: 2 }}>{t.sub}</T>
                  </View>
                  <ChevronRightIcon size={15} color={theme.subtext} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
