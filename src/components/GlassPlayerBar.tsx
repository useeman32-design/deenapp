import React, { useMemo, useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { ActivityIndicator, PanResponder, Pressable, View } from 'react-native';
import { VideoView } from 'expo-video';
import type { VideoPlayer } from 'expo-video';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * GlassPlayerBar (pass 22) — the ONE player design used across the app
 * (quran reader, dua, athkar, 99 names): frosted-glass bar, play/pause with a
 * loading spinner, title + subtitle line UNDER the title, draggable seek.
 * Mounts the hidden VideoView the web engine needs — pass the player in.
 */
export function GlassPlayerBar({
  player,
  playing,
  loading,
  title,
  subtitle,
  arabic,
  onToggle,
  frac,
  duration,
  onSeek,
  seekMargins,
  right,
}: {
  player: VideoPlayer | null;
  playing: boolean;
  loading?: boolean;
  title: string;
  subtitle?: string;
  arabic?: string;
  onToggle: () => void;
  /** seek state — omit for players without a seekable timeline (athkar) */
  frac?: number;
  duration?: number;
  onSeek?: (f: number) => void;
  /** shrink the seek bar a little (e.g. { left: 46, right: 8 }) */
  seekMargins?: { left: number; right: number };
  right?: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const trackW = useRef(1);
  const [dragging, setDragging] = useState(false);
  const [dragFrac, setDragFrac] = useState(0);
  const dragFracRef = useRef(0);
  const shown = dragging ? dragFrac : (frac ?? 0);
  const hasSeek = onSeek != null && frac != null;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          setDragging(true);
          const f = Math.max(0, Math.min(1, e.nativeEvent.locationX / (trackW.current || 1)));
          dragFracRef.current = f;
          setDragFrac(f);
        },
        onPanResponderMove: (e) => {
          const f = Math.max(0, Math.min(1, e.nativeEvent.locationX / (trackW.current || 1)));
          dragFracRef.current = f;
          setDragFrac(f);
        },
        onPanResponderRelease: () => {
          setDragging(false);
          haptic.selection();
          onSeek?.(dragFracRef.current);
        },
        onPanResponderTerminate: () => setDragging(false),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSeek],
  );

  const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

  return (
    <View
      style={[
        {
          borderRadius: 18,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(74,227,143,0.28)' : 'rgba(29,111,66,0.22)',
          backgroundColor: isDark ? 'rgba(10,22,15,0.72)' : 'rgba(255,255,255,0.72)',
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
        },
        /* frosted glass — RNW forwards web-only props to the DOM */
        {
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        } as unknown as ViewStyle,
      ]}
    >
      {/* hidden media element — expo-video on web needs a mounted VideoView */}
      {player ? (
        <View style={{ position: 'absolute', width: 2, height: 2, opacity: 0.01 }} pointerEvents="none">
          <VideoView player={player} style={{ width: 2, height: 2 }} contentFit="contain" nativeControls={false} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={() => {
            haptic.light();
            onToggle();
          }}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark ? '#1F8F5C' : '#1D6F42',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <FontAwesome5 name={playing ? 'pause' : 'play'} size={12} color="#FFFFFF" />
          )}
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="caption" numberOfLines={1} style={{ color: isDark ? '#F2F7F3' : '#14241C', fontWeight: '800', fontSize: 11.5 }}>
            {title}
            {arabic ? <T v="arabic" style={{ fontSize: 12 }}> {arabic}</T> : null}
          </T>
          {subtitle ? (
            <T v="caption" numberOfLines={1} style={{ color: isDark ? 'rgba(242,247,243,0.55)' : 'rgba(20,36,28,0.55)', fontSize: 9.5, fontWeight: '600', marginTop: 1 }}>
              {subtitle}
            </T>
          ) : null}
        </View>
        {right}
      </View>

      {hasSeek ? (
        <View style={{ marginTop: 6, marginBottom: 2, marginLeft: seekMargins?.left ?? 0, marginRight: seekMargins?.right ?? 0 }}>
          <View {...pan.panHandlers} onLayout={(e) => (trackW.current = e.nativeEvent.layout.width)} style={{ height: 20, justifyContent: 'center' }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(20,36,28,0.12)' }} />
            <View style={{ position: 'absolute', left: 0, width: `${shown * 100}%`, height: 4, borderRadius: 2, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
            <View
              style={{
                position: 'absolute',
                left: `${shown * 100}%`,
                marginLeft: -6,
                width: 12,
                height: 12,
                borderRadius: 7,
                backgroundColor: '#FFFFFF',
                borderWidth: 2.5,
                borderColor: isDark ? '#4AE38F' : '#1D6F42',
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
                transform: [{ scale: dragging ? 1.25 : 1 }],
              }}
            />
          </View>
          {duration && duration > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 }}>
              <T v="caption" style={{ fontSize: 8.5, color: isDark ? 'rgba(242,247,243,0.45)' : 'rgba(20,36,28,0.45)', fontVariant: ['tabular-nums'] }}>{mmss(shown * duration)}</T>
              <T v="caption" style={{ fontSize: 8.5, color: isDark ? 'rgba(242,247,243,0.45)' : 'rgba(20,36,28,0.45)', fontVariant: ['tabular-nums'] }}>{mmss(duration)}</T>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
