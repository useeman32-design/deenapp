import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_ACCOUNTS, MOCK_FOLLOWED } from '@/api/mocks';
import { AvatarImage } from '@/components/FeedCard';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Suggested accounts (pass 22) — "View more" from Accounts to Follow opens
 * this full list with follow toggles.
 */
export default function Suggestions() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [followed, setFollowed] = useState<string[]>(MOCK_FOLLOWED);
  const list = useMemo(() => MOCK_ACCOUNTS, []);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>Accounts to Follow</T>
          <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>{list.length} suggestions · scholars & community</T>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {list.map((a) => {
          const isF = followed.includes(a.username);
          return (
            <View key={a.username} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 9 }}>
              <Pressable onPress={() => router.push(`/profile/${a.username}`)}>
                <AvatarImage source={a.photo ?? null} name={a.full_name} size={48} tint={d.bgSoft} border={d.cardBorder} />
              </Pressable>
              <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(`/profile/${a.username}`)}>
                <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 13.5, color: d.text }}>{a.full_name}</T>
                <T v="caption" numberOfLines={1} style={{ fontSize: 11, color: d.faint, marginTop: 1 }}>@{a.username}{a.fields ? ` · ${a.fields}` : ''}</T>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.light();
                  setFollowed((f) => (isF ? f.filter((x) => x !== a.username) : [...f, a.username]));
                }}
                style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1, borderColor: isF ? d.cardBorder : 'transparent', backgroundColor: isF ? 'transparent' : '#1F8F5C' }}
              >
                <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: isF ? d.subtext : '#FFFFFF' }}>{isF ? 'Following' : 'Follow'}</T>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
