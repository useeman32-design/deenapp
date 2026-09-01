import { Linking, Pressable, ScrollView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { tiles, tilesDark } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import {
  BagIcon,
  BeadsIcon,
  BookIcon,
  BrainIcon,
  CalendarIcon,
  GiftIcon,
  HelpIcon,
  ImageIcon,
  PlayIcon,
  PlusIcon,
  PrayingHandsIcon,
  ScrollIcon,
  SparkleIcon,
  StarCrescentIcon,
  type IconProps,
} from '@/components/Icons';

type QuickAction =
  | { type: 'route'; href: Href }
  | { type: 'modal'; modal: 'post' }
  | { type: 'web'; url: string };

export interface QuickItem {
  key: keyof typeof tiles;
  label: string;
  icon: (p: IconProps) => React.ReactNode;
  action: QuickAction;
}

/**
 * The web home quick-access row, 1:1 — same 17 tiles, same order, same labels.
 * Horizontal scroll row of 100px gradient tiles (web .quick-button).
 */
export const QUICK_ITEMS: QuickItem[] = [
  { key: 'askquestion', label: 'Ask Question', icon: HelpIcon, action: { type: 'route', href: '/tools/scholars' } },
  { key: 'videos', label: 'Watch Videos', icon: PlayIcon, action: { type: 'route', href: '/videos' } },
  { key: 'deenai', label: 'DeenLink AI', icon: SparkleIcon, action: { type: 'web', url: 'https://deenlink.org/deenlink-ai/deenai.html' } },
  { key: 'shop', label: 'Shop', icon: BagIcon, action: { type: 'web', url: 'https://deenlink.org/shop/' } },
  { key: 'dua', label: 'Dua', icon: (p: any) => <FontAwesome5 name="hands-helping" size={(p.size ?? 20) * 0.9} color={p.color} />, action: { type: 'route', href: '/tools/dua' } },
  { key: 'athkar', label: 'Athkar', icon: (p: any) => <FontAwesome5 name="book-reader" size={(p.size ?? 20) * 0.9} color={p.color} />, action: { type: 'route', href: '/tools/athkar' } },
  { key: 'addpost', label: 'Add Post', icon: PlusIcon, action: { type: 'modal', modal: 'post' } },
  { key: 'wallpaper', label: 'Islamic Wallpapers', icon: ImageIcon, action: { type: 'route', href: '/tools/wallpapers' } },
  { key: 'donation', label: 'Donation & Charity', icon: GiftIcon, action: { type: 'route', href: '/tools/charity' } },
  { key: 'calendar', label: 'Islamic Events', icon: CalendarIcon, action: { type: 'route', href: '/tools/events' } },
  { key: 'tasbih', label: 'Tasbih', icon: BeadsIcon, action: { type: 'route', href: '/tools/tasbeeh' } },
  { key: 'calendar', label: 'Calendar', icon: CalendarIcon, action: { type: 'route', href: '/tools/calendar' } },
  { key: 'hadith', label: 'Hadith', icon: ScrollIcon, action: { type: 'route', href: '/tools/hadith' } },
  { key: 'quran', label: 'Quran', icon: BookIcon, action: { type: 'route', href: '/(tabs)/quran' } },
  { key: 'names', label: 'Names of Allah', icon: StarCrescentIcon, action: { type: 'route', href: '/tools/names' } },
  { key: 'shop', label: 'Islamic Poster', icon: ImageIcon, action: { type: 'web', url: 'https://deenlink.org/poster/' } },
  { key: 'quiz', label: 'Quiz', icon: BrainIcon, action: { type: 'route', href: '/tools/quiz' } },
  { key: 'learning', label: 'Learning Hub', icon: (p: any) => <FontAwesome5 name="graduation-cap" size={(p.size ?? 20) * 0.9} color={p.color} />, action: { type: 'route', href: '/tools/learning' } },
  { key: 'ruqyah', label: 'Ruqyah', icon: (p: any) => <FontAwesome5 name="shield-alt" size={(p.size ?? 20) * 0.9} color={p.color} />, action: { type: 'route', href: '/tools/ruqyah' } },
];

export function QuickGrid({ onOpenPost }: { onOpenPost?: () => void }) {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const press = (item: QuickItem) => {
    const a = item.action;
    if (a.type === 'route') router.push(a.href);
    else if (a.type === 'modal') onOpenPost?.();
    else Linking.openURL(a.url).catch(() => {});
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingVertical: 4, paddingBottom: 12 }}
    >
      {QUICK_ITEMS.map((q, i) => {
        const Icon = q.icon;
        const tint = tiles[q.key];
        const dark = isDark ? tilesDark[q.key] : null;
        return (
          <Pressable
            key={`${q.key}-${i}`}
            onPress={() => press(q)}
            style={({ pressed }) => ({
              width: 100,
              height: 100,
              borderRadius: 16,
              opacity: pressed ? 0.85 : 1,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
            })}
          >
            <LinearGradient
              colors={dark ? [dark.from, dark.to] : [tint.from, tint.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: '100%', height: '100%', borderRadius: 16 }}
            >
              <Icon size={27} color={isDark ? theme.text : tint.icon} />
              <T
                v="caption"
                style={{
                  marginTop: 8,
                  fontWeight: '600',
                  fontSize: 12,
                  color: isDark ? theme.text : '#000000',
                  textAlign: 'center',
                  paddingHorizontal: 6,
                }}
              >
                {q.label}
              </T>
            </LinearGradient>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
