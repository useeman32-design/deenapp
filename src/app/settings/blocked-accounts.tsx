import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { AvatarImage } from '@/components/FeedCard';
import { haptic } from '@/lib/haptics';
import { blockUser, isLive, myBlocks, type BlockedAccount } from '@/api/client';

/* pass 76 (Tier 3) — the accounts you blocked, with one-tap unblock.
 * Blocking is server-enforced: while blocked they cannot message, follow or
 * find you. Unblocking reopens any old DM as a message request. */
export default function BlockedAccountsScreen() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const green = isDark ? '#4AE38F' : '#0E7A46';

  const [rows, setRows] = useState<BlockedAccount[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!isLive()) { setRows([]); return; }
    myBlocks().then((r) => setRows(r ?? [])).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const unblock = async (b: BlockedAccount) => {
    if (busy) { return; }
    haptic.light();
    setBusy(b.user_id);
    const ok = await blockUser(b.username, false).catch(() => false);
    setBusy(null);
    if (ok) {
      haptic.success();
      setRows((prev) => (prev ?? []).filter((x) => x.user_id !== b.user_id));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <TopBar showBack title="Blocked accounts" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <T v="bodyS" style={{ fontSize: 12, color: d.subtext, lineHeight: 18, marginBottom: 14 }}>
          Blocked accounts cannot message, follow or find you. Unblocking reopens your old conversation as a message request.
        </T>
        {!rows ? (
          <View style={{ alignItems: 'center', paddingVertical: 50 }}><ActivityIndicator color={green} /></View>
        ) : !rows.length ? (
          <View style={{ alignItems: 'center', paddingVertical: 50, gap: 10 }}>
            <FontAwesome5 name="user-shield" size={24} color={d.faint} />
            <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5 }}>
              {isLive() ? 'You have not blocked anyone.' : 'Available on the live app.'}
            </T>
          </View>
        ) : rows.map((b) => (
          <View key={b.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13, marginBottom: 10 }}>
            <AvatarImage source={b.profile_image_url ?? null} name={b.full_name} size={40} tint={d.bgSoft} border={d.cardBorder} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="bodyS" numberOfLines={1} style={{ fontWeight: '800', fontSize: 13.5, color: d.text }}>{b.full_name}</T>
              <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>@{b.username}</T>
            </View>
            <Pressable disabled={busy === b.user_id} onPress={() => void unblock(b)}
              style={{ borderRadius: 11, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 14, paddingVertical: 9, opacity: busy === b.user_id ? 0.6 : 1 }}>
              {busy === b.user_id
                ? <ActivityIndicator size="small" color={d.faint} />
                : <T v="caption" style={{ fontWeight: '800', fontSize: 11.5, color: green }}>Unblock</T>}
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
