import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import type { ComponentType } from 'react';
import type { IconProps } from '@/components/Icons';

/**
 * Web inner-page header (.top-section), 1:1 — mecca background photo with
 * green gradient overlay, page-title row (icon + label) and centered
 * h1 + subtitle.
 */
export function PageHero({
  title,
  heading,
  sub,
  icon: Icon,
  children,
  height = 240,
}: {
  title: string;
  heading: string;
  sub?: string;
  icon?: ComponentType<IconProps>;
  children?: React.ReactNode;
  height?: number;
}) {
  const { mode } = useTheme();
  const colors: [string, string, ...string[]] = mode === 'dark'
    ? ['rgba(46,204,113,0.95)', 'rgba(39,174,96,0.9)']
    : ['rgba(29,111,66,0.9)', 'rgba(29,111,66,0.8)'];

  return (
    <View style={{ height }}>
      <Image source={require('../../assets/img/mecca.jpg')} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      {/* top-bar with page title */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        {Icon ? <Icon size={20} color="#fff" /> : null}
        <T v="h2" color="onPrimary" style={{ marginLeft: Icon ? 10 : 0, fontWeight: '600', fontSize: 20 }}>
          {title}
        </T>
        <View style={{ flex: 1 }} />
        {children}
      </View>
      {/* centered title block */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 86, alignItems: 'center', padding: 16 }}>
        <T v="display" color="onPrimary" style={{ fontSize: 24, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>
          {heading}
        </T>
        {sub ? (
          <T v="body" color="onPrimary" style={{ fontSize: 15, opacity: 0.9, marginTop: 8, textAlign: 'center', maxWidth: 400, lineHeight: 22 }}>
            {sub}
          </T>
        ) : null}
      </View>
    </View>
  );
}
