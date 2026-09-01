import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { FeedCard } from '@/components/FeedCard';
import { CommentsModal } from '@/components/CommentsModal';
import { MOCK_COMMENTS } from '@/api/mocks';
import { haptic } from '@/lib/haptics';
import { Image as ExpoImage } from 'expo-image';
import {
  ME,
  catIcon,
  isGroupImg,
  pickGroupPhoto,
  loadGroups,
  saveGroups,
  roleOf,
  ROLE_META,
  COVER_STYLES,
  CATS,
  AVATARS,
  type Group,
  type Role,
} from '@/components/Groups';
import type { Post } from '@/api/types';

/**
 * Group profile (pass 38 — owner-managed):
 *  · cover style (default fallback) + emoji profile picture + BIO under the name
 *  · OWNER: edit settings (name, bio, desc, category, open-join, cover, avatar),
 *    add/remove members, assign roles (admin), remove members
 *  · members: rank badges, follow/following like connections, view profile
 *  · posts are GROUP-FIRST FeedCards (group leads, member follows, rank badge)
 */

type Tab = 'posts' | 'members' | 'about';

/* suggested people the owner can add (from the wider DeenLink community) */
const ADDABLE = [
  { name: 'Umar D.', user: 'umar.d' },
  { name: 'Fatima Z.', user: 'fatima.z' },
  { name: 'Bilal A.', user: 'bilal.a' },
  { name: 'Zainab M.', user: 'zainab.m' },
  { name: 'Sadiq H.', user: 'sadiq.h' },
  { name: 'Hafsa O.', user: 'hafsa.o' },
];

export default function GroupScreen() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : String(params.id ?? 'g1');

  const [group, setGroup] = useState<Group | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [composer, setComposer] = useState('');
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  /* pass 38 management surfaces */
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [roleMenu, setRoleMenu] = useState<string | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);

  useEffect(() => {
    loadGroups().then((all) => setGroup(all.find((g) => g.id === id) ?? all[0] ?? null));
  }, [id]);

  const upd = (f: (g: Group) => Group) => {
    setGroup((g) => (g ? f(g) : g));
    loadGroups().then((all) => {
      const next = all.map((g) => (g.id === id ? f(g) : g));
      saveGroups(next);
    });
  };

  const myRole = group ? roleOf(group, ME) : 'member';
  const canManage = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  const join = () => {
    if (!group) return;
    haptic.success();
    upd((x) => ({ ...x, joined: x.open ? 'member' : 'requested', members: x.open ? [...x.members, ME] : x.members, memberCount: x.open ? x.memberCount + 1 : x.memberCount, mine: true }));
  };
  const leave = () => {
    if (!group) return;
    haptic.selection();
    upd((x) => ({ ...x, joined: null, members: x.members.filter((m) => m !== ME), memberCount: Math.max(0, x.memberCount - 1) }));
  };
  const post = () => {
    if (!composer.trim() || !group) return;
    haptic.light();
    upd((x) => ({ ...x, posts: [{ id: `p${Date.now()}`, author: ME, text: composer.trim(), at: Date.now() }, ...x.posts] }));
    setComposer('');
  };

  /* ── pass 38 management actions ── */
  const setRole = (member: string, role: Role) => {
    haptic.success();
    setRoleMenu(null);
    upd((x) => ({ ...x, roles: { ...(x.roles ?? {}), [member]: role } }));
  };
  const removeMember = (member: string) => {
    haptic.medium();
    setRoleMenu(null);
    upd((x) => {
      const roles = { ...(x.roles ?? {}) };
      delete roles[member];
      return { ...x, members: x.members.filter((m) => m !== member), roles, memberCount: Math.max(0, x.memberCount - 1) };
    });
  };
  const addMember = (name: string) => {
    haptic.success();
    upd((x) => (x.members.includes(name) ? x : { ...x, members: [...x.members, name], roles: { ...(x.roles ?? {}), [name]: 'member' }, memberCount: x.memberCount + 1 }));
  };
  const toggleFollow = (member: string) => {
    haptic.light();
    upd((x) => {
      const f = x.following ?? [];
      return { ...x, following: f.includes(member) ? f.filter((m) => m !== member) : [...f, member] };
    });
  };
  const changeCover = (cid: string) => {
    haptic.selection();
    setCoverOpen(false);
    upd((x) => ({ ...x, cover: cid }));
  };

  const feedPosts = useMemo(() => (group ? group.posts : []), [group]);

  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
        <T v="caption" style={{ fontSize: 11, color: d.faint }}>Opening group…</T>
      </View>
    );
  }

  const coverStyle = COVER_STYLES.find((c) => c.id === group.cover) ?? COVER_STYLES[0];
  const isMember = group.joined === 'member';
  const userOf = (name: string) =>
    name === ME ? { name: 'You', user: 'you' } : { name, user: name.toLowerCase().replace(/[^a-z]+/g, '.') };

  const Badge = ({ role, big }: { role: Role; big?: boolean }) => {
    const m = ROLE_META[role];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3.5, borderWidth: 1, borderColor: role === 'owner' ? 'rgba(212,175,55,0.5)' : role === 'admin' ? 'rgba(47,164,107,0.5)' : d.cardBorder, borderRadius: 7, paddingHorizontal: big ? 8 : 6, paddingVertical: big ? 3 : 2, backgroundColor: role === 'owner' ? 'rgba(212,175,55,0.1)' : role === 'admin' ? 'rgba(47,164,107,0.1)' : 'transparent' }}>
        <FontAwesome5 name={m.icon as never} size={big ? 9 : 7.5} color={m.color} solid={role !== 'member'} />
        <T v="caption" style={{ fontSize: big ? 9 : 8, fontWeight: '900', letterSpacing: 0.5, color: m.color }}>{m.label}</T>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ── cover (photo or styled, default fallback) — owner can change it ── */}
        <View>
          {isGroupImg(group.cover) ? (
            <ExpoImage source={{ uri: group.cover }} style={{ width: '100%', height: 150 }} contentFit="cover" />
          ) : (
            <LinearGradient colors={coverStyle.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: 150 }} />
          )}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: 0.14 }}>
            <FontAwesome5 name="mosque" size={64} color="#E8C96A" />
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ position: 'absolute', top: Math.max(insets.top, 10) + 2, left: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="chevron-left" size={13} color="#F2F7F3" />
          </Pressable>
          {canManage ? (
            <Pressable
              accessibilityLabel="change cover"
              onPress={() => { haptic.selection(); setCoverOpen(true); }}
              style={{ position: 'absolute', top: Math.max(insets.top, 10) + 2, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.38)', paddingHorizontal: 11, paddingVertical: 8 }}
            >
              <FontAwesome5 name="image" size={10} color="#E8C96A" />
              <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: '#E8C96A' }}>Change cover</T>
            </Pressable>
          ) : null}
        </View>

        {/* ── identity block ── */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: d.card, borderWidth: 2.5, borderColor: '#E8C96A', alignItems: 'center', justifyContent: 'center', marginTop: -38, overflow: 'hidden' }}>
            {isGroupImg(group.avatar) ? (
              <ExpoImage source={{ uri: group.avatar }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : group.avatar ? (
              <T v="h1" style={{ fontSize: 32 }}>{group.avatar}</T>
            ) : (
              <FontAwesome5 name={catIcon(group.cat)} size={24} color="#E8C96A" />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <T v="h2" style={{ fontWeight: '900', fontSize: 20, color: d.text, flexShrink: 1 }}>{group.name}</T>
            <Badge role={myRole} big />
          </View>
          {/* pass 38 — bio directly under the group name */}
          {group.bio ? (
            <T v="bodyS" style={{ fontSize: 12, color: d.subtext, marginTop: 4, lineHeight: 17 }}>{group.bio}</T>
          ) : null}
          <T v="caption" style={{ fontSize: 11, color: d.subtext, marginTop: 4 }}>
            {group.cat} group · {group.open ? 'Anyone can join' : 'Join by request'}
          </T>

          <View style={{ flexDirection: 'row', gap: 7, marginTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, backgroundColor: isDark ? 'rgba(74,227,143,0.1)' : 'rgba(29,111,66,0.07)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.3)' : 'rgba(29,111,66,0.2)', paddingHorizontal: 9, paddingVertical: 5 }}>
              <FontAwesome5 name="users" size={9} color={isDark ? '#4AE38F' : '#1D6F42'} />
              <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{group.memberCount.toLocaleString()} members</T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', paddingHorizontal: 9, paddingVertical: 5 }}>
              <FontAwesome5 name="file-alt" size={9} color="#E8C96A" />
              <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#E8C96A' }}>{group.posts.length} posts</T>
            </View>
          </View>

          {/* owner/admin: manage · member: join/leave */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}>
            {canManage ? (
              <Pressable
                accessibilityLabel="edit group settings"
                onPress={() => { haptic.selection(); setEditOpen(true); }}
                style={{ flex: 1, borderRadius: 14, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', alignItems: 'center', paddingVertical: 13, flexDirection: 'row', gap: 8, justifyContent: 'center' }}
              >
                <FontAwesome5 name="cog" size={12} color="#fff" />
                <T v="button" style={{ fontWeight: '800', fontSize: 13, color: '#fff' }}>Manage group</T>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel={group.joined ? 'leave group' : 'join group'}
              onPress={group.joined ? leave : join}
              style={{ flex: canManage ? 0.6 : 1, borderRadius: 14, backgroundColor: group.joined ? 'transparent' : (canManage ? 'rgba(212,175,55,0.12)' : isDark ? '#2ECC71' : '#1D6F42'), borderWidth: group.joined || canManage ? 1 : 0, borderColor: group.joined ? d.cardBorder : 'rgba(212,175,55,0.5)', alignItems: 'center', paddingVertical: 13 }}
            >
              <T v="button" style={{ fontWeight: '800', fontSize: 13, color: group.joined ? d.subtext : canManage ? '#E8C96A' : '#fff' }}>
                {group.joined === 'member' ? 'Leave' : group.joined === 'requested' ? 'Cancel request' : group.open ? 'Join group' : 'Request to join'}
              </T>
            </Pressable>
          </View>
        </View>

        {/* ── tabs ── */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16 }}>
          {([
            { id: 'posts' as Tab, label: 'Posts', icon: 'th-large', n: group.posts.length },
            { id: 'members' as Tab, label: 'Members', icon: 'users', n: group.members.length },
            { id: 'about' as Tab, label: 'About', icon: 'info-circle', n: 0 },
          ]).map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => { haptic.selection(); setTab(t.id); }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.14)' : 'rgba(29,111,66,0.07)') : d.card }}
              >
                <FontAwesome5 name={t.icon as never} size={11} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>
                  {t.label}{t.n ? ` · ${t.n}` : ''}
                </T>
              </Pressable>
            );
          })}
        </View>

        {/* ── POSTS — group-first cards ── */}
        {tab === 'posts' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
            {isMember ? (
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingLeft: 12, paddingRight: 5, paddingVertical: 4, alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'stretch' }}>
                  <TextInput
                    value={composer}
                    onChangeText={setComposer}
                    placeholder={`Post to ${group.name}…`}
                    placeholderTextColor={d.faint}
                    multiline
                    style={{ flex: 1, fontSize: 16, fontFamily: 'Poppins-Regular', color: d.text, maxHeight: 84, paddingVertical: 8 }}
                  />
                  <Pressable onPress={post} disabled={!composer.trim()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: composer.trim() ? (isDark ? '#2ECC71' : '#1D6F42') : d.bgSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                    <FontAwesome5 name="paper-plane" size={12} color={composer.trim() ? '#fff' : d.faint} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {feedPosts.length === 0 ? (
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 26, alignItems: 'center', gap: 8 }}>
                <FontAwesome5 name="comments" size={20} color={d.faint} />
                <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center' }}>
                  No posts yet{isMember ? ' — be the first to post!' : ' — join the group to start the conversation.'}
                </T>
              </View>
            ) : (
              feedPosts.map((p) => {
                const u = userOf(p.author);
                const fp = {
                  id: Math.abs([...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) + (p.at % 100000)),
                  content_text: p.text,
                  like_count: 8 + (p.at % 40),
                  comment_count: 1 + (p.at % 7),
                  liked_by_me: false,
                  time_ago: timeAgoLocal(p.at),
                  user: { id: u.user.length, username: u.user, full_name: u.name, user_type: 'member', profile_image: null },
                } as Post;
                return (
                  <FeedCard
                    key={p.id}
                    dash={d}
                    post={fp}
                    group={{ name: group.name, cat: group.cat, avatar: group.avatar, catIcon: catIcon(group.cat) }}
                    rank={roleOf(group, p.author)}
                    onOpenGroup={() => router.push({ pathname: '/tools/group', params: { id: group.id } } as never)}
                    onComments={(pp) => setCommentPost(pp)}
                  />
                );
              })
            )}
          </View>
        ) : null}

        {/* ── MEMBERS — ranks, follow, view profile, manage ── */}
        {tab === 'members' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              {group.members.slice(0, 5).map((m, i) => (
                <View key={m + i} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(212,175,55,0.16)', borderWidth: 2, borderColor: d.card, alignItems: 'center', justifyContent: 'center', marginLeft: i ? -9 : 0 }}>
                  <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: '#E8C96A' }}>{m.slice(0, 1)}</T>
                </View>
              ))}
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginLeft: 10, flex: 1 }}>{group.memberCount.toLocaleString()} people are in this group</T>
              {canManage ? (
                <Pressable
                  accessibilityLabel="add members"
                  onPress={() => { haptic.selection(); setAddOpen(true); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', paddingHorizontal: 10, paddingVertical: 7 }}
                >
                  <FontAwesome5 name="user-plus" size={9} color="#fff" />
                  <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Add</T>
                </Pressable>
              ) : null}
            </View>
            {group.members.map((m, i) => {
              const role = roleOf(group, m);
              const isFollowing = (group.following ?? []).includes(m);
              const u = userOf(m);
              return (
                <View key={m + i} style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Pressable onPress={() => { haptic.selection(); router.push(`/profile/${u.user}`); }} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(140,109,31,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <T v="caption" style={{ fontWeight: '800', fontSize: 13, color: '#E8C96A' }}>{m.slice(0, 1)}</T>
                      </View>
                    </Pressable>
                    <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => { haptic.selection(); router.push(`/profile/${u.user}`); }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text, flexShrink: 1 }} numberOfLines={1}>{m}</T>
                        <Badge role={role} />
                      </View>
                      <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 2 }}>@{u.user} · View profile</T>
                    </Pressable>
                    {m !== ME ? (
                      <Pressable
                        accessibilityLabel={isFollowing ? `unfollow ${m}` : `follow ${m}`}
                        onPress={() => toggleFollow(m)}
                        style={{ borderRadius: 10, borderWidth: 1, borderColor: isFollowing ? d.cardBorder : isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isFollowing ? 'transparent' : isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.06)', paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                      >
                        <FontAwesome5 name={isFollowing ? 'user-check' : 'user-plus'} size={9} color={isFollowing ? d.subtext : isDark ? '#4AE38F' : '#1D6F42'} />
                        <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: isFollowing ? d.subtext : isDark ? '#4AE38F' : '#1D6F42' }}>{isFollowing ? 'Following' : 'Follow'}</T>
                      </Pressable>
                    ) : null}
                    {canManage && m !== ME && role !== 'owner' ? (
                      <Pressable onPress={() => { haptic.selection(); setRoleMenu(roleMenu === m ? null : m); }} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <T v="caption" style={{ color: d.subtext, fontSize: 14, fontWeight: '700' }}>•••</T>
                      </Pressable>
                    ) : null}
                  </View>
                  {/* role / remove menu (owner + admin) */}
                  {roleMenu === m ? (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: d.cardBorder, gap: 7 }}>
                      {isOwner ? (
                        <Pressable onPress={() => setRole(m, role === 'admin' ? 'member' : 'admin')} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(47,164,107,0.4)', backgroundColor: 'rgba(47,164,107,0.07)', paddingHorizontal: 11, paddingVertical: 9 }}>
                          <FontAwesome5 name={role === 'admin' ? 'arrow-down' : 'shield-alt'} size={11} color="#2FA46B" />
                          <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: '#2FA46B' }}>{role === 'admin' ? 'Remove admin role' : 'Make admin'}</T>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => removeMember(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(229,62,62,0.35)', backgroundColor: 'rgba(229,62,62,0.05)', paddingHorizontal: 11, paddingVertical: 9 }}>
                        <FontAwesome5 name="user-minus" size={11} color="#E53E3E" />
                        <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: '#E53E3E' }}>Remove from group</T>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ── ABOUT ── */}
        {tab === 'about' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 15 }}>
              <T v="caption" style={{ fontWeight: '900', fontSize: 9.5, letterSpacing: 0.8, color: d.faint, marginBottom: 8 }}>ABOUT THIS GROUP</T>
              <T v="bodyS" style={{ fontSize: 12.5, lineHeight: 19, color: d.subtext }}>{group.desc}</T>
            </View>
            {[
              { icon: catIcon(group.cat), label: 'Category', value: group.cat },
              { icon: group.open ? 'lock-open' : 'lock', label: 'Privacy', value: group.open ? 'Open — anyone can join' : 'Private — join by request' },
              { icon: 'users', label: 'Members', value: group.memberCount.toLocaleString() },
              { icon: 'file-alt', label: 'Posts', value: String(group.posts.length) },
              { icon: 'crown', label: 'Owner', value: group.members.find((m) => roleOf(group, m) === 'owner') ?? (group.mine ? ME : '—') },
            ].map((r) => (
              <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 13 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(91,200,245,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={r.icon as never} size={13} color="#5BC8F5" />
                </View>
                <T v="caption" style={{ fontSize: 10, color: d.faint, width: 74 }}>{r.label}</T>
                <T v="bodyS" style={{ flex: 1, fontSize: 12, fontWeight: '700', color: d.text, textAlign: 'right' }}>{r.value}</T>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* ── edit settings sheet (owner/admin) ── */}
      <EditGroupSheet visible={editOpen} onClose={() => setEditOpen(false)} group={group} onSave={(patch) => { upd((x) => ({ ...x, ...patch })); }} isOwner={isOwner} />

      {/* ── add members sheet ── */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setAddOpen(false)} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, maxHeight: '70%' }}>
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
              <T v="h3" style={{ fontWeight: '900', fontSize: 16, color: d.text, marginBottom: 4 }}>Add members</T>
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 14 }}>From your connections and the DeenLink community</T>
              {ADDABLE.map((a) => {
                const inGroup = group.members.includes(a.name);
                return (
                  <View key={a.user} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 11, marginBottom: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(91,200,245,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                      <T v="caption" style={{ fontWeight: '800', fontSize: 13, color: '#5BC8F5' }}>{a.name.slice(0, 1)}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{a.name}</T>
                      <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>@{a.user}</T>
                    </View>
                    <Pressable
                      onPress={() => addMember(a.name)}
                      disabled={inGroup}
                      style={{ borderRadius: 10, backgroundColor: inGroup ? d.bgSoft : isDark ? '#2ECC71' : '#1D6F42', paddingHorizontal: 13, paddingVertical: 7 }}
                    >
                      <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: inGroup ? d.faint : '#fff' }}>{inGroup ? 'Added' : '+ Add'}</T>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── cover picker ── */}
      <Modal visible={coverOpen} transparent animationType="slide" onRequestClose={() => setCoverOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setCoverOpen(false)} />
          <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 30 }}>
            <T v="h3" style={{ fontWeight: '900', fontSize: 16, color: d.text, marginBottom: 4 }}>Group cover</T>
            <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 14 }}>Pick a style or upload your own photo — a default applies automatically</T>
            {/* pass 39 — cover photo straight from the gallery */}
            <Pressable
              accessibilityLabel="upload cover from gallery"
              onPress={async () => {
                const uri = await pickGroupPhoto([16, 9]);
                if (uri) { haptic.success(); setCoverOpen(false); upd((x) => ({ ...x, cover: uri })); }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(91,200,245,0.45)', backgroundColor: isDark ? 'rgba(91,200,245,0.08)' : 'rgba(91,200,245,0.05)', paddingHorizontal: 13, paddingVertical: 12, marginBottom: 12 }}
            >
              <FontAwesome5 name="images" size={13} color="#5BC8F5" />
              <T v="bodyS" style={{ flex: 1, fontWeight: '800', fontSize: 12.5, color: d.text }}>Upload cover photo from gallery</T>
              <FontAwesome5 name="chevron-right" size={10} color={d.faint} />
            </Pressable>
            {isGroupImg(group.cover) ? (
              <Pressable
                accessibilityLabel="remove cover photo"
                onPress={() => { haptic.medium(); upd((x) => ({ ...x, cover: 'emerald' })); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(229,62,62,0.35)', backgroundColor: 'rgba(229,62,62,0.05)', paddingHorizontal: 13, paddingVertical: 10, marginBottom: 12 }}
              >
                <FontAwesome5 name="trash" size={12} color="#E53E3E" />
                <T v="bodyS" style={{ flex: 1, fontWeight: '800', fontSize: 12, color: '#E53E3E' }}>Remove uploaded photo (back to style)</T>
              </Pressable>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {isGroupImg(group.cover) ? (
                <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#E8C96A' }}>
                  <ExpoImage source={{ uri: group.cover }} style={{ width: '100%', height: 52 }} contentFit="cover" />
                </View>
              ) : null}
              {COVER_STYLES.map((c) => {
                const on = (group.cover ?? 'emerald') === c.id;
                return (
                  <Pressable key={c.id} onPress={() => changeCover(c.id)} style={{ flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: on ? '#E8C96A' : 'transparent' }}>
                    <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <FontAwesome5 name="check" size={13} color="#E8C96A" /> : null}
                    </LinearGradient>
                    <T v="caption" style={{ fontSize: 8.5, fontWeight: '800', color: d.subtext, textAlign: 'center', marginTop: 4 }}>{c.label}</T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <CommentsModal post={commentPost} seed={(MOCK_COMMENTS[commentPost?.id ?? -1] ?? MOCK_COMMENTS[101] ?? []) as never} visible={commentPost != null} onClose={() => setCommentPost(null)} />
    </View>
  );
}

/* ── local timeAgo (kept private to avoid a circular import) ── */
function timeAgoLocal(t: number) {
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* ── edit settings sheet ── */
function EditGroupSheet({ visible, onClose, group, onSave, isOwner }: { visible: boolean; onClose: () => void; group: Group; onSave: (patch: Partial<Group>) => void; isOwner: boolean }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [name, setName] = useState(group.name);
  const [bio, setBio] = useState(group.bio ?? '');
  const [desc, setDesc] = useState(group.desc);
  const [cat, setCat] = useState<Group['cat']>(group.cat);
  const [open, setOpen] = useState(group.open);
  const [avatar, setAvatar] = useState(group.avatar ?? '');
  const [cover, setCover] = useState(group.cover ?? 'emerald');

  useEffect(() => {
    if (visible) {
      setName(group.name); setBio(group.bio ?? ''); setDesc(group.desc);
      setCat(group.cat); setOpen(group.open); setAvatar(group.avatar ?? ''); setCover(group.cover ?? 'emerald');
    }
  }, [visible, group]);

  const valid = name.trim().length >= 3;
  const input = { borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, fontFamily: 'Poppins-Medium', color: d.text, marginBottom: 14 } as const;
  const label = { fontWeight: '800', fontSize: 9.5, letterSpacing: 0.6, color: d.faint, marginBottom: 7 } as const;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, maxHeight: '92%' }}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="cog" size={14} color="#E8C96A" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="h3" style={{ fontWeight: '900', fontSize: 16, color: d.text }}>Group settings</T>
                <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>{isOwner ? 'You own this group' : 'Admin · some settings locked'}</T>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>

            <T v="caption" style={label}>NAME</T>
            <TextInput value={name} onChangeText={setName} placeholder="Group name" placeholderTextColor={d.faint} maxLength={48} style={input} />

            <T v="caption" style={label}>BIO — SHOWN UNDER THE GROUP NAME</T>
            <TextInput value={bio} onChangeText={setBio} placeholder="e.g. Tafsir every Friday after Jumu'ah" placeholderTextColor={d.faint} maxLength={90} style={{ ...input, fontFamily: 'Poppins-Regular' }} />

            <T v="caption" style={label}>DESCRIPTION</T>
            <TextInput value={desc} onChangeText={setDesc} placeholder="What is the group about?" placeholderTextColor={d.faint} multiline maxLength={240} style={{ ...input, fontFamily: 'Poppins-Regular', minHeight: 76, textAlignVertical: 'top' }} />

            <T v="caption" style={label}>CATEGORY</T>
            <View style={{ flexDirection: 'row', gap: 7, marginBottom: 14 }}>
              {CATS.map((c) => {
                const on = cat === c;
                return (
                  <Pressable key={c} onPress={() => { haptic.selection(); setCat(c); }} style={{ flex: 1, alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1, borderColor: on ? 'rgba(212,175,55,0.55)' : d.cardBorder, backgroundColor: on ? 'rgba(212,175,55,0.1)' : 'transparent', paddingVertical: 9 }}>
                    <FontAwesome5 name={catIcon(c)} size={13} color={on ? '#E8C96A' : d.faint} />
                    <T v="caption" style={{ fontSize: 8, fontWeight: '800', color: on ? '#E8C96A' : d.faint }}>{c === 'Organization' ? 'ORG.' : c.toUpperCase()}</T>
                  </Pressable>
                );
              })}
            </View>

            <T v="caption" style={label}>PROFILE PICTURE</T>
            {/* pass 39 — custom profile picture from the gallery */}
            <Pressable
              accessibilityLabel="upload group picture from gallery"
              onPress={async () => {
                const uri = await pickGroupPhoto([1, 1]);
                if (uri) { haptic.success(); setAvatar(uri); }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(74,227,143,0.4)', backgroundColor: isDark ? 'rgba(46,204,113,0.07)' : 'rgba(29,111,66,0.05)', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }}
            >
              {isGroupImg(avatar) ? (
                <ExpoImage source={{ uri: avatar }} style={{ width: 34, height: 34, borderRadius: 11 }} contentFit="cover" />
              ) : (
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(74,227,143,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="camera" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 12, color: d.text }}>Upload picture from gallery</T>
                <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 1 }}>Square photo · replaces the emoji</T>
              </View>
              <FontAwesome5 name="chevron-right" size={10} color={d.faint} />
            </Pressable>
            {isGroupImg(avatar) ? (
              <Pressable onPress={() => { haptic.medium(); setAvatar(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FontAwesome5 name="trash" size={10} color="#E53E3E" />
                <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: '#E53E3E' }}>Remove photo</T>
              </Pressable>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {AVATARS.map((a) => {
                const on = avatar === a;
                return (
                  <Pressable key={a} onPress={() => { haptic.selection(); setAvatar(a); }} style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 2, borderColor: on ? '#E8C96A' : d.cardBorder, backgroundColor: on ? 'rgba(212,175,55,0.1)' : d.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <T v="h2" style={{ fontSize: 20 }}>{a}</T>
                  </Pressable>
                );
              })}
            </View>

            <T v="caption" style={label}>COVER</T>
            <Pressable
              accessibilityLabel="upload cover from gallery in settings"
              onPress={async () => {
                const uri = await pickGroupPhoto([16, 9]);
                if (uri) { haptic.success(); setCover(uri); }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(91,200,245,0.45)', backgroundColor: isDark ? 'rgba(91,200,245,0.08)' : 'rgba(91,200,245,0.05)', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }}
            >
              {isGroupImg(cover) ? (
                <ExpoImage source={{ uri: cover }} style={{ width: 40, height: 24, borderRadius: 7 }} contentFit="cover" />
              ) : (
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(91,200,245,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="images" size={12} color="#5BC8F5" />
                </View>
              )}
              <T v="bodyS" style={{ flex: 1, fontWeight: '800', fontSize: 12, color: d.text }}>Upload cover photo from gallery</T>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {COVER_STYLES.map((c) => {
                const on = cover === c.id;
                return (
                  <Pressable key={c.id} onPress={() => { haptic.selection(); setCover(c.id); }} style={{ flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: on ? '#E8C96A' : 'transparent' }}>
                    <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <FontAwesome5 name="check" size={12} color="#E8C96A" /> : null}
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, marginBottom: 16 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(91,200,245,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name={open ? 'lock-open' : 'lock'} size={12} color="#5BC8F5" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 12, color: d.text }}>Open to join</T>
                <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{open ? 'Anyone joins instantly' : 'You approve each request'}</T>
              </View>
              <Switch value={open} onValueChange={(v) => { haptic.selection(); setOpen(v); }} trackColor={{ false: d.bgSoft, true: isDark ? '#2ECC71' : '#1D6F42' }} thumbColor="#fff" />
            </View>

            <Pressable
              disabled={!valid}
              onPress={() => {
                if (!valid) return;
                haptic.success();
                onSave({ name: name.trim(), bio: bio.trim(), desc: desc.trim() || group.desc, cat, open, avatar, cover });
                onClose();
              }}
              style={{ borderRadius: 14, backgroundColor: valid ? (isDark ? '#2ECC71' : '#1D6F42') : d.bgSoft, alignItems: 'center', paddingVertical: 14 }}
            >
              <T v="button" style={{ fontWeight: '800', fontSize: 13, color: valid ? '#fff' : d.faint }}>Save changes</T>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
