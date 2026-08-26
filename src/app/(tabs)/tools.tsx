import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { tiles } from '@/constants/theme';
import { QUICK_ITEMS, type QuickItem } from '@/components/QuickGrid';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { GiftIcon, HelpIcon, PlayIcon, StarIcon, type IconProps } from '@/components/Icons';

/** Extra tools beyond the home quick-grid. */
const MORE_TOOLS: QuickItem[] = [
  { key: 'donation', label: 'Donation', icon: GiftIcon, href: '/tools/charity' },
  { key: 'videos', label: 'Videos', icon: PlayIcon, href: '/tools/videos' },
  { key: 'wallpaper', label: 'Wallpapers', icon: StarIcon, href: '/tools/wallpapers' },
  { key: 'question', label: 'Scholars', icon: HelpIcon, href: '/tools/scholars' },
];

/**
 * Worship Tools tab — the web tools hub: every prayer & daily tool in one grid.
 */
export default function Tools() {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const all: QuickItem[] = [...QUICK_ITEMS, ...MORE_TOOLS.filter((m) => !QUICK_ITEMS.some((q) => q.href === m.href))];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TopBar title="Worship Tools" subtitle="Everything for your daily ibadat" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {all.map((q) => {
            const Icon: (p: IconProps) => React.ReactNode = q.icon;
            const tint = tiles[q.key];
            return (
              <Pressable
                key={q.key}
                onPress={() => router.push(q.href)}
                style={({ pressed }) => ({
                  flexBasis: '30.33%',
                  backgroundColor: isDark ? tint.bgDark : tint.bg,
                  borderRadius: 16,
                  alignItems: 'center',
                  paddingVertical: 15,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Icon size={21} color={isDark ? theme.primary : tint.icon} />
                <T v="caption" style={{ marginTop: 7, fontWeight: '700', color: theme.text }}>
                  {q.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
