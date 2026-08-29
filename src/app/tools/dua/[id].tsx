import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadDuas, type ContentDua, type ContentDuaText } from '@/lib/content';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { DUA_SECTIONS, groupBySection, type DuaSectionId } from '@/lib/duaSections';
import { ContentShareSheet } from '@/components/ContentShareSheet';
import { GlassPlayerBar } from '@/components/GlassPlayerBar';
import { useAudio } from '@/lib/useAudio';

/**
 * Dua section detail (pass 22) — the SHARED glass player, and the FULL data:
 * arabic + transliteration + translation + repeat, per-part audio from the
 * user's dataset (Hisn al-Muslim, https).
 */
const httpsOf = (u: string) => u.replace(/^http:\/\//, 'https://');

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
  const [shareDua, setShareDua] = useState<{ arabic: string; meaning: string; ref: string } | null>(null);
  const audio = useAudio();

  useEffect(() => {
    loadDuas()
      .then((p) => setPack(p))
      .catch(() => setPack({}));
  }, []);

  const english = useMemo(() => (pack ? pack['English'] ?? [] : []), [pack]);
  const list = useMemo(() => (pack ? groupBySection(english)[sectionId] ?? [] : []), [pack, english, sectionId]);

  /* the part currently loaded in the player (for the glass bar) */
  const nowPlaying = useMemo(() => {
    if (!audio.url) return null;
    for (const c of list) {
      const t = (c.TEXT ?? []).find((x) => x.AUDIO && httpsOf(x.AUDIO) === audio.url);
      if (t) return { dua: c, part: t };
    }
    return null;
  }, [audio.url, list]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
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

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        {!pack ? <T v="bodyS" style={{ color: d.faint, textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
        {list.map((c) => {
          const isOpen = openId === c.ID;
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
                <FontAwesome5 name={isOpen ? 'chevron-up' : 'chevron-down'} size={11} color={d.faint} />
              </Pressable>

              {isOpen ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 13, gap: 10 }}>
                  {(c.TEXT ?? []).map((t) => (
                    <PartCard key={t.ID} t={t} audio={audio} />
                  ))}
                  <Pressable
                    onPress={() => {
                      haptic.selection();
                      setShareDua({ arabic: c.TEXT[0]?.ARABIC_TEXT ?? '', meaning: c.TEXT[0]?.TRANSLATED_TEXT ?? c.TEXT[0]?.ENGLISH_TEXT ?? c.TITLE, ref: `Hisn al-Muslim · ${c.TITLE}` });
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

      {/* shared glass player */}
      {nowPlaying ? (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 14) + 4, zIndex: 40 }}>
          <GlassPlayerBar
            player={audio.player}
            playing={audio.playing}
            loading={audio.loading}
            title={nowPlaying.dua.TITLE}
            subtitle={nowPlaying.part.TRANSLATED_TEXT ?? nowPlaying.part.ENGLISH_TEXT ?? 'Dua audio'}
            onToggle={() => audio.toggle(audio.url as string)}
            frac={audio.frac}
            duration={audio.duration}
            onSeek={(f) => audio.seekFrac(f)}
            seekMargins={{ left: 46, right: 6 }}
          />
        </View>
      ) : null}

      <ContentShareSheet
        visible={shareDua != null}
        onClose={() => setShareDua(null)}
        card={shareDua ? { kind: 'dua', ...shareDua } : null}
        link="https://deenlink.org/tools/dua"
      />
    </View>
  );
}

/* one dua part: arabic + transliteration + translation + repeat + play */
function PartCard({ t, audio }: { t: ContentDuaText; audio: ReturnType<typeof useAudio> }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const url = t.AUDIO ? httpsOf(t.AUDIO) : null;
  const isPlaying = !!url && audio.playing && audio.url === url;
  const isLoading = !!url && audio.loading && audio.url === url;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: d.cardBorder, paddingTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="arabic" style={{ color: d.text, fontSize: 20, textAlign: 'right', lineHeight: 36 }}>{t.ARABIC_TEXT}</T>
          {t.REPEAT && t.REPEAT > 1 ? (
            <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, borderRadius: 8, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 7, paddingVertical: 2 }}>
              <FontAwesome5 name="redo" size={8} color={d.faint} />
              <T v="caption" style={{ fontSize: 9, color: d.faint, fontWeight: '700' }}>x{t.REPEAT}</T>
            </View>
          ) : null}
        </View>
        {url ? (
          <Pressable
            onPress={() => {
              haptic.light();
              audio.toggle(url);
            }}
            hitSlop={8}
            style={{ width: 34, height: 34, borderRadius: 17, marginTop: 4, backgroundColor: isPlaying ? 'rgba(46,204,113,0.22)' : isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: isPlaying ? 'rgba(74,227,143,0.6)' : d.cardBorder, alignItems: 'center', justifyContent: 'center' }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
            ) : (
              <FontAwesome5 name={isPlaying ? 'pause' : 'play'} size={10} color={isDark ? '#4AE38F' : '#1D6F42'} />
            )}
          </Pressable>
        ) : null}
      </View>
      {t.LANGUAGE_ARABIC_TRANSLATED_TEXT ? (
        <T v="bodyS" style={{ color: isDark ? '#4AE38F' : '#1D6F42', fontSize: 11.5, marginTop: 7, fontStyle: 'italic', lineHeight: 17 }}>{t.LANGUAGE_ARABIC_TRANSLATED_TEXT}</T>
      ) : null}
      {t.TRANSLATED_TEXT ?? t.ENGLISH_TEXT ? (
        <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, marginTop: 5, lineHeight: 19 }}>{t.TRANSLATED_TEXT ?? t.ENGLISH_TEXT}</T>
      ) : null}
    </View>
  );
}
