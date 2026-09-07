import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { BackButton } from '@/components/BackButton';

export function TopBar({
  title,
  subtitle,
  showBack = false,
  right,
  insetTop = true,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  /** Set false when the screen already supplies a top inset (e.g. it wraps this
   *  bar in a top-edge SafeAreaView) — otherwise the padding is applied twice. */
  insetTop?: boolean;
}) {
  const { theme } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  /* pass 44 — SAFE AREA FIX. This bar used a hardcoded paddingTop: 12, so on a
   * device every TopBar screen rendered 12px from the physical screen edge:
   * the title sat behind the clock on the left and the signal/LTE/battery
   * icons on the right. None of the 13 TopBar screens wrapped it in a
   * SafeAreaView or applied insets.top themselves, so fixing it here covers
   * all of them at once. Mirrors PageHero's proven Math.max(insets.top, 12).
   * If a screen ever wraps TopBar in a top-edge SafeAreaView, pass insetTop={0}. */
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingTop: insetTop ? Math.max(insets.top, 12) : 12,
        paddingBottom: 14,
        backgroundColor: d.bg,
      }}
    >
      {showBack ? <View style={{ marginRight: 12 }}><BackButton /></View> : null}
      <View style={{ flex: 1 }}>
        <T v="h1" style={{ color: d.text, fontWeight: '800', fontSize: 21 }}>{title}</T>
        {subtitle ? <T v="caption" style={{ marginTop: 2, color: d.faint }}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}
