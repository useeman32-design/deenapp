import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { OFFLINE_TEXT, QURAN, type Ayah } from '@/data/quran';
import { storage } from '@/lib/storage';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

const RECITER = 'Mishary Rashid Alafasy';
const audioUrl = (surah: number) => `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surah}.mp3`;

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** Qur'an reader (pass 15): dash design + per-surah audio player (expo-video as the engine). */
export default function SurahDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const n = Number(id);
  const meta = QURAN.find((s) => s.number === n);
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [online, setOnline] = useState(false);
  const [marks, setMarks] = useState<Set<number>>(new Set());

  /* reading position */
  useEffect(() => {
    setAyahs(OFFLINE_TEXT[n] ?? null);
    setOnline(false);
    storage.setItem('dl.quran.last', JSON.stringify({ surah: n, ayah: 1, at: new Date().toISOString() })).catch(() => {});
    fetch(`https://api.alquran.cloud/surah/${n}/editions/quran-simple,en.asad`)
      .then((r) => r.json())
      .then((dd: { data?: { name?: string; ayahs?: { numberInSurah: number; text: string }[] }[] }) => {
        const editions = Array.isArray(dd?.data) ? dd.data : [];
        const ar = editions[0]?.ayahs;
        const en = editions[1]?.ayahs;
        if (Array.isArray(ar) && ar.length > 0) {
          setAyahs(
            ar.map((a, i) => ({
              numberInSurah: a.numberInSurah,
              arabic: a.text,
              english: en?.[i]?.text ?? '',
            })),
          );
          setOnline(true);
        }
      })
      .catch(() => {});
    storage.getItem('dl.quran.ayahMarks').then((r) => {
      if (r)
        try {
          const all: Record<string, number[]> = JSON.parse(r);
          setMarks(new Set(all[n] ?? []));
        } catch {}
    });
  }, [n]);

  /* audio player (expo-video engine, audio-only file) */
  const player = useVideoPlayer({ uri: audioUrl(n) }, (p) => {
    p.loop = false;
  });
  const [playing, setPlaying] = useState(false);
  const [posSec, setPosSec] = useState(0);
  const [durSec, setDurSec] = useState(0);

  useEffect(() => {
    const sub = player.addListener('timeUpdate', (state: { currentTime: number; duration?: number }) => {
      setPosSec(state.currentTime);
      if (state.duration && Number.isFinite(state.duration)) setDurSec(state.duration);
    });
    const statusSub = player.addListener('statusChange', () => setPlaying(player.playing));
    return () => {
      sub.remove();
      statusSub.remove();
    };
  }, [player]);

  const toggleAudio = () => {
    haptic.light();
    if (player.playing) player.pause();
    else player.play();
  };

  const pct = durSec > 0 ? Math.min(1, posSec / durSec) : 0;

  const toggleAyahMark = (num: number) => {
    haptic.light();
    setMarks((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      storage.getItem('dl.quran.ayahMarks').then((r) => {
        let all: Record<string, number[]> = {};
        try {
          all = r ? JSON.parse(r) : {};
        } catch {}
        all[n] = Array.from(next);
        storage.setItem('dl.quran.ayahMarks', JSON.stringify(all));
      });
      return next;
    });
  };

  if (!meta) return null;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: d.cardBorder }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="chevron-left" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 18 }}>
              {meta.english}
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
              {meta.name} · {meta.ayahs} verses · {meta.revelation} · {online ? 'alquran.cloud' : 'offline copy'}
            </T>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* surah opener */}
        <View style={{ alignItems: 'center', marginBottom: 16, paddingVertical: 18, borderRadius: 18, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 40, height: 1.5, backgroundColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.5)' }} />
            <T v="arabic" style={{ color: d.text, fontSize: 30 }}>
              {meta.name}
            </T>
            <View style={{ width: 40, height: 1.5, backgroundColor: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(184,134,11,0.5)' }} />
          </View>
          <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 8, letterSpacing: 0.5 }}>
            SURAH {meta.number} · {meta.revelation.toUpperCase()}
          </T>
        </View>

        {ayahs?.map((a) => (
          <View
            key={a.numberInSurah}
            style={{
              backgroundColor: d.card,
              borderWidth: 1,
              borderColor: d.cardBorder,
              borderRadius: 16,
              padding: 15,
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontSize: 11, fontWeight: '800' }}>{a.numberInSurah}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => toggleAyahMark(a.numberInSurah)} hitSlop={8} style={{ padding: 4 }}>
                <FontAwesome5 name="bookmark" size={14} solid={marks.has(a.numberInSurah)} color={marks.has(a.numberInSurah) ? '#E8C96A' : d.faint} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 25, fontFamily: 'Amiri', color: d.text, textAlign: 'right', lineHeight: 46 }}>{a.arabic}</Text>
            {a.english ? <Text style={{ color: d.subtext, fontSize: 13.5, marginTop: 10, lineHeight: 20 }}>{a.english}</Text> : null}
          </View>
        ))}

        {!ayahs ? (
          <Text style={{ color: d.subtext, textAlign: 'center', marginTop: 30, fontSize: 13 }}>Connect to the internet to read this surah.</Text>
        ) : null}
      </ScrollView>

      {/* audio player bar */}
      <View
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 16,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.25)',
          backgroundColor: isDark ? 'rgba(8,20,13,0.92)' : 'rgba(255,255,255,0.96)',
          paddingHorizontal: 14,
          paddingVertical: 11,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Pressable
            onPress={toggleAudio}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: isDark ? '#1F8F5C' : '#1D6F42',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <FontAwesome5 name={playing ? 'pause' : 'play'} size={15} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T v="caption" numberOfLines={1} style={{ color: d.text, fontWeight: '700', fontSize: 11 }}>
                {meta.english} · {RECITER}
              </T>
              <T v="caption" style={{ color: d.faint, fontSize: 10 }}>
                {fmt(posSec)} / {durSec > 0 ? fmt(durSec) : '—'}
              </T>
            </View>
            {/* progress */}
            <View style={{ height: 14, justifyContent: 'center', marginTop: 2 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(20,36,28,0.1)' }} />
              <View style={{ position: 'absolute', left: 0, width: `${pct * 100}%`, height: 4, borderRadius: 2, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} />
              <View style={{ position: 'absolute', left: `${pct * 100}%`, marginLeft: -5, width: 11, height: 11, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: isDark ? '#4AE38F' : '#1D6F42' }} />
            </View>
          </View>
          {/* hidden engine surface keeps expo-video happy on web */}
          <View pointerEvents="none" style={{ width: 1, height: 1, opacity: 0 }}>
            <VideoView player={player} contentFit="contain" nativeControls={false} playsInline style={{ width: 1, height: 1 }} />
          </View>
        </View>
      </View>
    </View>
  );
}
