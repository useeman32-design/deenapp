import { useEffect, useMemo, useState } from 'react';
import { goBack } from '@/lib/navigation';
import { LayoutAnimation, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_ACCOUNTS } from '@/api/mocks';
import { isLive, notificationsList, notificationsMarkAllRead, type NotifRow } from '@/api/client';
import { AvatarImage } from '@/components/FeedCard';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { useIsGuest } from '@/lib/guest';
import { LoginRequired } from '@/components/LoginRequired';

/**
 * Notifications (pass 23) — likes, follows, reposts, mentions and system
 * notices. The community bell opens this; the inbox icon opens the inbox.
 */
type Notif = {
  id: string;
  kind: 'like' | 'follow' | 'repost' | 'mention' | 'system' | 'chat';
  user?: string;
  text: string;
  ago: string;
  read?: boolean;
  photo?: string | null;
};

/* pass 68 — live rows become the same shape the screen already renders. */
function agoOf(dt: string): string {
  const t = new Date(dt.replace(' ', 'T')).getTime();
  if (!t) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function mapLive(rows: NotifRow[]): Notif[] {
  return rows.map((r) => {
    const type = String(r.type || '').toLowerCase();
    const kind: Notif['kind'] = type === 'chat_message' ? 'chat'
      : type.includes('follow') ? 'follow'
      : type.includes('like') ? 'like'
      : type.includes('mention') ? 'mention'
      : type.includes('deenpoint') || type.includes('points') || type.includes('reward') ? 'system'
      : type.startsWith('admin_') || type.startsWith('system') ? 'system'
      : 'mention';
    return {
      id: `L${r.id}`,
      kind,
      user: r.actor?.username || undefined,
      text: (r.body || r.title || '').trim(),
      ago: agoOf(r.created_at),
      read: !!r.is_read,
      photo: r.actor?.profile_image_url ?? null,
    };
  });
}

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
  chat: { icon: 'comment-dots', tint: '#4AE38F', label: 'MESSAGES' },
  like: { icon: 'heart', tint: '#FF5A5A', label: 'LIKES' },
  follow: { icon: 'user-plus', tint: '#4AE38F', label: 'FOLLOWS' },
  repost: { icon: 'retweet', tint: '#5BC8F5', label: 'REPOSTS' },
  mention: { icon: 'at', tint: '#E8C96A', label: 'MENTIONS' },
  system: { icon: 'bell', tint: '#B0A8F0', label: 'APP' },
};

function NotificationsInner() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | Notif['kind']>('all');
  const [read, setRead] = useState<Set<string>>(new Set(SEED.filter((n) => n.read).map((n) => n.id)));
  /* pass 68 — live mode: real notifications (chat messages first), polled
   * every 30s, all marked read on open so the home bell clears. */
  const live = isLive();
  const [liveList, setLiveList] = useState<Notif[] | null>(null);
  useEffect(() => {
    if (!live) return;
    let on = true;
    const pull = (first: boolean) => notificationsList(40).then((rows) => {
      if (!on || !rows) return;
      setLiveList(mapLive(rows));
      if (first) notificationsMarkAllRead().catch(() => {});
    }).catch(() => {});
    pull(true);
    const iv = setInterval(() => pull(false), 30000);
    return () => { on = false; clearInterval(iv); };
  }, [live]);

  const source = live && liveList ? liveList : SEED;
  const isUnread = (x: Notif) => (x.id.startsWith('L') ? !x.read : !read.has(x.id));
  const list = useMemo(() => (filter === 'all' ? source : source.filter((n) => n.kind === filter)), [filter, source]);
  const unreadOf = (k: 'all' | Notif['kind']) =>
    (k === 'all' ? source : source.filter((n) => n.kind === k)).filter(isUnread).length;
  const pick = (f: 'all' | Notif['kind']) => {
    haptic.selection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter(f);
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>Notifications</T>
          <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>{live && liveList ? liveList.filter(isUnread).length : SEED.length - read.size} new</T>
        </View>
        <Pressable onPress={() => { haptic.selection(); router.push('/tools/inbox'); }} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="inbox" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
        {(['all', 'chat', 'like', 'follow', 'repost', 'mention', 'system'] as const).map((f) => {
          const on = filter === f;
          const label = f === 'all' ? 'All' : KIND_META[f].label;
          const unread = unreadOf(f);
          return (
            <Pressable
              key={f}
              onPress={() => pick(f)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: on ? 7 : 5, borderRadius: 999, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.35)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(14,122,70,0.08)') : d.card, paddingHorizontal: on ? 13 : 11, paddingVertical: 7 }}
            >
              {f !== 'all' ? <FontAwesome5 name={KIND_META[f].icon as never} size={on ? 10 : 9} color={KIND_META[f].tint} /> : null}
              <T v="caption" style={{ fontSize: on ? 11 : 10.5, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#0E7A46') : d.subtext }}>{label}</T>
              {on && unread > 0 ? (
                <View style={{ minWidth: 17, borderRadius: 9, backgroundColor: isDark ? '#4AE38F' : '#0E7A46', paddingHorizontal: 5, paddingVertical: 1.5, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="caption" style={{ fontSize: 8.5, fontWeight: '900', color: '#fff' }}>{unread}</T>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }} showsVerticalScrollIndicator={false}>
        {list.map((n) => {
          const meta = KIND_META[n.kind];
          const a = n.user ? MOCK_ACCOUNTS.find((x) => x.username === n.user) : undefined;
          const unread = isUnread(n);
          return (
            <Pressable
              key={n.id}
              onPress={() => {
                haptic.selection();
                setRead((r) => new Set([...r, n.id]));
                /* pass 68 — a message notification lands in the thread itself */
                if (n.kind === 'chat' && n.user) router.push(`/tools/inbox?u=${n.user}`);
                else if (n.user) router.push(`/profile/${n.user}`);
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: unread ? (isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.28)') : d.cardBorder, backgroundColor: unread ? (isDark ? 'rgba(46,204,113,0.07)' : 'rgba(29,111,66,0.04)') : d.card, padding: 12, opacity: pressed ? 0.8 : 1 })}
            >
              <View>
                {(a || n.photo) ? <AvatarImage source={a?.photo ?? n.photo ?? null} name={a?.full_name ?? n.user ?? 'DeenLink'} size={42} tint={d.bgSoft} border={d.cardBorder} /> : (
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: `${meta.tint}18`, borderWidth: 1, borderColor: `${meta.tint}55`, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="star-and-crescent" size={15} color={meta.tint} />
                  </View>
                )}
                <View style={{ position: 'absolute', right: -3, bottom: -3, width: 19, height: 19, borderRadius: 10, backgroundColor: meta.tint, borderWidth: 2, borderColor: d.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={meta.icon as never} size={8} color="#FFFFFF" />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 18, color: d.text }}>
                  <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>{a ? a.full_name : n.user ? `@${n.user}` : 'DeenLink'} </T>
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

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
export default function Notifications() {
  const guest = useIsGuest();
  if (guest) return <LoginRequired module="Notifications" />;
  return <NotificationsInner />;
}
