import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { dictateArabic, speechSupported } from '@/lib/speech';
import { stopBubble } from '@/lib/press';

/**
 * Recite-to-search modal (pass 26): a glassy centre card —
 *  · pulsing gold mic + live Arabic transcript, big & bold, appearing word by word
 *  · on finish → "Analyzing your recitation…" animation
 *  · then hands the transcript to the parent search (results show behind).
 */
export function ReciteSearchModal({
  visible,
  onClose,
  onText,
  label = 'RECITE THE VERSE',
}: {
  visible: boolean;
  onClose: () => void;
  onText: (t: string) => void;
  label?: string;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [phase, setPhase] = useState<'idle' | 'listening' | 'analyzing'>('idle');
  const [live, setLive] = useState('');
  const [typed, setTyped] = useState('');
  const canListen = speechSupported(); /* native/no-SpeechAPI → type-it fallback */
  const pulse = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  useEffect(() => {
    if (visible) { setPhase('idle'); setLive(''); started.current = false; }
  }, [visible]);

  /* pulse rings only WHILE listening (after the tap) */
  useEffect(() => {
    if (!visible || phase !== 'listening') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.poly(3)), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, phase, pulse]);

  useEffect(() => {
    if (!visible || phase !== 'analyzing') return;
    const loop = Animated.loop(Animated.timing(dot, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [visible, phase, dot]);

  const begin = () => {
    if (started.current) return;
    started.current = true;
    setPhase('listening');
    haptic.light();
    dictateArabic(
      (interim) => setLive(interim.trim()),
      14000,
    )
      .then(async (text) => {
        const t = text.trim();
        if (!t) { started.current = false; return; }
        setLive(t);
        setPhase('analyzing');
        await new Promise((r) => setTimeout(r, 1100)); // analyzing animation
        onText(t);
        onClose();
      })
      .catch(() => { started.current = false; });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,10,6,0.62)', alignItems: 'center', justifyContent: 'center', padding: 22 }} onPress={onClose}>
        <Pressable onPress={(e) => stopBubble(e)} style={{ width: '100%', borderRadius: 24, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.22)', backgroundColor: isDark ? 'rgba(14,28,20,0.92)' : 'rgba(255,255,255,0.9)', padding: 22, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}>
            <FontAwesome5 name="microphone-alt" size={12} color="#E8C96A" />
            <T v="caption" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: '#B8870B' }}>{label}</T>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} hitSlop={8} style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,36,28,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="times" size={11} color={d.subtext} />
            </Pressable>
          </View>

          {phase !== 'analyzing' ? (
            <>
              {/* mic: static gold until tapped — then GREEN + pulsing */}
              {canListen ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 16 }}>
                  {phase === 'listening' ? (
                    <>
                      <Animated.View style={{ position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: 1.5, borderColor: 'rgba(31,143,92,0.6)', transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.65] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }) }} />
                      <Animated.View style={{ position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: 'rgba(31,143,92,0.4)', transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }) }} />
                    </>
                  ) : null}
                  <Pressable onPress={begin} accessibilityLabel="start reciting" style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: phase === 'listening' ? 'rgba(31,143,92,0.16)' : 'rgba(212,175,55,0.13)', borderWidth: 2, borderColor: phase === 'listening' ? 'rgba(31,143,92,0.75)' : 'rgba(212,175,55,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="microphone-alt" size={30} color={phase === 'listening' ? '#1F8F5C' : '#E8C96A'} />
                  </Pressable>
                </View>
              ) : null}
              <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginBottom: 12 }}>{phase === 'listening' ? 'Listening… recite the verse, then pause' : canListen ? 'Tap the mic, then recite — I’m listening' : 'Mic listening isn’t available here — type the verse instead'}</T>
              {!canListen ? (
                /* type-it fallback (Expo Go / browsers without Web Speech) */
                <View style={{ width: '100%', borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.25)' : 'rgba(29,111,66,0.18)', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(29,111,66,0.04)', padding: 12, gap: 10 }}>
                  <TextInput
                    value={typed}
                    onChangeText={setTyped}
                    placeholder="e.g. bismillahir rahmanir raheem"
                    placeholderTextColor={d.faint}
                    multiline
                    accessibilityLabel="type the verse"
                    style={{ fontFamily: 'Amiri-Bold', fontSize: 20, lineHeight: 36, color: d.text, textAlign: 'right', minHeight: 72 }}
                  />
                  <Pressable
                    accessibilityLabel="search typed verse"
                    onPress={() => {
                      const t = typed.trim();
                      if (!t) return;
                      haptic.light();
                      setPhase('analyzing');
                      setTimeout(() => { onText(t); onClose(); }, 700);
                    }}
                    style={{ borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: '#1F8F5C' }}
                  >
                    <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 }}>FIND THE VERSE</T>
                  </Pressable>
                </View>
              ) : (
                /* live transcript — big & bold */
                <View style={{ width: '100%', minHeight: 96, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.25)' : 'rgba(29,111,66,0.18)', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(29,111,66,0.04)', padding: 14, justifyContent: 'center' }}>
                  {live ? (
                    <Text style={{ fontFamily: 'Amiri-Bold', fontSize: 24, lineHeight: 44, color: d.text, textAlign: 'right', writingDirection: 'rtl' }}>{live}</Text>
                  ) : (
                    <T v="caption" style={{ textAlign: 'center', color: d.faint, fontSize: 11 }}>{phase === 'listening' ? '…' : 'your recitation appears here'}</T>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 34, gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {[0, 1, 2].map((i) => (
                  <Animated.View key={i} style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#E8C96A', opacity: dot.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.25, 1, 0.45, 0.25] }), transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -7, 0] }) }] }} />
                ))}
              </View>
              <T v="bodyS" style={{ fontSize: 13.5, fontWeight: '800', color: d.text }}>Analyzing your recitation…</T>
              <T v="caption" style={{ fontSize: 10, color: d.faint }}>matching against the app library</T>
              <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
