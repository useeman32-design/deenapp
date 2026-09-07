import { Text, View } from 'react-native';

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials = (parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[1][0] : '');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.34 }}>
        {initials.toUpperCase()}
      </Text>
    </View>
  );
}
