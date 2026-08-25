import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

const ITEMS = [
  { icon: '📖', label: 'Quran', href: '/(tabs)/quran' },
  { icon: '📿', label: 'Tasbeeh', href: '/tools/tasbeeh' },
  { icon: '🤲', label: 'Dua', href: '/tools/dua' },
  { icon: '🕌', label: 'Athkar', href: '/tools/athkar' },
  { icon: '✨', label: '99 Names', href: '/tools/names' },
  { icon: '📅', label: 'Calendar', href: '/tools/calendar' },
  { icon: '🎬', label: 'Videos', href: '/(tabs)/videos' },
  { icon: '🖼️', label: 'Wallpapers', href: '/tools/wallpapers' },
  { icon: '🎯', label: 'Quiz', href: '/tools/quiz' },
  { icon: '📍', label: 'Events', href: '/tools/events' },
  { icon: '🎓', label: 'Scholars', href: '/tools/scholars' },
  { icon: '💝', label: 'Charity', href: '/tools/charity' },
] as const;

export function QuickGrid() {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {ITEMS.map((it) => (
        <Link key={it.label} href={it.href} style={{ width: '33.33%', padding: 4 }}>
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 24 }}>{it.icon}</Text>
            <Text style={{ color: theme.text, fontSize: 11.5, fontWeight: '600', marginTop: 7 }}>{it.label}</Text>
          </View>
        </Link>
      ))}
    </View>
  );
}
