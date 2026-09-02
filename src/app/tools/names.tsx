import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { loadNames99 } from '@/lib/content';
import { NAMES_99 as FALLBACK_NAMES } from '@/data/names99';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/components/Card';
import { TopBar } from '@/components/TopBar';
import { VideoView } from 'expo-video';
import { ScoreShareSheet, type ScoreCard } from '@/components/ScoreShareSheet';
import * as Speech from 'expo-speech';
import { useAudio } from '@/lib/useAudio';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { markGoal } from '@/lib/routine';

/**
 * 99 Names of Allah (pass 22) — now driven by the USER'S dataset (content
 * pack) which carries per-name AUDIO (islamicapi.com mirror) + transliteration
 * + translation + meaning. Play any name through the shared glass player.
 * Falls back to the static list offline.
 */
type NameEntry = { number: number; arabic: string; transliteration: string; translation: string; meaning: string; audio: string };

const audioUrl = (a: string) => (a.startsWith('http') ? a.replace(/^http:/, 'https:') : `https://islamicapi.com${a}`);

export default function Names() {
  /* pass 44 — Today's Goal auto-detect */
  useEffect(() => { markGoal('names'); }, []);

  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [pack, setPack] = useState<NameEntry[] | null>(null);
  const [openNo, setOpenNo] = useState<number | null>(null);
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  /* pass 40 — proper language dropdown + square share card */
  const [langOpen, setLangOpen] = useState(false);
  const [ttsNo, setTtsNo] = useState<number | null>(null);
  const [shareName, setShareName] = useState<NameEntry | null>(null);
  const [scoreCard, setScoreCard] = useState<ScoreCard | null>(null);
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
          onPress={() => { haptic.selection(); setLangOpen(true); }}
          accessibilityLabel="choose language"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: theme.card }}
        >
          <FontAwesome5 name="language" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="caption" style={{ fontWeight: '800', fontSize: 10.5, color: theme.text }}>{lang === 'en' ? 'English' : 'العربية'}</T>
          <FontAwesome5 name="chevron-down" size={8} color={theme.subtext} />
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
                <Pressable
                  onPress={() => {
                    haptic.selection();
                    setScoreCard({ kind: 'name', metric: n.arabic, title: n.transliteration, subtitle: `${n.translation} · Name ${n.number} of 99`, link: 'https://deenlink.org/tools/names' });
                  }}
                  hitSlop={8}
                  style={{ width: 32, height: 32, borderRadius: 11, marginLeft: 6, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}
                >
                  <FontAwesome5 name="share-alt" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </Pressable>
                {/* pass 40 — the play button is ALWAYS shown; entries without
                 * an audio file are spoken with the device TTS (arabic). */}
                <Pressable
                  onPress={() => {
                    haptic.light();
                    if (n.audio) {
                      if (ttsNo != null) { Speech.stop(); setTtsNo(null); }
                      audio.toggle(audioUrl(n.audio));
                    } else if (ttsNo === n.number) {
                      Speech.stop();
                      setTtsNo(null);
                    } else {
                      if (audio.url) audio.toggle(audio.url);
                      Speech.stop();
                      setTtsNo(n.number);
                      Speech.speak(n.arabic, { language: 'ar', rate: 0.85, onDone: () => setTtsNo(null), onError: () => {
                        Speech.speak(n.transliteration, { rate: 0.85, onDone: () => setTtsNo(null) });
                      } });
                    }
                  }}
                  hitSlop={8}
                  style={{ width: 36, height: 36, borderRadius: 18, marginLeft: 8, backgroundColor: isPlaying || ttsNo === n.number ? 'rgba(46,204,113,0.22)' : isDark ? 'rgba(46,204,113,0.10)' : 'rgba(29,111,66,0.06)', borderWidth: 1, borderColor: isPlaying || ttsNo === n.number ? 'rgba(74,227,143,0.6)' : d.cardBorder, alignItems: 'center', justifyContent: 'center' }}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
                  ) : (
                    <FontAwesome5 name={isPlaying || ttsNo === n.number ? 'pause' : 'volume-up'} size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                  )}
                </Pressable>
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
      <ScoreShareSheet
        visible={scoreCard != null}
        onClose={() => setScoreCard(null)}
        card={scoreCard}
        friends={scoreCard ? { title: `99 Names of Allah — ${scoreCard.title} (${scoreCard.subtitle})`, preview: 'deenlink.org/tools/names' } : undefined}
      />

      {/* language dropdown — a proper list */}
      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(4,10,7,0.55)', alignItems: 'center', justifyContent: 'center', padding: 40 }} onPress={() => setLangOpen(false)}>
          <Pressable onPress={(e) => { e.stopPropagation(); }} style={{ width: '100%', maxWidth: 280, borderRadius: 18, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, padding: 8 }}>
            <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 1, color: theme.subtext, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6 }}>DISPLAY LANGUAGE</T>
            {([
              { id: 'en' as const, label: 'English', sub: 'Transliteration first' },
              { id: 'ar' as const, label: 'العربية', sub: 'Arabic script first' },
            ]).map((o) => {
              const on = lang === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => { haptic.selection(); setLang(o.id); setLangOpen(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent' }}
                >
                  <View style={{ flex: 1 }}>
                    <T v="bodyS" style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{o.label}</T>
                    <T v="caption" style={{ fontSize: 9.5, color: theme.subtext, marginTop: 1 }}>{o.sub}</T>
                  </View>
                  {on ? <FontAwesome5 name="check-circle" size={15} color={isDark ? '#4AE38F' : '#1D6F42'} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
