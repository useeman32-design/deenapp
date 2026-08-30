import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { speakWord, useReciteTracker, type ReciteItem, type WordState } from '@/lib/reciteEngine';
import { useQuranAudio } from '@/context/QuranAudioContext';

/** Recite Mode screen (pass 27) — UI over lib/reciteEngine:
 *  · mic auto-STOPS when the ayah completes (or auto-advances when perfect)
 *  · strict matching — vowel slips that change a word are flagged red
 *  · tap any word → real reciter pronunciation of that word alone */
export { type ReciteItem } from '@/lib/reciteEngine';

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
  const [autoNext, setAutoNextState] = useState(mode === 'surah');
  const tr = useReciteTracker(items, { autoNext: mode === 'surah' });

  useEffect(() => { tr.setAutoNext(autoNext); }, [autoNext, tr]);
  useEffect(() => { tr.setIdx(Math.min(Math.max(0, startAt), Math.max(0, items.length - 1))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const listenAyah = () => { haptic.light(); if (tr.item) audio.playAyah(tr.item.surah, tr.item.ayah); };
  const pronounce = (i: number) => { haptic.selection(); if (tr.item) speakWord(tr.item.surah, tr.item.ayah, i, tr.shown[i] ?? '', listenAyah); };

  return (
    <Modal visible animationType="slide" onRequestClose={() => { tr.stop(); onClose(); }}>
      <View style={{ flex: 1, backgroundColor: d.bg, paddingTop: insets.top + 8 }}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="microphone-alt" size={14} color="#E8C96A" />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h2" style={{ fontWeight: '800', fontSize: 16, color: d.text }}>Recite Mode</T>
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>
              {mode === 'surah' ? `${title} · ${tr.idx + 1}/${items.length} ayahs` : `${title}`}{tr.supported ? '' : ' · practice mode'}
            </T>
          </View>
          {/* AUTO-NEXT: perfect ayah → move on automatically */}
          <Pressable
            accessibilityLabel="toggle auto next"
            onPress={() => { haptic.selection(); setAutoNextState((v) => !v); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, borderRadius: 11, borderWidth: 1.5, borderColor: autoNext ? 'rgba(212,175,55,0.6)' : d.cardBorder, backgroundColor: autoNext ? 'rgba(212,175,55,0.13)' : d.card, paddingHorizontal: 9 }}
          >
            <FontAwesome5 name="forward" size={9} color={autoNext ? '#E8C96A' : d.subtext} />
            <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: autoNext ? '#E8C96A' : d.subtext }}>AUTO-NEXT</T>
          </Pressable>
          <Pressable accessibilityLabel="close recite mode" onPress={() => { tr.stop(); onClose(); }} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="times" size={13} color={d.subtext} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ marginTop: 6, borderRadius: 20, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 18 }}>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {tr.shown.map((w, i) => {
                const st = tr.states[i] ?? 'hidden';
                return (
                  <WordChip
                    key={`${tr.idx}-${i}`}
                    word={w}
                    state={st}
                    listening={tr.listening}
                    isNext={i === tr.reached}
                    colorBase={d.text}
                    faint={isDark ? 'rgba(242,247,243,0.13)' : 'rgba(20,36,28,0.13)'}
                    onPress={() => { if (st !== 'hidden') pronounce(i); }}
                  />
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.08)', overflow: 'hidden' }}>
                <View style={{ width: `${tr.shown.length ? (100 * tr.reached) / tr.shown.length : 0}%`, backgroundColor: tr.wrongCount > 0 && tr.wrongCount >= tr.okCount ? '#E05252' : isDark ? '#4AE38F' : '#1D6F42', height: 5 }} />
              </View>
              <T v="caption" style={{ fontSize: 9, fontWeight: '800', color: d.faint }}>{tr.reached}/{tr.shown.length}</T>
            </View>
            {tr.live ? (
              <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: isDark ? 'rgba(74,227,143,0.75)' : 'rgba(29,111,66,0.75)', textAlign: 'center', marginTop: 8 }} numberOfLines={2}>🎙 {tr.live}</T>
            ) : null}
          </View>

          {/* verdict */}
          {tr.score ? (
            <View style={{ marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: tr.score.wrong === 0 ? 'rgba(212,175,55,0.5)' : d.cardBorder, backgroundColor: tr.score.wrong === 0 ? 'rgba(212,175,55,0.08)' : d.card, padding: 16, alignItems: 'center' }}>
              <FontAwesome5 name={tr.score.wrong === 0 ? 'trophy' : 'exclamation-circle'} size={20} color={tr.score.wrong === 0 ? '#E8C96A' : '#DC5050'} />
              <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: d.text, marginTop: 8 }}>
                {tr.score.wrong === 0 ? 'Masha’Allah — perfect!' : `${tr.score.ok}/${tr.score.words} correct`}
              </T>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 3, textAlign: 'center' }}>
                {tr.score.wrong === 0
                  ? autoNext && tr.idx < items.length - 1 ? 'Moving to the next ayah…' : 'Ayah recited flawlessly.'
                  : `${tr.score.wrong} word${tr.score.wrong > 1 ? 's' : ''} need another look — tap a red word to hear it, then Retry.`}
              </T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Pressable onPress={listenAyah} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
                  <FontAwesome5 name="volume-up" size={11} color="#E8C96A" />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#E8C96A' }}>Listen</T>
                </Pressable>
                <Pressable onPress={() => { haptic.selection(); tr.clearAyah(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft }}>
                  <FontAwesome5 name="redo" size={11} color={d.subtext} />
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.subtext }}>Retry</T>
                </Pressable>
                {tr.idx < items.length - 1 ? (
                  <Pressable onPress={() => { haptic.selection(); tr.setIdx(tr.idx + 1); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: isDark ? '#1F8F5C' : '#1D6F42' }}>
                    <FontAwesome5 name="arrow-right" size={11} color="#fff" />
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#fff' }}>Next ayah</T>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {tr.error ? (
            <View style={{ marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(220,80,80,0.3)', backgroundColor: 'rgba(220,80,80,0.06)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FontAwesome5 name="exclamation-circle" size={12} color="#DC5050" />
              <T v="caption" style={{ flex: 1, fontSize: 10, color: '#DC5050' }}>{tr.error}</T>
            </View>
          ) : null}

          <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 14, lineHeight: 15 }}>
            {tr.supported ? 'Strict mode: words must be said as written — a changed word turns red and stays until you recite it correctly. The mic stops itself when the ayah is done.' : 'Practice mode: recite out loud and tap each word as you say it.'}
          </T>
        </ScrollView>

        {/* footer */}
        <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: d.cardBorder, backgroundColor: d.card, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {tr.supported ? (
            <Pressable
              onPress={() => { if (tr.listening) tr.stop(); else tr.start(); }}
              accessibilityLabel="toggle recitation listening"
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, backgroundColor: tr.listening ? 'rgba(220,80,80,0.1)' : isDark ? '#1F8F5C' : '#1D6F42', borderWidth: 1, borderColor: tr.listening ? 'rgba(220,80,80,0.4)' : 'transparent' }}
            >
              {tr.listening ? <ActivityIndicator size="small" color="#DC5050" /> : <FontAwesome5 name="microphone-alt" size={13} color="#fff" />}
              <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: tr.listening ? '#DC5050' : '#fff' }}>{tr.listening ? 'Listening… tap to stop' : tr.score ? 'Recite again' : 'Start reciting'}</T>
            </Pressable>
          ) : null}
          <Pressable onPress={listenAyah} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(212,175,55,0.08)' }}>
            <FontAwesome5 name="volume-up" size={13} color="#E8C96A" />
            <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: '#E8C96A' }}>Listen</T>
          </Pressable>
          <Pressable onPress={() => { haptic.selection(); tr.clearAyah(); }} accessibilityLabel="reset ayah" style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="undo" size={13} color={d.subtext} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** one ayah word — animates smoothly when its state changes (shared with mushaf) */
export function WordChip({ word, state, listening, isNext, colorBase, faint, masked, onPress }: {
  word: string; state: WordState; listening: boolean; isNext: boolean;
  colorBase: string; faint: string; masked?: boolean; onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(state === 'hidden' ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: state === 'hidden' ? 0 : 1, duration: 320, easing: Easing.out(Easing.poly(3)), useNativeDriver: false }).start();
  }, [state, anim]);

  const isLive = listening && isNext && state === 'hidden';
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 6,
        paddingHorizontal: 3,
        paddingVertical: 1,
        backgroundColor: state === 'wrong' ? 'rgba(220,60,60,0.16)' : isLive ? 'rgba(212,175,55,0.15)' : 'transparent',
        borderWidth: state === 'wrong' ? 1 : 0,
        borderColor: 'rgba(220,60,60,0.45)',
      }}
    >
      <Animated.Text
        style={{
          fontFamily: 'Amiri',
          fontSize: 28,
          lineHeight: 52,
          textAlign: 'center',
          color: masked ? 'transparent' : state === 'wrong' ? '#E05252' : state === 'ok' ? colorBase : isLive ? '#E8C96A' : faint,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          textDecorationLine: state === 'wrong' ? 'underline' : 'none',
        }}
      >
        {masked ? '҉҉҉' : word}
      </Animated.Text>
    </Pressable>
  );
}
