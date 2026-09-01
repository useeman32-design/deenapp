import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { FeedCard } from '@/components/FeedCard';
import type { Post } from '@/api/types';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

/**
 * Groups (pass 36) — Facebook-style:
 *  · the rail on Community previews groups; tapping opens the FULL-SCREEN
 *    group profile at /tools/group?id=… (no more in-rail modal)
 *  · group posts in the feed are normal FeedCards with a group chip
 *  · shared storage helpers so the rail + the screen stay in sync
 */

export type GroupPost = { id: string; author: string; text: string; at: number };
export type Group = {
  id: string;
  name: string;
  desc: string;
  cat: 'Mosque' | 'School' | 'Organization' | 'Community';
  open: boolean;
  members: string[];
  memberCount: number;
  joined: null | 'member' | 'requested';
  mine?: boolean;
  posts: GroupPost[];
};

export const GROUP_KEY = 'dl.groups.v1';
export const ME = 'You';

export const CAT_GRAD: Record<string, [string, string]> = {
  Mosque: ['#0E3B26', '#08251A'],
  School: ['#123B52', '#0A2334'],
  Organization: ['#4A3A12', '#2A2008'],
  Community: ['#123F3A', '#0A2320'],
};
export const gradFor = (cat: string): [string, string] => CAT_GRAD[cat] ?? CAT_GRAD.Community;
export const catIcon = (cat: string) => (cat === 'Mosque' ? 'mosque' : cat === 'School' ? 'graduation-cap' : cat === 'Organization' ? 'building' : 'users');

export const SEED: Group[] = [
  { id: 'g1', name: "Abuja Jumu'ah Circle", desc: 'Weekly tafsir & brotherhood at the central mosque.', cat: 'Mosque', open: false, members: ['Ibrahim S.', 'Aisha K.', 'Yusuf B.'], memberCount: 1284, joined: null, posts: [{ id: 'p1', author: 'Ibrahim S.', text: 'Reminder: this week\'s tafsir moves to 5:30 PM after Maghrib inshaAllah.', at: Date.now() - 3600000 * 5 }] },
  { id: 'g2', name: 'DeenLink Student Halaqah', desc: 'School halaqah — memorize & revise together every weekend.', cat: 'School', open: true, members: ['Maryam A.'], memberCount: 342, joined: null, posts: [] },
  { id: 'g3', name: 'Sisters of Light', desc: 'A safe space for sisters to learn, ask and grow.', cat: 'Community', open: false, members: ['Khadijah T.'], memberCount: 876, joined: null, posts: [] },
];

export async function loadGroups(): Promise<Group[]> {
  try {
    const r = await storage.getItem(GROUP_KEY);
    const saved = JSON.parse(r ?? 'null') as Group[] | null;
    return saved && saved.length ? saved : SEED;
  } catch {
    return SEED;
  }
}
export function saveGroups(list: Group[]) {
  storage.setItem(GROUP_KEY, JSON.stringify(list)).catch(() => {});
}

/* ── group posts as real FeedCards ── */
const GROUP_MEMBERS: Record<string, Array<{ name: string; user: string }>> = {
  g1: [
    { name: 'Ibrahim S.', user: 'ibrahim.s' },
    { name: 'Aisha K.', user: 'aisha.k' },
    { name: 'Yusuf B.', user: 'yusuf.b' },
  ],
  g2: [{ name: 'Maryam A.', user: 'maryam.a' }],
  g3: [{ name: 'Khadijah T.', user: 'khadijah.t' }],
};

export function groupPostAsFeed(g: { id: string; name: string }, p: GroupPost): Post {
  const member =
    GROUP_MEMBERS[g.id]?.find((m) => m.name === p.author) ??
    (p.author === ME ? { name: 'You', user: 'you' } : { name: p.author, user: p.author.toLowerCase().replace(/[^a-z]+/g, '.') });
  return {
    id: Math.abs([...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) + p.at % 100000),
    content_text: p.text,
    like_count: 8 + (p.at % 40),
    comment_count: 1 + (p.at % 7),
    liked_by_me: false,
    time_ago: timeAgo(p.at),
    user: { id: member.user.length, username: member.user, full_name: member.name, user_type: 'member', profile_image: null },
  } as Post;
}

export const timeAgo = (t: number) => {
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

/** sample member posts surfaced in the community feed as normal post cards */
const SAMPLE_FEED: Array<{ gid: string; author: string; text: string; ago: string; likes: number; comments: number }> = [
  { gid: 'g1', author: 'Ibrahim S.', text: 'Alhamdulillah, this week\'s tafsir covered Ayat al-Kursi — the virtues mentioned in Sahih al-Bukhari are immense. Audio notes are up in the group files.', ago: '2h', likes: 46, comments: 12 },
  { gid: 'g2', author: 'Maryam A.', text: 'Reminder for the weekend halaqah: we continue Juz 29 revision. Bring your mushaf and a notebook — new sisters are welcome! 🤍', ago: '5h', likes: 31, comments: 6 },
];

export function GroupFeedPosts({ onComments }: { onComments?: (p: Post) => void }) {
  const { theme } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const [liked, setLiked] = useState<Set<number>>(new Set());
  return (
    <View style={{ marginTop: 16, paddingHorizontal: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <FontAwesome5 name="users" size={11} color={d.faint} />
        <T v="caption" style={{ fontWeight: '900', fontSize: 9.5, letterSpacing: 0.8, color: d.faint, flex: 1 }}>FROM YOUR GROUPS</T>
        <Pressable onPress={() => router.push('/(tabs)/community')} hitSlop={8}>
          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: d.faint }}>See all</T>
        </Pressable>
      </View>
      {SAMPLE_FEED.map((sp) => {
        const g = SEED.find((x) => x.id === sp.gid) ?? SEED[0];
        const member = GROUP_MEMBERS[g.id]?.find((m) => m.name === sp.author) ?? { name: sp.author, user: 'member' };
        const id = Math.abs([...sp.gid + sp.author].reduce((a, c) => a + c.charCodeAt(0), 0));
        const post = {
          id,
          content_text: sp.text,
          like_count: sp.likes + (liked.has(id) ? 1 : 0),
          comment_count: sp.comments,
          liked_by_me: liked.has(id),
          time_ago: sp.ago,
          user: { id: id + 1, username: member.user, full_name: member.name, user_type: 'member', profile_image: null },
        } as Post;
        return (
          <FeedCard
            key={id}
            dash={d}
            post={post}
            groupLabel={g.name}
            onLike={(pid) => { haptic.light(); setLiked((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; }); }}
            onComments={onComments}
          />
        );
      })}
    </View>
  );
}

/* ── the rail ── */
export function GroupsRail() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadGroups().then(setGroups); }, []);
  const list = groups ?? [];
  const openGroup = (id: string) => { haptic.selection(); router.push({ pathname: '/tools/group', params: { id } } as never); };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
        <FontAwesome5 name="users" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
        <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, color: d.faint, marginLeft: 6, flex: 1 }}>GROUPS</T>
        <Pressable onPress={() => { haptic.selection(); setCreating(true); }} hitSlop={8}>
          <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>+ Create</T>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
        {list.map((g) => {
          const [c1, c2] = gradFor(g.cat);
          return (
            <Pressable
              key={g.id}
              accessibilityLabel={`group ${g.name}`}
              onPress={() => openGroup(g.id)}
              style={{ width: 168, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card }}
            >
              <ExpoImage source={require('../../assets/img/mecca.jpg')} style={{ width: '100%', height: 62 }} contentFit="cover" />
              <LinearGradient colors={[`${c1}55`, c1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 62 }} />
              <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: d.card, borderWidth: 1.5, borderColor: '#E8C96A', alignItems: 'center', justifyContent: 'center', marginTop: -17 }}>
                  <FontAwesome5 name={catIcon(g.cat)} size={12} color="#E8C96A" />
                </View>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 11.5, color: d.text, marginTop: 6 }} numberOfLines={1}>{g.name}</T>
                <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 2 }}>{g.memberCount.toLocaleString()} members · {g.posts.length} posts</T>
                <View style={{ marginTop: 7, alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, borderColor: g.joined ? (isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.25)') : d.cardBorder, backgroundColor: g.joined ? (isDark ? 'rgba(74,227,143,0.14)' : 'rgba(29,111,66,0.08)') : 'transparent' }}>
                  <T v="caption" style={{ fontSize: 8, fontWeight: '800', color: g.joined ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint }}>
                    {g.joined === 'member' ? 'MEMBER' : g.joined === 'requested' ? 'REQUESTED' : g.open ? 'OPEN' : 'BY REQUEST'}
                  </T>
                </View>
              </View>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityLabel="create group"
          onPress={() => { haptic.selection(); setCreating(true); }}
          style={{ width: 120, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.3)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: isDark ? 'rgba(46,204,113,0.05)' : 'rgba(29,111,66,0.03)' }}
        >
          <FontAwesome5 name="plus" size={15} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>New group</T>
        </Pressable>
      </ScrollView>

      <CreateGroupModal
        visible={creating}
        onClose={() => setCreating(false)}
        onCreate={(g) => { setGroups((l) => [g, ...(l ?? [])]); saveGroups([g, ...(list ?? [])]); setCreating(false); }}
      />
    </View>
  );
}

/* ── create sheet (pass 36 upgrade: cover style + icon + live preview) ── */
const COVER_STYLES: Array<{ id: string; label: string; grad: [string, string] }> = [
  { id: 'emerald', label: 'Emerald', grad: ['#0E3B26', '#06180F'] },
  { id: 'night', label: 'Night blue', grad: ['#123B52', '#0A2334'] },
  { id: 'gold', label: 'Gold', grad: ['#4A3A12', '#2A2008'] },
  { id: 'teal', label: 'Teal', grad: ['#123F3A', '#0A2320'] },
];
const CATS: Array<Group['cat']> = ['Mosque', 'School', 'Organization', 'Community'];

export function CreateGroupModal({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (g: Group) => void }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState<Group['cat']>('Community');
  const [cover, setCover] = useState('emerald');
  const [openJoin, setOpenJoin] = useState(true);
  const valid = name.trim().length >= 3;
  const cg = COVER_STYLES.find((c) => c.id === cover) ?? COVER_STYLES[0];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, maxHeight: '92%' }}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(74,227,143,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="users" size={14} color={isDark ? '#4AE38F' : '#1D6F42'} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="h3" style={{ fontWeight: '900', fontSize: 16, color: d.text }}>Create a group</T>
                <T v="caption" style={{ fontSize: 10, color: d.faint, marginTop: 1 }}>Bring your mosque, school or circle together</T>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesome5 name="times" size={12} color={d.subtext} />
              </Pressable>
            </View>

            {/* live preview */}
            <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder, marginBottom: 16 }}>
              <LinearGradient colors={cg.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 64, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: 'rgba(232,201,102,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name={catIcon(cat)} size={13} color="#E8C96A" />
                </View>
              </LinearGradient>
              <View style={{ padding: 11, backgroundColor: d.card }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }} numberOfLines={1}>{name.trim() || 'Your group name'}</T>
                <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 2 }}>{cat} · {openJoin ? 'Anyone can join' : 'Join by request'}</T>
              </View>
            </View>

            <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.6, color: d.faint, marginBottom: 7 }}>NAME</T>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Wuse Quran Circle"
              placeholderTextColor={d.faint}
              maxLength={48}
              style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, fontFamily: 'Poppins-Medium', color: d.text, marginBottom: 14 }}
            />

            <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.6, color: d.faint, marginBottom: 7 }}>DESCRIPTION</T>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="What is the group about?"
              placeholderTextColor={d.faint}
              multiline
              maxLength={140}
              style={{ borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 11, fontSize: 16, fontFamily: 'Poppins-Regular', color: d.text, minHeight: 76, textAlignVertical: 'top', marginBottom: 14 }}
            />

            <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.6, color: d.faint, marginBottom: 7 }}>CATEGORY</T>
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

            <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.6, color: d.faint, marginBottom: 7 }}>COVER STYLE</T>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
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
                <FontAwesome5 name={openJoin ? 'lock-open' : 'lock'} size={12} color="#5BC8F5" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 12, color: d.text }}>Open to join</T>
                <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>{openJoin ? 'Anyone joins instantly' : 'You approve each request'}</T>
              </View>
              <Switch value={openJoin} onValueChange={(v) => { haptic.selection(); setOpenJoin(v); }} trackColor={{ false: d.bgSoft, true: isDark ? '#2ECC71' : '#1D6F42' }} thumbColor="#fff" />
            </View>

            <Pressable
              disabled={!valid}
              onPress={() => {
                if (!valid) return;
                haptic.success();
                onCreate({ id: `g${Date.now()}`, name: name.trim(), desc: desc.trim() || 'A DeenLink community group.', cat, open: openJoin, members: [ME], memberCount: 1, mine: true, joined: 'member', posts: [] });
              }}
              style={{ borderRadius: 14, backgroundColor: valid ? (isDark ? '#2ECC71' : '#1D6F42') : d.bgSoft, alignItems: 'center', paddingVertical: 14 }}
            >
              <T v="button" style={{ fontWeight: '800', fontSize: 13, color: valid ? '#fff' : d.faint }}>Create group</T>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
