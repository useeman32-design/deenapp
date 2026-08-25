import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { storage } from '@/lib/storage';
import { DeenLogo } from '@/components/DeenLogo';
import { GradientButton } from '@/components/GradientButton';
import { Surface } from '@/components/Surface';
import { T } from '@/components/T';
import { BeadsIcon, BookIcon, CheckCircleIcon, MoonStarIcon, TargetIcon } from '@/components/Icons';

const bookImg = require('../../assets/img/onboard-book.png');
const mosqueImg = require('../../assets/img/onboard-mosque.png');
const patternDark = require('../../assets/img/pattern-dark.png');
const patternLight = require('../../assets/img/pattern-light.png');

const SLIDES = 3;
const WIDTH = Dimensions.get('window').width;

const PROGRESS_ROWS = [
  { icon: TargetIcon, tint: 'accent' as const, label: 'Daily Goal', value: '4 / 5', pct: 80 },
  { icon: BookIcon, tint: 'primary' as const, label: 'Quran', value: '21 min', pct: 42 },
  { icon: BeadsIcon, tint: 'primary' as const, label: 'Dhikr', value: '160 / 200', pct: 80 },
  { icon: CheckCircleIcon, tint: 'accent' as const, label: 'Prayer', value: '5 / 5', pct: 100 },
];

export default function Onboarding() {
  const { theme, isDark } = useTheme();
  const [phase, setPhase] = useState<'splash' | 'slides'>('splash');
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setTimeout(() => setPhase('slides'), 1900);
    return () => clearTimeout(t);
  }, []);

  const finish = () => {
    storage.setItem('dl.onboarded', '1');
    router.replace('/(auth)/login');
  };

  const next = () => {
    if (page >= SLIDES - 1) {
      finish();
      return;
    }
    const p = page + 1;
    setPage(p);
    scrollRef.current?.scrollTo({ x: p * WIDTH, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Image
        source={isDark ? patternDark : patternLight}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        resizeMode="cover"
      />
      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(5, 13, 9, 0.5)' : 'rgba(247, 245, 239, 0.62)' }}>
        {phase === 'splash' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <DeenLogo size={94} color={theme.primary} accent={theme.accent} />
            <T v="h1" style={{ marginTop: 22 }}>DeenLink</T>
            <T v="caption" style={{ marginTop: 8 }}>Connecting you to what matters.</T>
            <View style={{ flexDirection: 'row', gap: 7, marginTop: 26 }}>
              <View style={{ width: 24, height: 4, borderRadius: 2, backgroundColor: theme.accent }} />
              <View style={{ width: 9, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
              <View style={{ width: 9, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ height: 36 }} />
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={WIDTH}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / WIDTH))}
            >
              {/* Slide 1 */}
              <View style={{ width: WIDTH, padding: 28, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <MoonStarIcon size={13} color={theme.primary} />
                  <T v="meta" color="primary" style={{ letterSpacing: 0.8 }}>FAITH · DAILY</T>
                </View>
                <T v="display" style={{ marginTop: 14, textAlign: 'center' }}>
                  Strengthen
                  {'\n'}your Imaan
                </T>
                <T v="body" style={{ marginTop: 10, textAlign: 'center' }}>
                  Quran, Hadith, Dhikr and more in one place.
                </T>
                <Image source={bookImg} style={{ width: '100%', height: 252, marginTop: 26, borderRadius: 24 }} resizeMode="cover" />
              </View>

              {/* Slide 2 */}
              <View style={{ width: WIDTH, padding: 28, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <TargetIcon size={13} color={theme.primary} />
                  <T v="meta" color="primary" style={{ letterSpacing: 0.8 }}>CONSISTENCY</T>
                </View>
                <T v="display" style={{ marginTop: 14, textAlign: 'center' }}>
                  Stay on track
                  {'\n'}every day
                </T>
                <T v="body" style={{ marginTop: 10, textAlign: 'center' }}>
                  Track goals, build habits and grow consistently.
                </T>
                <Surface style={{ width: '100%', marginTop: 26, paddingVertical: 10 }}>
                  {PROGRESS_ROWS.map((r) => {
                    const Icon = r.icon;
                    const tint = r.tint === 'accent' ? theme.accent : theme.primary;
                    return (
                      <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14 }}>
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 11,
                            backgroundColor: r.tint === 'accent' ? theme.accentSoft : theme.primarySoft,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon size={16} color={tint} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 11 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <T v="bodyS" style={{ fontWeight: '600' }}>{r.label}</T>
                            <T v="caption" color="primary" style={{ fontWeight: '800' }}>{r.value}</T>
                          </View>
                          <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.border, marginTop: 6, overflow: 'hidden' }}>
                            <View style={{ height: 4, borderRadius: 2, backgroundColor: tint, width: `${r.pct}%` }} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </Surface>
              </View>

              {/* Slide 3 */}
              <View style={{ width: WIDTH, padding: 28, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <CheckCircleIcon size={13} color={theme.primary} />
                  <T v="meta" color="primary" style={{ letterSpacing: 0.8 }}>COMMUNITY</T>
                </View>
                <T v="display" style={{ marginTop: 14, textAlign: 'center' }}>
                  A community
                  {'\n'}that cares
                </T>
                <T v="body" style={{ marginTop: 10, textAlign: 'center' }}>
                  Learn, share and grow together.
                </T>
                <Image source={mosqueImg} style={{ width: '100%', height: 252, marginTop: 26, borderRadius: 24 }} resizeMode="cover" />
              </View>
            </ScrollView>

            <View style={{ padding: 20 }}>
              <GradientButton label={page >= SLIDES - 1 ? 'Get Started' : 'Next'} onPress={next} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 }}>
                {Array.from({ length: SLIDES }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === page ? 22 : 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: i === page ? theme.primary : theme.border,
                    }}
                  />
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
