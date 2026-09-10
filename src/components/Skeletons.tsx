import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { T } from '@/components/T';

/**
 * pass 83-26 — shared loading kit (owner: "be like instagram… when opening
 * accounts, even posts, or any general loading"). The CONTENT breathes while
 * it loads — never a bare spinner — and a failed load always says what
 * failed with a way back.
 */
export function Breathe({ children, style }: { children: ReactNode; style?: object }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 850, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ opacity: pulse }, style]}>{children}</Animated.View>;
}

/** A FeedCard-shaped skeleton: avatar + name lines, text lines, media block. */
export function PostSkeleton({ card, cardBorder, media = true }: { card: string; cardBorder: string; media?: boolean }) {
  return (
    <Breathe style={{ backgroundColor: card, borderRadius: 18, borderWidth: 1, borderColor: cardBorder, padding: 14, gap: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: cardBorder }} />
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ width: 110, height: 9, borderRadius: 5, backgroundColor: cardBorder }} />
          <View style={{ width: 70, height: 7, borderRadius: 4, backgroundColor: cardBorder }} />
        </View>
      </View>
      <View style={{ width: '92%', height: 9, borderRadius: 5, backgroundColor: cardBorder }} />
      <View style={{ width: '78%', height: 9, borderRadius: 5, backgroundColor: cardBorder }} />
      {media ? <View style={{ width: '100%', height: 120, borderRadius: 12, backgroundColor: cardBorder }} /> : null}
    </Breathe>
  );
}

export function FeedSkeleton({ card, cardBorder, count = 3 }: { card: string; cardBorder: string; count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <PostSkeleton key={i} card={card} cardBorder={cardBorder} media={i === 0} />
      ))}
    </View>
  );
}

/** "Unable to load X" + a way back (the header back stays visible too). */
export function LoadError({ icon = 'question-circle', message, backLabel = 'Go back', onBack, faint, subtext, text, cardBorder, emerald, darkText }: {
  icon?: string;
  message: string;
  backLabel?: string;
  onBack: () => void;
  faint: string;
  subtext: string;
  text: string;
  cardBorder: string;
  emerald: string;
  darkText: string;
}) {
  return (
    <View style={{ alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 24 }}>
      <FontAwesome5 name={icon as never} size={28} color={faint} />
      <T v="bodyS" style={{ color: subtext, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{message}</T>
      <Pressable onPress={onBack} hitSlop={10} style={{ borderRadius: 10, backgroundColor: emerald, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4 }}>
        <T v="bodyS" style={{ color: darkText, fontWeight: '700', fontSize: 12 }}>{backLabel}</T>
      </Pressable>
    </View>
  );
}
