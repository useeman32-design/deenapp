import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { storage } from '@/lib/storage';
import { DeenLogo } from '@/components/DeenLogo';
import { GradientButton } from '@/components/GradientButton';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

const bookImg = require('../../assets/img/onboard-book.jpg');
const mosqueImg = require('../../assets/img/onboard-mosque.jpg');
const patternDark = require('../../assets/img/pattern-dark.png');
const patternLight = require('../../assets/img/pattern-light.png');

const SLIDES = 3;
const WIDTH = Dimensions.get('window').width;

const STATS = [
  { icon: 'book-open' as const, label: 'Quran reading', value: '21 min', pct: 42, tint: 'emerald' as const },
  { icon: 'list-ol' as const, label: 'Daily dhikr', value: '160 / 200', pct: 80, tint: 'gold' as const },
  { icon: 'check-circle' as const, label: 'Prayers on time', value: '5 / 5', pct: 100, tint: 'emerald' as const },
];

/**
 * Onboarding — pass-12 redesign: premium, fully theme-aware. Splash →
 * three slides (faith / consistency / community) with framed image cards,
 * a stats card, skip control, gradient CTA and pill dots.
 */
export default function Onboarding() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [phase, setPhase] = useState<'splash' | 'slides'>('splash');
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setTimeout(() => setPhase('slides'), 1500);
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
    haptic.selection();
    const p = page + 1;
    setPage(p);
    scrollRef.current?.scrollTo({ x: p * WIDTH, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* themed pattern backdrop */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        <Image source={isDark ? patternDark : patternLight} style={{ width: '100%', height: '100%', opacity: d.patternOpacity * 0.55 }} resizeMode="cover" />
      </View>

      {phase === 'splash' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View
            style={{
              width: 128,
              height: 128,
              borderRadius: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(2,59,42,0.55)' : 'rgba(255,255,255,0.75)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(212,175,55,0.3)' : 'rgba(29,111,66,0.18)',
            }}
          >
            <DeenLogo size={72} color={isDark ? '#4AE38F' : '#1D6F42'} accent={isDark ? '#D4AF37' : '#B8860B'} />
          </View>
          <T v="h1" style={{ marginTop: 24, fontSize: 27, color: d.text, fontWeight: '800' }}>
            DeenLink
          </T>
          <T v="caption" style={{ marginTop: 7, fontSize: 12, color: d.subtext, letterSpacing: 0.3 }}>
            Strengthen Your Deen, Every Day
          </T>
          <View style={{ flexDirection: 'row', gap: 7, marginTop: 26 }}>
            <View style={{ width: 24, height: 4, borderRadius: 2, backgroundColor: isDark ? '#D4AF37' : '#B8860B' }} />
            <View style={{ width: 9, height: 4, borderRadius: 2, backgroundColor: d.cardBorder }} />
            <View style={{ width: 9, height: 4, borderRadius: 2, backgroundColor: d.cardBorder }} />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* top row — page count + skip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 }}>
            <T v="caption" style={{ color: d.faint, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 }}>
              {page + 1} OF {SLIDES}
            </T>
            <Pressable onPress={finish} hitSlop={10} style={{ paddingVertical: 4, paddingHorizontal: 10 }}>
              <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 12 }}>
                Skip
              </T>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / WIDTH))}
            scrollEventThrottle={16}
          >
            {/* Slide 1 — faith */}
            <View style={{ width: WIDTH, padding: 26, alignItems: 'center', paddingTop: 14 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  backgroundColor: isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.08)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.22)',
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>
                  FAITH · DAILY
                </T>
              </View>
              <T v="display" style={{ marginTop: 16, textAlign: 'center', fontSize: 27, lineHeight: 34, color: d.text, fontWeight: '800' }}>
                Strengthen{'\n'}your Imaan
              </T>
              <T v="bodyS" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: d.subtext }}>
                Quran, Hadith, Dhikr and more — everything you need in one place.
              </T>
              <View
                style={{
                  width: '100%',
                  marginTop: 24,
                  borderRadius: 24,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  backgroundColor: d.card,
                  shadowColor: '#000',
                  shadowOpacity: isDark ? 0.3 : 0.1,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 6,
                }}
              >
                <Image source={bookImg} style={{ width: '100%', height: 232 }} resizeMode="cover" />
              </View>
            </View>

            {/* Slide 2 — consistency */}
            <View style={{ width: WIDTH, padding: 26, alignItems: 'center', paddingTop: 14 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(184,134,11,0.08)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(212,175,55,0.4)' : 'rgba(184,134,11,0.25)',
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>
                  CONSISTENCY
                </T>
              </View>
              <T v="display" style={{ marginTop: 16, textAlign: 'center', fontSize: 27, lineHeight: 34, color: d.text, fontWeight: '800' }}>
                Stay on track{'\n'}every day
              </T>
              <T v="bodyS" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: d.subtext }}>
                Track goals, build habits and grow — one day at a time.
              </T>
              <View
                style={{
                  width: '100%',
                  marginTop: 24,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  backgroundColor: d.card,
                  paddingVertical: 8,
                  shadowColor: '#000',
                  shadowOpacity: isDark ? 0.3 : 0.1,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 6,
                }}
              >
                    {STATS.map((r) => {
                      const tint = r.tint === 'gold' ? (isDark ? '#E8C96A' : '#B8860B') : isDark ? '#4AE38F' : '#1D6F42';
                      return (
                        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 }}>
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: r.tint === 'gold' ? (isDark ? 'rgba(212,175,55,0.13)' : 'rgba(184,134,11,0.08)') : isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.08)',
                              borderWidth: 1,
                              borderColor: r.tint === 'gold' ? (isDark ? 'rgba(212,175,55,0.35)' : 'rgba(184,134,11,0.2)') : isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.2)',
                            }}
                          >
                            <FontAwesome5 name={r.icon} size={14} color={tint} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <T v="bodyS" style={{ fontWeight: '600', fontSize: 12.5, color: d.text }}>
                                {r.label}
                              </T>
                              <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: tint }}>
                                {r.value}
                              </T>
                            </View>
                            <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', marginTop: 7, overflow: 'hidden' }}>
                              <View style={{ height: 5, borderRadius: 3, backgroundColor: tint, width: `${r.pct}%` }} />
                            </View>
                          </View>
                        </View>
                      );
                    })}
              </View>
            </View>

            {/* Slide 3 — community */}
            <View style={{ width: WIDTH, padding: 26, alignItems: 'center', paddingTop: 14 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  backgroundColor: isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.08)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.22)',
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <T v="caption" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>
                  COMMUNITY
                </T>
              </View>
              <T v="display" style={{ marginTop: 16, textAlign: 'center', fontSize: 27, lineHeight: 34, color: d.text, fontWeight: '800' }}>
                A community{'\n'}that cares
              </T>
              <T v="bodyS" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: d.subtext }}>
                Learn, share and grow together with scholars and friends.
              </T>
              <View
                style={{
                  width: '100%',
                  marginTop: 24,
                  borderRadius: 24,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: d.cardBorder,
                  backgroundColor: d.card,
                  shadowColor: '#000',
                  shadowOpacity: isDark ? 0.3 : 0.1,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 6,
                }}
              >
                <Image source={mosqueImg} style={{ width: '100%', height: 232 }} resizeMode="cover" />
              </View>
            </View>
          </ScrollView>

          {/* CTA + dots */}
          <View style={{ padding: 22, paddingTop: 10 }}>
            <GradientButton label={page >= SLIDES - 1 ? 'Get Started' : 'Next'} onPress={next} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 }}>
              {Array.from({ length: SLIDES }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === page ? 22 : 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: i === page ? (isDark ? '#4AE38F' : '#1D6F42') : d.cardBorder,
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
