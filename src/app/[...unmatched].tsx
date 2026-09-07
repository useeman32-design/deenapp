import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/** pass 34 — catch-all: a stale cached bundle pointing at a route that no
 * longer exists (or a mistyped deep link) used to show expo-router's ugly
 * "Unmatched Route" screen. Redirect home instead — the app always works. */
export default function Unmatched() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace('/(tabs)'), 350);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#06140D' }}>
      <ActivityIndicator color="#4AE38F" />
    </View>
  );
}
