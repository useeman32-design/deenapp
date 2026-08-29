import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { loadNames99 } from '@/lib/content';
import { NAMES_99 as FALLBACK_NAMES } from '@/data/names99';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';
import { GlassPlayerBar } from '@/components/GlassPlayerBar';
import { useAudio } from '@/lib/useAudio';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

/**
 * 99 Names of Allah (pass 22) — now driven by the USER'S dataset (content
 * pack) which carries per-name AUDIO (islamicapi.com mirror) + transliteration
 * + translation + meaning. Play any name through the shared glass player.
 * Falls back to the static list offline.
 */
type NameEntry = { number: number; arabic: string; transliteration: string; translation: string; meaning: string; audio: string };

const audioUrl = (a: string) => (a.startsWith('http') ? a.replace(/^http:/, 'https:') : `https://islamicapi.com${a}`);

export default function Names() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [pack, setPack] = useState<NameEntry[] | null>(null);
  const [openNo, setOpenNo] = useState<number | null>(null);
  const audio = useAudio();

  useEffect(() => {
    loadNames99()
      .then((r) => {
        const list = (r?.data?.names ?? []).map((n: { number: number; name: string; transliteration: string; translation: string; meaning: string; audio: string }) => ({
          number: n.number,
          arabic: n.name,
          transliteration: n.transliteration,
          translation: n.translation,
          meaning: n.meaning,
          audio: n.audio,
        }));
        if (list.length) setPack(list);
      })
      .catch(() => {});
  }, []);

  const source = pack ?? FALLBACK_NAMES.map((n) => ({ ...n, audio: '' }));

  const list = useMemo(() => {
    const sorted = [...source].sort((a, b) => a.transliteration.localeCompare(b.transliteration));
    const query = q.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter(
      (n) =>
        n.transliteration.toLowerCase().includes(query) ||
        n.translation.toLowerCase().includes(query) ||
        n.meaning.toLowerCase().includes(query) ||
        n.arabic.includes(q.trim()),
    );
  }, [q, source]);

  const playingName = audio.url ? source.find((n) => n.audio && audioUrl(n.audio) === audio.url) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar title="99 Names of Allah" subtitle={pack ? `${list.length} of ${pack.length} names · audio` : `${list.length} names · offline list`} />
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by name or meaning…"
          placeholderTextColor={theme.subtext}
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: theme.text,
            fontSize: 16 /* no iOS zoom */,
          }}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {!pack ? (
          <T v="caption" style={{ color: d.faint, textAlign: 'center', marginBottom: 8 }}>Using built-in list…</T>
        ) : null}
        {list.map((n) => {
          const isOpen = openNo === n.number;
          const isPlaying = !!n.audio && audio.playing && audio.url === audioUrl(n.audio);
          const isLoading = !!n.audio && audio.loading && audio.url === audioUrl(n.audio);
          return (
            <Card key={n.transliteration} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  onPress={() => {
                    haptic.selection();
                    setOpenNo(isOpen ? null : n.number);
                  }}
                  style={{ flex: 1 }}
                >
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14.5, fontFamily: 'Poppins-SemiBold' }}>{n.transliteration}</Text>
                  <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 2, fontFamily: 'Poppins' }}>{n.translation}</Text>
                </Pressable>
                {n.audio ? (
                  <Pressable
                    onPress={() => {
                      haptic.light();
                      audio.toggle(audioUrl(n.audio));
                    }}
                    hitSlop={8}
                    style={{ width: 36, height: 36, borderRadius: 18, marginLeft: 8, backgroundColor: isPlaying ? 'rgba(46,204,113,0.22)' : isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: isPlaying ? 'rgba(74,227,143,0.6)' : d.cardBorder, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
                    ) : (
                      <FontAwesome5 name={isPlaying ? 'pause' : 'volume-up'} size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                    )}
                  </Pressable>
                ) : null}
                <Pressable onPress={() => { haptic.selection(); setOpenNo(isOpen ? null : n.number); }} hitSlop={8} style={{ padding: 6 }}>
                  <Text style={{ fontFamily: 'Amiri', color: theme.primary, fontSize: 24, marginLeft: 6 }}>{n.arabic}</Text>
                </Pressable>
              </View>
              {isOpen ? (
                <View style={{ borderTopWidth: 1, borderTopColor: d.cardBorder, marginTop: 10, paddingTop: 10 }}>
                  <T v="caption" style={{ color: d.faint, fontWeight: '800', fontSize: 9.5, letterSpacing: 0.6, marginBottom: 5 }}>MEANING</T>
                  <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, lineHeight: 19 }}>{n.meaning}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <FontAwesome5 name="hashtag" size={9} color={d.faint} />
                    <T v="caption" style={{ color: d.faint, fontSize: 10 }}>Name {n.number} of 99</T>
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>

      {/* shared glass player — mounts the audio element */}
      {(audio.playing || audio.loading) && playingName ? (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 14) + 4 }}>
          <GlassPlayerBar
            player={audio.player}
            playing={audio.playing}
            loading={audio.loading}
            title={playingName.transliteration}
            arabic={playingName.arabic}
            subtitle={playingName.translation}
            onToggle={() => audio.toggle(audioUrl(playingName.audio))}
            frac={audio.frac}
            duration={audio.duration}
            onSeek={(f) => audio.seekFrac(f)}
            seekMargins={{ left: 46, right: 6 }}
          />
        </View>
      ) : null}
    </View>
  );
}
