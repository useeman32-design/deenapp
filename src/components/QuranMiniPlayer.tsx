import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useQuranAudio } from '@/context/QuranAudioContext';
import { QURAN } from '@/data/quran';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Cassette mini-player (pass 16) — global Qur'an audio, shrunk to a small
 * round cassette at the left. Tap → expands with surah · ayah · speed;
 * tap the cassette again → jumps to the reader at the playing ayah.
 * Auto-collapses after 5s.
 */
export function QuranMiniPlayer() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { surah, ayah, playing, rate, toggle, cycleRate } = useQuranAudio();
  const [expanded, setExpanded] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(46)).current;

  useEffect(() => {
    if (playing) {
      const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }));
      a.start();
      return () => a.stop();
    }
    return undefined;
  }, [playing, spin]);

  useEffect(() => {
    Animated.spring(width, { toValue: expanded ? 218 : 46, useNativeDriver: false, friction: 8 }).start();
    if (expanded) {
      const t = setTimeout(() => setExpanded(false), 5000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [expanded, width]);

  if (surah == null) return null;
  const meta = QURAN.find((s) => s.number === surah);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 12,
        bottom: 10 + insets.bottom + 76,
        height: 46,
        width,
        borderRadius: 23,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(8,20,13,0.94)' : 'rgba(255,255,255,0.97)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        zIndex: 60,
      }}
    >
      {/* cassette — tap 1: expand · tap 2 (expanded): go to the reader */}
      <Pressable
        onPress={() => {
          haptic.selection();
          if (expanded) router.push(`/read/${surah}?ayah=${ayah}` as never);
          else setExpanded(true);
        }}
        style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <FontAwesome5 name="compact-disc" size={25} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Animated.View>
      </Pressable>

      {expanded ? (
        <View style={{ flex: 1, paddingRight: 8, opacity: expanded ? 1 : 0 }}>
          <T v="caption" numberOfLines={1} style={{ color: d.text, fontWeight: '800', fontSize: 11 }}>
            {meta?.english ?? 'Qur’an'} · Ayah {ayah}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
            <Pressable onPress={toggle} hitSlop={6} style={{ marginRight: 7 }}>
              <FontAwesome5 name={playing ? 'pause' : 'play'} size={10} color={isDark ? '#4AE38F' : '#1D6F42'} />
            </Pressable>
            <Pressable onPress={() => { haptic.selection(); cycleRate(); }} hitSlop={6} style={{ marginRight: 7 }}>
              <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10 }}>
                {rate}x
              </T>
            </Pressable>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: playing ? '#2ECC71' : 'rgba(150,150,150,0.6)' }} />
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}
