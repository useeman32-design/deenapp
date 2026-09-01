import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { haptic } from '@/lib/haptics';
import { JOKES } from '@/data/learn';
import { addUserPost } from '@/lib/userPosts';

/** Learning — clean Islamic jokes (pass 29): one at a time, next / share. */
export default function Jokes() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const j = JOKES[i % JOKES.length];
  const [shown, setShown] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title="Islamic Jokes" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 30, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 18, padding: 18 }}>
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(245,124,0,0.12)', borderWidth: 1, borderColor: 'rgba(245,124,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="laugh-beam" size={20} color="#F57C00" />
            </View>
          </View>
          <T v="h3" style={{ fontSize: 16, fontWeight: '800', lineHeight: 24, textAlign: 'center' }}>{j.setup}</T>
          {shown ? (
            <T v="bodyS" style={{ fontSize: 13, lineHeight: 20, textAlign: 'center', color: isDark ? '#4AE38F' : '#1D6F42', fontWeight: '700', marginTop: 12 }}>{j.punch}</T>
          ) : (
            <Pressable onPress={() => { haptic.light(); setShown(true); }} style={{ alignSelf: 'center', marginTop: 14, borderRadius: 12, backgroundColor: '#F57C00', paddingHorizontal: 18, paddingVertical: 10 }}>
              <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>SHOW PUNCHLINE</T>
            </Pressable>
          )}
          <View style={{ flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 18 }}>
            <Pressable onPress={() => { haptic.selection(); setShown(false); setI((x) => x + 1); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 14, paddingVertical: 9 }}>
              <FontAwesome5 name="arrow-right" size={10} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>NEXT JOKE</T>
            </Pressable>
            <Pressable onPress={() => { haptic.success(); addUserPost(`${j.setup}\n\n${j.punch} 😄`, 'joke').then(() => setToast('Posted to your feed ✓')); setTimeout(() => setToast(null), 2200); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)', paddingHorizontal: 14, paddingVertical: 9 }}>
              <FontAwesome5 name="share-alt" size={10} color="#B8870B" />
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: '#B8870B' }}>SHARE</T>
            </Pressable>
          </View>
          <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 16, lineHeight: 14 }}>
            The Prophet ﷺ smiled and joked truthfully — humor here is clean, honest and never at anyone’s expense.
          </T>
        </View>
        {toast ? <T v="caption" style={{ fontSize: 10.5, color: '#4AE38F', textAlign: 'center', marginTop: 10 }}>{toast}</T> : null}
      </ScrollView>
    </View>
  );
}
