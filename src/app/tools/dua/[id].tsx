import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { loadDuas, type ContentDua } from '@/lib/content';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { DUA_SECTIONS, groupBySection, type DuaSectionId } from '@/lib/duaSections';
import { ContentShareSheet } from '@/components/ContentShareSheet';

/**
 * Dua section detail (pass 20) — every dua under a section, with audio
 * (hisnmuslim CDN) and per-dua share (friends / link / image).
 */
export default function DuaSection() {
  const { id, open } = useLocalSearchParams<{ id: string; open?: string }>();
  const sectionId = (id ?? 'other') as DuaSectionId;
  const section = DUA_SECTIONS.find((s) => s.id === sectionId) ?? DUA_SECTIONS[DUA_SECTIONS.length - 1];
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [pack, setPack] = useState<Record<string, ContentDua[]> | null>(null);
  const [openId, setOpenId] = useState<number | null>(open ? Number(open) : null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [shareDua, setShareDua] = useState<{ arabic: string; meaning: string; ref: string } | null>(null);

  useEffect(() => {
    loadDuas()
      .then((p) => setPack(p))
      .catch(() => setPack({}));
  }, []);

  const english = useMemo(() => (pack ? (pack['English'] ?? []) : []), [pack]);
  const list = useMemo(() => (pack ? groupBySection(english)[sectionId] : []), [pack, english, sectionId]);

  const player = useVideoPlayer(playingUrl ?? null, (p) => {
    p.loop = false;
  });

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
      {/* hidden audio element (web: expo-video needs a mounted view) */}
      <View style={{ position: 'absolute', width: 2, height: 2, opacity: 0.01 }}>
        <VideoView player={player} style={{ width: 2, height: 2 }} contentFit="contain" nativeControls={false} />
      </View>

      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h2" numberOfLines={1} style={{ color: d.text, fontWeight: '800', fontSize: 17 }}>{section.label}</T>
          <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>{list.length} duas · Hisn al-Muslim</T>
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name={section.icon as never} size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {!pack ? <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
        {list.map((c) => {
          const isOpen = openId === c.ID;
          const isThisPlaying = playingUrl === c.AUDIO_URL && playing;
          return (
            <View key={c.ID} style={{ borderRadius: 16, borderWidth: 1, borderColor: isOpen ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)') : d.cardBorder, backgroundColor: d.card, marginBottom: 10, overflow: 'hidden' }}>
              <Pressable
                onPress={() => {
                  haptic.selection();
                  setOpenId(isOpen ? null : c.ID);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 }}
              >
                <T v="body" style={{ flex: 1, color: d.text, fontWeight: '700', fontSize: 13, lineHeight: 18 }}>{c.TITLE}</T>
                {c.AUDIO_URL ? (
                  <Pressable onPress={() => toggleAudio(c.AUDIO_URL)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isThisPlaying ? 'rgba(46,204,113,0.25)' : d.bgSoft, borderWidth: 1, borderColor: isThisPlaying ? 'rgba(74,227,143,0.6)' : d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name={isThisPlaying ? 'pause' : 'volume-up'} size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
                  </Pressable>
                ) : null}
                <FontAwesome5 name={isOpen ? 'chevron-up' : 'chevron-down'} size={11} color={d.faint} />
              </Pressable>

              {isOpen ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 13, gap: 8 }}>
                  {c.TEXT.map((t) => (
                    <View key={t.ID} style={{ borderTopWidth: 1, borderTopColor: d.cardBorder, paddingTop: 8 }}>
                      <T v="arabic" style={{ color: d.text, fontSize: 20, textAlign: 'right', lineHeight: 36 }}>{t.ARABIC_TEXT}</T>
                      {t.ENGLISH_TEXT ? <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, marginTop: 6, lineHeight: 19 }}>{t.ENGLISH_TEXT}</T> : null}
                    </View>
                  ))}
                  <Pressable
                    onPress={() => {
                      haptic.selection();
                      setShareDua({ arabic: c.TEXT[0]?.ARABIC_TEXT ?? '', meaning: c.TEXT[0]?.ENGLISH_TEXT ?? c.TITLE, ref: `Hisn al-Muslim · ${c.TITLE}` });
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 }}
                  >
                    <FontAwesome5 name="share-alt" size={10} color={d.faint} />
                    <T v="caption" style={{ color: d.subtext, fontWeight: '700', fontSize: 10.5 }}>Share this dua</T>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <ContentShareSheet
        visible={shareDua != null}
        onClose={() => setShareDua(null)}
        card={shareDua ? { kind: 'dua', ...shareDua } : null}
        link="https://deenlink.org/tools/dua"
      />
    </View>
  );
}
