import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { normalizeArabic } from '@/lib/quranSearch';
import { getRecognition, speechSupported } from '@/lib/speech';
import { useQuranAudio } from '@/context/QuranAudioContext';
import type { SurahContent } from '@/lib/content';

/**
 * Recite Mode (pass 24) — the app listens while you recite:
 * · words of the ayah reveal smoothly, one by one, as you say them
 * · a word the app can't match lights up RED — recite it again or tap 🔊
 * · tap any word to hear it highlighted; end-of-ayah score + next ayah
 * · browsers without speech recognition (in-app browsers etc.) get
 *   tap-to-reveal practice mode instead.
 */

/* word-level tolerance for recognition slips */
function close(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length && edits <= 2) {
    if (a[i] === b[j]) { i++; j++; }
    else { edits++; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  }
  return edits + (a.length - i) + (b.length - j) <= 2;
}

type WordState = 'hidden' | 'ok' | 'wrong';

export function ReciteMode({
  surah,
  surahName,
  data,
  startAyah,
  onClose,
}: {
  surah: number;
  surahName: string;
  data: SurahContent;
  startAyah: number;
  onClose: () => void;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const audio = useQuranAudio();

  const [ayah, setAyah] = useState(Math.min(Math.max(1, startAyah), data.verses.length));
  const verse = data.verses[ayah - 1];
  const supported = useMemo(() => speechSupported(), []);
  const [listening, setListening] = useState(false);
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<ReturnType<typeof getRecognition>>(null);
  const ptr = useRef(0);

  const words = useMemo(
    () => (verse?.arabic ?? '').split(/\s+/).filter(Boolean).map((w) => normalizeArabic(w)).filter((w) => w.length > 0),
    [verse?.arabic],
  );
  const shown = useMemo(() => (verse?.arabic ?? '').split(/\s+/).filter(Boolean), [verse?.arabic]);
  const done = ptr.current >= words.length && words.length > 0;
  const okCount = wordStates.filter((s) => s === 'ok').length;
  const wrongCount = wordStates.filter((s) => s === 'wrong').length;

  const resetAyah = (a: number) => {
    ptr.current = 0;
    setWordStates(new Array(words.length).fill('hidden'));
    setHeard('');
    setAyah(a);
  };

  /* re-seed when the ayah changes */
  useEffect(() => {
    ptr.current = 0;
    setWordStates(new Array(words.length).fill('hidden'));
  }, [words.length, ayah]);

  const mark = (idx: number, state: WordState) => {
    setWordStates((prev) => {
      const next = prev.length === words.length ? [...prev] : new Array(words.length).fill('hidden');
      next[idx] = state;
      return next;
    });
  };

  /* feed one recognized token into the alignment */
  const step = (tokRaw: string) => {
    const tok = normalizeArabic(tokRaw);
    if (tok.length < 2) return;
    setHeard((h) => (h ? h + ' ' + tokRaw : tokRaw));
    if (ptr.current >= words.length) return;
    const target = words[ptr.current];
    if (close(target, tok)) {
      mark(ptr.current, 'ok');
      ptr.current++;
      haptic.selection();
    } else if (ptr.current + 1 < words.length && close(words[ptr.current + 1], tok)) {
      /* skipped a word → that word is the mistake */
      mark(ptr.current, 'wrong');
      ptr.current += 1;
      mark(ptr.current, 'ok');
      ptr.current++;
    } else {
      mark(ptr.current, 'wrong');
      ptr.current++;
    }
  };

  const startListening = () => {
    setError(null);
    const r = getRecognition({ continuous: true });
    if (!r) { setError('Speech recognition is not available in this browser.'); return; }
    recRef.current = r;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt: string = res[0]?.transcript ?? '';
        if (res.isFinal) {
          const toks = txt.split(/\s+/).filter(Boolean);
          toks.forEach(step);
        } else {
          /* interim: only chase the newest token */
          const toks = txt.split(/\s+/).filter(Boolean);
          const last = toks[toks.length - 1];
          if (last) setHeard((h) => (h ? h + ' ' + last : last));
        }
      }
    };
    r.onerror = (e: any) => {
      setListening(false);
      const code = e?.error ?? 'error';
      setError(code === 'not-allowed' ? 'Microphone permission denied — enable it in browser settings.' : code === 'no-speech' ? 'No speech heard — tap the mic and recite again.' : `Mic error: ${code}`);
    };
    r.onend = () => setListening(false);
    try { r.start(); setListening(true); haptic.light(); } catch { setError('Could not start the mic.'); }
  };

  const stopListening = () => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  };

  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  const listenVerse = () => {
    haptic.light();
    audio.playAyah(surah, ayah);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: d.bg, paddingTop: insets.top + 8 }}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="microphone-alt" size={14} color="#E8C96A" />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 16, color: d.text }}>Recite Mode</T>
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{surahName} · Ayah {ayah} of {data.verses.length}{supported ? '' : ' · practice mode'}</T>
          </View>
          <Pressable accessibilityLabel="close recite mode" onPress={() => { stopListening(); onClose(); }} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="times" size={13} color={d.subtext} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* the ayah, word by word (RTL) */}
          <View style={{ marginTop: 10, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 18 }}>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {shown.map((w, i) => {
                const st = wordStates[i] ?? 'hidden';
                return (
                  <Pressable key={i} onPress={() => (supported && st === 'hidden' ? mark(i, 'ok') : undefined)} style={{ borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2, backgroundColor: st === 'wrong' ? 'rgba(220,60,60,0.16)' : 'transparent', borderWidth: st === 'wrong' ? 1 : 0, borderColor: 'rgba(220,60,60,0.45)' }}>
                    <Text
                      style={{
                        fontFamily: 'Amiri',
                        fontSize: 30,
                        lineHeight: 56,
                        textAlign: 'center',
                        color: st === 'wrong' ? '#E05252' : st === 'ok' ? d.text : isDark ? 'rgba(242,247,243,0.13)' : 'rgba(20,36,28,0.13)',
                        textDecorationLine: st === 'wrong' ? 'underline' : 'none',
                      }}
                    >
                      {w}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* progress */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', overflow: 'hidden', flexDirection: 'row' }}>
                <View style={{ width: `${words.length ? (100 * (okCount + wrongCount)) / words.length : 0}%`, backgroundColor: wrongCount > 0 && wrongCount >= okCount ? '#E05252' : isDark ? '#4AE38F' : '#1D6F42' }} />
              </View>
              <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: d.faint }}>{okCount + wrongCount}/{words.length}</T>
            </View>
            {heard ? (
              <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 8 }} numberOfLines={2}>
                heard: {heard.slice(-120)}
              </T>
            ) : null}
          </View>

          {/* done card */}
          {done ? (
            <View style={{ marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: wrongCount === 0 ? 'rgba(212,175,55,0.5)' : d.cardBorder, backgroundColor: wrongCount === 0 ? 'rgba(212,175,55,0.08)' : d.card, padding: 16, alignItems: 'center' }}>
              <FontAwesome5 name={wrongCount === 0 ? 'trophy' : 'redo'} size={20} color={wrongCount === 0 ? '#E8C96A' : d.subtext} />
              <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text, marginTop: 8 }}>
                {wrongCount === 0 ? 'Masha’Allah — perfect!' : `${okCount}/${words.length} correct`}
              </T>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 3, textAlign: 'center' }}>
                {wrongCount === 0 ? 'Ayah recited flawlessly.' : `${wrongCount} word${wrongCount > 1 ? 's' : ''} lit red — listen again and repeat them.`}
              </T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable onPress={listenVerse} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
                  <FontAwesome5 name="volume-up" size={11} color="#E8C96A" />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#E8C96A' }}>Listen</T>
                </Pressable>
                <Pressable onPress={() => resetAyah(ayah)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft }}>
                  <FontAwesome5 name="undo" size={11} color={d.subtext} />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.subtext }}>Retry</T>
                </Pressable>
                {ayah < data.verses.length ? (
                  <Pressable onPress={() => resetAyah(ayah + 1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}>
                    <FontAwesome5 name="arrow-right" size={11} color="#fff" />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#fff' }}>Next ayah</T>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={{ marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(220,80,80,0.3)', backgroundColor: 'rgba(220,80,80,0.06)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FontAwesome5 name="exclamation-circle" size={12} color="#DC5050" />
              <T v="caption" style={{ flex: 1, fontSize: 10, color: '#DC5050' }}>{error}</T>
            </View>
          ) : null}

          {!supported ? (
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 14, lineHeight: 15 }}>
              Speech recognition isn’t available here — practice mode: recite out loud and tap each word as you say it to reveal it.
            </T>
          ) : (
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 14, lineHeight: 15 }}>
              Recite slowly and clearly. Words appear as you say them — a red word means the app heard something different: say it again or tap 🔊 to listen.
            </T>
          )}
        </ScrollView>

        {/* footer controls */}
        <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: d.cardBorder, backgroundColor: d.card, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {supported ? (
            <Pressable
              onPress={() => (listening ? stopListening() : startListening())}
              accessibilityLabel="toggle recitation listening"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: listening ? 'rgba(220,80,80,0.1)' : isDark ? '#1F8F5C' : '#1D6F42', borderWidth: 1, borderColor: listening ? 'rgba(220,80,80,0.4)' : 'transparent' }}
            >
              {listening ? <ActivityIndicator size="small" color="#DC5050" /> : <FontAwesome5 name="microphone-alt" size={13} color={listening ? '#DC5050' : '#fff'} />}
              <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: listening ? '#DC5050' : '#fff' }}>{listening ? 'Listening… tap to stop' : 'Start reciting'}</T>
            </Pressable>
          ) : null}
          <Pressable onPress={listenVerse} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
            <FontAwesome5 name="volume-up" size={13} color="#E8C96A" />
            <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: '#E8C96A' }}>Listen</T>
          </Pressable>
          <Pressable onPress={() => resetAyah(ayah)} style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="undo" size={13} color={d.subtext} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
