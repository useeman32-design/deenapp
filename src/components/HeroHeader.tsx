import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { formatHijri, computePrayerTimes, formatTime, nextPrayer } from '@/lib/prayer';
import { resolveLocation, type Loc } from '@/lib/location';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { PinIcon, SearchIcon, MoonStarIcon } from '@/components/Icons';

/**
 * The web home "top section": location, Hijri + Gregorian date, next prayer,
 * search and theme toggle — restyled as a native mobile header.
 */
export function HeroHeader() {
  const { theme, mode, setMode } = useTheme();
  const [loc, setLoc] = useState<Loc | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [q, setQ] = useState('');

  useEffect(() => {
    resolveLocation().then(setLoc);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);

  const times = loc ? computePrayerTimes(now, loc) : null;
  const np = times ? nextPrayer(now, times) : null;
  const hijri = formatHijri(now);

  return (
    <View>
      {/* Row 1: location + theme toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <Pressable
          onPress={() => resolveLocation().then(setLoc)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: theme.card,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 12,
            paddingVertical: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <PinIcon size={14} color={theme.primary} />
          <T v="caption" style={{ fontWeight: '700', color: theme.text }}>
            {loc?.name ?? 'Locating…'}
          </T>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setMode((mode === 'dark' ? 'light' : 'dark') as ThemeMode)}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <MoonStarIcon size={16} color={theme.accent} />
        </Pressable>
      </View>

      {/* Dates */}
      <T v="h2" color="primary">
        {hijri}
      </T>
      <T v="caption" style={{ marginTop: 3 }}>
        {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        {np ? `  ·  Next: ${np.name} ${formatTime(np.time)}` : ''}
      </T>

      {/* Search */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.card,
          borderRadius: 30,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 14,
          marginTop: 14,
        }}
      >
        <SearchIcon size={15} color={theme.subtext} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search people, posts…"
          placeholderTextColor={theme.subtext}
          style={{
            flex: 1,
            fontFamily: 'Poppins-Medium',
            fontSize: 13.5,
            color: theme.text,
            paddingVertical: 11,
            paddingLeft: 9,
          }}
        />
      </View>
    </View>
  );
}
