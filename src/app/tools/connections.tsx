import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_ACCOUNTS, MOCK_FOLLOWED } from '@/api/mocks';
import { AvatarImage } from '@/components/FeedCard';
import { useTheme } from '@/context/ThemeContext';
import { catIcon, loadGroups } from '@/components/Groups';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Connections (pass 22) — Instagram-style: Following / Followers / Suggested.
 * Opened from the profile stats row (?tab=followers|following) and from
 * "View more" on Accounts to Follow (?tab=suggested).
 */

type Tab = 'following' | 'followers' | 'suggested';

/* pass 36 — live group list (storage-backed) → /tools/group?id=… */
function GroupLinks() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof loadGroups>> | null>(null);
  useEffect(() => { loadGroups().then(setGroups); }, []);
  if (!groups) {
    return (
      <View style={{ alignItems: 'center', gap: 8, marginTop: 30 }}>
        <ActivityIndicator size="small" color={isDark ? '#4AE38F' : '#1D6F42'} />
        <T v="caption" style={{ fontSize: 10.5, color: d.faint }}>Loading your groups…</T>
      </View>
    );
  }
  return (
    <View>
      {groups.map((g) => (
        <Pressable
          key={g.id}
          onPress={() => router.push({ pathname: '/tools/group', params: { id: g.id } } as never)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 8 }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(74,227,143,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={catIcon(g.cat) as never} size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{g.name}</T>
            <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{g.cat} · {g.memberCount.toLocaleString()} members{g.joined ? ' · joined' : ''}</T>
          </View>
          <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
        </Pressable>
      ))}
      <T v="caption" style={{ fontSize: 9.5, color: d.faint, textAlign: 'center', marginTop: 8 }}>Open the Community tab to browse & create groups</T>
    </View>
  );
}

export default function Connections() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  type Tab2 = Tab | 'groups';
  const [tab, setTab] = useState<Tab2>((['following', 'followers', 'suggested'] as const).includes(tabParam as Tab) ? (tabParam as Tab) : 'following');
  const [followed, setFollowed] = useState<string[]>(MOCK_FOLLOWED);

  const list = useMemo(() => {
    if (tab === 'groups') return [];
    if (tab === 'following') return MOCK_ACCOUNTS.filter((a) => followed.includes(a.username));
    if (tab === 'followers') return MOCK_ACCOUNTS.filter((a, i) => i % 2 === 1 || followed.includes(a.username));
    return MOCK_ACCOUNTS.filter((a) => !followed.includes(a.username));
  }, [tab, followed]);

  const TABS: Array<{ id: Tab2; label: string; icon: string }> = [
    { id: 'following', label: 'Following', icon: 'user-check' },
    { id: 'followers', label: 'Followers', icon: 'users' },
    { id: 'suggested', label: 'Suggested', icon: 'user-plus' },
    { id: 'groups', label: 'Groups', icon: 'users-cog' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>Connections</T>
      </View>

      {/* tabs */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                haptic.selection();
                setTab(t.id);
              }}
              style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.10)') : 'transparent', borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.35)') : 'transparent', opacity: pressed ? 0.75 : 1 })}
            >
              <FontAwesome5 name={t.icon as never} size={10} color={on ? (isDark ? '#4AE38F' : '#0E7A46') : d.faint} />
              <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: on ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext }}>{t.label}</T>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {tab === 'groups' ? (
          /* pass 36 — your groups open the full group profile screen */
          <View style={{ paddingHorizontal: 16 }}>
            <GroupLinks />
          </View>
        ) : null}
        {tab !== 'groups' && list.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 8, marginTop: 50 }}>
            <FontAwesome5 name={tab === 'following' ? 'user-check' : 'users'} size={22} color={d.faint} />
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5 }}>{tab === 'following' ? 'You are not following anyone yet.' : 'Nothing here yet.'}</T>
          </View>
        ) : null}
        {list.map((a) => {
          const isF = followed.includes(a.username);
          return (
            <View key={a.username} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 11, marginBottom: 9 }}>
              <Pressable onPress={() => router.push(`/profile/${a.username}`)}>
                <AvatarImage source={a.photo ?? null} name={a.full_name} size={46} tint={d.bgSoft} border={d.cardBorder} />
              </Pressable>
              <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(`/profile/${a.username}`)}>
                <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 13, color: d.text }}>{a.full_name}</T>
                <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>@{a.username}{a.fields ? ` · ${a.fields}` : ''}</T>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.light();
                  setFollowed((f) => (isF ? f.filter((x) => x !== a.username) : [...f, a.username]));
                }}
                style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: isF ? d.cardBorder : 'transparent', backgroundColor: isF ? 'transparent' : '#1F8F5C' }}
              >
                <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: isF ? d.subtext : '#FFFFFF' }}>{isF ? 'Following' : 'Follow'}</T>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
