import { useEffect, useState } from 'react';
import { Animated, Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatHijri, computePrayerTimes, nextPrayer } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { ClockIcon, PaperPlaneIcon, PinIcon, SearchIcon } from '@/components/Icons';

const SLIDES = [
  require('../../assets/img/mecca.jpg'),
  require('../../assets/img/medina.jpg'),
  require('../../assets/img/kaabah.jpg'),
];

/**
 * Web home hero (.top-section), 1:1 — background carousel with green overlay,
 * glass location/date/search/messages bar, and the prayer countdown.
 */
export function HeroHeader({ onSearch, onMessages }: { onSearch?: () => void; onMessages?: () => void }) {
  const { theme, mode, setMode } = useTheme();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    resolveLocation().then(setLoc);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(iv);
  }, []);

  const times = loc ? computePrayerTimes(now, loc) : null;
  const np = times ? nextPrayer(now, times) : null;
  const hijri = formatHijri(now);
  const overlay = mode === 'dark' ? ['rgba(46,204,113,0.95)', 'rgba(39,174,96,0.9)'] : ['rgba(29,111,66,0.88)', 'rgba(29,111,66,0.92)'];

  return (
    <View style={{ height: 240 }}>
      {/* Background carousel */}
      {SLIDES.map((src, i) => (
        <Animated.Image
          key={i}
          source={src}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: slide === i ? 1 : 0,
          }}
        />
      ))}
      <LinearGradient
        colors={overlay as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Carousel indicators */}
      <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: slide === i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
            }}
          />
        ))}
      </View>

      {/* Top bar */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 }}>
        {/* Location */}
        <Pressable
          onPress={() => resolveLocation().then(setLoc)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: theme.glass,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 8,
            maxWidth: 130,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <PinIcon size={13} color="#fff" />
          <T v="caption" color="onPrimary" style={{ fontWeight: '500', fontSize: 13, maxWidth: 90 }}>
            {loc?.name ?? '…'}
          </T>
        </Pressable>

        {/* Dates */}
        <View style={{ flex: 1, alignItems: 'flex-end', marginHorizontal: 4 }}>
          <T v="caption" color="onPrimary" style={{ fontWeight: '500', fontSize: 13 }}>
            {hijri}
          </T>
          <T v="caption" color="onPrimary" style={{ fontSize: 11, opacity: 0.9, marginTop: 1 }}>
            {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </T>
        </View>

        {/* Search + messages (web: search-btn + paper-plane messages-btn, both glass) */}
        <Pressable
          onPress={onSearch}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 20,
            backgroundColor: theme.glass,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <SearchIcon size={15} color="#fff" />
        </Pressable>
        <Pressable
          onPress={onMessages}
          style={({ pressed }) => ({
            position: 'relative',
            width: 36,
            height: 36,
            borderRadius: 20,
            backgroundColor: theme.glass,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <PaperPlaneIcon size={15} color="#fff" />
        </Pressable>
      </View>

      {/* Prayer timer */}
      <View style={{ position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center' }}>
        {np ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ClockIcon size={16} color="#fff" />
            <T v="h3" color="onPrimary" style={{ fontWeight: '600', fontSize: 16 }}>
              {np.name}
            </T>
          </View>
        ) : null}
        <T v="stat" color="onPrimary" style={{ fontFamily: 'Poppins-Bold', fontSize: 28, letterSpacing: 1, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>
          {np ? countdown(now, np.time) : '—'}
        </T>
      </View>
    </View>
  );
}

function countdown(now: Date, target: Date): string {
  let diff = target.getTime() - now.getTime();
  if (diff <= 0) diff += 24 * 60 * 60 * 1000;
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(sec)}`;
}
