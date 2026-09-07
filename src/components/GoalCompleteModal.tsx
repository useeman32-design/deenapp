import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { DPIcon } from '@/components/DeenPoints';
import { haptic } from '@/lib/haptics';

/**
 * pass 44 — "Barakallah" celebration when a Today's Goal is completed.
 *  · a gold circle pops/forms, then a checkmark springs into it
 *  · "Explore today's goals" jumps to the goals list
 *  · when the WHOLE day is complete, a +10 DeenPoints chip (real coin logo)
 *    is revealed AFTER the checkmark lands.
 */
export function GoalCompleteModal({
  visible,
  allComplete,
  completed,
  onClose,
  onExplore,
}: {
  visible: boolean;
  allComplete: boolean;
  completed: string[];
  onClose: () => void;
  onExplore: () => void;
}) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const reward = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      pop.setValue(0); ring.setValue(0); check.setValue(0); reward.setValue(0);
      return;
    }
    haptic.success();
    Animated.spring(pop, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }).start();
    Animated.spring(ring, { toValue: 1, friction: 5, tension: 55, useNativeDriver: true, delay: 90 }).start();
    Animated.spring(check, { toValue: 1, friction: 4, tension: 110, useNativeDriver: true, delay: 480 }).start();
    if (allComplete) {
      Animated.spring(reward, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true, delay: 950 }).start();
      setTimeout(() => haptic.success(), 980);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, allComplete]);

  const gold = isDark ? d.goldBright : d.gold;
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const checkScale = check.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1], extrapolate: 'clamp' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(2,8,5,0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Animated.View
          style={{
            width: '100%', maxWidth: 340, borderRadius: 26, borderWidth: 1,
            borderColor: isDark ? 'rgba(212,175,55,0.35)' : 'rgba(184,134,11,0.3)',
            backgroundColor: d.card, padding: 26, alignItems: 'center',
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
          }}
        >
          <Pressable onPress={(e) => e.stopPropagation()} onStartShouldSetResponder={() => true} style={{ width: '100%', alignItems: 'center' }}>
            {/* circle forms → checkmark springs in */}
            <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View
                style={{
                  position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 4,
                  borderColor: gold, backgroundColor: 'rgba(212,175,55,0.1)',
                  opacity: ring, transform: [{ scale: ringScale }],
                }}
              />
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <FontAwesome5 name="check" size={40} color={gold} solid />
              </Animated.View>
            </View>

            <T v="h3" style={{ fontSize: 19, fontWeight: '900', color: d.text, textAlign: 'center', marginTop: 18 }}>Barakallah! 🌙</T>
            {completed.length > 0 ? (
              <View style={{ alignItems: 'center', marginTop: 7 }}>
                <T v="caption" style={{ fontSize: 12, color: d.subtext }}>{allComplete ? 'Final goal done —' : 'You completed:'}</T>
                {completed.map((c, i) => (
                  <T key={i} v="bodyS" style={{ fontSize: 15, fontWeight: '800', color: gold, marginTop: 2, textAlign: 'center' }}>{c}</T>
                ))}
              </View>
            ) : (
              <T v="caption" style={{ fontSize: 12.5, color: d.subtext, textAlign: 'center', marginTop: 5 }}>You've completed a goal for today.</T>
            )}
            {allComplete ? <T v="caption" style={{ fontSize: 12, color: d.subtext, textAlign: 'center', marginTop: 6 }}>Day complete — Mashā'Allah! 🌙</T> : null}

            {allComplete ? (
              <Animated.View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18,
                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
                  backgroundColor: 'rgba(212,175,55,0.14)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)',
                  opacity: reward,
                  transform: [
                    { scale: reward.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1], extrapolate: 'clamp' }) },
                    { translateY: reward.interpolate({ inputRange: [0, 1], outputRange: [10, 0], extrapolate: 'clamp' }) },
                  ],
                }}
              >
                <DPIcon size={24} />
                <T v="h3" style={{ fontSize: 17, fontWeight: '900', color: gold }}>+10 DeenPoints</T>
              </Animated.View>
            ) : null}

            <Pressable
              onPress={onExplore}
              style={({ pressed }) => ({ marginTop: 20, width: '100%', alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#1F8F5C', opacity: pressed ? 0.85 : 1 })}
            >
              <T v="button" style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Explore today's goals</T>
            </Pressable>
            <Pressable onPress={onClose} style={{ marginTop: 8, padding: 8 }}>
              <T v="caption" style={{ color: d.subtext, fontSize: 12 }}>Close</T>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
