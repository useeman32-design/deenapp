import { Image, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { ARTICLES } from '@/data/learn';

/** Learning — Articles: a list of short authentic reads; tap to open the reader. */
export default function Articles() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title="Articles" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {ARTICLES.map((a, i) => (
          <Pressable
            key={i}
            onPress={() => { haptic.selection(); router.push(`/tools/article/${i}` as never); }}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 12, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 16, padding: 12, marginBottom: 12, opacity: pressed ? 0.9 : 1 })}
          >
            {a.img ? (
              <Image source={a.img} style={{ width: 92, height: 92, borderRadius: 12 }} resizeMode="cover" />
            ) : (
              <View style={{ width: 92, height: 92, borderRadius: 12, backgroundColor: 'rgba(48,63,143,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name={a.icon} size={22} color="#3F51B5" />
              </View>
            )}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ borderRadius: 7, backgroundColor: isDark ? 'rgba(74,227,143,0.14)' : 'rgba(29,111,66,0.1)', paddingHorizontal: 7, paddingVertical: 2 }}>
                  <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4, color: isDark ? '#4AE38F' : '#1D6F42' }}>{a.tag.toUpperCase()}</T>
                </View>
                <T v="caption" style={{ fontSize: 9.5, color: d.faint }}>{a.mins} min read</T>
              </View>
              <T v="bodyS" style={{ fontSize: 14, fontWeight: '800', lineHeight: 19, color: d.text }} numberOfLines={2}>{a.title}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Read article</T>
                <FontAwesome5 name="chevron-right" size={9} color={isDark ? '#4AE38F' : '#1D6F42'} />
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
