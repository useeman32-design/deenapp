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

/**
 * Recite Mode v2 (pass 25):
 * · WASL tolerance — reciting words joined (or slightly changed) still matches;
 *   a mismatch only turns red when the word truly isn't what was heard.
 * · REALTIME — interim speech results move a gold cursor to where you are now.
 * · BLIND mode — hide the text entirely and recite from memory; revealed (with
 *   mistakes) when the ayah completes.
 * · SURAH / PAGE mode — keep following across every ayah in `data.verses`,
 *   auto-advancing as you recite; mistakes stay tappable.
 * · tap a red word → the app pronounces just that word (Arabic TTS, falls back
 *   to the ayah's recitation).
 */

const DIA = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const bare = (t: string) => normalizeArabic(t).replace(DIA, '').replace(/\s+/g, '');

/** tolerant word equality (recognition slips of ≤2 edits) */
function close(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length && edits <= 2) {
    if (a[i] === b[j]) { i++; j++; }
    else { edits++; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  }
  return edits + (a.length - i) + (b.length - j) <= 2;
}

/** speak a single arabic word (TTS → fallback: play the whole ayah) */
function speakWord(word: string, fallback: () => void) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return fallback();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'ar-SA';
    u.rate = 0.75;
    const arabicVoice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('ar'));
    if (arabicVoice) u.voice = arabicVoice;
    u.onerror = () => fallback();
    synth.cancel();
    synth.speak(u);
    /* if no arabic voice exists many engines stay silent — schedule the fallback */
    setTimeout(() => { if (!synth.speaking) fallback(); }, 700);
  } catch {
    fallback();
  }
}

type WordState = 'hidden' | 'ok' | 'wrong' | 'current';

export type ReciteItem = { surah: number; ayah: number; arabic: string; label?: string };

export function ReciteMode({
  title,
  items,
  startAt = 0,
  mode = 'ayah',
  onClose,
}: {
  title: string;
  items: ReciteItem[];
  startAt?: number;
  /** ayah = one at a time · surah/page = follow the whole list continuously */
  mode?: 'ayah' | 'surah';
  onClose: () => void;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const audio = useQuranAudio();

  const supported = useMemo(() => speechSupported(), []);
  const [verseIdx, setVerseIdx] = useState(Math.min(Math.max(0, startAt), Math.max(0, items.length - 1)));
  const verse = items[verseIdx];
  const [listening, setListening] = useState(false);
  const [blind, setBlind] = useState(false);
  const [revealed, setRevealed] = useState(false); // blind → revealed after finishing
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<{ ok: number; wrong: number; words: number } | null>(null);
  const recRef = useRef<ReturnType<typeof getRecognition>>(null);

  const shown = useMemo(() => (verse?.arabic ?? '').split(/\s+/).filter(Boolean), [verse?.arabic]);
  const words = useMemo(() => shown.map((w) => bare(w)).filter((w) => w.length > 0), [shown]);
  const [states, setStates] = useState<WordState[]>([]);
  const ptr = useRef(0);
  const carry = useRef(''); // wasl buffer — half-heard word waiting for its other half

  useEffect(() => {
    ptr.current = 0;
    carry.current = '';
    setStates(new Array(shown.length).fill('hidden'));
    setScore(null);
    setRevealed(false);
    setHeard('');
  }, [verseIdx, shown.length]);

  const setW = (idx: number, st: WordState) =>
    setStates((prev) => {
      const next = prev.length === shown.length ? [...prev] : new Array(shown.length).fill('hidden');
      next[idx] = st;
      return next;
    });

  const finishAyah = (ok: number, wrong: number) => {
    setScore({ ok, wrong, words: shown.length });
    setRevealed(true);
    haptic.light();
  };

  /** core aligner — one heard token (raw) against the ayah, wasl-tolerant */
  const step = (tokRaw: string, isFinal: boolean) => {
    const tok = bare(tokRaw);
    if (tok.length < 1) return;
    setHeard((h) => (h ? h + ' ' + tokRaw : tokRaw));
    if (ptr.current >= shown.length) return;

    /* candidate = carried half + new token (handles a word split across results) */
    const joined = carry.current ? carry.current + tok : tok;
    const joinedN = bare(joined);

    /* 1) plain match on the current word */
    if (close(words[ptr.current], tok)) {
      setW(ptr.current, 'ok');
      ptr.current++;
      carry.current = '';
    }
    /* 2) WASL — this token is TWO+ expected words said joined */
    else {
      let matchedN = 0;
      for (let n = 2; n <= 4 && ptr.current + n <= words.length; n++) {
        const run = words.slice(ptr.current, ptr.current + n).join('');
        if (close(run, joinedN) || close(run, tok)) { matchedN = n; break; }
      }
      if (matchedN > 0) {
        for (let k = 0; k < matchedN; k++) setW(ptr.current + k, 'ok');
        ptr.current += matchedN;
        carry.current = '';
      }
      /* 3) split — carried + token joins into the current word */
      else if (carry.current && close(words[ptr.current], joinedN)) {
        setW(ptr.current, 'ok');
        ptr.current++;
        carry.current = '';
      }
      /* 4) skip-ahead — the NEXT word was said (current one is the mistake) */
      else if (ptr.current + 1 < words.length && close(words[ptr.current + 1], tok)) {
        if (isFinal) {
          setW(ptr.current, 'wrong');
          setW(ptr.current + 1, 'ok');
          ptr.current += 2;
        } else {
          setW(ptr.current + 1, 'current');
        }
        carry.current = '';
      }
      /* 5) genuinely different — only Finals may mark red (interim is too noisy) */
      else {
        if (isFinal) {
          setW(ptr.current, 'wrong');
          ptr.current++;
          carry.current = '';
        } else if (tok.length > 2) {
          carry.current = tok; // might be the first half of a joined/split word
        }
      }
    }

    /* cursor on the upcoming word (realtime position, no commitment) */
    if (ptr.current < shown.length) setW(ptr.current, states[ptr.current] === 'ok' || states[ptr.current] === 'wrong' ? states[ptr.current] : 'current');

    if (ptr.current >= shown.length) {
      const ok = states.filter((s) => s === 'ok').length + 1;
      const wrong = states.filter((s) => s === 'wrong').length;
      finishAyah(ok, wrong);
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
        const toks = txt.split(/\s+/).filter(Boolean);
        if (res.isFinal) toks.forEach((t) => step(t, true));
        else if (toks.length) step(toks[toks.length - 1], false); // realtime: chase the newest word
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

  const nextAyah = () => {
    if (verseIdx < items.length - 1) setVerseIdx(verseIdx + 1);
  };
  const listenAyah = () => {
    haptic.light();
    if (verse) audio.playAyah(verse.surah, verse.ayah);
  };

  const hideText = blind && !revealed;
  const okCount = states.filter((s) => s === 'ok').length;
  const wrongCount = states.filter((s) => s === 'wrong').length;
  const done = ptr.current >= shown.length && shown.length > 0;
  const totalProgress = mode === 'surah' ? `${verseIdx + 1}/${items.length} · ` : '';

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
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>
              {mode === 'surah' ? `${title} · following ${items.length} ayahs` : `${title}${verse?.label ? ' · ' + verse.label : ''}`}{supported ? '' : ' · practice mode'}
            </T>
          </View>
          {/* blind toggle */}
          <Pressable
            accessibilityLabel="toggle blind mode"
            onPress={() => { haptic.selection(); setBlind((b) => !b); }}
            style={{ width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: blind ? 'rgba(44,110,143,0.55)' : d.cardBorder, backgroundColor: blind ? 'rgba(44,110,143,0.12)' : d.card, alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name={blind ? 'eye-slash' : 'eye'} size={13} color={blind ? '#5EA7C9' : d.subtext} />
          </Pressable>
          <Pressable accessibilityLabel="close recite mode" onPress={() => { stopListening(); onClose(); }} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="times" size={13} color={d.subtext} />
          </Pressable>
        </View>

        {/* blind banner */}
        {hideText ? (
          <View style={{ marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(44,110,143,0.4)', backgroundColor: 'rgba(44,110,143,0.07)', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FontAwesome5 name="eye-slash" size={11} color="#5EA7C9" />
            <T v="caption" style={{ flex: 1, fontSize: 10, color: '#5EA7C9' }}>BLIND MODE — recite from memory. The text reveals (with mistakes marked) when the ayah completes.</T>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ marginTop: 6, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 18 }}>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {shown.map((w, i) => {
                const st = states[i] ?? 'hidden';
                const showWord = !hideText || st === 'ok' || st === 'wrong';
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      if (st === 'wrong' || st === 'ok') {
                        haptic.selection();
                        speakWord(w, () => audio.playAyah(verse.surah, verse.ayah));
                      } else if (!supported && st === 'hidden') {
                        markPractice(i);
                      }
                    }}
                    style={{
                      borderRadius: 8,
                      paddingHorizontal: 4,
                      paddingVertical: 2,
                      backgroundColor: st === 'wrong' ? 'rgba(220,60,60,0.16)' : st === 'current' && listening ? 'rgba(212,175,55,0.15)' : 'transparent',
                      borderWidth: st === 'wrong' ? 1 : 0,
                      borderColor: 'rgba(220,60,60,0.45)',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Amiri',
                        fontSize: 30,
                        lineHeight: 56,
                        textAlign: 'center',
                        color: st === 'wrong' ? '#E05252' : st === 'ok' ? d.text : hideText ? 'transparent' : st === 'current' && listening ? '#E8C96A' : isDark ? 'rgba(242,247,243,0.13)' : 'rgba(20,36,28,0.13)',
                        textDecorationLine: st === 'wrong' ? 'underline' : 'none',
                        minWidth: hideText ? 34 : undefined,
                      }}
                    >
                      {hideText ? '҉҉҉' : w}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* progress */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', overflow: 'hidden' }}>
                <View style={{ width: `${shown.length ? (100 * (okCount + wrongCount)) / shown.length : 0}%`, backgroundColor: wrongCount > 0 && wrongCount >= okCount ? '#E05252' : isDark ? '#4AE38F' : '#1D6F42', height: 5 }} />
              </View>
              <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: d.faint }}>{totalProgress}{okCount + wrongCount}/{shown.length}</T>
            </View>
            {heard && !hideText ? (
              <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 8 }} numberOfLines={2}>heard: {heard.slice(-120)}</T>
            ) : null}
          </View>

          {/* completion card */}
          {score ? (
            <View style={{ marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: score.wrong === 0 ? 'rgba(212,175,55,0.5)' : d.cardBorder, backgroundColor: score.wrong === 0 ? 'rgba(212,175,55,0.08)' : d.card, padding: 16, alignItems: 'center' }}>
              <FontAwesome5 name={score.wrong === 0 ? 'trophy' : 'redo'} size={20} color={score.wrong === 0 ? '#E8C96A' : d.subtext} />
              <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text, marginTop: 8 }}>
                {score.wrong === 0 ? 'Masha’Allah — perfect!' : `${score.ok}/${score.words} correct`}
              </T>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 3, textAlign: 'center' }}>
                {score.wrong === 0 ? 'Ayah recited flawlessly.' : `${score.wrong} word${score.wrong > 1 ? 's' : ''} in red — tap a red word to hear it pronounced.`}
              </T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Pressable onPress={listenAyah} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
                  <FontAwesome5 name="volume-up" size={11} color="#E8C96A" />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#E8C96A' }}>Listen</T>
                </Pressable>
                <Pressable onPress={() => { setVerseIdx(verseIdx); ptr.current = 0; carry.current = ''; setStates(new Array(shown.length).fill('hidden')); setScore(null); setRevealed(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft }}>
                  <FontAwesome5 name="undo" size={11} color={d.subtext} />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.subtext }}>Retry</T>
                </Pressable>
                {verseIdx < items.length - 1 ? (
                  <Pressable onPress={nextAyah} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}>
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

          <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 14, lineHeight: 15 }}>
            {supported ? 'Recite at a steady pace — joined words (wasl) are fine. The gold word is where I’m listening; red words need another look — tap them to hear each word alone.' : 'Speech recognition isn’t available here — practice mode: recite out loud and tap each word as you say it.'}
          </T>
        </ScrollView>

        {/* footer */}
        <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: d.cardBorder, backgroundColor: d.card, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {supported ? (
            <Pressable
              onPress={() => (listening ? stopListening() : startListening())}
              accessibilityLabel="toggle recitation listening"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: listening ? 'rgba(220,80,80,0.1)' : isDark ? '#1F8F5C' : '#1D6F42', borderWidth: 1, borderColor: listening ? 'rgba(220,80,80,0.4)' : 'transparent' }}
            >
              {listening ? <ActivityIndicator size="small" color="#DC5050" /> : <FontAwesome5 name="microphone-alt" size={13} color="#fff" />}
              <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: listening ? '#DC5050' : '#fff' }}>{listening ? 'Listening… tap to stop' : done ? 'Recite next ayah' : 'Start reciting'}</T>
            </Pressable>
          ) : null}
          <Pressable onPress={listenAyah} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
            <FontAwesome5 name="volume-up" size={13} color="#E8C96A" />
            <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: '#E8C96A' }}>Listen</T>
          </Pressable>
          <Pressable onPress={() => { ptr.current = 0; carry.current = ''; setStates(new Array(shown.length).fill('hidden')); setScore(null); setRevealed(false); }} accessibilityLabel="reset ayah" style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="undo" size={13} color={d.subtext} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  /* practice fallback: tap reveals */
  function markPractice(i: number) {
    setW(i, 'ok');
    ptr.current = Math.max(ptr.current, i + 1);
    if (ptr.current >= shown.length) {
      const ok = states.filter((s) => s === 'ok').length + 1;
      finishAyah(ok, 0);
    }
  }
}
