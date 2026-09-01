import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { loadNames99 } from '@/lib/content';
import { NAMES_99 as FALLBACK_NAMES } from '@/data/names99';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';
import { VideoView } from 'expo-video';
import { ContentShareSheet } from '@/components/ContentShareSheet';
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
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [shareName, setShareName] = useState<NameEntry | null>(null);
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
      <TopBar showBack title="99 Names of Allah" subtitle={pack ? `${list.length} of ${pack.length} names · audio` : `${list.length} names · offline list`} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Pressable
          onPress={() => { haptic.selection(); setLang((l) => (l === 'en' ? 'ar' : 'en')); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: theme.card }}
        >
          <FontAwesome5 name="language" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="caption" style={{ color: lang === 'en' ? (isDark ? '#4AE38F' : '#1D6F42') : theme.subtext, fontWeight: '800', fontSize: 10.5 }}>EN</T>
          <T v="caption" style={{ color: theme.subtext, fontWeight: '800', fontSize: 10.5 }}>|</T>
          <T v="caption" style={{ color: lang === 'ar' ? (isDark ? '#4AE38F' : '#1D6F42') : theme.subtext, fontWeight: '800', fontSize: 10.5 }}>AR</T>
        </Pressable>
        <View style={{ flex: 1 }}>
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
                  {lang === 'en' ? (
                    <>
                      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14.5, fontFamily: 'Poppins-SemiBold' }}>{n.transliteration}</Text>
                      <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 2, fontFamily: 'Poppins' }}>{n.translation}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontFamily: 'Amiri-Bold', color: theme.text, fontSize: 21, lineHeight: 30, textAlign: 'left' }}>{n.arabic}</Text>
                      <Text style={{ color: theme.subtext, fontSize: 11.5, marginTop: 1, fontFamily: 'Poppins', fontStyle: 'italic' }}>{n.transliteration}</Text>
                    </>
                  )}
                </Pressable>
                <Pressable onPress={() => { haptic.selection(); setShareName(n); }} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 11, marginLeft: 6, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="share-alt" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
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

      {/* pass 23: no floating player — the per-row play button is enough.
       * The audio element still needs a mounted view for the web engine. */}
      <View style={{ position: 'absolute', width: 2, height: 2, opacity: 0.01 }} pointerEvents="none">
        <VideoView player={audio.player} style={{ width: 2, height: 2 }} contentFit="contain" nativeControls={false} />
      </View>
      <ContentShareSheet
        visible={shareName != null}
        onClose={() => setShareName(null)}
        card={shareName ? { kind: 'post', arabic: shareName.arabic, meaning: `${shareName.transliteration} — ${shareName.translation}. ${shareName.meaning}`.slice(0, 400), ref: `99 Names of Allah · No. ${shareName.number}` } : null}
        link="https://deenlink.org/tools/names"
      />
    </View>
  );
}
