import { useEffect, useMemo, useState } from 'react';
import { goBack } from '@/lib/navigation';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_ACCOUNTS, MOCK_FOLLOWED } from '@/api/mocks';
import { getConnections, isLive, toggleFollow, type ConnectionRow } from '@/api/client';
import { AvatarImage } from '@/components/FeedCard';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Suggested accounts (pass 22, wired live in pass 70) — "View more" from
 * Accounts to Follow opens this full list with REAL follow toggles.
 * Live: get_connections.php?tab=suggestions + toggle_follow.php (server-side
 * graph, mutual-first ordering). Demo: the bundled mock list, local toggles.
 */

type Row = { id: number; username: string; name: string; photo: string | null; sub: string; following: boolean };

export default function Suggestions() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const live = isLive();

  useEffect(() => {
    if (!live) {
      setRows(
        MOCK_ACCOUNTS.map((a) => ({
          id: 0,
          username: a.username,
          name: a.full_name,
          photo: typeof a.photo === 'string' ? a.photo : null,
          sub: a.fields ?? '',
          following: MOCK_FOLLOWED.includes(a.username),
        })),
      );
      return;
    }
    getConnections('suggestions')
      .then((r) => {
        const items: ConnectionRow[] = r?.items ?? [];
        setRows(
          items.map((x) => ({
            id: x.id,
            username: x.username,
            name: x.name || x.username,
            photo: x.profile_image_url ?? null,
            sub: x.user_type && x.user_type !== 'user' ? x.user_type : x.mutual_count ? `${x.mutual_count} mutual` : '',
            following: !!x.following_by_me,
          })),
        );
      })
      .catch(() => setRows([]));
  }, [live]);

  const list = useMemo(() => rows ?? [], [rows]);

  const toggle = async (row: Row) => {
    haptic.light();
    if (!live || row.id <= 0) {
      setRows((prev) => (prev ?? []).map((x) => (x.username === row.username ? { ...x, following: !x.following } : x)));
      return;
    }
    const desired = !row.following;
    setBusy(row.username);
    setRows((prev) => (prev ?? []).map((x) => (x.id === row.id ? { ...x, following: desired } : x)));
    const ok = await toggleFollow(row.id, desired).catch(() => false);
    if (!ok) setRows((prev) => (prev ?? []).map((x) => (x.id === row.id ? { ...x, following: !desired } : x)));
    setBusy(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>Accounts to Follow</T>
          <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>
            {rows ? `${list.length} suggestion${list.length === 1 ? '' : 's'} · scholars & community` : 'Finding people for you…'}
          </T>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {!rows ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            {[...Array(5)].map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 9, opacity: 1 - i * 0.15 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: d.bgSoft }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ height: 11, borderRadius: 5, width: '55%', backgroundColor: d.bgSoft }} />
                  <View style={{ height: 9, borderRadius: 4, width: '35%', backgroundColor: d.bgSoft }} />
                </View>
              </View>
            ))}
            <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} style={{ marginTop: 6 }} />
          </View>
        ) : list.length === 0 ? (
          <T v="caption" style={{ textAlign: 'center', marginTop: 40, fontSize: 11.5, color: d.faint }}>
            No suggestions right now — invite friends or search for people you know.
          </T>
        ) : (
          list.map((a) => {
            const isF = a.following;
            return (
              <View key={`${a.id}-${a.username}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 9 }}>
                <Pressable onPress={() => router.push(`/profile/${a.username}`)}>
                  <AvatarImage source={a.photo} name={a.name} size={48} tint={d.bgSoft} border={d.cardBorder} />
                </Pressable>
                <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(`/profile/${a.username}`)}>
                  <T v="bodyS" numberOfLines={1} style={{ fontWeight: '700', fontSize: 13.5, color: d.text }}>{a.name}</T>
                  <T v="caption" numberOfLines={1} style={{ fontSize: 11, color: d.faint, marginTop: 1 }}>@{a.username}{a.sub ? ` · ${a.sub}` : ''}</T>
                </Pressable>
                <Pressable
                  onPress={() => { void toggle(a); }}
                  disabled={busy === a.username}
                  style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1, borderColor: isF ? d.cardBorder : 'transparent', backgroundColor: isF ? 'transparent' : '#1F8F5C', opacity: busy === a.username ? 0.6 : 1 }}
                >
                  <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: isF ? d.subtext : '#FFFFFF' }}>{isF ? 'Following' : 'Follow'}</T>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
