import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { T } from '@/components/T';

/**
 * pass 40 — the shared DeenLink loading mark: a crescent + star that slowly
 * rotates and gently pulses. Replaces plain ActivityIndicators/"loading"
 * text in video load, share generation, calculating states…
 */
export function CrescentLoader({ size = 46, label, color = '#D4AF37', dark = false }: { size?: number; label?: string; color?: string; dark?: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => { a.stop(); };
  }, [spin]);

  const r = size / 2;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={47} fill="none" stroke={color} strokeWidth={2.5} opacity={0.25} strokeDasharray="4 7" />
          <Path
            fillRule="evenodd"
            d="M 50 26 A 24 24 0 0 1 50 74 A 24 24 0 0 1 50 26 Z M 56 33 A 17 17 0 0 1 56 67 A 17 17 0 0 1 56 33 Z"
            fill={color}
          />
          <Path d="M 66.5 42.0 L 68.4 46.9 L 73.6 47.2 L 69.5 50.5 L 70.9 55.6 L 66.5 52.7 L 62.1 55.6 L 63.5 50.5 L 59.4 47.2 L 64.6 46.9 Z" fill={color} />
        </Svg>
      </Animated.View>
      {label ? <T v="caption" style={{ fontSize: 10.5, letterSpacing: 0.4, color: dark ? 'rgba(245,248,245,0.6)' : undefined, opacity: 0.85 }}>{label}</T> : null}
    </View>
  );
}
