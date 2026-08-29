import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_ACCOUNTS } from '@/api/mocks';
import { AvatarImage } from '@/components/FeedCard';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';

/**
 * Notifications (pass 23) — likes, follows, reposts, mentions and system
 * notices. The community bell opens this; the inbox icon opens the inbox.
 */
type Notif = {
  id: string;
  kind: 'like' | 'follow' | 'repost' | 'mention' | 'system';
  user?: string;
  text: string;
  ago: string;
  read?: boolean;
};

const SEED: Notif[] = [
  { id: 'n1', kind: 'like', user: 'aisha_yusuf', text: 'liked your comment on “Never underestimate a single ayah a day”', ago: '12m' },
  { id: 'n2', kind: 'follow', user: 'alameen', text: 'started following you', ago: '1h' },
  { id: 'n3', kind: 'repost', user: 'usman_ahmad', text: 'reposted your reel “One ummah, one qiblah”', ago: '3h', read: true },
  { id: 'n4', kind: 'mention', user: 'Gimba', text: 'mentioned you: “Jazakallahu khairan @you for the reminder”', ago: '5h', read: true },
  { id: 'n5', kind: 'system', text: 'Ramadan starts in 2 weeks — set your daily worship goal now', ago: '1d', read: true },
  { id: 'n6', kind: 'like', user: 'mayanchie12', text: 'and 23 others liked your post', ago: '1d', read: true },
  { id: 'n7', kind: 'follow', user: 'kunfai_ibrahim', text: 'started following you', ago: '2d', read: true },
];

const KIND_META: Record<Notif['kind'], { icon: string; tint: string; label: string }> = {
  like: { icon: 'heart', tint: '#FF5A5A', label: 'LIKES' },
  follow: { icon: 'user-plus', tint: '#4AE38F', label: 'FOLLOWS' },
  repost: { icon: 'retweet', tint: '#5BC8F5', label: 'REPOSTS' },
  mention: { icon: 'at', tint: '#E8C96A', label: 'MENTIONS' },
  system: { icon: 'bell', tint: '#B0A8F0', label: 'APP' },
};

export default function Notifications() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | Notif['kind']>('all');
  const [read, setRead] = useState<Set<string>>(new Set(SEED.filter((n) => n.read).map((n) => n.id)));

  const list = useMemo(() => (filter === 'all' ? SEED : SEED.filter((n) => n.kind === filter)), [filter]);

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>Notifications</T>
          <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>{SEED.length - read.size} new</T>
        </View>
        <Pressable onPress={() => { haptic.selection(); router.push('/tools/inbox'); }} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="inbox" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
        {(['all', 'like', 'follow', 'repost', 'mention', 'system'] as const).map((f) => {
          const on = filter === f;
          const label = f === 'all' ? 'All' : KIND_META[f].label;
          return (
            <Pressable
              key={f}
              onPress={() => { haptic.selection(); setFilter(f); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.35)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(14,122,70,0.08)') : d.card, paddingHorizontal: 11, paddingVertical: 7 }}
            >
              {f !== 'all' ? <FontAwesome5 name={KIND_META[f].icon as never} size={9} color={KIND_META[f].tint} /> : null}
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext }}>{label}</T>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }} showsVerticalScrollIndicator={false}>
        {list.map((n) => {
          const meta = KIND_META[n.kind];
          const a = n.user ? MOCK_ACCOUNTS.find((x) => x.username === n.user) : undefined;
          const unread = !read.has(n.id);
          return (
            <Pressable
              key={n.id}
              onPress={() => {
                haptic.selection();
                setRead((r) => new Set([...r, n.id]));
                if (n.user) router.push(`/profile/${n.user}`);
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: unread ? (isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.28)') : d.cardBorder, backgroundColor: unread ? (isDark ? 'rgba(46,204,113,0.07)' : 'rgba(29,111,66,0.04)') : d.card, padding: 12, opacity: pressed ? 0.8 : 1 })}
            >
              <View>
                {a ? <AvatarImage source={a.photo ?? null} name={a.full_name} size={42} tint={d.bgSoft} border={d.cardBorder} /> : (
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: `${meta.tint}18`, borderWidth: 1, borderColor: `${meta.tint}55`, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="mosque" size={15} color={meta.tint} />
                  </View>
                )}
                <View style={{ position: 'absolute', right: -3, bottom: -3, width: 19, height: 19, borderRadius: 10, backgroundColor: meta.tint, borderWidth: 2, borderColor: d.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={meta.icon as never} size={8} color="#FFFFFF" />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: d.text }}>
                  <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>{a ? a.full_name : 'DeenLink'} </T>
                  {n.text}
                </T>
                <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 2 }}>{n.ago} ago</T>
              </View>
              {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
