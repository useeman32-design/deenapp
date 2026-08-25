import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export function DhikrCounter({
  label,
  arabic,
  target,
  count,
  onIncrement,
  onReset,
  note,
}: {
  label?: string;
  arabic?: string;
  target: number;
  count: number;
  onIncrement: () => void;
  onReset: () => void;
  note?: string;
}) {
  const { theme } = useTheme();
  const done = target > 0 && count >= target;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 6 }}>
      {arabic ? <Text style={{ fontSize: 27, fontFamily: 'Amiri', color: theme.text, marginBottom: 4 }}>{arabic}</Text> : null}
      {label ? <Text style={{ color: theme.subtext, fontSize: 13, marginBottom: 14 }}>{label}</Text> : null}

      <Pressable
        onPress={onIncrement}
        style={({ pressed }) => [
          {
            width: 228,
            height: 228,
            borderRadius: 114,
            backgroundColor: theme.primarySoft,
            borderWidth: 3,
            borderColor: theme.primary,
            alignItems: 'center',
            justifyContent: 'center',
          },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        <Text style={{ fontSize: 54, fontFamily: 'Sora', fontWeight: '800', color: theme.primary }}>{count}</Text>
        <Text style={{ color: theme.subtext, marginTop: 4, fontSize: 14, fontWeight: '600' }}>
          {target > 0 ? `of ${target}` : 'unlimited'}
        </Text>
        <Text style={{ color: theme.subtext, marginTop: 10, fontSize: 11.5 }}>Tap to count</Text>
      </Pressable>

      {target > 0 && target <= 40 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 228,
            marginTop: 16,
          }}
        >
          {Array.from({ length: target }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                margin: 3,
                backgroundColor: i < count ? theme.primary : theme.border,
              }}
            />
          ))}
        </View>
      ) : null}

      {target > 40 ? (
        <View
          style={{
            width: 228,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.border,
            marginTop: 16,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.min(100, (count / target) * 100)}%`,
              height: 8,
              backgroundColor: theme.primary,
            }}
          />
        </View>
      ) : null}

      {done ? (
        <Text style={{ color: theme.accent, fontWeight: '800', marginTop: 16, fontSize: 15 }}>
          MashaAllah! Target reached 🎉
        </Text>
      ) : null}

      {note ? (
        <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 14, textAlign: 'center', lineHeight: 18, maxWidth: 320 }}>
          {note}
        </Text>
      ) : null}

      <Pressable
        onPress={onReset}
        style={{
          marginTop: 18,
          paddingHorizontal: 20,
          paddingVertical: 9,
          borderRadius: 12,
          backgroundColor: theme.primarySoft,
        }}
      >
        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13.5 }}>Reset</Text>
      </Pressable>
    </View>
  );
}
