import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { storage } from '@/lib/storage';
import { DeenLogo } from '@/components/DeenLogo';
import { GradientButton } from '@/components/GradientButton';
import { CheckCircleIcon } from '@/components/Icons';

const bookImg = require('../../assets/img/onboard-book.png');
const mosqueImg = require('../../assets/img/onboard-mosque.png');
const patternDark = require('../../assets/img/pattern-dark.png');
const patternLight = require('../../assets/img/pattern-light.png');

const SLIDES = 3;
const WIDTH = Dimensions.get('window').width;

const TRACK_ROWS = [
  { label: 'Daily Goal', value: '4/5' },
  { label: 'Quran', value: '21 min' },
  { label: 'Dhikr', value: '160 / 200' },
  { label: 'Prayer', value: '5 / 5 ✓' },
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
    <View style={{ flex: 1 }}>
      <Image
        source={isDark ? patternDark : patternLight}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        resizeMode="cover"
      />
      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(5, 13, 9, 0.42)' : 'rgba(246, 243, 235, 0.55)' }}>
        {phase === 'splash' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <DeenLogo size={92} color={theme.primary} accent={theme.accent} />
            <Text style={{ marginTop: 20, fontSize: 14.5, color: theme.text, fontWeight: '600' }}>
              Connecting you to what matters.
            </Text>
            <View style={{ flexDirection: 'row', gap: 7, marginTop: 24 }}>
              <View style={{ width: 22, height: 4, borderRadius: 2, backgroundColor: theme.accent }} />
              <View style={{ width: 9, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
              <View style={{ width: 9, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ height: 40 }} />
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
                <Text style={{ fontSize: 23, fontWeight: '800', color: theme.heading, textAlign: 'center' }}>
                  Strengthen
                  {'\n'}your Imaan
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                  Duas, Adkar, Qur’an & more in one place
                </Text>
                <Image source={bookImg} style={{ width: '100%', height: 268, marginTop: 26, borderRadius: 24 }} resizeMode="cover" />
              </View>

              {/* Slide 2 */}
              <View style={{ width: WIDTH, padding: 28, alignItems: 'center' }}>
                <Text style={{ fontSize: 23, fontWeight: '800', color: theme.heading, textAlign: 'center' }}>
                  Stay on track
                  {'\n'}every day
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                  Track goals, build habits and grow spiritually
                </Text>
                <View
                  style={{
                    width: '100%',
                    backgroundColor: theme.card,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: theme.border,
                    marginTop: 28,
                    paddingVertical: 8,
                  }}
                >
                  {TRACK_ROWS.map((r) => (
                    <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16 }}>
                      <CheckCircleIcon size={19} color={theme.primary} />
                      <Text style={{ flex: 1, color: theme.text, fontSize: 13.5, fontWeight: '600', marginLeft: 11 }}>{r.label}</Text>
                      <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '800' }}>{r.value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Slide 3 */}
              <View style={{ width: WIDTH, padding: 28, alignItems: 'center' }}>
                <Text style={{ fontSize: 23, fontWeight: '800', color: theme.heading, textAlign: 'center' }}>
                  A community
                  {'\n'}that cares
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                  Learn, share and grow together
                </Text>
                <Image source={mosqueImg} style={{ width: '100%', height: 268, marginTop: 26, borderRadius: 24 }} resizeMode="cover" />
              </View>
            </ScrollView>

            <View style={{ padding: 20 }}>
              <GradientButton label={page >= SLIDES - 1 ? 'Get Started' : 'Next  →'} onPress={next} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 }}>
                {Array.from({ length: SLIDES }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === page ? 20 : 7,
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
