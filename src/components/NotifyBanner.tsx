import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { T } from '@/components/T';
import { useTheme } from '@/context/ThemeContext';
import { haptic } from '@/lib/haptics';
import { setBannerHost } from '@/lib/notifyCenter';

/**
 * pass 97 — the in-app arrival banner.
 *
 * Owner: "i tried chatting with a pwa app i dont if notifications is registered
 * or wired there but am not seeing the chatting or other notifications of the
 * app." Until real push is live, an arrival has to be VISIBLE: this slides a
 * tappable card in from the top the moment the unread count grows, and takes you
 * to the inbox / notifications screen. Mounted once, in the root layout.
 */
export function NotifyBanner(): React.ReactElement | null {
  const { isDark } = useTheme();
  const [item, setItem] = useState<{ title: string; body: string; go?: () => void } | null>(null);
  const slide = useRef(new Animated.ValueXY({ x: 0, y: -120 })).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = (x = 0, y = -140) => {
    if (timer.current) clearTimeout(timer.current);
    /* Animate the whole vector so a diagonal/vertical swipe cannot leave the
     * other axis parked off-screen. PanResponder capture below makes this work
     * on web and native in all four directions. */
    Animated.timing(slide, { toValue: { x, y }, duration: 220, useNativeDriver: true }).start(() => setItem(null));
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
    onPanResponderGrant: () => { slide.stopAnimation(); },
    onPanResponderMove: (_, g) => slide.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 70 || Math.abs(g.dy) > 70) {
        const x = Math.abs(g.dx) > Math.abs(g.dy) ? (g.dx > 0 ? 420 : -420) : 0;
        const y = x === 0 ? (g.dy > 0 ? 180 : -180) : 0;
        dismiss(x, y);
      } else {
        Animated.spring(slide, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 5 }).start();
      }
    },
  })).current;

  useEffect(() => {
    setBannerHost((b) => setItem(b));
    return () => setBannerHost(null);
  }, []);

  useEffect(() => {
    if (!item) return;
    slide.setValue({ x: 0, y: -120 });
    Animated.timing(slide.y, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dismiss(0, -140);
    }, 5200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [item, slide]);

  if (!item) return null;

  const card = isDark ? '#12211A' : '#FFFFFF';
  const border = isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 9999, transform: [{ translateX: slide.x }, { translateY: slide.y }] }}
    >
      <Pressable
        {...responder.panHandlers}
        onPress={() => {
          haptic.selection();
          const go = item.go;
          setItem(null);
          go?.();
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: card,
          paddingHorizontal: 13,
          paddingVertical: 11,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 12,
        }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(212,175,55,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="bell" size={13} color="#D4AF37" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: isDark ? '#F2F7F3' : '#14241C' }} numberOfLines={1}>
            {item.title}
          </T>
          <T v="caption" style={{ fontSize: 10.5, color: isDark ? 'rgba(242,247,243,0.72)' : 'rgba(20,36,28,0.66)', marginTop: 1 }} numberOfLines={2}>
            {item.body}
          </T>
        </View>
        <FontAwesome5 name="chevron-right" size={11} color={isDark ? 'rgba(242,247,243,0.5)' : 'rgba(20,36,28,0.4)'} />
      </Pressable>
    </Animated.View>
  );
}
