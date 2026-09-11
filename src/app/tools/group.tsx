import { useEffect, useMemo, useRef, useState } from 'react';
import { goBack } from '@/lib/navigation';
import { ActivityIndicator, Alert, Animated, Modal, Platform, Pressable, ScrollView, Share, Switch, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { T } from '@/components/T';
import { FeedCard, AvatarImage } from '@/components/FeedCard';
import { CommentsModal } from '@/components/CommentsModal';
import { MOCK_COMMENTS } from '@/api/mocks';
import { FriendsPicker } from '@/components/SendToFriends';

/* pass 83-17 — skeleton breathing loader (owner: "when opening group the
 * loader should be skeleton breathing loader"). Contents breathe — never a
 * breathing icon (correction 64 pattern). */
function BreathingPosts({ dash }: { dash: { card: string; cardBorder: string } }) {
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
    <View style={{ gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={{ backgroundColor: dash.card, borderRadius: 18, borderWidth: 1, borderColor: dash.cardBorder, padding: 14, gap: 9, opacity: pulse }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: dash.cardBorder }} />
            <View style={{ flex: 1, gap: 5 }}>
              <View style={{ width: 110, height: 9, borderRadius: 5, backgroundColor: dash.cardBorder }} />
              <View style={{ width: 70, height: 7, borderRadius: 4, backgroundColor: dash.cardBorder }} />
            </View>
          </View>
          <View style={{ width: '92%', height: 9, borderRadius: 5, backgroundColor: dash.cardBorder }} />
          <View style={{ width: '78%', height: 9, borderRadius: 5, backgroundColor: dash.cardBorder }} />
          {i === 0 ? <View style={{ width: '100%', height: 120, borderRadius: 12, backgroundColor: dash.cardBorder }} /> : null}
        </Animated.View>
      ))}
    </View>
  );
}
import { groupCreatePost, publicSettings, groupDeletePost, groupGet, groupJoin, groupJoinDecide, groupJoinRequests, groupJoinRich, groupMembers, groupPosts as groupPostsApi, searchAccounts, toggleFollow as apiToggleFollow, type AccountResult, type GroupRow } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { haptic } from '@/lib/haptics';
import { shareLink } from '@/lib/share';
import { Image as ExpoImage } from 'expo-image';
import {
  ME,
  catIcon,
  isGroupImg,
  pickGroupPhoto,
  loadGroups,
  saveGroups,
  srvGroupId,
  roleOf,
  ROLE_META,
  COVER_STYLES,
  CATS,
  AVATARS,
  type Group,
  type Role,
} from '@/components/Groups';
import type { Post } from '@/api/types';
import { useIsGuest } from '@/lib/guest';
import { LoginRequired } from '@/components/LoginRequired';

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

function GroupScreenInner() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : String(params.id ?? 'g1');

  const [group, setGroup] = useState<Group | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [composer, setComposer] = useState('');
  /* pass 83-10 — photo posts in groups (same picker pattern as the community
   * composer: web file input, native expo-image-picker via lazy import).
   * pass 83-25 — up to 5 photos (carousel), + local video + YouTube link. */
  const [imagesAttach, setImagesAttach] = useState<Array<{ uri: string; name: string }>>([]);
  const [videoAttach, setVideoAttach] = useState<{ uri: string; name: string; type?: string } | null>(null);
  const [ytOn, setYtOn] = useState(false);
  const [ytLink, setYtLink] = useState('');
  const [uploadFrac, setUploadFrac] = useState<number | null>(null);
  /* pass 83-36 — admin toggle: community/group video posting OFF by default */
  const [videoAllowed, setVideoAllowed] = useState(false);
  useEffect(() => {
    publicSettings().then((fl: Record<string, boolean | string>) => setVideoAllowed(fl['posting.community_video'] === true)).catch(() => setVideoAllowed(false));
  }, []);
  /* pass 83-17 */
  const [loadDone, setLoadDone] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  /* pass 83-26 — posted-success pill (community parity) */
  const [postedPill, setPostedPill] = useState(false);
  /* pass 83-10b — poll builder (2–6 options) */
  const [pollOn, setPollOn] = useState(false);
  const [pollOpts, setPollOpts] = useState<string[]>(['', '']);
  /* pass 83-10c — audio FILE uploads (owner: pick a file, not voice recording) */
  const [audioAttach, setAudioAttach] = useState<{ uri: string; name: string; type?: string } | null>(null);
  const audioFileRef = useRef<TextInput | null>(null);
  /* pass 83-10 — keep the server's posts INTACT (media, polls, real counts);
   * the old path flattened them into local demo rows and dropped everything. */
  const [serverPosts, setServerPosts] = useState<Post[] | null>(null);
  const imageFileRef = useRef<TextInput | null>(null);
  const pickImage = async () => {
    haptic.light();
    try {
      if (Platform.OS === 'web') {
        (imageFileRef.current as unknown as HTMLInputElement | null)?.click?.();
        return;
      }
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo-library access to pick an image.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: true, selectionLimit: 5 });
      if (!res.canceled && res.assets?.length) {
        /* pass 83-25 — photos are exclusive with video/YouTube (server rule) */
        setPostError(null);
        setVideoAttach(null);
        setYtLink('');
        setImagesAttach((cur) => [...cur, ...res.assets.filter((a) => a.uri).map((a) => ({ uri: a.uri, name: a.fileName ?? 'photo.jpg' }))].slice(0, 5));
      }
    } catch {
      Alert.alert('Could not open the picker', 'Please try again.');
    }
  };
  /* pass 83-10c — audio FILE picker: web hidden input, native expo-document-picker
     (lazy import — never loaded on web, correction 61) */
  const pickAudio = async () => {
    haptic.light();
    try {
      if (Platform.OS === 'web') {
        (audioFileRef.current as unknown as HTMLInputElement | null)?.click?.();
        return;
      }
      const docPicker = await import('expo-document-picker');
      /* pass 83-34 — iOS: the old all-media wildcard string is NOT a UTI; the
       * picker maps it to nothing and the Files app GREYS OUT audio (owner,
       * 3rd report). Real UTIs:
       * public.data is the base type every readable file conforms to (mp3,
       * m4a, wav, aac…), public.audio is the explicit audio tree. Files in
       * iCloud download on pick (copyToCacheDirectory defaults true).
       * validateAudio() still rejects non-audio picks with a clear message. */
      /* pass 83-35 — Android too: the audio/* intent greys m4a/aac in the
       * Files picker (owner: "I have m4a and aac … it won't work"). ALL
       * platforms now open the full picker; validateAudio() rejects
       * non-audio picks with a clear message right after. */
      const audioTypes = Platform.OS === 'ios' ? ['public.audio', 'public.data'] : '*/*';
      const res = await docPicker.getDocumentAsync({ type: audioTypes as never });
      const asset = (Array.isArray(res.assets) ? res.assets[0] : (res as unknown)) as { uri?: string; name?: string; mimeType?: string; size?: number } | undefined;
      if (res.canceled !== true && asset?.uri) {
        /* pass 83-25 — validate BEFORE attach (the server silently drops bad
         * files, which read as "nothing happened" / "audio not playing") */
        const err = validateAudio(asset.name ?? 'audio.mp3', asset.size);
        if (err) { setPostError(err); return; }
        setPostError(null);
        setAudioAttach({ uri: asset.uri, name: asset.name ?? 'audio.mp3', type: asset.mimeType });
      }
    } catch { /* picker unavailable — nothing attached */ }
  };
  /* pass 83-25 — client mirrors of the server's media rules (create_post.php):
   * audio ≤25MB (mp3/m4a/aac/wav/ogg/webm/mka), video ≤50MB (mp4/mov/webm/m4v).
   * Photos ride the same compression as the feed composer. */
  const extOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase().split('?')[0];
  const validateAudio = (name: string, size?: number): string | null => {
    if (!['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'webm', 'mka'].includes(extOf(name))) return `“${name}” is not a supported audio file (mp3, m4a, aac, wav, ogg, webm).`;
    if (size != null && size > 25 * 1024 * 1024) return `“${name}” is over the 25 MB audio limit.`;
    return null;
  };
  const validateVideo = (name: string, size?: number): string | null => {
    if (!['mp4', 'mov', 'webm', 'm4v'].includes(extOf(name))) return `“${name}” is not a supported video file (mp4, mov, webm, m4v).`;
    if (size != null && size > 50 * 1024 * 1024) return `“${name}” is over the 50 MB video limit.`;
    return null;
  };
  const YT_RE = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch|shorts|embed|live)|youtu\.be\/)/i;
  const videoFileRef = useRef<TextInput | null>(null);
  const pickVideo = async () => {
    haptic.light();
    try {
      if (Platform.OS === 'web') {
        (videoFileRef.current as unknown as HTMLInputElement | null)?.click?.();
        return;
      }
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo-library access to pick a video.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: false });
      const a = res.assets?.[0];
      if (!res.canceled && a?.uri) {
        const err = validateVideo(a.fileName ?? 'video.mp4', a.fileSize ?? undefined);
        if (err) { setPostError(err); return; }
        setPostError(null);
        setImagesAttach([]);
        setYtLink('');
        setVideoAttach({ uri: a.uri, name: a.fileName ?? 'video.mp4' });
      }
    } catch {
      Alert.alert('Could not open the picker', 'Please try again.');
    }
  };
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  /* pass 38 management surfaces */
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [roleMenu, setRoleMenu] = useState<string | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  /* pass 83-25 — live roster (get.php members[]), member actions, join busy */
  const [roster, setRoster] = useState<NonNullable<GroupRow['members']> | null>(null);
  const [memberBusy, setMemberBusy] = useState<number | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  /* pass 83-25 — add-members sheet: live account search */
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<AccountResult[] | null>(null);
  const [addSearching, setAddSearching] = useState(false);
  const [addBusy, setAddBusy] = useState<number | null>(null);

  /* pass 83-28 — posts fetch can FAIL (server hiccup / session drop); it used
   * to leave the skeleton breathing forever with no way out. */
  const [postsError, setPostsError] = useState(false);
  /* pass 83-28 — admin join-request queue (owner: "a place where admin can
   * accept or rejects joining requests") */
  const [joinReqs, setJoinReqs] = useState<Array<{ id: number; username: string; full_name: string; profile_image_url?: string | null }> | null>(null);
  const [reqBusy, setReqBusy] = useState<number | null>(null);
  const loadServerPosts = (sid: number, localId?: number | string, retried = false) => {
    setPostsError(false);
    /* pass 83-31 — owner: loader then "could not load" DESPITE internet.
     * One silent retry before giving up; rejected fetches now land in the
     * same handler (they used to slip past .then and leave the skeleton
     * breathing forever), and the posts call gets a 45s window. */
    void groupPostsApi(sid)
      .then((rows) => {
        if (!rows) {
          if (!retried) { setTimeout(() => loadServerPosts(sid, localId, true), 900); return; }
          setPostsError(true);
          return;
        }
        setServerPosts(rows);
        if (!rows.length) return;
        const lid = localId;
        setGroup((cur) =>
          cur && (lid == null ? true : cur.id === lid)
            ? { ...cur, posts: rows.map((p) => ({ id: `sp${p.id}`, author: p.user?.full_name || p.user?.username || 'Member', text: p.content_text ?? '', at: new Date(p.created_at ?? Date.now()).getTime() })) }
            : cur,
        );
      })
      .catch(() => {
        if (!retried) { setTimeout(() => loadServerPosts(sid, localId, true), 900); return; }
        setPostsError(true);
      });
  };

  useEffect(() => {
    loadGroups().then((all) => {
      /* pass 83-17 — removed the `?? all[0]` fallback: a stale/wrong id used
       * to silently open whatever group was first in the list. */
      const g = all.find((x) => x.id === id) ?? null;
      setGroup(g);
      setLoadDone(true);
      if (!g) return;
      /* pass 66-night — live group: pull the real posts behind the srv id */
      const sid = srvGroupId(g);
      if (sid != null) {
        /* pass 83-25 — roster + the viewer's own role (the Members tab used
         * to be EMPTY on live groups — members mapped to [] — and every
         * admin read as MEMBER). */
        void groupGet(sid).then((row) => {
          if (!row) return;
          setGroup((cur) => (cur && cur.id === g.id ? { ...cur, my_role: row.my_role ?? cur.my_role ?? null, mine: row.is_owner } : cur));
          if (Array.isArray(row.members)) setRoster(row.members);
          /* pass 83-28 — admins pull the join-request queue */
          if (row.my_role === 'owner' || row.my_role === 'admin' || row.is_owner) {
            void groupJoinRequests(sid).then((reqs) => setJoinReqs(reqs ?? []));
          }
        });
        loadServerPosts(sid, g.id);
      }
    });
  }, [id]);

  const upd = (f: (g: Group) => Group) => {
    setGroup((g) => (g ? f(g) : g));
    loadGroups().then((all) => {
      const next = all.map((g) => (g.id === id ? f(g) : g));
      saveGroups(next);
    });
  };

  const { user } = useAuth(); /* pass 83-14 — real identity for delete rights */
  const myRole = group ? roleOf(group, ME) : 'member';
  const canManage = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  /* pass 83-25 — join/leave show a busy state and ROLL BACK when the server
   * says no (the old fire-and-forget left phantom memberships; and join used
   * to set mine:true, which displayed every joiner as the group's OWNER). */
  const join = () => {
    if (!group || joinBusy) return;
    haptic.success();
    const sid = srvGroupId(group);
    if (sid != null && group.open) {
      setJoinBusy(true);
      setMemberError(null);
      upd((x) => ({ ...x, joined: 'member', members: x.members.includes(ME) ? x.members : [...x.members, ME], memberCount: x.memberCount + 1, my_role: 'member' as Role }));
      groupJoin(sid, true).then((ok) => {
        setJoinBusy(false);
        if (ok) {
          void groupGet(sid).then((row) => {
            if (!row) return;
            setGroup((cur) => (cur ? { ...cur, my_role: row.my_role ?? 'member', mine: row.is_owner, memberCount: row.member_count } : cur));
            if (Array.isArray(row.members)) setRoster(row.members);
          });
        } else {
          upd((x) => ({ ...x, joined: null, members: x.members.filter((m) => m !== ME), memberCount: Math.max(0, x.memberCount - 1), my_role: null }));
          setMemberError('Could not join — please try again.');
        }
      });
      return;
    }
    /* pass 83-28 — closed server groups now send a real JOIN REQUEST the
     * owner approves/declines (it used to flip a local flag only — and the
     * server answered every later join with "This group is invite-only"). */
    if (sid != null) {
      setJoinBusy(true);
      setMemberError(null);
      upd((x) => ({ ...x, joined: 'requested' }));
      groupJoinRich(sid, true).then((res) => {
        setJoinBusy(false);
        if (res === 'requested') {
          Alert.alert('Request sent', 'The group admin will review your join request.');
        } else if (res === 'joined') {
          void groupGet(sid).then((row) => {
            if (!row) return;
            setGroup((cur) => (cur ? { ...cur, my_role: row.my_role ?? 'member', mine: row.is_owner, memberCount: row.member_count } : cur));
            if (Array.isArray(row.members)) setRoster(row.members);
          });
          upd((x) => ({ ...x, joined: 'member', my_role: 'member' as Role }));
        } else if (res === null) {
          upd((x) => ({ ...x, joined: null }));
          setMemberError('Could not send the request — please try again.');
        }
      });
      return;
    }
    upd((x) => ({ ...x, joined: x.open ? 'member' : 'requested', members: x.open ? (x.members.includes(ME) ? x.members : [...x.members, ME]) : x.members, memberCount: x.open ? x.memberCount + 1 : x.memberCount, ...(x.open ? { my_role: 'member' as Role } : {}) }));
  };
  const leave = () => {
    if (!group || joinBusy) return;
    haptic.selection();
    const sid = srvGroupId(group);
    if (sid != null) {
      setJoinBusy(true);
      setMemberError(null);
      upd((x) => ({ ...x, joined: null, members: x.members.filter((m) => m !== ME), memberCount: Math.max(0, x.memberCount - 1), my_role: null, mine: false }));
      groupJoin(sid, false).then((ok) => {
        setJoinBusy(false);
        if (ok) {
          setRoster(null);
        } else {
          upd((x) => ({ ...x, joined: 'member', members: [...x.members, ME], memberCount: x.memberCount + 1 }));
          setMemberError('Could not leave — please try again.');
        }
      });
      return;
    }
    upd((x) => ({ ...x, joined: null, members: x.members.filter((m) => m !== ME), memberCount: Math.max(0, x.memberCount - 1), my_role: null }));
  };
  const post = () => {
    const poll = pollOn ? pollOpts.map((o) => o.trim()).filter(Boolean) : [];
    const pollOk = poll.length >= 2;
    const yt = ytOn ? ytLink.trim() : '';
    if (yt && !YT_RE.test(yt)) { setPostError('That does not look like a YouTube link.'); return; }
    if ((!composer.trim() && !imagesAttach.length && !audioAttach && !videoAttach && !pollOk && !yt) || !group) return;
    haptic.light();
    const text = composer.trim();
    const imgs = imagesAttach;
    const vid = videoAttach;
    const aud = audioAttach;
    /* pass 83-32 — keep a snapshot so a failed upload hands EVERYTHING back
     * (owner: "show unable to post not just disappearing blindly") */
    const draft = { text, imgs, vid, aud, yt, pollOn, poll, ytOn: ytOn || !!yt };
    upd((x) => ({ ...x, posts: [{ id: `p${Date.now()}`, author: ME, text, at: Date.now() }, ...x.posts] })); /* pass 83-35 — no local media preview in the list */
    const optId = -Date.now();
    if (serverPosts) {
      const optimistic = {
        id: optId, content_text: text, created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        like_count: 0, comment_count: 0, liked_by_me: false,
        user: { username: 'you', full_name: 'You', profile_image_url: null },
        /* pass 83-35 — owner: media must NOT show in the list until the post
         * actually finishes. The optimistic row is TEXT-ONLY ("Posting…");
         * loadServerPosts() swaps in the real row with its media on success. */
        ...(yt ? { youtube_url: yt } : {}),
        ...(pollOk ? { poll: { options: poll.map((o, i) => ({ id: i + 1, text: o, votes: 0 })), voted: null } } : {}),
      } as Post;
      setServerPosts((rows) => [optimistic, ...(rows ?? [])]);
    }
    setComposer('');
    setImagesAttach([]);
    setVideoAttach(null);
    setYtLink('');
    setAudioAttach(null);
    setPollOn(false);
    setPollOpts(['', '']);
    /* pass 66-night — group posts hit the server on live; pass 83-10 — photos ride multipart;
       83-10b/c — poll options + audio file ride along;
       pass 83-25 — + video + YouTube + real upload progress. */
    const sid = srvGroupId(group);
    if (sid != null) {
      setPostError(null);
      if (imgs.length || vid || aud) setUploadFrac(0);
      /* pass 83-34 — "It says failed, but after a refresh the post is there."
       * On mobile networks the upload CAN reach the server and commit while
       * the response never makes it back (screen lock, network switch, proxy
       * drop). Before declaring failure, silently re-fetch the group feed:
       * if our post is already there, it SUCCEEDED — reconcile, never nag. */
      const verifyMaybePosted = async (): Promise<boolean> => {
        try {
          const rows = await groupPostsApi(sid);
          const newest = (rows ?? [])[0] as Post | undefined;
          if (!newest) return false;
          if (text !== '') return String(newest.content_text ?? '') === text;
          /* pure-media post: newest row with media, fresh enough to be ours */
          const hasMedia = Array.isArray((newest as { media?: unknown[] }).media) && ((newest as { media?: unknown[] }).media ?? []).length > 0;
          const ts = Date.parse(String(newest.created_at ?? '').replace(' ', 'T') + 'Z');
          const fresh = Number.isNaN(ts) ? true : Date.now() - ts < 6 * 3600 * 1000;
          return hasMedia && fresh;
        } catch { return false; }
      };
      const salvageWin = () => {
        loadServerPosts(sid);
        haptic.success();
        setPostedPill(true);
        setTimeout(() => setPostedPill(false), 2200);
      };
      void groupCreatePost(
        sid,
        text,
        imgs.length ? imgs.map((m) => ({ uri: m.uri, name: m.name, type: 'image/jpeg' })) : undefined,
        pollOk ? poll : undefined,
        aud ?? undefined,
        vid ?? undefined,
        yt || undefined,
        (f) => setUploadFrac(f),
      ).then(async (res) => {
        setUploadFrac(null);
        /* pass 83-28 — res is {id, message}: only a REAL id counts as a win,
         * and the server's own message (rate limit, membership…) is shown. */
        if (res && res.id != null) {
          /* pass 83-17 — refetch so the real server row (with its real id)
           * replaces the optimistic one. */
          loadServerPosts(sid);
          haptic.success();
          setPostedPill(true);
          setTimeout(() => setPostedPill(false), 2200);
        } else {
          /* pass 83-34 — the response was lost/mangled but the post may be
           * committed; verify before calling it a failure. A server-said
           * error (rate limit, membership…) is a REAL failure — no salvage. */
          const salvaged = !res?.message ? await verifyMaybePosted() : false;
          if (salvaged) { salvageWin(); return; }
          /* pass 83-32 — failure hands the draft back (text + attachments +
           * toggles), so nothing vanishes blindly. */
          setServerPosts((rows) => (rows ?? []).filter((r) => r.id !== optId));
          restoreGroupDraft(draft);
          setPostError(res?.message ? `Unable to post — ${res.message}` : 'Unable to post — please try again.');
        }
      }).catch(async () => {
        setUploadFrac(null);
        if (await verifyMaybePosted()) { salvageWin(); return; }
        setServerPosts((rows) => (rows ?? []).filter((r) => r.id !== optId));
        restoreGroupDraft(draft);
        setPostError('Unable to post — check your connection and try again.');
      });
    } else {
      /* local group — the optimistic post above IS the publish */
      haptic.success();
      setPostedPill(true);
      setTimeout(() => setPostedPill(false), 2200);
    }
  };
  /* pass 83-25 — send-button state, computed once (photo/video/YouTube/poll/audio/text) */
  const ytReady = ytOn && ytLink.trim().length > 0;
  const canSend = !!group && uploadFrac == null && (!!composer.trim() || imagesAttach.length > 0 || !!audioAttach || !!videoAttach || ytReady || (pollOn && pollOpts.filter((o) => o.trim()).length >= 2));

  /* pass 83-32 — put a failed post's content back into the composer */
  const restoreGroupDraft = (d: { text: string; imgs: typeof imagesAttach; vid: typeof videoAttach; aud: typeof audioAttach; yt: string; pollOn: boolean; poll: string[]; ytOn: boolean }) => {
    setComposer(d.text);
    setImagesAttach(d.imgs);
    setVideoAttach(d.vid);
    setAudioAttach(d.aud);
    setYtLink(d.yt);
    setYtOn(d.ytOn || !!d.yt);
    setPollOn(d.pollOn);
    setPollOpts(d.poll.length ? d.poll : ['', '']);
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
  /* pass 83-25 — the same actions against the SERVER roster (members.php):
   * per-row busy state, inline errors, roster refetch on success. */
  const refreshRoster = (sid: number) => {
    void groupGet(sid).then((row) => {
      if (!row) return;
      if (Array.isArray(row.members)) setRoster(row.members);
      setGroup((cur) => (cur ? { ...cur, memberCount: row.member_count } : cur));
    });
  };
  const setServerRole = (uid: number, role: 'admin' | 'member') => {
    const sid = group ? srvGroupId(group) : null;
    if (sid == null) return;
    haptic.success();
    setRoleMenu(null);
    setMemberBusy(uid);
    setMemberError(null);
    groupMembers(sid, 'set_role', uid, role).then((r) => {
      setMemberBusy(null);
      if (r.ok) refreshRoster(sid);
      else setMemberError(r.message ?? 'Could not change the role.');
    });
  };
  const removeServerMember = (uid: number) => {
    const sid = group ? srvGroupId(group) : null;
    if (sid == null) return;
    haptic.medium();
    setRoleMenu(null);
    setMemberBusy(uid);
    setMemberError(null);
    groupMembers(sid, 'remove', uid).then((r) => {
      setMemberBusy(null);
      if (r.ok) refreshRoster(sid);
      else setMemberError(r.message ?? 'Could not remove that member.');
    });
  };
  /* pass 83-29 — privacy denials pile up: "Cannot add @u Full Name", or with
   * more than one, "Cannot add @a, @b and @c" (owner's exact wording). */
  const [addDenials, setAddDenials] = useState<Array<{ username: string; full_name: string }>>([]);
  const addDenialsRef = useRef<Array<{ username: string; full_name: string }>>([]);
  const commitDenial = (d: { username: string; full_name: string }) => {
    const list = addDenialsRef.current.some((x) => x.username === d.username)
      ? addDenialsRef.current
      : [...addDenialsRef.current, d].sort((a, b) => a.username.localeCompare(b.username));
    addDenialsRef.current = list;
    setAddDenials([...list]);
    const names = list.map((x) => `@${x.username}`);
    setMemberError(
      list.length === 1
        ? `Cannot add ${names[0]}${list[0].full_name ? ` ${list[0].full_name}` : ''}`
        : `Cannot add ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`,
    );
  };
  const addServerMember = (uid: number) => {
    const sid = group ? srvGroupId(group) : null;
    if (sid == null) return;
    haptic.success();
    setAddBusy(uid);
    setMemberError(null);
    groupMembers(sid, 'add', uid).then((r) => {
      setAddBusy(null);
      if (r.ok) refreshRoster(sid);
      else if (r.denial) commitDenial(r.denial);
      else setMemberError(r.message ?? 'Could not add that account.');
    });
  };
  /* pass 83-25 — follow real accounts from the live roster (toggle_follow) */
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());
  const toggleServerFollow = (uid: number) => {
    haptic.light();
    const want = !followedIds.has(uid);
    setFollowedIds((s) => { const n = new Set(s); if (want) n.add(uid); else n.delete(uid); return n; });
    apiToggleFollow(uid, want).then((ok) => {
      if (!ok) setFollowedIds((s) => { const n = new Set(s); if (want) n.delete(uid); else n.add(uid); return n; });
    });
  };
  /* pass 83-25 — debounced account search while the add sheet is open */
  useEffect(() => {
    if (!addOpen || !group || srvGroupId(group) == null) return;
    const q = addQuery.trim();
    if (q.length < 2) { setAddResults(null); return; }
    setAddSearching(true);
    const t = setTimeout(() => {
      searchAccounts(q, 12).then((rows) => setAddResults(rows ?? [])).catch(() => setAddResults([])).finally(() => setAddSearching(false));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen, addQuery]);
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

  /* pass 83-25 — share the group (share.php?t=group deep-links back here) */
  const shareGroup = async () => {
    if (!group) return;
    haptic.selection();
    try {
      const sid = srvGroupId(group);
      if (sid != null) {
        await shareLink({ kind: 'group', id: sid, title: group.name, text: group.bio || group.desc });
      } else {
        await Share.share({ message: `${group.name} — join my DeenLink group!` });
      }
    } catch { /* dismissed */ }
  };
  /* pass 83-25 — post rank: the server's author_role leads (owner>admin>
   * member); the local roles map is the demo fallback. */
  const serverRank = (sp: Post): Role => {
    const ar = String((sp as { author_role?: unknown }).author_role ?? '').toLowerCase();
    if (ar === 'owner' || ar === 'admin' || ar === 'member') return ar;
    return group ? roleOf(group, sp.user?.username || '') : 'member';
  };

  const feedPosts = useMemo(() => (group ? group.posts : []), [group]);

  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: d.bg, paddingTop: insets.top + 14, paddingHorizontal: 16 }}>
        {loadDone ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <FontAwesome5 name="users-slash" size={26} color={d.faint} />
            <T v="bodyS" style={{ fontSize: 12.5, fontWeight: '700', color: d.subtext }}>Group not found</T>
            <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ borderRadius: 10, borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4 }}>
              <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: d.text }}>Go back</T>
            </Pressable>
          </View>
        ) : (
          /* pass 83-17 — skeleton breathing loader while the group opens */
          <BreathingPosts dash={d} />
        )}
      </View>
    );
  }

  const coverStyle = COVER_STYLES.find((c) => c.id === group.cover) ?? COVER_STYLES[0];
  const isMember = group.joined === 'member' || roleOf(group, ME) === 'owner' || roleOf(group, ME) === 'admin';
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
      {/* pass 83-36 — upload progress pill: BYTE-IDENTICAL to community's
       * (screen-root level, not buried in the composer where it clipped) */}
      {uploadFrac != null ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 54, alignSelf: 'center', zIndex: 60, borderRadius: 14, backgroundColor: isDark ? 'rgba(10,22,15,0.95)' : 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: d.cardBorder, paddingHorizontal: 14, paddingVertical: 10, minWidth: 190 }}>
          <T v="caption" style={{ fontSize: 10.5, fontWeight: '800', color: d.text, marginBottom: 6 }}>Posting… {Math.round(uploadFrac * 100)}%</T>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(20,36,28,0.1)' }}>
            <View style={{ height: 6, borderRadius: 3, width: `${Math.max(4, Math.round(uploadFrac * 100))}%`, backgroundColor: '#1F8F5C' }} />
          </View>
        </View>
      ) : null}
      {/* pass 83-26 — posted-success pill (auto-dismiss, community parity) */}
      {postedPill ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 54, alignSelf: 'center', zIndex: 60, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, backgroundColor: '#1F8F5C', paddingHorizontal: 16, paddingVertical: 9 }}>
          <FontAwesome5 name="check-circle" size={13} color="#fff" />
          <T v="caption" style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>Posted</T>
        </View>
      ) : null}
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
            onPress={() => goBack(router)}
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
            <View style={{ flex: 1 }} />
            {/* pass 83-25 — share the group */}
            <Pressable accessibilityLabel="share group" onPress={() => { void shareGroup(); }} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="share-alt" size={13} color={d.subtext} />
            </Pressable>
            {/* pass 83-26 — invite friends in-app: lands in their inbox, taps back here */}
            <Pressable accessibilityLabel="invite friends" onPress={() => { haptic.selection(); setInviteOpen(true); }} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: d.card, borderWidth: 1, borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome5 name="user-plus" size={13} color={d.subtext} />
            </Pressable>
            <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(3,7,5,0.62)', justifyContent: 'flex-end' }}>
                <Pressable onPress={() => setInviteOpen(false)} style={{ flex: 1 }} />
                <View style={{ backgroundColor: d.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: d.cardBorder, paddingTop: 14, paddingBottom: 30, paddingHorizontal: 14, maxHeight: '78%' }}>
                  <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 42, height: 4.5, borderRadius: 3, backgroundColor: d.cardBorder }} />
                  </View>
                  <FriendsPicker share={{ kind: 'group', title: group.name, sub: `${group.memberCount.toLocaleString()} members${group.bio ? ` · ${group.bio.slice(0, 60)}` : ''}`, route: `/tools/group?id=${group.id}` }} onDone={() => setTimeout(() => setInviteOpen(false), 1400)} />
                </View>
              </View>
            </Modal>
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
              disabled={joinBusy}
              style={{ flex: canManage ? 0.6 : 1, borderRadius: 14, backgroundColor: group.joined ? 'transparent' : (canManage ? 'rgba(212,175,55,0.12)' : isDark ? '#2ECC71' : '#1D6F42'), borderWidth: group.joined || canManage ? 1 : 0, borderColor: group.joined ? d.cardBorder : 'rgba(212,175,55,0.5)', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, minHeight: 48, opacity: joinBusy ? 0.6 : 1 }}
            >
              {joinBusy ? (
                <ActivityIndicator size="small" color={group.joined ? d.subtext : canManage ? '#E8C96A' : '#fff'} />
              ) : (
                <T v="button" style={{ fontWeight: '800', fontSize: 13, color: group.joined ? d.subtext : canManage ? '#E8C96A' : '#fff' }}>
                  {group.joined === 'member' ? 'Leave' : group.joined === 'requested' ? 'Cancel request' : group.open ? 'Join group' : 'Request to join'}
                </T>
              )}
            </Pressable>
          </View>
          {memberError ? (
            <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: '#E74C3C', marginTop: 8 }}>{memberError}</T>
          ) : null}
        </View>

        {/* ── tabs ── */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16 }}>
          {([
            { id: 'posts' as Tab, label: 'Posts', icon: 'th-large', n: group.posts.length },
            { id: 'members' as Tab, label: 'Members', icon: 'users', n: roster?.length ?? group.members.length },
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
            {/* pass 83-28 — admin join-request queue (accept / reject) */}
            {canManage && joinReqs && joinReqs.length > 0 ? (
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.4)' : 'rgba(140,109,31,0.35)', backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.07)', padding: 12, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <FontAwesome5 name="user-clock" size={13} color={isDark ? '#E8C96A' : '#8C6D1F'} />
                  <T v="bodyS" style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: isDark ? '#E8C96A' : '#8C6D1F' }}>
                    Join requests · {joinReqs.length}
                  </T>
                </View>
                {joinReqs.map((rq) => (
                  <View key={rq.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <AvatarImage source={rq.profile_image_url ?? null} name={rq.full_name} size={38} tint={d.bgSoft} border={d.cardBorder} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="bodyS" numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: d.text }}>{rq.full_name}</T>
                      <T v="caption" numberOfLines={1} style={{ fontSize: 10.5, color: d.faint }}>@{rq.username}</T>
                    </View>
                    <Pressable
                      onPress={() => {
                        if (reqBusy != null) return;
                        const sid = group ? srvGroupId(group) : null;
                        if (sid == null) return;
                        setReqBusy(rq.id);
                        void groupJoinDecide(sid, rq.id, true).then((r) => {
                          setReqBusy(null);
                          if (r.ok) {
                            setJoinReqs((cur) => (cur ?? []).filter((x) => x.id !== rq.id));
                            setRoster(null);
                            void groupGet(sid).then((row) => { if (row) { setGroup((cur) => (cur ? { ...cur, memberCount: row.member_count } : cur)); if (Array.isArray(row.members)) setRoster(row.members); } });
                          } else {
                            setMemberError(r.message ?? 'Could not approve.');
                          }
                        });
                      }}
                      disabled={reqBusy != null}
                      style={{ borderRadius: 10, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', paddingHorizontal: 14, paddingVertical: 8, opacity: reqBusy === rq.id ? 0.6 : 1 }}
                    >
                      <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{reqBusy === rq.id ? '…' : 'Accept'}</T>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (reqBusy != null) return;
                        const sid = group ? srvGroupId(group) : null;
                        if (sid == null) return;
                        setReqBusy(rq.id);
                        void groupJoinDecide(sid, rq.id, false).then((r) => {
                          setReqBusy(null);
                          if (r.ok) setJoinReqs((cur) => (cur ?? []).filter((x) => x.id !== rq.id));
                          else setMemberError(r.message ?? 'Could not decline.');
                        });
                      }}
                      disabled={reqBusy != null}
                      style={{ borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,123,123,0.5)' : 'rgba(207,58,58,0.45)', paddingHorizontal: 14, paddingVertical: 8, opacity: reqBusy === rq.id ? 0.6 : 1 }}
                    >
                      <T v="caption" style={{ fontSize: 11, fontWeight: '800', color: '#FF7B7B' }}>Decline</T>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {/* pass 83-28 — posts fetch failed: say so, offer a retry (the
             * skeleton used to breathe forever when this endpoint failed) */}
            {postsError && serverPosts == null ? (
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 26, alignItems: 'center', gap: 10 }}>
                <FontAwesome5 name="wifi" size={20} color={d.faint} />
                <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center' }}>
                  Couldn't load this group's posts — check your connection.
                </T>
                <Pressable
                  onPress={() => { const sid = group ? srvGroupId(group) : null; if (sid != null) loadServerPosts(sid); }}
                  style={{ borderRadius: 10, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', paddingHorizontal: 18, paddingVertical: 9 }}
                >
                  <T v="caption" style={{ fontSize: 11.5, fontWeight: '800', color: '#fff' }}>Try again</T>
                </Pressable>
              </View>
            ) : null}
            {isMember ? (
              /* pass 83-28 — the composer used to cram the textfield and six
               * icon buttons into ONE row (owner: "increase it a bit giving
               * the icons place to breath and the textfield will have its
               * full space"). Text on top, tools row underneath. */
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, paddingLeft: 14, paddingRight: 12, paddingTop: 12, paddingBottom: 10, gap: 8 }}>
                <TextInput
                  value={composer}
                  onChangeText={setComposer}
                  placeholder={`Post to ${group.name}…`}
                  placeholderTextColor={d.faint}
                  multiline
                  style={{ fontSize: 16, fontFamily: 'Poppins-Regular', color: d.text, minHeight: 72, maxHeight: 140, textAlignVertical: 'top', paddingBottom: 4 }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Pressable onPress={() => { void pickImage(); }} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: imagesAttach.length ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.08)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(29,111,66,0.05)'), alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="image" size={14} color={imagesAttach.length ? (isDark ? '#4AE38F' : '#0E7A46') : d.faint} />
                  </Pressable>
                  {/* pass 83-10b — poll builder toggle */}
                  <Pressable onPress={() => { haptic.selection(); setPollOn((v) => !v); }} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: pollOn ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.08)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(29,111,66,0.05)'), alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="poll-h" size={14} color={pollOn ? (isDark ? '#4AE38F' : '#0E7A46') : d.faint} />
                  </Pressable>
                  {/* pass 83-10c — audio file picker */}
                  <Pressable onPress={() => { void pickAudio(); }} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: audioAttach ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.08)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(29,111,66,0.05)'), alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="music" size={13} color={audioAttach ? (isDark ? '#4AE38F' : '#0E7A46') : d.faint} />
                  </Pressable>
                  {/* pass 83-25 — local video picker (admin toggle) */}
                  {videoAllowed ? (
                  <Pressable onPress={() => { void pickVideo(); }} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: videoAttach ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.08)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(29,111,66,0.05)'), alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="video" size={13} color={videoAttach ? (isDark ? '#4AE38F' : '#0E7A46') : d.faint} />
                  </Pressable>
                  ) : null}
                  {/* pass 83-25 — YouTube link toggle */}
                  <Pressable onPress={() => { haptic.selection(); setYtOn((v) => !v); }} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: ytOn ? (isDark ? 'rgba(46,204,113,0.16)' : 'rgba(14,122,70,0.08)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(29,111,66,0.05)'), alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="youtube" size={14} color={ytOn ? (isDark ? '#4AE38F' : '#0E7A46') : d.faint} />
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={post} disabled={!canSend} style={{ width: 44, height: 40, borderRadius: 12, backgroundColor: canSend ? (isDark ? '#2ECC71' : '#1D6F42') : d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                    {uploadFrac != null ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <FontAwesome5 name="paper-plane" size={13} color={canSend ? '#fff' : d.faint} />
                    )}
                  </Pressable>
                </View>
                {imagesAttach.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ alignSelf: 'stretch', marginTop: 6, marginBottom: 2 }} contentContainerStyle={{ gap: 7, paddingTop: 6, paddingRight: 6 }}>
                    {imagesAttach.map((m, i) => (
                      <View key={`${m.uri}-${i}`} style={{ position: 'relative' }}>
                        <ExpoImage source={{ uri: m.uri }} style={{ width: 52, height: 52, borderRadius: 10, borderWidth: 1, borderColor: d.cardBorder }} contentFit="cover" />
                        <Pressable onPress={() => setImagesAttach((cur) => cur.filter((_, j) => j !== i))} hitSlop={6} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesome5 name="times" size={9} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                    {imagesAttach.length < 5 ? (
                      <Pressable onPress={() => { void pickImage(); }} style={{ width: 52, height: 52, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: d.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome5 name="plus" size={13} color={d.faint} />
                      </Pressable>
                    ) : null}
                  </ScrollView>
                ) : null}
                {videoAttach ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', marginTop: 6, marginBottom: 2, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', backgroundColor: isDark ? 'rgba(46,204,113,0.10)' : 'rgba(14,122,70,0.05)', paddingHorizontal: 8, paddingVertical: 6 }}>
                    <FontAwesome5 name="video" size={12} color={isDark ? '#4AE38F' : '#0E7A46'} />
                    <T v="caption" style={{ flex: 1, fontSize: 10.5, fontWeight: '700', color: d.subtext }} numberOfLines={1}>{videoAttach.name}</T>
                    <Pressable onPress={() => setVideoAttach(null)} hitSlop={8}>
                      <FontAwesome5 name="times" size={11} color={d.faint} />
                    </Pressable>
                  </View>
                ) : null}
                {/* pass 83-10b — poll option editor */}
                {pollOn ? (
                  <View style={{ alignSelf: 'stretch', marginTop: 6, gap: 6 }}>
                    {pollOpts.map((o, i) => (
                      <View key={`po-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TextInput
                          value={o}
                          onChangeText={(v) => setPollOpts((cur) => cur.map((x, j) => (j === i ? v : x)))}
                          placeholder={`Option ${i + 1}`}
                          placeholderTextColor={d.faint}
                          maxLength={60}
                          style={{ flex: 1, fontSize: 13.5, fontFamily: 'Poppins-Regular', color: d.text, borderWidth: 1, borderColor: d.cardBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}
                        />
                        {pollOpts.length > 2 ? (
                          <Pressable onPress={() => setPollOpts((cur) => cur.filter((_, j) => j !== i))} hitSlop={8} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(207,58,58,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                            <FontAwesome5 name="times" size={10} color="#cf3a3a" />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                    {pollOpts.length < 6 ? (
                      <Pressable onPress={() => setPollOpts((cur) => [...cur, ''])} hitSlop={6}>
                        <T v="caption" style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#4AE38F' : '#0E7A46' }}>+ Add option</T>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {/* pass 83-10c — attached audio chip */}
                {audioAttach ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', marginTop: 6, marginBottom: 2, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(74,227,143,0.35)' : 'rgba(29,111,66,0.25)', backgroundColor: isDark ? 'rgba(46,204,113,0.10)' : 'rgba(14,122,70,0.05)', paddingHorizontal: 8, paddingVertical: 6 }}>
                    <FontAwesome5 name="music" size={12} color={isDark ? '#4AE38F' : '#0E7A46'} />
                    <T v="caption" style={{ flex: 1, fontSize: 10.5, fontWeight: '700', color: d.subtext }} numberOfLines={1}>{audioAttach.name}</T>
                    <Pressable onPress={() => setAudioAttach(null)} hitSlop={8}>
                      <FontAwesome5 name="times" size={11} color={d.faint} />
                    </Pressable>
                  </View>
                ) : null}
                {ytOn ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', marginTop: 6, borderRadius: 10, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff', paddingHorizontal: 10, paddingVertical: 4 }}>
                    <FontAwesome5 name="youtube" size={13} color="#E53E3E" />
                    <TextInput
                      value={ytLink}
                      onChangeText={(v) => { setYtLink(v); if (v.trim()) { setImagesAttach([]); setVideoAttach(null); } }}
                      placeholder="Paste a YouTube link…"
                      placeholderTextColor={d.faint}
                      autoCapitalize="none"
                      keyboardType="url"
                      style={{ flex: 1, fontSize: 13.5, fontFamily: 'Poppins-Regular', color: d.text, paddingVertical: 7 }}
                    />
                    {ytLink ? (
                      <Pressable onPress={() => setYtLink('')} hitSlop={8}>
                        <FontAwesome5 name="times" size={11} color={d.faint} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {postError ? (
                  <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: '#E74C3C', marginTop: 4 }}>{postError}</T>
                ) : null}
                {Platform.OS === 'web' ? (
                  <input
                    ref={imageFileRef as never}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e: unknown) => {
                      const files = Array.from((e as React.ChangeEvent<HTMLInputElement>).target.files ?? []).slice(0, 5);
                      (e as React.ChangeEvent<HTMLInputElement>).target.value = '';
                      if (files.length) {
                        setPostError(null);
                        setVideoAttach(null);
                        setYtLink('');
                        setImagesAttach((cur) => [...cur, ...files.map((f) => ({ uri: URL.createObjectURL(f), name: f.name }))].slice(0, 5));
                      }
                    }}
                  />
                ) : null}
                {Platform.OS === 'web' ? (
                  <input
                    ref={audioFileRef as never}
                    type="file"
                    accept="audio/*"
                    style={{ display: 'none' }}
                    onChange={(e: unknown) => {
                      const file = (e as React.ChangeEvent<HTMLInputElement>).target.files?.[0];
                      (e as React.ChangeEvent<HTMLInputElement>).target.value = '';
                      if (!file) return;
                      const err = validateAudio(file.name, file.size);
                      if (err) { setPostError(err); return; }
                      setPostError(null);
                      setAudioAttach({ uri: URL.createObjectURL(file), name: file.name, type: file.type });
                    }}
                  />
                ) : null}
                {Platform.OS === 'web' ? (
                  <input
                    ref={videoFileRef as never}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={(e: unknown) => {
                      const file = (e as React.ChangeEvent<HTMLInputElement>).target.files?.[0];
                      (e as React.ChangeEvent<HTMLInputElement>).target.value = '';
                      if (!file) return;
                      const err = validateVideo(file.name, file.size);
                      if (err) { setPostError(err); return; }
                      setPostError(null);
                      setImagesAttach([]);
                      setYtLink('');
                      setVideoAttach({ uri: URL.createObjectURL(file), name: file.name, type: file.type });
                    }}
                  />
                ) : null}
              </View>
            ) : null}

            {(serverPosts === null ? false : serverPosts ? serverPosts.length === 0 : feedPosts.length === 0) ? (
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 26, alignItems: 'center', gap: 8 }}>
                <FontAwesome5 name="comments" size={20} color={d.faint} />
                <T v="bodyS" style={{ color: d.subtext, fontSize: 12.5, textAlign: 'center' }}>
                  No posts yet{isMember ? ' — be the first to post!' : ' — join the group to start the conversation.'}
                </T>
              </View>
            ) : serverPosts === null ? (
              <BreathingPosts dash={d} />
            ) : (
              serverPosts
                ? serverPosts.map((sp) => (
                    <FeedCard
                      key={`srv-${sp.id}`}
                      dash={d}
                      post={sp}
                      group={{ name: group.name, cat: group.cat, avatar: group.avatar, catIcon: catIcon(group.cat) }}
                      rank={serverRank(sp)}
                      /* pass 83-36 — already INSIDE the group: tapping the group
                       * name on a post must not re-navigate into the group */
                      onComments={(pp) => setCommentPost(pp)}
                      onOpenReels={(pp) => router.push({ pathname: '/videos', params: { start: String(pp.id) } } as never)}
                      /* pass 83-14 — authors delete their own posts; the group
                       * owner/admin can delete any (the server double-checks) */
                      onDelete={((sp.user?.id != null && user?.id != null && String(sp.user.id) === String(user.id)) || (sp.user?.username && user?.username && sp.user.username === user.username)) || canManage ? () => {
                        void groupDeletePost(sp.id).then((ok) => {
                          if (ok) {
                            setServerPosts((rows) => (rows ?? []).filter((x) => x.id !== sp.id));
                            setGroup((cur) => (cur ? { ...cur, posts: cur.posts.filter((x) => x.id !== `sp${sp.id}`) } : cur));
                          } else {
                            Alert.alert('Could not delete', 'You may not have permission to delete this post.');
                          }
                        });
                      } : undefined}
                    />
                  ))
                : feedPosts.map((p) => {
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
                    onComments={(pp) => setCommentPost(pp)}
                    /* pass 83-35 — expand → the VIDEOS page (reels view) */
                    onOpenReels={(pp) => router.push({ pathname: '/videos', params: { start: String(pp.id) } } as never)}
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
              {(roster ? roster.slice(0, 5).map((m) => ({ key: `r${m.id}`, label: (m.full_name || m.username || '?').slice(0, 1) })) : group.members.slice(0, 5).map((m, i) => ({ key: `${m}${i}`, label: m.slice(0, 1) }))).map((a, i) => (
                <View key={a.key} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(212,175,55,0.16)', borderWidth: 2, borderColor: d.card, alignItems: 'center', justifyContent: 'center', marginLeft: i ? -9 : 0 }}>
                  <T v="caption" style={{ fontWeight: '800', fontSize: 11, color: '#E8C96A' }}>{a.label}</T>
                </View>
              ))}
              <T v="caption" style={{ fontSize: 10, color: d.faint, marginLeft: 10, flex: 1 }}>{group.memberCount.toLocaleString()} people are in this group</T>
              {canManage ? (
                <Pressable
                  accessibilityLabel="add members"
                  onPress={() => { haptic.selection(); addDenialsRef.current = []; setAddDenials([]); setMemberError(null); setAddOpen(true); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, backgroundColor: isDark ? '#2ECC71' : '#1D6F42', paddingHorizontal: 10, paddingVertical: 7 }}
                >
                  <FontAwesome5 name="user-plus" size={9} color="#fff" />
                  <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Add</T>
                </Pressable>
              ) : null}
            </View>
            {memberError ? (
              <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: '#E74C3C', marginBottom: 10 }}>{memberError}</T>
            ) : null}
            {/* pass 83-25 — the LIVE roster: real members, roles, follow, manage */}
            {roster ? roster.map((rm) => {
              const rRole = (['owner', 'admin', 'member'].includes(String(rm.role)) ? rm.role : 'member') as Role;
              const label = rm.full_name || rm.username || 'Member';
              const menuKey = `srv${rm.id}`;
              const busy = memberBusy === rm.id;
              const isSelf = user?.id != null && rm.id === user.id;
              const following = followedIds.has(rm.id);
              return (
                <View key={menuKey} style={{ borderRadius: 14, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.card, padding: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(140,109,31,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {rm.profile_image_url ? (
                        <ExpoImage source={{ uri: rm.profile_image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      ) : (
                        <T v="caption" style={{ fontWeight: '800', fontSize: 13, color: '#E8C96A' }}>{label.slice(0, 1)}</T>
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text, flexShrink: 1 }} numberOfLines={1}>{label}{isSelf ? ' (You)' : ''}</T>
                        <Badge role={rRole} />
                      </View>
                      <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 2 }}>@{rm.username}</T>
                    </View>
                    {!isSelf ? (
                      <Pressable
                        accessibilityLabel={following ? `unfollow ${label}` : `follow ${label}`}
                        onPress={() => toggleServerFollow(rm.id)}
                        style={{ borderRadius: 10, borderWidth: 1, borderColor: following ? d.cardBorder : isDark ? 'rgba(74,227,143,0.4)' : 'rgba(29,111,66,0.3)', backgroundColor: following ? 'transparent' : isDark ? 'rgba(46,204,113,0.12)' : 'rgba(29,111,66,0.06)', paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                      >
                        <FontAwesome5 name={following ? 'user-check' : 'user-plus'} size={9} color={following ? d.subtext : isDark ? '#4AE38F' : '#1D6F42'} />
                        <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: following ? d.subtext : isDark ? '#4AE38F' : '#1D6F42' }}>{following ? 'Following' : 'Follow'}</T>
                      </Pressable>
                    ) : null}
                    {canManage && !isSelf && rRole !== 'owner' ? (
                      <Pressable onPress={() => { haptic.selection(); setRoleMenu(roleMenu === menuKey ? null : menuKey); }} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: d.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                        {busy ? <ActivityIndicator size="small" color={d.subtext} /> : <T v="caption" style={{ color: d.subtext, fontSize: 14, fontWeight: '700' }}>•••</T>}
                      </Pressable>
                    ) : null}
                  </View>
                  {roleMenu === menuKey ? (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: d.cardBorder, gap: 7 }}>
                      {isOwner ? (
                        <Pressable onPress={() => setServerRole(rm.id, rRole === 'admin' ? 'member' : 'admin')} disabled={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(47,164,107,0.4)', backgroundColor: 'rgba(47,164,107,0.07)', paddingHorizontal: 11, paddingVertical: 9, opacity: busy ? 0.5 : 1 }}>
                          <FontAwesome5 name={rRole === 'admin' ? 'arrow-down' : 'shield-alt'} size={11} color="#2FA46B" />
                          <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: '#2FA46B' }}>{rRole === 'admin' ? 'Remove admin role' : 'Make admin'}</T>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => removeServerMember(rm.id)} disabled={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(229,62,62,0.35)', backgroundColor: 'rgba(229,62,62,0.05)', paddingHorizontal: 11, paddingVertical: 9, opacity: busy ? 0.5 : 1 }}>
                        <FontAwesome5 name="user-minus" size={11} color="#E53E3E" />
                        <T v="bodyS" style={{ fontSize: 12, fontWeight: '800', color: '#E53E3E' }}>Remove from group</T>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            }) : group.members.map((m, i) => {
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
              {srvGroupId(group) != null ? (
                <>
                  <T v="caption" style={{ fontSize: 10, color: d.faint, marginBottom: 10 }}>Search DeenLink accounts by name or username</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 12 }}>
                    <FontAwesome5 name="search" size={11} color={d.faint} />
                    <TextInput value={addQuery} onChangeText={setAddQuery} placeholder="Type at least 2 letters…" placeholderTextColor={d.faint} maxLength={40} style={{ flex: 1, fontSize: 16, fontFamily: 'Poppins-Regular', color: d.text, paddingVertical: 0 }} />
                    {addSearching ? <ActivityIndicator size="small" color={d.faint} /> : addQuery ? (
                      <Pressable onPress={() => setAddQuery('')} hitSlop={8}><FontAwesome5 name="times-circle" size={13} color={d.faint} /></Pressable>
                    ) : null}
                  </View>
                  {memberError ? (
                    <T v="caption" style={{ fontSize: 10.5, fontWeight: '700', color: '#E74C3C', marginBottom: 10 }}>{memberError}</T>
                  ) : null}
                  {(addResults ?? []).map((a) => {
                    const inGroup = (roster ?? []).some((m) => m.id === a.id);
                    const busy = addBusy === a.id;
                    const denied = addDenials.some((x) => x.username === a.username);
                    return (
                      <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 13, borderWidth: 1, borderColor: d.cardBorder, backgroundColor: d.bg, padding: 11, marginBottom: 8 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(91,200,245,0.12)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {a.profile_image_url ? (
                            <ExpoImage source={{ uri: a.profile_image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                          ) : (
                            <T v="caption" style={{ fontWeight: '800', fontSize: 13, color: '#5BC8F5' }}>{(a.full_name || a.username || '?').slice(0, 1)}</T>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <T v="bodyS" style={{ fontWeight: '800', fontSize: 12.5, color: d.text }}>{a.full_name || a.username}</T>
                          <T v="caption" style={{ fontSize: 9.5, color: d.faint, marginTop: 1 }}>@{a.username}</T>
                        </View>
                        <Pressable onPress={() => addServerMember(a.id)} disabled={inGroup || busy || denied} style={{ borderRadius: 10, backgroundColor: inGroup || denied ? d.bgSoft : isDark ? '#2ECC71' : '#1D6F42', paddingHorizontal: 13, paddingVertical: 7, minWidth: 64, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                          {busy ? <ActivityIndicator size="small" color="#fff" /> : (
                            <T v="caption" style={{ fontSize: 10, fontWeight: '800', color: inGroup || denied ? d.faint : '#fff' }}>{denied ? "Can't add" : inGroup ? 'Added' : '+ Add'}</T>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                  {addResults && !addSearching && addResults.length === 0 ? (
                    <T v="caption" style={{ fontSize: 11, color: d.faint, textAlign: 'center', marginTop: 6 }}>No accounts match “{addQuery.trim()}”.</T>
                  ) : null}
                </>
              ) : (
                <>
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
                </>
              )}
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

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
export default function GroupScreen() {
  const guest = useIsGuest();
  if (guest) return <LoginRequired module="Groups" />;
  return <GroupScreenInner />;
}
