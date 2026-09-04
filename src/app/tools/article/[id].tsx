import { Image, Pressable, ScrollView, Share, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { ARTICLES } from '@/data/learn';

/** Article reader — full text + native share sheet. */
export default function ArticleReader() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = ARTICLES[Number(id)] ?? ARTICLES[0];
  const idx = Number(id) || 0;

  const share = async () => {
    haptic.selection();
    const url = `https://app.deenlink.org/tools/article/${idx}`;
    try {
      await Share.share({ title: a.title, message: `${a.title}\n\nRead on DeenLink: ${url}`, url });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title={a.tag} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {a.img ? <Image source={a.img} style={{ width: '100%', height: 200 }} resizeMode="cover" /> : null}
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ borderRadius: 8, backgroundColor: isDark ? 'rgba(74,227,143,0.14)' : 'rgba(29,111,66,0.1)', paddingHorizontal: 9, paddingVertical: 3 }}>
              <T v="caption" style={{ fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: isDark ? '#4AE38F' : '#1D6F42' }}>{a.tag.toUpperCase()}</T>
            </View>
            <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>{a.mins} min read</T>
            <View style={{ flex: 1 }} />
            <Pressable onPress={share} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingHorizontal: 11, paddingVertical: 7 }}>
              <FontAwesome5 name="share-alt" size={11} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Share</T>
            </Pressable>
          </View>

          <T v="h2" style={{ fontSize: 21, fontWeight: '900', lineHeight: 28, color: d.text, marginBottom: 14 }}>{a.title}</T>

          {a.body.map((par, k) => (
            <T key={k} v="body" style={{ fontSize: 14.5, lineHeight: 24, color: d.subtext, marginBottom: 13 }}>{par}</T>
          ))}

          <Pressable onPress={share} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, borderWidth: 1.5, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(74,227,143,0.1)' : 'rgba(29,111,66,0.06)', padding: 14, marginTop: 6 }}>
            <FontAwesome5 name="share-alt" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
            <T v="button" style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Share this article</T>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
