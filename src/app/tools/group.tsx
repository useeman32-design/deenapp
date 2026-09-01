import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { FeedCard } from '@/components/FeedCard';
import { CommentsModal } from '@/components/CommentsModal';
import { MOCK_COMMENTS } from '@/api/mocks';
import type { SampleComment } from '@/api/mocks';
import { haptic } from '@/lib/haptics';
import {
  ME,
  catIcon,
  gradFor,
  groupPostAsFeed,
  loadGroups,
  saveGroups,
  type Group,
} from '@/components/Groups';
import type { Post } from '@/api/types';

/**
 * Group profile (pass 36) — a full screen, like a user's public profile:
 * cover + medallion header, join/leave, then tabs — Posts (the members'
 * posts as normal feed cards), Members and About.
 */

type Tab = 'posts' | 'members' | 'about';

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

  const feedPosts = useMemo(
    () => (group ? group.posts.map((p) => groupPostAsFeed(group, p)) : []),
    [group],
  );

  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator color={isDark ? '#4AE38F' : '#1D6F42'} />
        <T v="caption" style={{ fontSize: 11, color: d.faint }}>Opening group…</T>
      </View>
    );
  }

  const [c1] = gradFor(group.cat);
  const isMember = group.joined === 'member';

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ── cover ── */}
        <View>
          <ExpoImage source={require('../../../assets/img/mecca.jpg')} style={{ width: '100%', height: 148 }} contentFit="cover" />
          <LinearGradient colors={[`${c1}77`, `${c1}F2`]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ position: 'absolute', top: Math.max(insets.top, 10) + 2, left: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center' }}
          >
            <FontAwesome5 name="chevron-left" size={13} color="#F2F7F3" />
          </Pressable>
        </View>

        {/* ── identity block ── */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: d.card, borderWidth: 2.5, borderColor: '#E8C96A', alignItems: 'center', justifyContent: 'center', marginTop: -38 }}>
            <FontAwesome5 name={catIcon(group.cat)} size={24} color="#E8C96A" />
          </View>
          <T v="h2" style={{ fontWeight: '900', fontSize: 20, color: d.text, marginTop: 10 }}>{group.name}</T>
          <T v="caption" style={{ fontSize: 11, color: d.subtext, marginTop: 3 }}>
            {group.cat} group · {group.open ? 'Anyone can join' : 'Join by request'}
            {group.mine ? ' · created by you' : ''}
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

          {/* join / leave */}
          <Pressable
            accessibilityLabel={group.joined ? 'leave group' : 'join group'}
            onPress={group.joined ? leave : join}
            style={{ marginTop: 13, borderRadius: 14, backgroundColor: group.joined ? 'transparent' : (isDark ? '#2ECC71' : '#1D6F42'), borderWidth: group.joined ? 1 : 0, borderColor: d.cardBorder, alignItems: 'center', paddingVertical: 13 }}
          >
            <T v="button" style={{ fontWeight: '800', fontSize: 13, color: group.joined ? d.subtext : '#fff' }}>
              {group.joined === 'member' ? 'Leave group' : group.joined === 'requested' ? 'Cancel request' : group.open ? 'Join group' : 'Request to join'}
            </T>
          </Pressable>
        </View>

        {/* ── tabs ── */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16 }}>
          {([
            { id: 'posts' as Tab, label: 'Posts', icon: 'th-large', n: group.posts.length },
            { id: 'members' as Tab, label: 'Members', icon: 'users', n: group.memberCount },
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

        {/* ── POSTS — the members' posts ── */}
        {tab === 'posts' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
            {isMember ? (
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingLeft: 12, paddingRight: 5, paddingVertical: 4, alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'stretch' }}>
                  <TextInput
                    value={composer}
                    onChangeText={setComposer}
                    placeholder="Post to the group…"
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
              feedPosts.map((p) => (
                <FeedCard key={p.id} dash={d} post={p} groupLabel={group.name} onComments={(pp) => setCommentPost(pp)} />
              ))
            )}
          </View>
        ) : null}

        {/* ── MEMBERS ── */}
        {tab === 'members' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              {group.members.slice(0, 5).map((m, i) => (
                <View key={m + i} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(212,175,55,0.16)', borderWidth: 2, borderColor: d.card, alignItems: 'center', justifyContent: 'center', marginLeft: i ? -9 : 0 }}>
                  <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: '#E8C96A' }}>{m.slice(0, 1)}</T>
                </View>
              ))}
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginLeft: 10 }}>{group.memberCount.toLocaleString()} people are in this group</T>
            </View>
            {group.members.map((m, i) => (
              <View key={m + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(140,109,31,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <T v="caption" style={{ fontWeight: '800', fontSize: 13, color: '#E8C96A' }}>{m.slice(0, 1)}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{m}</T>
                  <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{m === ME ? 'You · admin' : 'Member'}</T>
                </View>
                {m !== ME ? (
                  <Pressable onPress={() => router.push('/tools/connections')} style={{ borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.06)', paddingHorizontal: 12, paddingVertical: 6 }}>
                    <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>Connect</T>
                  </Pressable>
                ) : null}
              </View>
            ))}
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

      <CommentsModal post={commentPost} seed={(MOCK_COMMENTS[commentPost?.id ?? -1] ?? MOCK_COMMENTS[101] ?? []) as never} visible={commentPost != null} onClose={() => setCommentPost(null)} />
    </View>
  );
}
