import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/* pass 82 — audio post player: a cassette whose two reels spin while the
 * clip plays. Used by group voice posts (and any post carrying audio_url). */

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function Reel({ spin, dark }: { spin: Animated.Value; dark: boolean }) {
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spoke = dark ? '#0B1710' : '#F4EEDD';
  return (
    <Animated.View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: dark ? '#16281D' : '#E7DCC0', alignItems: 'center', justifyContent: 'center', transform: [{ rotate }] }}>
      <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: dark ? '#0B1710' : '#C9B98F' }} />
      {[0, 60, 120].map((deg) => (
        <View key={deg} style={{ position: 'absolute', width: 4, height: 40, borderRadius: 2, backgroundColor: spoke, opacity: 0.55, transform: [{ rotate: `${deg}deg` }] }} />
      ))}
    </Animated.View>
  );
}

export function CassettePlayer({ url }: { url: string }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (status?.playing) {
      loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
    } else {
      spin.stopAnimation((v) => spin.setValue(v % 1));
    }
    return () => { loop?.stop(); };
  }, [status?.playing, spin]);

  const dur = Number(status?.duration ?? 0);
  const cur = Number(status?.currentTime ?? 0);
  const pct = dur > 0 ? Math.min(1, cur / dur) : 0;
  const done = !!status?.didJustFinish;

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.28)' : 'rgba(184,134,11,0.25)', backgroundColor: isDark ? '#101F16' : '#FBF6E9', padding: 13, gap: 11 }}>
      {/* cassette shell */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 12, backgroundColor: isDark ? '#0C1A12' : '#EFE5C8', paddingVertical: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(120,96,40,0.2)' }}>
          <Reel spin={spin} dark={isDark} />
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: isDark ? '#1D3527' : '#D9C99F' }} />
          <Reel spin={spin} dark={isDark} />
        </View>
        <Pressable
          accessibilityLabel={status?.playing ? 'pause audio' : 'play audio'}
          onPress={() => {
            haptic.light();
            if (!url) return;
            if (status?.playing) player.pause();
            else { if (done) player.seekTo(0); player.play(); }
          }}
          style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: isDark ? '#D4AF37' : '#B8860B', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
        >
          <FontAwesome5 name={status?.playing ? 'pause' : 'play'} size={15} color={isDark ? '#14241C' : '#fff'} style={status?.playing ? undefined : { marginLeft: 2 }} />
        </Pressable>
      </View>
      {/* progress */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: d.faint, width: 34 }}>{fmt(cur)}</T>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(60,48,20,0.14)' }}>
          <View style={{ width: `${Math.round(pct * 100)}%`, height: 4, borderRadius: 2, backgroundColor: isDark ? '#D4AF37' : '#B8860B' }} />
        </View>
        <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: d.faint, width: 34, textAlign: 'right' }}>{fmt(dur)}</T>
      </View>
    </View>
  );
}
