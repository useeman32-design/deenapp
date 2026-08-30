import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { normalizeArabic } from '@/lib/quranSearch';
import { getRecognition, speechSupported } from '@/lib/speech';
import { useQuranAudio } from '@/context/QuranAudioContext';

/**
 * Recite Mode v3 (pass 26):
 * · IDEMPOTENT REALIGNMENT — on every speech event we rebuild the full spoken
 *   token list (all finals + the current interim) and re-run the aligner from
 *   scratch. The old incremental consumer double-counted interim words, which
 *   made realtime tracking jump and mark good words wrong.
 * · WASL — a spoken token may be 2-4 expected words joined; or one expected
 *   word split over two tokens. Both directions handled.
 * · CORRECTIONS — words marked wrong are re-matched against ANY unused spoken
 *   token: recite the word again and the red disappears.
 * · SMOOTH REVEAL — each word animates (opacity/scale) the moment its state
 *   changes; in blind mode words unmask progressively as you reach them.
 * · tap a red/green word → it is pronounced alone (Arabic TTS, ayah fallback).
 */

const DIA = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u06E5\u06E6]/g;
const bare = (t: string) => normalizeArabic(t).replace(DIA, '').replace(/\s+/g, '');

/** edit budget grows with word length — short words must be near-exact */
function close(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const budget = a.length <= 3 ? 1 : a.length <= 6 ? 2 : 3;
  if (Math.abs(a.length - b.length) > budget) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length && edits <= budget) {
    if (a[i] === b[j]) { i++; j++; }
    else { edits++; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  }
  return edits + (a.length - i) + (b.length - j) <= budget;
}

type WordState = 'hidden' | 'ok' | 'wrong';

/** full alignment of the ayah against everything spoken so far */
function align(E: string[], S: string[]): { states: WordState[]; reached: number } {
  const n = E.length;
  const states: WordState[] = new Array(n).fill('hidden');
  const used = new Array(S.length).fill(false);
  let ei = 0;

  /* pass 1 — ordered scan: match / wasl-join / skip-ahead */
  for (let si = 0; si < S.length && ei < n; si++) {
    const tok = S[si];
    if (!tok) continue;
    if (close(E[ei], tok)) { states[ei] = 'ok'; used[si] = true; ei++; continue; }
    let joinHit = 0;
    for (let k = 2; k <= 4 && ei + k <= n; k++) {
      if (close(E.slice(ei, ei + k).join(''), tok)) { joinHit = k; break; }
    }
    if (joinHit) { for (let q = 0; q < joinHit; q++) states[ei + q] = 'ok'; ei += joinHit; used[si] = true; continue; }
    if (ei + 1 < n && close(E[ei + 1], tok)) { states[ei] = 'wrong'; states[ei + 1] = 'ok'; ei += 2; used[si] = true; continue; }
    /* else: insertion noise — ignore */
  }

  /* pass 2 — split: the word at the frontier = two unused tokens glued */
  let front = 0;
  while (front < n && states[front] !== 'hidden') front++;
  if (front < n) {
    for (let si = 0; si < S.length - 1; si++) {
      if (!used[si] && !used[si + 1] && close(E[front], (S[si] ?? '') + (S[si + 1] ?? ''))) {
        states[front] = 'ok'; used[si] = true; used[si + 1] = true; break;
      }
    }
  }

  /* pass 3 — corrections: any red word that matches an unused token turns ok */
  for (let i = 0; i < n; i++) {
    if (states[i] !== 'wrong') continue;
    for (let si = 0; si < S.length; si++) {
      if (!used[si] && close(E[i], S[si] ?? '')) { states[i] = 'ok'; used[si] = true; break; }
    }
  }

  let reached = 0;
  for (let i = n - 1; i >= 0; i--) if (states[i] !== 'hidden') { reached = i + 1; break; }
  return { states, reached };
}

/** pronounce one arabic word via TTS (fallback: the full ayah) */
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
    setTimeout(() => { if (!synth.speaking) fallback(); }, 700);
  } catch { fallback(); }
}

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
  const [live, setLive] = useState(''); // what we hear, right now (bold caption)
  const [score, setScore] = useState<{ ok: number; wrong: number; words: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<ReturnType<typeof getRecognition>>(null);
  const finalText = useRef('');
  const interimText = useRef('');

  const shown = useMemo(() => (verse?.arabic ?? '').split(/\s+/).filter(Boolean), [verse?.arabic]);
  const words = useMemo(() => shown.map((w) => bare(w)), [shown]);
  const [states, setStates] = useState<WordState[]>([]);
  const [reached, setReached] = useState(0);
  const scoredFor = useRef<string>('');

  const realign = () => {
    const spoken = (finalText.current + ' ' + interimText.current).split(/\s+/).map(bare).filter((x) => x.length > 0);
    const { states: st, reached: r } = align(words, spoken);
    setStates(st);
    setReached(r);
    if (r >= words.length && words.length > 0 && scoredFor.current !== `${verseIdx}-${words.length}`) {
      scoredFor.current = `${verseIdx}-${words.length}`;
      setTimeout(() => {
        setScore({ ok: st.filter((x) => x === 'ok').length, wrong: st.filter((x) => x === 'wrong').length, words: words.length });
        haptic.light();
      }, 350);
    }
  };

  useEffect(() => {
    finalText.current = '';
    interimText.current = '';
    scoredFor.current = '';
    setStates(new Array(shown.length).fill('hidden'));
    setReached(0);
    setScore(null);
    setLive('');
  }, [verseIdx, shown.length]);

  const startListening = () => {
    setError(null);
    const r = getRecognition({ continuous: true });
    if (!r) { setError('Speech recognition is not available in this browser.'); return; }
    recRef.current = r;
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt: string = res[0]?.transcript ?? '';
        if (res.isFinal) finalText.current = (finalText.current + ' ' + txt).trim();
        else interim += txt + ' ';
      }
      interimText.current = interim.trim();
      setLive((finalText.current + ' ' + interimText.current).trim().slice(-140));
      realign(); // idempotent — recompute the whole alignment every event
    };
    r.onerror = (e: any) => {
      setListening(false);
      const code = e?.error ?? 'error';
      setError(code === 'not-allowed' ? 'Microphone permission denied — enable it in browser settings.' : code === 'no-speech' ? 'No speech heard — tap the mic and recite again.' : `Mic error: ${code}`);
    };
    r.onend = () => setListening(false);
    try { r.start(); setListening(true); haptic.light(); } catch { setError('Could not start the mic.'); }
  };
  const stopListening = () => { try { recRef.current?.stop(); } catch {} setListening(false); };
  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  const listenAyah = () => { haptic.light(); if (verse) audio.playAyah(verse.surah, verse.ayah); };
  const resetAyah = () => {
    finalText.current = '';
    interimText.current = '';
    scoredFor.current = '';
    setStates(new Array(shown.length).fill('hidden'));
    setReached(0);
    setScore(null);
    setLive('');
  };

  const okCount = states.filter((s) => s === 'ok').length;
  const wrongCount = states.filter((s) => s === 'wrong').length;
  const done = reached >= shown.length && shown.length > 0;

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
          <Pressable accessibilityLabel="toggle blind mode" onPress={() => { haptic.selection(); setBlind((b) => !b); resetAyah(); }} style={{ width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: blind ? 'rgba(44,110,143,0.55)' : d.cardBorder, backgroundColor: blind ? 'rgba(44,110,143,0.12)' : d.card, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={blind ? 'eye-slash' : 'eye'} size={13} color={blind ? '#5EA7C9' : d.subtext} />
          </Pressable>
          <Pressable accessibilityLabel="close recite mode" onPress={() => { stopListening(); onClose(); }} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="times" size={13} color={d.subtext} />
          </Pressable>
        </View>

        {blind ? (
          <View style={{ marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(44,110,143,0.4)', backgroundColor: 'rgba(44,110,143,0.07)', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FontAwesome5 name="eye-slash" size={11} color="#5EA7C9" />
            <T v="caption" style={{ flex: 1, fontSize: 10, color: '#5EA7C9' }}>BLIND MODE — recite from memory; words reveal as you reach them. Went wrong? Say the word again and the red clears.</T>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ marginTop: 6, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 18 }}>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {shown.map((w, i) => (
                <WordChip
                  key={`${verseIdx}-${i}`}
                  word={w}
                  state={states[i] ?? 'hidden'}
                  reached={i < reached}
                  blind={blind}
                  listening={listening}
                  isNext={i === reached}
                  colorBase={d.text}
                  faint={isDark ? 'rgba(242,247,243,0.13)' : 'rgba(20,36,28,0.13)'}
                  onPress={() => {
                    const st = states[i] ?? 'hidden';
                    if (st === 'wrong' || st === 'ok') { haptic.selection(); speakWord(w, listenAyah); }
                    else if (!supported) {
                      /* practice mode: tap each word as you recite it */
                      haptic.selection();
                      setStates((prev) => { const n = prev.length === shown.length ? [...prev] : new Array(shown.length).fill('hidden'); n[i] = 'ok'; return n; });
                      setReached(Math.max(reached, i + 1));
                    }
                  }}
                />
              ))}
            </View>

            {/* progress */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', overflow: 'hidden' }}>
                <View style={{ width: `${shown.length ? (100 * reached) / shown.length : 0}%`, backgroundColor: wrongCount > 0 && wrongCount >= okCount ? '#E05252' : isDark ? '#4AE38F' : '#1D6F42', height: 5 }} />
              </View>
              <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: d.faint }}>{mode === 'surah' ? `${verseIdx + 1}/${items.length} · ` : ''}{reached}/{shown.length}</T>
            </View>
            {live ? (
              <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: isDark ? 'rgba(74,227,143,0.75)' : 'rgba(29,111,66,0.75)', textAlign: 'center', marginTop: 8 }} numberOfLines={2}>🎙 {live}</T>
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
                {score.wrong === 0 ? 'Ayah recited flawlessly.' : `${score.wrong} word${score.wrong > 1 ? 's' : ''} in red — tap a red word to hear it, or say it again to clear it.`}
              </T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Pressable onPress={listenAyah} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
                  <FontAwesome5 name="volume-up" size={11} color="#E8C96A" />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#E8C96A' }}>Listen</T>
                </Pressable>
                <Pressable onPress={resetAyah} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft }}>
                  <FontAwesome5 name="undo" size={11} color={d.subtext} />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.subtext }}>Retry</T>
                </Pressable>
                {verseIdx < items.length - 1 ? (
                  <Pressable onPress={() => setVerseIdx(verseIdx + 1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}>
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
            {supported ? 'Recite at a steady pace — joined words (wasl) are fine. Words light up as you say them; a red word clears when you say it correctly again.' : 'Speech recognition isn’t available here — practice mode: recite out loud and tap each word as you say it.'}
          </T>
        </ScrollView>

        {/* footer */}
        <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: d.cardBorder, backgroundColor: d.card, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {supported ? (
            <Pressable onPress={() => (listening ? stopListening() : startListening())} accessibilityLabel="toggle recitation listening" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: listening ? 'rgba(220,80,80,0.1)' : isDark ? '#1F8F5C' : '#1D6F42', borderWidth: 1, borderColor: listening ? 'rgba(220,80,80,0.4)' : 'transparent' }}>
              {listening ? <ActivityIndicator size="small" color="#DC5050" /> : <FontAwesome5 name="microphone-alt" size={13} color="#fff" />}
              <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: listening ? '#DC5050' : '#fff' }}>{listening ? 'Listening… tap to stop' : done ? 'Recite next ayah' : 'Start reciting'}</T>
            </Pressable>
          ) : null}
          <Pressable onPress={listenAyah} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
            <FontAwesome5 name="volume-up" size={13} color="#E8C96A" />
            <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: '#E8C96A' }}>Listen</T>
          </Pressable>
          <Pressable onPress={resetAyah} accessibilityLabel="reset ayah" style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="undo" size={13} color={d.subtext} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** one ayah word — animates smoothly when its state changes */
function WordChip({ word, state, reached, blind, listening, isNext, colorBase, faint, onPress }: {
  word: string; state: WordState; reached: boolean; blind: boolean; listening: boolean; isNext: boolean;
  colorBase: string; faint: string; onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(state === 'hidden' ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: state === 'hidden' ? 0 : 1, duration: 320, easing: Easing.out(Easing.poly(3)), useNativeDriver: false }).start();
  }, [state, anim]);

  const revealed = !blind || reached; // blind: only words the reciter has reached
  const color = state === 'wrong' ? '#E05252' : state === 'ok' ? colorBase : revealed ? faint : 'transparent';
  const isLive = listening && isNext && state === 'hidden';

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 8,
        paddingHorizontal: 4,
        paddingVertical: 2,
        backgroundColor: state === 'wrong' ? 'rgba(220,60,60,0.16)' : isLive ? 'rgba(212,175,55,0.14)' : 'transparent',
        borderWidth: state === 'wrong' ? 1 : 0,
        borderColor: 'rgba(220,60,60,0.45)',
      }}
    >
      <Animated.Text
        style={{
          fontFamily: 'Amiri',
          fontSize: 30,
          lineHeight: 56,
          textAlign: 'center',
          color,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          textDecorationLine: state === 'wrong' ? 'underline' : 'none',
          minWidth: blind && !reached ? 34 : undefined,
        }}
      >
        {blind && !reached ? '҉҉҉' : word}
      </Animated.Text>
    </Pressable>
  );
}
