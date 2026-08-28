import { Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import type { ComponentType } from 'react';
import type { IconProps } from '@/components/Icons';

/**
 * Page hero — pass-14 dash redesign: deep-forest gradient over the mecca
 * photo, subtle themed pattern, gold eyebrow + big title. Shared by every
 * tool screen and the Qur'an hub, so they all speak the new design.
 */
export function PageHero({
  title,
  heading,
  sub,
  icon: Icon,
  children,
  height = 230,
  back = true,
}: {
  title: string;
  heading: string;
  sub?: string;
  icon?: ComponentType<IconProps>;
  children?: React.ReactNode;
  height?: number;
  back?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const pattern = isDark ? require('../../assets/img/pattern-dark.png') : require('../../assets/img/pattern-light.png');

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Image source={require('../../assets/img/mecca.jpg')} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
      <Image source={pattern} style={{ position: 'absolute', width: '100%', height: '100%', opacity: d.patternOpacity * 0.6 }} resizeMode="cover" />
      <LinearGradient
        colors={(isDark ? ['rgba(3,20,12,0.93)', 'rgba(5,32,20,0.86)'] : ['rgba(6,38,23,0.88)', 'rgba(13,58,37,0.8)']) as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* top bar: back + page title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingHorizontal: 14 }}>
        {back ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
          >
            <T v="h2" style={{ color: '#FFFFFF', fontSize: 17, lineHeight: 22 }}>
              ‹
            </T>
          </Pressable>
        ) : null}
        {Icon ? <Icon size={19} color="#E8C96A" /> : null}
        <T v="caption" style={{ marginLeft: Icon ? 8 : 0, color: 'rgba(255,255,255,0.75)', fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>
          {title.toUpperCase()}
        </T>
        <View style={{ flex: 1 }} />
        {children}
      </View>

      {/* centered title block */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 84, alignItems: 'center', padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 26, height: 1.5, backgroundColor: 'rgba(212,175,55,0.7)' }} />
          <T v="caption" style={{ color: '#E8C96A', fontWeight: '800', fontSize: 10, letterSpacing: 1.6 }}>
            DEENLINK
          </T>
          <View style={{ width: 26, height: 1.5, backgroundColor: 'rgba(212,175,55,0.7)' }} />
        </View>
        <T v="display" style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 8, textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }}>
          {heading}
        </T>
        {sub ? (
          <T v="body" style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, marginTop: 7, textAlign: 'center', maxWidth: 400, lineHeight: 20 }}>
            {sub}
          </T>
        ) : null}
      </View>
    </View>
  );
}
