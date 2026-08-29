import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Platform } from 'react-native';
import { loadDuas, type ContentDua } from '@/lib/content';
import { markGoal } from '@/lib/routine';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Duas & Adhkar (pass 18) — the user's /content dataset (dua.json):
 * categories → duas with FULL arabic text, translation and AUDIO
 * (hisnmuslim.com CDN).
 */
export default function Duas() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [pack, setPack] = useState<Record<string, ContentDua[]> | null>(null);
  const [cat, setCat] = useState<string>('All');
  const [openId, setOpenId] = useState<number | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  useEffect(() => {
    markGoal('dua');
    loadDuas()
      .then((p) => setPack(p))
      .catch(() => setPack({}));
  }, []);

  const english = useMemo(() => (pack ? (pack['English'] ?? []) : []), [pack]);
  const categories = useMemo(() => ['All', ...english.map((c) => c.TITLE)], [english]);
  const list = useMemo(() => (cat === 'All' ? english : english.filter((c) => c.TITLE === cat)), [english, cat]);

  const player = useVideoPlayer({ uri: playingUrl ?? 'about:blank' }, (p) => {
    p.loop = false;
  });
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playingUrl) return;
    try {
      player.replace({ uri: playingUrl });
      player.play();
      setPlaying(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingUrl]);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => setPlaying(false));
    return () => sub.remove();
  }, [player]);

  const toggleAudio = (url?: string) => {
    haptic.light();
    if (!url) return;
    if (playingUrl === url && playing) {
      player.pause();
      setPlaying(false);
    } else {
      setPlayingUrl(url);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ color: d.text, fontWeight: '800', fontSize: 20 }}>
              Duas & Adhkar
            </T>
            <T v="caption" style={{ color: d.faint, fontSize: 11, marginTop: 1 }}>
              {english.length} collections · arabic + audio
            </T>
          </View>
        </View>
      </View>

      {/* categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        {categories.slice(0, 12).map((c) => {
          const on = cat === c;
          return (
            <Pressable
              key={c}
              onPress={() => {
                haptic.selection();
                setCat(c);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder,
                backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(29,111,66,0.08)') : d.card,
              }}
            >
              <T v="caption" style={{ color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext, fontWeight: '800', fontSize: 11 }} numberOfLines={1}>
                {c === 'All' ? 'All' : c.length > 26 ? c.slice(0, 26) + '…' : c}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {pack == null ? (
          <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginTop: 30 }} />
        ) : (
          list.map((c) => {
            const open = openId === c.ID;
            const isThisPlaying = playingUrl === c.AUDIO_URL && playing;
            return (
              <View key={c.ID} style={{ borderRadius: 16, borderWidth: 1, borderColor: open ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)') : d.cardBorder, backgroundColor: d.card, marginBottom: 10, overflow: 'hidden' }}>
                <Pressable
                  onPress={() => {
                    haptic.selection();
                    setOpenId(open ? null : c.ID);
                  }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, opacity: pressed ? 0.8 : 1 })}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="praying-hands" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
                  </View>
                  <T v="body" style={{ flex: 1, color: d.text, fontWeight: '700', fontSize: 13, lineHeight: 18 }}>
                    {c.TITLE}
                  </T>
                  {c.AUDIO_URL ? (
                    <Pressable onPress={() => toggleAudio(c.AUDIO_URL)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isThisPlaying ? 'rgba(46,204,113,0.25)' : d.bgSoft, borderWidth: 1, borderColor: isThisPlaying ? 'rgba(74,227,143,0.6)' : d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesome5 name={isThisPlaying ? 'pause' : 'play'} size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
                    </Pressable>
                  ) : null}
                  <FontAwesome5 name={open ? 'chevron-up' : 'chevron-down'} size={11} color={d.faint} />
                </Pressable>

                {open ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
                    {c.TEXT.map((t) => (
                      <View key={t.ID} style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: d.cardBorder }}>
                        <T v="arabic" style={{ color: d.text, fontSize: 20, textAlign: 'right', lineHeight: 36 }}>
                          {t.ARABIC_TEXT}
                        </T>
                        {t.ENGLISH_TEXT ? (
                          <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, marginTop: 6, lineHeight: 19 }}>
                            {t.ENGLISH_TEXT}
                          </T>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* hidden engine surface (web) */}
      {Platform.OS === 'web' ? (
        <View pointerEvents="none" style={{ width: 1, height: 1, opacity: 0 }}>
          <VideoView player={player} contentFit="contain" nativeControls={false} playsInline style={{ width: 1, height: 1 }} />
        </View>
      ) : null}
    </View>
  );
}
