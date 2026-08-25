import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';

/**
 * Card with a pointed mihrab-arch top, drawn as a single SVG path so the
 * shape works at any content height.
 */
export function ArchCard({
  children,
  style,
  contentStyle,
  archHeight = 52,
  fill,
  strokeColor,
  strokeWidth = 1,
  padding = 16,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  archHeight?: number;
  fill?: string;
  strokeColor?: string;
  strokeWidth?: number;
  padding?: number;
}) {
  const { theme } = useTheme();
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const fillC = fill ?? theme.card;
  const r = 18;

  const path = (w: number, h: number) =>
    [
      `M 0 ${archHeight}`,
      `Q 0 ${archHeight * 0.14} ${w / 2} 0`,
      `Q ${w} ${archHeight * 0.14} ${w} ${archHeight}`,
      `L ${w} ${h - r}`,
      `Q ${w} ${h} ${w - r} ${h}`,
      `L ${r} ${h}`,
      `Q 0 ${h} 0 ${h - r}`,
      'Z',
    ].join(' ');

  return (
    <View
      onLayout={(e) => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[{ overflow: 'hidden' }, style]}
    >
      {dims.w > 0 && dims.h > 0 ? (
        <Svg width={dims.w} height={dims.h} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Path d={path(dims.w, dims.h)} fill={fillC} />
          <Path d={path(dims.w, dims.h)} fill="none" stroke={strokeColor ?? theme.border} strokeWidth={strokeWidth} />
        </Svg>
      ) : null}
      <View style={[{ flex: 1, padding, paddingTop: archHeight - 14 }, contentStyle]}>{children}</View>
    </View>
  );
}
