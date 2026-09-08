import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useVideoPlayer } from 'expo-video';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';

/**
 * pass 83-10c — audio-upload player for group posts: a cassette whose two
 * reels spin while the clip plays. Art is pure SVG (per the shared-art rule —
 * no video/gif assets); playback rides expo-video, the app's cross-platform
 * media engine (same one the Qur'an audio uses), so web + native behave alike.
 */
export function AudioCassette({ url }: { url: string }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const player = useVideoPlayer(url);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (playing) {
      const a = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }),
      );
      a.start();
      return () => a.stop();
    }
    return undefined;
  }, [playing, spin]);

  /* progress poll — same trick as the Qur'an player: web engines don't
   * always emit timeUpdate, and this also detects the end of the clip. */
  useEffect(() => {
    if (!playing) return undefined;
    const iv = setInterval(() => {
      try {
        const p = player.currentTime ?? 0;
        const t = player.duration ?? 0;
        setPos(p);
        setDur(t);
        if (t > 0 && p >= t - 0.25) { setPlaying(false); }
      } catch { /* player disposed */ }
    }, 400);
    return () => clearInterval(iv);
  }, [playing, player]);

  const toggle = () => {
    try {
      if (playing) { player.pause(); setPlaying(false); }
      else { player.play(); setPlaying(true); }
    } catch { /* not ready yet */ }
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const accent = isDark ? '#4AE38F' : '#1D6F42';

  const reel = (left: number) => (
    <Animated.View style={{ position: 'absolute', left, top: 9, transform: [{ rotate }] }}>
      <Svg width={30} height={30} viewBox="0 0 30 30">
        <Circle cx={15} cy={15} r={13} fill="none" stroke={accent} strokeWidth={2} />
        <Circle cx={15} cy={15} r={4} fill={accent} />
        {[0, 60, 120].map((ang) => (
          <Rect key={ang} x={14} y={4} width={2} height={8} fill={accent} transform={`rotate(${ang} 15 15)`} />
        ))}
      </Svg>
    </Animated.View>
  );

  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  return (
    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(20,36,28,0.03)', padding: 12, marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* the cassette shell */}
        <View style={{ width: 88, height: 56, borderRadius: 9, backgroundColor: isDark ? '#101F16' : '#E8C96A', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(140,109,31,0.4)', overflow: 'hidden' }}>
          {reel(11)}
          {reel(47)}
          <View style={{ position: 'absolute', left: 31, top: 40, width: 26, height: 9, borderRadius: 3, backgroundColor: isDark ? '#0A140E' : '#8C6D1F', opacity: 0.85 }} />
        </View>
        <View style={{ flex: 1, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={toggle} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name={playing ? 'pause' : 'play'} size={12} color="#fff" />
            </Pressable>
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: d.faint }}>
              {mmss(pos)} / {dur ? mmss(dur) : '--:--'}
            </T>
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)' }}>
            <View style={{ height: 4, borderRadius: 2, width: `${dur ? Math.min(100, (pos / dur) * 100) : 0}%` as `${number}%`, backgroundColor: accent }} />
          </View>
        </View>
      </View>
    </View>
  );
}
