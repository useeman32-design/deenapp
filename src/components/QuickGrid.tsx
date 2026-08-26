import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { tiles } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import {
  BeadsIcon,
  CalendarIcon,
  ClockIcon,
  CompassIcon,
  HeartIcon,
  HelpIcon,
  MedalIcon,
  MosqueIcon,
  PlayIcon,
  ScrollIcon,
  SparkleIcon,
  TargetIcon,
  type IconProps,
} from '@/components/Icons';

export interface QuickItem {
  key: keyof typeof tiles;
  label: string;
  icon: (p: IconProps) => React.ReactNode;
  href: Href;
}

export const QUICK_ITEMS: QuickItem[] = [
  { key: 'dua', label: 'Dua', icon: HeartIcon, href: '/tools/dua' },
  { key: 'athkar', label: 'Athkar', icon: MosqueIcon, href: '/tools/athkar' },
  { key: 'tasbih', label: 'Tasbeeh', icon: BeadsIcon, href: '/tools/tasbeeh' },
  { key: 'prayer', label: 'Prayer Times', icon: ClockIcon, href: '/tools/prayer' },
  { key: 'qibla', label: 'Qibla', icon: CompassIcon, href: '/tools/qibla' },
  { key: 'calendar', label: 'Calendar', icon: CalendarIcon, href: '/tools/calendar' },
  { key: 'hadith', label: 'Hadith', icon: ScrollIcon, href: '/tools/hadith' },
  { key: 'names', label: '99 Names', icon: SparkleIcon, href: '/tools/names' },
  { key: 'zakat', label: 'Zakat', icon: TargetIcon, href: '/tools/zakat' },
  { key: 'quiz', label: 'Quiz', icon: MedalIcon, href: '/tools/quiz' },
  { key: 'videos', label: 'Videos', icon: PlayIcon, href: '/tools/videos' },
  { key: 'question', label: 'Ask Question', icon: HelpIcon, href: '/tools/scholars' },
];

/** The web quick-access grid: pastel tiles, one per tool. */
export function QuickGrid({ items = QUICK_ITEMS, columns = 3 }: { items?: QuickItem[]; columns?: number }) {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
      {items.map((q) => {
        const Icon = q.icon;
        const tint = tiles[q.key];
        return (
          <Pressable
            key={q.key}
            onPress={() => router.push(q.href)}
            style={({ pressed }) => ({
              flexBasis: `${100 / columns - 3}%`,
              flexGrow: 1,
              backgroundColor: isDark ? tint.bgDark : tint.bg,
              borderRadius: 16,
              alignItems: 'center',
              paddingVertical: 14,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Icon size={21} color={isDark ? theme.primary : tint.icon} />
            <T v="caption" style={{ marginTop: 7, fontWeight: '700', color: theme.text }}>{q.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
