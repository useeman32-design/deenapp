import { useEffect, useMemo, useRef, useState } from 'react';
import { goBack } from '@/lib/navigation';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE, isLive, notificationsList, notificationsMarkAllRead, type NotifRow } from '@/api/client';
import { AvatarImage } from '@/components/FeedCard';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { useIsGuest } from '@/lib/guest';
import { LoginRequired } from '@/components/LoginRequired';

const DEENLINK_LOGO = require('@/assets/img/logo-badge.png');

/**
 * Notifications — likes, follows, reposts, mentions and DeenLink notices.
 * pass 83-26 — de-dummied: one single flow, no tabs. Live rows come from the
 * server; rows from DeenLink itself (admin announcements, rewards, bans…)
 * render with the logo and tap nowhere (there is no profile to open), while
 * rows about a thing (post/comment) open that thing.
 */
type Notif = {
  id: string;
  kind: 'like' | 'follow' | 'repost' | 'mention' | 'system' | 'chat';
  user?: string;
  name?: string;
  text: string;
  ago: string;
  read?: boolean;
  photo?: string | null;
  /* pass 83-26 — where the tap goes: actor 0 / deenlink / missing actor sinks */
  actorId?: number;
  entityType?: string | null;
  entityId?: number | null;
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
/* pass 83-26 — the API sends path-relative photo urls (/deenLink/…); the app
 * needs absolute ones. The system logo stays bundled (offline-safe). */
function absPhoto(u: string | null | undefined): string | null {
  if (!u) return null;
  if (u.startsWith('http')) return u;
  if (u.startsWith('/')) return `${BASE}${u}`;
  return `${BASE}/${u}`;
}
function mapLive(rows: NotifRow[]): Notif[] {
  return rows.map((r) => {
    const type = String(r.type || '').toLowerCase();
    const actorId = r.actor?.id ?? 0;
    const sysActor = actorId <= 0;
    const kind: Notif['kind'] = type === 'chat_message' ? 'chat'
      : type.includes('follow') ? 'follow'
      : type.includes('like') ? 'like'
      : type.includes('repost') || type.includes('share') ? 'repost'
      : type.includes('mention') || type.includes('comment') ? 'mention'
      : 'system';
    const username = sysActor ? undefined : (r.actor?.username || undefined);
    return {
      id: `L${r.id}`,
      kind: sysActor ? 'system' : kind,
      user: username,
      /* pass 83-26 — the server field is actor.name (was: full_name, always blank) */
      name: sysActor ? 'DeenLink' : (r.actor?.name || undefined),
      text: (r.body || r.title || '').trim(),
      ago: agoOf(r.created_at),
      read: !!r.is_read,
      photo: sysActor ? null : absPhoto(r.actor?.profile_image_url),
      actorId,
      entityType: r.entity_type ?? null,
      entityId: r.entity_id ?? null,
    };
  });
}

/* pass 83-38 — demo notifications removed: the list is server-only */

const KIND_META: Record<Notif['kind'], { icon: string; tint: string }> = {
  chat: { icon: 'comment-dots', tint: '#4AE38F' },
  like: { icon: 'heart', tint: '#FF5A5A' },
  follow: { icon: 'user-plus', tint: '#4AE38F' },
  repost: { icon: 'retweet', tint: '#5BC8F5' },
  mention: { icon: 'at', tint: '#E8C96A' },
  system: { icon: 'star-and-crescent', tint: '#B0A8F0' },
};

/* pass 83-26 — breathing rows while the live list loads (never dummy rows). */
function LoadingRows({ card, cardBorder }: { card: string; cardBorder: string }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 850, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Animated.View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, backgroundColor: card, borderWidth: 1, borderColor: cardBorder, padding: 12, opacity: pulse }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: cardBorder }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ width: '85%', height: 10, borderRadius: 5, backgroundColor: cardBorder }} />
            <View style={{ width: '55%', height: 8, borderRadius: 4, backgroundColor: cardBorder }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function NotificationsInner() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [read, setRead] = useState<Set<string>>(new Set());
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

  /* pass 83-26 — live shows the server list (or the loader, or the empty
   * state); the dummy seed only exists for the offline build. */
  const loading = live && liveList == null;
  const source = live ? (liveList ?? []) : []; /* pass 83-38 — real notifications only */
  const isUnread = (x: Notif) => (x.id.startsWith('L') ? !x.read : !read.has(x.id));
  const newCount = useMemo(() => source.filter(isUnread).length, [source]);
  const tap = (n: Notif) => {
    haptic.selection();
    setRead((r) => new Set([...r, n.id]));
    if (n.id.startsWith('L')) setLiveList((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev);
    /* pass 83-26 — a notification opens the thing it is about. Rows from
     * DeenLink itself (actor 0 / no user) tap nowhere — the tap just clears
     * the dot, because there is no profile behind the app talking. */
    if (n.kind === 'chat' && n.user) { router.push(`/tools/inbox?u=${n.user}`); return; }
    if (n.entityType === 'post' && n.entityId) { router.push(`/tools/post?id=${n.entityId}`); return; }
    if (n.actorId != null && n.actorId <= 0) return;
    if (n.user) router.push(`/profile/${n.user}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="chevron-left" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="h2" style={{ fontWeight: '800', fontSize: 17, color: d.text }}>Notifications</T>
          <T v="caption" style={{ fontSize: 10.5, color: d.faint, marginTop: 1 }}>
            {loading ? 'Loading…' : newCount > 0 ? `${newCount} new` : 'You’re all caught up'}
          </T>
        </View>
        <Pressable onPress={() => { haptic.selection(); router.push('/tools/inbox'); }} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="comment-dots" size={13} color={isDark ? '#4AE38F' : '#1D6F42'} />
        </Pressable>
      </View>

      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <LoadingRows card={d.card} cardBorder={d.cardBorder} />
        </ScrollView>
      ) : !source.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
          <FontAwesome5 name="bell-slash" size={30} color={d.faint} />
          <T v="bodyS" style={{ color: d.subtext, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
            Nothing here yet — likes, follows and mentions will land here.
          </T>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }} showsVerticalScrollIndicator={false}>
          {source.map((n) => {
            const meta = KIND_META[n.kind];

            const unread = isUnread(n);
            const sys = n.kind === 'system';
            return (
              <Pressable
                key={n.id}
                onPress={() => tap(n)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: unread ? (isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.28)') : d.cardBorder, backgroundColor: unread ? (isDark ? 'rgba(46,204,113,0.07)' : 'rgba(29,111,66,0.04)') : d.card, padding: 12, opacity: pressed ? 0.8 : 1 })}
              >
                <View>
                  {sys ? (
                    <AvatarImage source={DEENLINK_LOGO} name="DeenLink" size={42} tint={d.bgSoft} border={d.cardBorder} />
                  ) : n.photo ? (
                    <AvatarImage source={n.photo} name={n.user ?? 'DeenLink'} size={42} tint={d.bgSoft} border={d.cardBorder} />
                  ) : (
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
                    {/* pass 83-14 — owner wants BOTH: the name AND @username, then the message */}
                    <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '800', color: d.text }}>{n.name || (n.user ? `@${n.user}` : 'DeenLink')} </T>
                    {n.user ? <T v="bodyS" style={{ fontSize: 11, fontWeight: '600', color: d.faint }}>@{n.user} </T> : null}
                    {n.text}
                  </T>
                  <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 2 }}>{n.ago} ago</T>
                </View>
                {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDark ? '#4AE38F' : '#1D6F42' }} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
export default function Notifications() {
  const guest = useIsGuest();
  if (guest) return <LoginRequired module="Notifications" />;
  return <NotificationsInner />;
}
