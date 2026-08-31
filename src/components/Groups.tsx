import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { haptic } from '@/lib/haptics';
import { storage } from '@/lib/storage';

/**
 * Groups (pass 34) — facebook-style community groups, fully local for now:
 *  · anyone can CREATE a group (open join / join-by-request)
 *  · schools, mosques & organizations; members count; posts inside the group
 *    page (and note that public posts also surface in the main feed)
 *  · state persisted at dl.groups.v1
 */

export type GroupPost = { id: string; author: string; text: string; at: number };
export type Group = {
  id: string;
  name: string;
  desc: string;
  cat: string;
  open: boolean; /* anyone can join vs join by request */
  members: string[];
  memberCount: number;
  mine?: boolean;
  joined: 'member' | 'requested' | null;
  posts: GroupPost[];
};

const KEY = 'dl.groups.v1';
const ME = 'You';
const timeAgo = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const SEED: Group[] = [
  { id: 'g1', name: 'Abuja Jumu\'ah Circle', desc: 'Weekly tafsir & brotherhood at the central mosque.', cat: 'Mosque', open: false, members: ['Ibrahim S.', 'Aisha K.', 'Yusuf B.'], memberCount: 1284, joined: null, posts: [{ id: 'p1', author: 'Ibrahim S.', text: 'Reminder: this week\'s tafsir moves to 5:30 PM after Maghrib inshaAllah.', at: Date.now() - 3600000 * 5 }] },
  { id: 'g2', name: 'DeenLink Student Halaqah', desc: 'School halaqah — memorize & revise together every weekend.', cat: 'School', open: true, members: ['Maryam A.'], memberCount: 342, joined: null, posts: [] },
  { id: 'g3', name: 'Sisters of Light', desc: 'A safe space for sisters to learn, ask and grow.', cat: 'Community', open: false, members: ['Khadijah T.'], memberCount: 876, joined: null, posts: [] },
];

const CAT_GRAD: Record<string, [string, string]> = {
  Mosque: ['#0E3B26', '#08251A'],
  School: ['#123B52', '#0A2334'],
  Organization: ['#4A3A12', '#2A2008'],
  Community: ['#123F3A', '#0A2320'],
};

export function GroupsRail({ onOpenFeed }: { onOpenFeed?: (text: string) => void }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [open, setOpen] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);
  const [composer, setComposer] = useState('');

  useEffect(() => {
    storage.getItem(KEY).then((r) => {
      try {
        const saved = JSON.parse(r ?? 'null') as Group[] | null;
        setGroups(saved && saved.length ? saved : SEED);
      } catch { setGroups(SEED); }
    }).catch(() => setGroups(SEED));
  }, []);
  const persist = (g: Group[]) => { setGroups(g); storage.setItem(KEY, JSON.stringify(g)).catch(() => {}); };

  const upd = (id: string, f: (g: Group) => Group) => persist((groups ?? []).map((g) => (g.id === id ? f(g) : g)));

  const join = (g: Group) => {
    haptic.selection();
    upd(g.id, (x) => ({ ...x, joined: x.open ? 'member' : 'requested', members: x.open ? [...x.members, ME] : x.members, memberCount: x.open ? x.memberCount + 1 : x.memberCount, mine: true }));
  };
  const leave = (g: Group) => {
    haptic.selection();
    upd(g.id, (x) => ({ ...x, joined: null, members: x.members.filter((m) => m !== ME), memberCount: Math.max(0, x.memberCount - 1) }));
  };
  const post = () => {
    if (!composer.trim() || !open) return;
    haptic.light();
    upd(open.id, (x) => ({ ...x, posts: [{ id: `p${Date.now()}`, author: ME, text: composer.trim(), at: Date.now() }, ...x.posts] }));
    onOpenFeed?.(composer.trim());
    setComposer('');
  };

  const list = groups ?? [];
  const grad = (cat: string) => CAT_GRAD[cat] ?? CAT_GRAD.Community;

  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
        <FontAwesome5 name="users" size={12} color={isDark ? '#4AE38F' : '#1D6F42'} />
        <T v="caption" style={{ fontWeight: '800', fontSize: 10, letterSpacing: 0.6, color: d.faint, marginLeft: 6, flex: 1 }}>GROUPS</T>
        <Pressable onPress={() => { haptic.selection(); setCreating(true); }} hitSlop={8}>
          <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>+ Create</T>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
        {list.map((g) => {
          const [c1, c2] = grad(g.cat);
          return (
            <Pressable
              key={g.id}
              accessibilityLabel={`group ${g.name}`}
              onPress={() => { haptic.selection(); setOpen(g); }}
              style={{ width: 148, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: d.cardBorder }}
            >
              <View style={{ height: 52, backgroundColor: c1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' }}>
                  <FontAwesome5 name={g.cat === 'Mosque' ? 'mosque' : g.cat === 'School' ? 'graduation-cap' : g.cat === 'Organization' ? 'building' : 'users'} size={13} color="#E8C96A" />
                </View>
              </View>
              <View style={{ backgroundColor: d.card, padding: 9 }}>
                <T v="bodyS" style={{ fontWeight: '800', fontSize: 11.5, color: d.text }} numberOfLines={1}>{g.name}</T>
                <T v="caption" style={{ fontSize: 9, color: d.faint, marginTop: 2 }}>{g.memberCount.toLocaleString()} members</T>
                {g.joined ? (
                  <View style={{ marginTop: 6, alignSelf: 'flex-start', borderRadius: 6, backgroundColor: isDark ? 'rgba(74,227,143,0.14)' : 'rgba(29,111,66,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.25)', paddingHorizontal: 7, paddingVertical: 2 }}>
                    <T v="caption" style={{ fontSize: 8, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>{g.joined === 'member' ? 'MEMBER' : 'REQUESTED'}</T>
                  </View>
                ) : (
                  <View style={{ marginTop: 6, alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <T v="caption" style={{ fontSize: 8, fontWeight: '800', color: d.faint }}>{g.open ? 'OPEN' : 'BY REQUEST'}</T>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityLabel="create group"
          onPress={() => { haptic.selection(); setCreating(true); }}
          style={{ width: 110, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.3)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: isDark ? 'rgba(46,204,113,0.05)' : 'rgba(29,111,66,0.03)' }}
        >
          <FontAwesome5 name="plus" size={15} color={isDark ? '#4AE38F' : '#1D6F42'} />
          <T v="caption" style={{ fontSize: 9.5, fontWeight: '800', color: isDark ? '#4AE38F' : '#1D6F42' }}>New group</T>
        </Pressable>
      </ScrollView>

      {/* ── group page ── */}
      <Modal visible={open != null} animationType="slide" transparent onRequestClose={() => setOpen(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)' }} onPress={() => setOpen(null)} />
        <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, maxHeight: '90%' }}>
          {open ? (() => {
            const [c1] = grad(open.cat);
            const isMember = open.joined === 'member';
            return (
              <View style={{ flex: 1 }}>
                <View style={{ backgroundColor: c1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' }}>
                    <FontAwesome5 name="users" size={15} color="#E8C96A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="h3" style={{ fontWeight: '800', fontSize: 15, color: '#F2F7F3' }}>{open.name}</T>
                    <T v="caption" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{open.memberCount.toLocaleString()} members · {open.cat} · {open.open ? 'Anyone can join' : 'Join by request'}</T>
                  </View>
                  <Pressable onPress={() => setOpen(null)} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="times" size={12} color="#F2F7F3" />
                  </Pressable>
                </View>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
                  <T v="bodyS" style={{ fontSize: 12, lineHeight: 18, color: d.subtext }}>{open.desc}</T>
                  <Pressable
                    onPress={() => (open.joined ? leave(open) : join(open))}
                    style={{ marginTop: 12, borderRadius: 13, backgroundColor: open.joined ? 'transparent' : isDark ? '#4AE38F' : '#1D6F42', borderWidth: open.joined ? 1 : 0, borderColor: d.cardBorder, alignItems: 'center', paddingVertical: 12 }}
                  >
                    <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: open.joined ? d.subtext : '#fff' }}>
                      {open.joined === 'member' ? 'Leave group' : open.joined === 'requested' ? 'Cancel request' : open.open ? 'Join group' : 'Request to join'}
                    </T>
                  </Pressable>

                  {isMember ? (
                    <View style={{ marginTop: 16 }}>
                      <View style={{ flexDirection: 'row', borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, paddingLeft: 12, paddingRight: 5, paddingVertical: 4, alignItems: 'flex-end' }}>
                        <TextInput
                          value={composer}
                          onChangeText={setComposer}
                          placeholder="Post to the group…"
                          placeholderTextColor={d.faint}
                          multiline
                          style={{ flex: 1, fontSize: 13, fontFamily: 'Poppins-Regular', color: d.text, maxHeight: 84, paddingVertical: 8 }}
                        />
                        <Pressable onPress={post} disabled={!composer.trim()} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: composer.trim() ? (isDark ? '#4AE38F' : '#1D6F42') : d.bgSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                          <FontAwesome5 name="paper-plane" size={12} color={composer.trim() ? '#fff' : d.faint} />
                        </Pressable>
                      </View>
                      <T v="caption" style={{ fontSize: 8.5, color: d.faint, marginTop: 5 }}>Group posts appear here — public groups also surface in the main feed.</T>
                    </View>
                  ) : null}

                  <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginTop: 16, marginBottom: 8 }}>POSTS · {open.posts.length}</T>
                  {!open.posts.length ? (
                    <T v="bodyS" style={{ color: d.faint, textAlign: 'center', paddingVertical: 18 }}>No posts yet{isMember ? ' — be the first!' : '.'}</T>
                  ) : (
                    open.posts.map((p) => (
                      <View key={p.id} style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(140,109,31,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <T v="caption" style={{ fontWeight: '800', fontSize: 10, color: '#E8C96A' }}>{p.author.slice(0, 1)}</T>
                          </View>
                          <T v="bodyS" style={{ fontWeight: '800', fontSize: 11.5, color: d.text }}>{p.author}</T>
                          <T v="caption" style={{ fontSize: 9, color: d.faint, marginLeft: 'auto' }}>{timeAgo(p.at)}</T>
                        </View>
                        <T v="bodyS" style={{ fontSize: 12, lineHeight: 18, color: d.subtext, marginTop: 7 }}>{p.text}</T>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            );
          })() : null}
        </View>
      </Modal>

      {/* ── create group ── */}
      <CreateGroupModal visible={creating} onClose={() => setCreating(false)} onCreate={(g) => { persist([g, ...list]); setCreating(false); }} />
    </View>
  );
}

function CreateGroupModal({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (g: Group) => void }) {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Community');
  const [openJoin, setOpenJoin] = useState(true);
  const valid = name.trim().length > 2;
  const cats = ['Community', 'Mosque', 'School', 'Organization'];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.55)' }} onPress={onClose} />
      <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, padding: 18, paddingBottom: 30 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <T v="h3" style={{ fontWeight: '800', flex: 1, fontSize: 15 }}>Create a group</T>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="times" size={12} color={d.subtext} />
          </Pressable>
        </View>
        <TextInput value={name} onChangeText={setName} placeholder="Group name — e.g. FCT Quran Class" placeholderTextColor={d.faint} style={{ borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, fontSize: 14, fontFamily: 'Poppins-Medium', color: d.text, marginBottom: 10 }} />
        <TextInput value={desc} onChangeText={setDesc} placeholder="What is the group about?" placeholderTextColor={d.faint} multiline style={{ borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 12, fontSize: 13, minHeight: 70, textAlignVertical: 'top', fontFamily: 'Poppins-Regular', color: d.text, marginBottom: 12 }} />
        <T v="caption" style={{ fontWeight: '800', fontSize: 9.5, letterSpacing: 0.5, color: d.faint, marginBottom: 7 }}>CATEGORY</T>
        <View style={{ flexDirection: 'row', gap: 7, marginBottom: 14 }}>
          {cats.map((c) => {
            const on = cat === c;
            return (
              <Pressable key={c} onPress={() => { haptic.selection(); setCat(c); }} style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.07)') : 'transparent', alignItems: 'center', paddingVertical: 8 }}>
                <T v="caption" style={{ fontSize: 10, fontWeight: '700', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext }}>{c}</T>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {([true, false] as const).map((o) => {
            const on = openJoin === o;
            return (
              <Pressable key={String(o)} onPress={() => { haptic.selection(); setOpenJoin(o); }} style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: on ? (isDark ? 'rgba(74,227,143,0.5)' : 'rgba(29,111,66,0.4)') : d.cardBorder, backgroundColor: on ? (isDark ? 'rgba(46,204,113,0.1)' : 'rgba(29,111,66,0.06)') : 'transparent', padding: 11, alignItems: 'center' }}>
                <FontAwesome5 name={o ? 'unlock' : 'user-check'} size={12} color={on ? (isDark ? '#4AE38F' : '#1D6F42') : d.faint} />
                <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: on ? (isDark ? '#4AE38F' : '#1D6F42') : d.subtext, marginTop: 5 }}>{o ? 'Anyone can join' : 'Join by request'}</T>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityLabel="create group"
          onPress={() => { if (valid) { haptic.success(); onCreate({ id: `g${Date.now()}`, name: name.trim(), desc: desc.trim() || 'A DeenLink community group.', cat, open: openJoin, members: [ME], memberCount: 1, mine: true, joined: 'member', posts: [] }); } }}
          disabled={!valid}
          style={{ borderRadius: 14, backgroundColor: valid ? (isDark ? '#4AE38F' : '#1D6F42') : d.cardBorder, alignItems: 'center', paddingVertical: 14 }}
        >
          <T v="bodyS" style={{ fontWeight: '900', fontSize: 13, color: valid ? '#06140D' : d.faint }}>Create group</T>
        </Pressable>
      </View>
    </Modal>
  );
}
