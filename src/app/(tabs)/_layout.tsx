import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Redirect, Tabs } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';

/* ------------------------------------------------------------------ */
/* Floating glassy tab bar with ONE sliding pill.                      */
/*                                                                      */
/* Structure (bottom → top):                                            */
/*   1. floating wrapper  — absolute, inset by margins, R.xxl radius    */
/*   2. glass             — BlurView + translucent tint + 1px hairline  */
/*   3. the pill          — 48×34 rounded-14, greenSoft, slides         */
/*   4. per-tab content   — stacked icon + label, cross-faded opacity   */
/*                                                                      */
/* One continuous Animated.Value (`pos`) drives everything:             */
/*   • pill glide   pos → [0, n-1] mapped to [pillX(0), pillX(n-1)]     */
/*   • tab "lit"    pos over [i-0.55, i, i+0.55] → [0, 1, 0] (clamped)  */
/* Opacity + transform only → useNativeDriver: true.                    */
/* ------------------------------------------------------------------ */

const TABS = [
  { name: 'index', first: 'Home', second: '', icon: 'home' as const },
  { name: 'quran', first: 'Quran &', second: 'Hadith', icon: 'quran' as const },
  { name: 'tools', first: 'Worship', second: 'Tools', icon: 'mosque' as const },
  { name: 'community', first: 'Community', second: '', icon: 'users' as const },
  { name: 'profile', first: 'Profile', second: '', icon: 'user' as const },
];

const PILL_W = 48;
const PILL_H = 34;
const PILL_R = 14;
const PILL_TOP = 12;
const SIDE_PAD = 8;

function FloatingTabBar({
  state,
  navigation,
  insets,
}: {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { navigate: (name: string) => void };
  insets: { bottom: number };
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;

  const n = state.routes.length;
  const [barW, setBarW] = useState(0);
  const itemW = barW > 0 ? (barW - 2 * SIDE_PAD) / n : 0;
  const pillX = (i: number) => SIDE_PAD + i * itemW + (itemW - PILL_W) / 2;

  const pos = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.timing(pos, {
      toValue: state.index,
      duration: 420,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: true,
    }).start();
  }, [state.index, pos]);

  const pillTranslate = pos.interpolate({
    inputRange: [0, n - 1],
    outputRange: [pillX(0), pillX(n - 1)],
  });

  return (
    <View
      onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 20 + insets.bottom,
        height: 74,
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        // soft deep-green lift
        shadowColor: d.navShadow,
        shadowOpacity: 0.14,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 12 },
        elevation: 10,
      }}
    >
      {/* glass layer 1 — blur */}
      <BlurView intensity={isDark ? 42 : 22} tint={isDark ? 'dark' : 'light'} style={{ position: 'absolute', inset: 0 }} />
      {/* glass layer 2 — translucent tint + hairline */}
      <View
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: d.navTint,
          borderWidth: 1,
          borderColor: d.navBorder,
          borderRadius: 26,
        }}
      />

      {/* the one sliding pill */}
      {itemW > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: PILL_TOP,
            width: PILL_W,
            height: PILL_H,
            borderRadius: PILL_R,
            backgroundColor: d.greenSoft,
            transform: [{ translateX: pillTranslate }],
          }}
        />
      )}

      {/* per-tab content */}
      <View style={{ position: 'absolute', inset: 0, flexDirection: 'row', paddingHorizontal: SIDE_PAD }}>
        {state.routes.map((route, i) => {
          const tab = TABS.find((t) => t.name === route.name) ?? TABS[0];
          const lit = pos.interpolate({
            inputRange: [i - 0.55, i, i + 0.55],
            outputRange: [0, 1, 0],
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const dim = lit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
          return (
            <Pressable
              key={route.key}
              style={{ flex: 1, alignItems: 'center', paddingTop: PILL_TOP }}
              onPress={() => {
                if (state.index !== i) {
                  haptic.selection();
                  navigation.navigate(route.name as never);
                }
              }}
            >
              {/* stacked icons: faint base + lit green, cross-faded */}
              <View style={{ height: PILL_H, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={{ position: 'absolute', opacity: dim }}>
                  <FontAwesome5 name={tab.icon} size={19} color={d.faint} />
                </Animated.View>
                <Animated.View style={{ opacity: lit }}>
                  <FontAwesome5 name={tab.icon} size={19} color={d.emerald} />
                </Animated.View>
              </View>
              {/* stacked labels: faint base + lit, cross-faded */}
              <View style={{ height: 24, marginTop: 4, width: itemW }}>
                <Animated.View style={{ position: 'absolute', top: 0, left: 0, width: itemW, opacity: dim }}>
                  <TabLabels first={tab.first} second={tab.second} color={d.faint} width={itemW} />
                </Animated.View>
                <Animated.View style={{ position: 'absolute', top: 0, left: 0, width: itemW, opacity: lit }}>
                  <TabLabels first={tab.first} second={tab.second} color={isDark ? '#FFFFFF' : d.text} active color2={d.emerald} width={itemW} />
                </Animated.View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabLabels({
  first,
  second,
  color,
  active,
  color2,
  width,
}: {
  first: string;
  second: string;
  color: string;
  active?: boolean;
  color2?: string;
  width?: number;
}) {
  const base = {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 9,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
    includeFontPadding: false,
    textAlign: 'center' as const,
    lineHeight: 10.5,
    width,
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ ...base, color: active && color2 ? color2 : color }}>{first}</Text>
      {second ? <Text style={{ ...base, color: active && color2 ? color2 : color }}>{second}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */

export default function TabsLayout() {
  const { ready, user } = useAuth();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="quran" options={{ title: 'Quran & Hadith' }} />
      <Tabs.Screen name="tools" options={{ title: 'Worship Tools' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
