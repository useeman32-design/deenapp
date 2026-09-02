import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Pressable, ScrollView, View } from 'react-native';
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
const aiImg = require('../../assets/img/onboard-ai.jpg');
const libraryImg = require('../../assets/img/onboard-library.jpg');
const patternDark = require('../../assets/img/pattern-dark.png');
const patternLight = require('../../assets/img/pattern-light.png');

/* pass 44 — two new slides (AI + Library) added BEFORE theme selection */
const SLIDES = 6;
const WIDTH = Dimensions.get('window').width;

/* pass 44 — 3 more stats (6 total) for the "Stay on track" slide */
const STATS = [
  { icon: 'book-open' as const, label: 'Quran reading', value: '21 min', pct: 42, tint: 'emerald' as const },
  { icon: 'list-ol' as const, label: 'Daily dhikr', value: '160 / 200', pct: 80, tint: 'gold' as const },
  { icon: 'check-circle' as const, label: 'Prayers on time', value: '5 / 5', pct: 100, tint: 'emerald' as const },
  { icon: 'star-and-crescent' as const, label: 'Evening adhkar', value: '12 / 15', pct: 60, tint: 'gold' as const },
  { icon: 'hands-helping' as const, label: 'Duas made', value: '8 today', pct: 50, tint: 'emerald' as const },
  { icon: 'gem' as const, label: 'Names of Allah', value: '10 / 99', pct: 25, tint: 'gold' as const },
];

const cardShadow = (isDark: boolean) => ({
  shadowColor: '#000',
  shadowOpacity: isDark ? 0.3 : 0.1,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
});

function ImageCard({ img, isDark, d }: { img: any; isDark: boolean; d: any }) {
  return (
    <View style={{ width: '100%', marginTop: 24, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, ...cardShadow(isDark) }}>
      <Image source={img} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />
    </View>
  );
}

function Tag({ children, isDark, gold }: { children: any; isDark: boolean; gold?: boolean }) {
  const em = isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.08)';
  const emb = isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.22)';
  const gt = isDark ? 'rgba(212,175,55,0.12)' : 'rgba(184,134,11,0.08)';
  const gtb = isDark ? 'rgba(212,175,55,0.4)' : 'rgba(184,134,11,0.25)';
  const tc = isDark ? '#4AE38F' : '#1D6F42';
  const gc = isDark ? '#E8C96A' : '#8C6D1F';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: gold ? gt : em, borderWidth: 1, borderColor: gold ? gtb : emb, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
      <T v="caption" style={{ color: gold ? gc : tc, fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>{children}</T>
    </View>
  );
}

/**
 * Onboarding — pass-44: splash → five slides (faith / consistency / community /
 * DeenLink AI / library) then theme selection. Animated progress bars on the
 * consistency slide and dots that track the pager in BOTH directions.
 */
export default function Onboarding() {
  const { theme, isDark, mode, setMode } = useTheme();
  const d = theme.dash;
  const [phase, setPhase] = useState<'splash' | 'slides'>('splash');
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const bars = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => setPhase('slides'), 1500);
    return () => clearTimeout(t);
  }, []);

  /* animate the consistency-slide progress bars whenever it's on screen */
  useEffect(() => {
    if (page === 1) {
      bars.setValue(0);
      Animated.timing(bars, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), delay: 150, useNativeDriver: false }).start();
    }
  }, [page, bars]);

  const finish = () => {
    storage.setItem('dl.onboarded', '1');
    router.replace('/(auth)/login');
  };

  const next = () => {
    if (page >= SLIDES - 1) { finish(); return; }
    haptic.selection();
    const p = page + 1;
    setPage(p);
    scrollRef.current?.scrollTo({ x: p * WIDTH, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        <Image source={isDark ? patternDark : patternLight} style={{ width: '100%', height: '100%', opacity: d.patternOpacity * 0.55 }} resizeMode="cover" />
      </View>

      {phase === 'splash' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 128, height: 128, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(2,59,42,0.55)' : 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.3)' : 'rgba(29,111,66,0.18)' }}>
            <DeenLogo size={72} color={isDark ? '#4AE38F' : '#1D6F42'} accent={isDark ? '#D4AF37' : '#B8860B'} />
          </View>
          <T v="h1" style={{ marginTop: 24, fontSize: 27, color: d.text, fontWeight: '800' }}>DeenLink</T>
          <T v="caption" style={{ marginTop: 7, fontSize: 12, color: d.subtext, letterSpacing: 0.3 }}>Strengthen Your Deen, Every Day</T>
          <View style={{ flexDirection: 'row', gap: 7, marginTop: 26 }}>
            <View style={{ width: 24, height: 4, borderRadius: 2, backgroundColor: isDark ? '#D4AF37' : '#B8860B' }} />
            <View style={{ width: 9, height: 4, borderRadius: 2, backgroundColor: d.cardBorder }} />
            <View style={{ width: 9, height: 4, borderRadius: 2, backgroundColor: d.cardBorder }} />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 }}>
            <T v="caption" style={{ color: d.faint, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 }}>{page + 1} OF {SLIDES}</T>
            <Pressable onPress={finish} hitSlop={10} style={{ paddingVertical: 4, paddingHorizontal: 10 }}>
              <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 12 }}>Skip</T>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            /* pass 44 — track the pager on every scroll so the dots follow both
               forward AND back (onMomentumScrollEnd alone missed back-swipes) */
            onScroll={(e) => {
              const p = Math.round(e.nativeEvent.contentOffset.x / WIDTH);
              if (p >= 0 && p < SLIDES) setPage(p);
            }}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / WIDTH))}
          >
            {/* Slide 1 — faith */}
            <View style={{ width: WIDTH, padding: 26, alignItems: 'center', paddingTop: 14 }}>
              <Tag isDark={isDark}>FAITH · DAILY</Tag>
              <T v="display" style={{ marginTop: 16, textAlign: 'center', fontSize: 27, lineHeight: 34, color: d.text, fontWeight: '800' }}>Strengthen{'\n'}your Imaan</T>
              <T v="bodyS" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: d.subtext }}>Quran, Hadith, Dhikr and more — everything you need in one place.</T>
              <ImageCard img={bookImg} isDark={isDark} d={d} />
            </View>

            {/* Slide 2 — consistency (animated progress bars, 6 stats) */}
            <View style={{ width: WIDTH, padding: 26, alignItems: 'center', paddingTop: 14 }}>
              <Tag isDark={isDark} gold>CONSISTENCY</Tag>
              <T v="display" style={{ marginTop: 16, textAlign: 'center', fontSize: 27, lineHeight: 34, color: d.text, fontWeight: '800' }}>Stay on track{'\n'}every day</T>
              <T v="bodyS" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: d.subtext }}>Track goals, build habits and grow — one day at a time.</T>
              <View style={{ width: '100%', marginTop: 24, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingVertical: 6, ...cardShadow(isDark) }}>
                {STATS.map((r) => {
                  const tint = r.tint === 'gold' ? (isDark ? '#E8C96A' : '#B8860B') : isDark ? '#4AE38F' : '#1D6F42';
                  return (
                    <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: r.tint === 'gold' ? (isDark ? 'rgba(212,175,55,0.13)' : 'rgba(184,134,11,0.08)') : isDark ? 'rgba(46,204,113,0.13)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: r.tint === 'gold' ? (isDark ? 'rgba(212,175,55,0.35)' : 'rgba(184,134,11,0.2)') : isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.2)' }}>
                        <FontAwesome5 name={r.icon} size={13} color={tint} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <T v="bodyS" style={{ fontWeight: '600', fontSize: 12.5, color: d.text }}>{r.label}</T>
                          <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: tint }}>{r.value}</T>
                        </View>
                        <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', marginTop: 6, overflow: 'hidden' }}>
                          {/* pass 44 — animated fill */}
                          <Animated.View style={{ height: 5, borderRadius: 3, backgroundColor: tint, width: bars.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${r.pct}%`] }) }} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Slide 3 — community */}
            <View style={{ width: WIDTH, padding: 26, alignItems: 'center', paddingTop: 14 }}>
              <Tag isDark={isDark}>COMMUNITY</Tag>
              <T v="display" style={{ marginTop: 16, textAlign: 'center', fontSize: 27, lineHeight: 34, color: d.text, fontWeight: '800' }}>A community{'\n'}that cares</T>
              <T v="bodyS" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: d.subtext }}>Learn, share and grow together with scholars and friends.</T>
              <ImageCard img={mosqueImg} isDark={isDark} d={d} />
            </View>

            {/* Slide 4 — DeenLink AI */}
            <View style={{ width: WIDTH, padding: 26, alignItems: 'center', paddingTop: 14 }}>
              <Tag isDark={isDark} gold>DEENLINK AI</Tag>
              <T v="display" style={{ marginTop: 16, textAlign: 'center', fontSize: 27, lineHeight: 34, color: d.text, fontWeight: '800' }}>Ask anything,{'\n'}anytime</T>
              <T v="bodyS" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: d.subtext }}>Instant, respectful answers grounded in the Quran and Sunnah.</T>
              <ImageCard img={aiImg} isDark={isDark} d={d} />
            </View>

            {/* Slide 5 — library */}
            <View style={{ width: WIDTH, padding: 26, alignItems: 'center', paddingTop: 14 }}>
              <Tag isDark={isDark}>LIBRARY</Tag>
              <T v="display" style={{ marginTop: 16, textAlign: 'center', fontSize: 27, lineHeight: 34, color: d.text, fontWeight: '800' }}>A library at{'\n'}your fingertips</T>
              <T v="bodyS" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: d.subtext }}>Tafsir, Duas, Names of Allah, Seerah and more — always with you.</T>
              <ImageCard img={libraryImg} isDark={isDark} d={d} />
            </View>

            {/* Slide 6 — theme selection */}
            <View style={{ width: WIDTH, padding: 26, alignItems: 'center', paddingTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: isDark ? 'rgba(212,175,55,0.13)' : 'rgba(140,109,31,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(232,201,106,0.35)' : 'rgba(140,109,31,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <FontAwesome5 name="moon" size={9} color={isDark ? '#E8C96A' : '#8C6D1F'} />
                <T v="caption" style={{ color: isDark ? '#E8C96A' : '#8C6D1F', fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>APPEARANCE</T>
              </View>
              <T v="display" style={{ marginTop: 16, textAlign: 'center', fontSize: 27, lineHeight: 34, color: d.text, fontWeight: '800' }}>Choose your{'\n'}theme</T>
              <T v="bodyS" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: d.subtext }}>You can change it anytime in Settings.</T>

              <View style={{ flexDirection: 'row', gap: 14, marginTop: 24 }}>
                {([
                  { id: 'dark', label: 'Dark', bg: '#08120C', card: '#10241A', line: 'rgba(74,227,143,0.35)', accent: '#4AE38F', text: '#F2F7F3', sub: 'rgba(242,247,243,0.55)' },
                  { id: 'light', label: 'Light', bg: '#F6FAF7', card: '#FFFFFF', line: 'rgba(29,111,66,0.28)', accent: '#1D6F42', text: '#14241C', sub: 'rgba(20,36,28,0.55)' },
                ] as const).map((opt) => {
                  const active = mode === opt.id;
                  return (
                    <Pressable key={opt.id} accessibilityLabel={`theme ${opt.label}`} onPress={() => { haptic.selection(); setMode(opt.id); }} style={{ flex: 1, borderRadius: 22, borderWidth: 2, borderColor: active ? '#E8C96A' : d.cardBorder, padding: 9, backgroundColor: active ? (isDark ? 'rgba(232,201,106,0.07)' : 'rgba(140,109,31,0.04)') : 'transparent' }}>
                      <View style={{ borderRadius: 16, backgroundColor: opt.bg, borderWidth: 1, borderColor: opt.line, overflow: 'hidden', paddingTop: 8, paddingHorizontal: 8, paddingBottom: 10 }}>
                        <View style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: opt.sub, marginBottom: 8 }} />
                        <View style={{ borderRadius: 8, backgroundColor: opt.card, borderWidth: 1, borderColor: opt.line, padding: 7, gap: 4 }}>
                          <View style={{ width: 26, height: 5, borderRadius: 3, backgroundColor: opt.accent, opacity: 0.9 }} />
                          <View style={{ width: 68, height: 4, borderRadius: 2, backgroundColor: opt.sub }} />
                          <View style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: opt.sub, opacity: 0.6 }} />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 5, marginTop: 6 }}>
                          <View style={{ flex: 1, height: 22, borderRadius: 8, backgroundColor: opt.card, borderWidth: 1, borderColor: opt.line, alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ width: 12, height: 4, borderRadius: 2, backgroundColor: opt.accent }} />
                          </View>
                          <View style={{ flex: 1, height: 22, borderRadius: 8, backgroundColor: opt.card, borderWidth: 1, borderColor: opt.line, alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ width: 12, height: 4, borderRadius: 2, backgroundColor: opt.sub }} />
                          </View>
                        </View>
                        <View style={{ marginTop: 6, height: 14, borderRadius: 7, backgroundColor: opt.accent, opacity: 0.85 }} />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 9 }}>
                        <View style={{ width: 15, height: 15, borderRadius: 8, borderWidth: 1.6, borderColor: active ? '#E8C96A' : d.cardBorder, backgroundColor: active ? '#E8C96A' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {active ? <FontAwesome5 name="check" size={7} color="#08120C" /> : null}
                        </View>
                        <T v="bodyS" style={{ fontSize: 13, fontWeight: '800', color: active ? '#E8C96A' : d.text }}>{opt.label}</T>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable accessibilityLabel="theme System" onPress={() => { haptic.selection(); setMode('system'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: mode === 'system' ? '#E8C96A' : d.cardBorder, backgroundColor: mode === 'system' ? (isDark ? 'rgba(232,201,106,0.07)' : 'rgba(140,109,31,0.04)') : 'transparent', paddingHorizontal: 14, paddingVertical: 9, marginTop: 12 }}>
                <FontAwesome5 name="mobile-alt" size={10} color={mode === 'system' ? '#E8C96A' : d.faint} />
                <T v="bodyS" style={{ fontSize: 12, fontWeight: '700', color: mode === 'system' ? '#E8C96A' : d.subtext }}>Match my phone{"'"}s setting</T>
                {mode === 'system' ? <FontAwesome5 name="check-circle" size={12} color="#E8C96A" /> : null}
              </Pressable>
            </View>
          </ScrollView>

          {/* CTA + dots */}
          <View style={{ padding: 22, paddingTop: 10 }}>
            <GradientButton label={page >= SLIDES - 1 ? 'Get Started' : 'Next'} onPress={next} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 }}>
              {Array.from({ length: SLIDES }).map((_, i) => (
                <Animated.View
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
