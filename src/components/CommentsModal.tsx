import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Alert } from '../lib/alert';
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import type { Post } from "@/api/types";
import type { SampleComment } from "@/api/mocks";
import * as api from "@/api/client";
import { videosCommentDelete as videosCommentDeleteApi } from "@/api/client";
import {
  NAV_LABELS,
  SYSTEM_PROMPT,
  composeLocalAnswer,
  detectProvider,
  getApiKey,
  getModel,
  navAnswer,
  retrieveLocal,
  streamLLM,
} from "@/lib/ai";
import { T } from "@/components/T";
import { VerificationBadge } from "@/components/VerificationBadge";
import { AvatarImage } from "@/components/FeedCard";
import { HeartIcon } from "@/components/Icons";
import { haptic } from "@/lib/haptics";
import { useRouter } from "expo-router";
/* pass 66-night — live comments: the sheet reads/writes the server thread when
 * the session is real. Server reply ids are namespaced (+1e9) so they can never
 * collide with comment ids in the shared liked-map. */
import {
  addComment as srvAddComment,
  addReply as srvAddReply,
  getComments,
  isLive,
  saveAiCommentReply,
  toggleCommentLike,
  toggleReplyLike,
  videosCommentAdd,
  videosCommentLike,
  videosComments,
  type ServerComment,
  type ServerReply,
} from "@/api/client";
import { useAuth } from "@/context/AuthContext";
const REPLY_OFF = 1_000_000_000;
/* The visible name is “@DeenLink AI”; accept that spelling as well as the
 * compact handle inserted by the picker.  The old regex only accepted
 * @deenlinkai, so a user typing the displayed name got no answer. */
const AI_MENTION_RE = /@deenlink\s*ai\b|@deenlinkai\b|@ai\b/i;
const hasAiMention = (text: string): boolean => AI_MENTION_RE.test(text);
const withoutAiMention = (text: string): string =>
  text.replace(AI_MENTION_RE, "").replace(/\s{2,}/g, " ").trim();

/* pass 83-38 — no demo persona */
const ME = { name: "You", handle: "me" };

/* ﷺ (sallallahu alayhi wasallam ligature U+FDFA) and Subhanahu wa ta'ala lead the picker. */
const EMOJIS = [
  "ﷺ",
  "سُبْحَانَهُ وَتَعَالَى",
  "😄",
  "😅",
  "🥹",
  "😍",
  "🤲",
  "🕌",
  "✨",
  "🤍",
  "📖",
  "🌙",
  "🔥",
  "🕋",
];

/** Renders @mentions in comment text as colored + bold (IG-style). */
/** pass 41 — [Quran 2:255] / [Bukhari · #12] / [Dua · …] references in AI
 * replies become TAPPABLE deeplinks to the in-app source (when we have one). */
function refRoute(ref: string): string | null {
  const r = ref.trim();
  if (/^quran/i.test(r)) {
    const m = r.match(/(\d+)/);
    return m ? `/read/${m[1]}` : null;
  }
  if (/^dua/i.test(r)) return "/tools/dua";
  return "/tools/hadith";
}

function MentionText({
  text,
  base,
  mention,
}: {
  text: string;
  base: object;
  mention: object;
}) {
  const router = useRouter();
  const parts = text.split(
    /(@[A-Za-z0-9_]+|\[(?:Quran\s+\d+|Bukhari|Muslim|Abu Dawud|Tirmidhi|Nasa['\u2019]?i|Ibn Majah|Dua)[^\]]*\])/g,
  );
  return (
    <T v="bodyS" style={base as object}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          return (
            <T key={i} style={mention as object}>
              {part}
            </T>
          );
        }
        if (part.startsWith("[")) {
          const rt = refRoute(part.slice(1, -1));
          return (
            <T
              key={i}
              v="bodyS"
              style={{
                color: "#D4AF37",
                fontWeight: "800",
                textDecorationLine: rt ? "underline" : "none",
              }}
              onPress={rt ? () => router.push(rt as never) : undefined}
            >
              {part}
            </T>
          );
        }
        return <T key={i}>{part}</T>;
      })}
    </T>
  );
}

/* pass 42 — tappable "Open <place>" chip rendered under AI comment answers.
 * Navigating away must also dismiss the comments sheet (it stayed up before). */
function NavChip({ route, onClose }: { route: string; onClose?: () => void }) {
  const router = useRouter();
  const label =
    NAV_LABELS[route.replace(/^\/+/, "/")] ??
    NAV_LABELS["/" + route.replace(/^\/+/, "")] ??
    "Open in the app";
  return (
    <Pressable
      accessibilityLabel={`open ${label}`}
      onPress={() => {
        haptic.medium();
        onClose?.();
        setTimeout(() => router.push(route as never), 140);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        marginTop: 7,
        borderRadius: 11,
        backgroundColor: "rgba(46,204,113,0.12)",
        borderWidth: 1,
        borderColor: "rgba(74,227,143,0.4)",
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <FontAwesome5 name="location-arrow" size={9} color="#4AE38F" />
      <T
        v="caption"
        style={{ fontSize: 10, fontWeight: "800", color: "#4AE38F" }}
      >
        Open {label}
      </T>
    </Pressable>
  );
}

/* Three-dot typing animation shown while DeenLink AI composes its reply. */
function TypingDots({ color }: { color: string }) {
  const v0 = useRef(new Animated.Value(0.3)).current;
  const v1 = useRef(new Animated.Value(0.3)).current;
  const v2 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.delay(520 - delay),
        ]),
      );
    const loops = [mk(v0, 0), mk(v1, 160), mk(v2, 320)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [v0, v1, v2]);
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 5,
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 4,
      }}
    >
      {[v0, v1, v2].map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: color,
            opacity: v,
            transform: [{ scale: v }],
          }}
        />
      ))}
    </View>
  );
}

/**
 * Comment row — MODULE-LEVEL on purpose: defining it inside the modal
 * component remounted every row (and glitched the avatars) on each like tap.
 */
function CommentRow({
  c,
  isReply = false,
  replyTo,
  isLiked,
  onToggleLike,
  onReply,
  onToggleReplies,
  repliesOpen,
  onOpenProfile,
  onClose,
  onReport,
  canReport,
  reportedIds,
  reportingIds,
  onDelete,
  canDelete,
  highlightId,
  colors,
}: {
  c: SampleComment;
  /** pass 55 — TikTok-style: nested replies show who they answer, above the name. */
  replyTo?: string;
  isReply?: boolean;
  isLiked: (id: number) => boolean;
  onToggleLike: (id: number) => void;
  onReply: (c: SampleComment) => void;
  onToggleReplies: (id: number) => void;
  repliesOpen: boolean;
  onOpenProfile: (handle: string) => void;
  onClose?: () => void;
  onReport: (c: SampleComment) => void;
  canReport: (c: SampleComment) => boolean;
  reportedIds: Set<number>;
  reportingIds: Set<number>;
  /* pass 97 — the author (or the post owner) can delete a comment */
  onDelete?: (c: SampleComment) => void;
  canDelete?: (c: SampleComment) => boolean;
  highlightId?: number | null;
  colors: {
    txt: string;
    sub: string;
    faint: string;
    hairline: string;
    bubble: string;
    emerald: string;
    isDark: boolean;
  };
}) {
  const cImg = c.avatar != null ? c.avatar : null;
  const cName = c.name ?? c.handle;
  const isAI = !!c.isAI || c.handle.toLowerCase() === "deenlinkai";
  const rowLiked = isLiked(c.id);
  const likeCount = (c.likes ?? 0) + (rowLiked && !c.liked ? 1 : 0);
  const nReplies = c.replies?.length ?? 0;
  return (
    <View style={{ flexDirection: "row", gap: 9, marginTop: isReply ? 8 : 14 }}>
      {/* only the avatar + name open a profile — the comment body never does */}
      <Pressable
        onPress={() => onOpenProfile(c.handle)}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {isAI ? (
          <View
            style={{
              width: isReply ? 27 : 32,
              height: isReply ? 27 : 32,
              borderRadius: isReply ? 9 : 11,
              backgroundColor: "rgba(212,175,55,0.16)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(212,175,55,0.4)",
            }}
          >
            <FontAwesome5 name="robot" size={isReply ? 11 : 13} color="#D4AF37" />
          </View>
        ) : (
          <AvatarImage
            source={cImg}
            name={cName}
            size={isReply ? 27 : 32}
            tint={
              colors.isDark ? "rgba(255,255,255,0.08)" : "rgba(20,36,28,0.08)"
            }
            border={colors.hairline}
          />
        )}
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            borderRadius: 13,
            backgroundColor:
              highlightId === c.id
                ? colors.isDark
                  ? "rgba(74,227,143,0.18)"
                  : "rgba(14,122,70,0.12)"
                : colors.bubble,
            borderWidth: highlightId === c.id ? 1.5 : 0,
            borderColor: colors.emerald,
            paddingHorizontal: 11,
            paddingVertical: 7,
          }}
        >
          {isReply && replyTo ? (
            <T
              v="caption"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontSize: 9.5,
                fontWeight: "800",
                letterSpacing: 0.2,
                color: colors.emerald,
                marginBottom: 2,
              }}
            >
              replying to › {replyTo}
            </T>
          ) : null}
          <Pressable
            onPress={() => onOpenProfile(c.handle)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              alignSelf: "flex-start",
            }}
          >
            <T
              v="caption"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontWeight: "700",
                fontSize: 11,
                color: colors.txt,
                flexShrink: 1,
              }}
            >
              {cName}
            </T>
            {c.badge ? <VerificationBadge type={c.badge} size={11} /> : null}
          </Pressable>
          {c.text ? (
            <MentionText
              text={c.text}
              base={{
                fontSize: 12.5,
                lineHeight: 17.5,
                color: colors.txt,
                marginTop: 2,
              }}
              mention={{
                fontSize: 12.5,
                fontWeight: "800",
                color: colors.emerald,
              }}
            />
          ) : null}
          {/* pass 42 — AI answers get a DIRECT open button for the place it described */}
          {c.nav ? <NavChip route={c.nav} onClose={onClose} /> : null}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginTop: 5,
          }}
        >
          <T
            v="caption"
            style={{ fontSize: 9.5, color: colors.faint, fontWeight: "600" }}
          >
            {c.time}
          </T>
          {!isAI ? (
            <Pressable
              hitSlop={6}
              onPress={() => {
                haptic.light();
                onToggleLike(c.id);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <HeartIcon
                size={11}
                filled={rowLiked}
                color={rowLiked ? "#E74C3C" : colors.faint}
              />
              {likeCount > 0 ? (
                <T
                  v="caption"
                  style={{
                    fontSize: 9.5,
                    color: rowLiked ? "#E74C3C" : colors.faint,
                    fontWeight: "700",
                  }}
                >
                  {likeCount}
                </T>
              ) : null}
            </Pressable>
          ) : null}
          {!isAI ? (
            <Pressable hitSlop={6} onPress={() => onReply(c)}>
              <T
                v="caption"
                style={{ fontSize: 9.5, color: colors.sub, fontWeight: "700" }}
              >
                Reply
              </T>
            </Pressable>
          ) : null}
          {/* Never offer a report action on the signed-in user's own row. */}
          {!isAI && canReport(c) ? <Pressable
            hitSlop={8}
            onPress={() => { if (!reportedIds.has(c.id) && !reportingIds.has(c.id)) onReport(c); }}
            accessibilityLabel={reportedIds.has(c.id) ? "Comment reported" : "Report comment"}
            disabled={reportedIds.has(c.id) || reportingIds.has(c.id)}
          >
            {reportingIds.has(c.id) ? <ActivityIndicator size="small" color="#E8C96A" /> : <FontAwesome5 name={reportedIds.has(c.id) ? "check" : "flag"} size={9} color={reportedIds.has(c.id) ? colors.emerald : "#E74C3C"} />}
          </Pressable> : null}
          {/* pass 97 — delete your own comment (or any comment on your post).
              The endpoint existed; the app simply never offered it. */}
          {!isAI && onDelete && canDelete?.(c) ? (
            <Pressable
              hitSlop={8}
              onPress={() => onDelete(c)}
              accessibilityLabel="Delete comment"
            >
              <FontAwesome5 name="trash-alt" size={9} color={colors.faint} />
            </Pressable>
          ) : null}
          {nReplies > 0 ? (
            <Pressable
              hitSlop={6}
              onPress={() => onToggleReplies(c.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
            >
              <T
                v="caption"
                style={{
                  fontSize: 9.5,
                  color: colors.emerald,
                  fontWeight: "700",
                }}
              >
                {repliesOpen
                  ? "Hide replies"
                  : `View ${nReplies} ${nReplies === 1 ? "reply" : "replies"}`}
              </T>
              <FontAwesome5
                name={repliesOpen ? "chevron-up" : "chevron-down"}
                size={8}
                color={colors.emerald}
              />
            </Pressable>
          ) : null}
        </View>
        {nReplies > 0 && repliesOpen ? (
          // thread rail — a single soft emerald line under the parent avatar,
          // replies indented inside it
          <View
            style={{
              marginLeft: 3,
              marginTop: 6,
              paddingLeft: 13,
              borderLeftWidth: 2,
              borderLeftColor: colors.isDark
                ? "rgba(74,227,143,0.22)"
                : "rgba(14,122,70,0.16)",
              borderTopLeftRadius: 8,
              borderBottomLeftRadius: 8,
            }}
          >
            {c.replies!.map((r) => (
              <CommentRow
                key={r.id}
                c={r}
                isReply
                replyTo={
                  r.parentId != null
                    ? (c.replies!.find(
                        (x) => x.id === (r.parentId as number) + REPLY_OFF,
                      )?.name ?? c.name)
                    : c.name
                }
                isLiked={isLiked}
                onToggleLike={onToggleLike}
                onReply={onReply}
                onToggleReplies={onToggleReplies}
                repliesOpen={repliesOpen}
                onOpenProfile={onOpenProfile}
                onClose={onClose}
                onReport={onReport}
                canReport={canReport}
                reportedIds={reportedIds}
                reportingIds={reportingIds}
                onDelete={onDelete}
                canDelete={canDelete}
                highlightId={highlightId}
                colors={colors}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Instagram-style comments sheet (theme-aware):
 * post summary → comment list (photo avatars, filling like hearts,
 * nested replies w/ thread rail) → "Replying to @user" indicator →
 * add-a-comment input at the bottom.
 *
 * `inline` renders as an absolute overlay instead of an RN Modal — needed
 * inside modal-presented routes (videos) on native where nested Modals
 * don't present reliably.
 */
export function CommentsModal({
  visible,
  post,
  seed,
  onClose,
  inline = false,
  postId = null,
  videoId = null,
  highlightCommentId = null,
  onDeleted,
}: {
  visible: boolean;
  post: Post | null;
  seed: SampleComment[];
  onClose: () => void;
  inline?: boolean;
  /* pass 97 — the parent surface learns about a successful delete so its
   * comment counter drops at once */
  onDeleted?: (id: number, isReply: boolean) => void;
  /** pass 66-night — real post id → the thread reads/writes the server. */
  postId?: number | null;
  /** pass 72 — real video (reel) id → the thread reads/writes the VIDEO
   * comments API instead (reels are not posts server-side). */
  videoId?: number | null;
  highlightCommentId?: number | null;
}) {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const d = theme.dash;
  const card = isDark ? "#101B15" : "#FFFFFF";
  const bg = isDark ? "rgba(4,8,6,0.86)" : "rgba(15,25,19,0.42)";
  const txt = isDark ? "#F2F7F3" : "#14241C";
  const sub = isDark ? "rgba(233,244,237,0.72)" : "rgba(20,36,28,0.75)";
  const faint = isDark ? "rgba(233,244,237,0.45)" : "rgba(20,36,28,0.48)";
  const hairline = isDark ? "rgba(255,255,255,0.08)" : "rgba(20,36,28,0.12)";
  const bubble = isDark ? "rgba(255,255,255,0.045)" : "rgba(20,36,28,0.055)";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(20,36,28,0.07)";
  const gold = "#D4AF37";
  const emerald = isDark ? "#4AE38F" : "#0E7A46";

  const [items, setItems] = useState<SampleComment[]>([]);
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});
  const [openReplies, setOpenReplies] = useState<Set<number>>(new Set());
  const [reportedIds, setReportedIds] = useState<Set<number>>(new Set());
  const [reportingIds, setReportingIds] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState("");
  /* pass 40 — @DeenLink AI: mentions get an in-thread AI reply (like Grok on X) */
  const [aiTyping, setAiTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: number;
    name: string;
    handle: string;
  } | null>(null);
  /* pass 66-night — live mode: the thread is a real server conversation. */
  const { user: authUser } = useAuth();
  const liveVideo = videoId != null && videoId > 0 && isLive();
  const live = (postId != null && postId > 0 && isLive()) || liveVideo;
  const me = authUser
    ? { name: authUser.full_name || authUser.username, handle: authUser.username }
    : ME;
  const mapServer = (c: ServerComment): SampleComment => ({
    id: c.id,
    name: c.user?.name || c.user?.username || "DeenLink",
    handle: c.user?.username || "deenlink",
    avatar: c.user?.profile_image_url ?? null,
    badge: (c.user?.verification_badge as SampleComment["badge"]) ?? null,
    text: c.text,
    nav: c.nav ?? undefined,
    isAI: !!c.is_ai,
    time: c.time_ago || "",
    likes: c.like_count,
    liked: c.liked_by_me,
    replies: (() => {
      /* pass 77 — get_comments/list_comments return a TREE (a reply to a
       * reply nests inside its parent). Flatten it DFS so every level
       * renders, and keep parentId = the DIRECT parent so "replying to ›"
       * names the right person (feed: parent_reply_id · videos: parent_id). */
      const flat: NonNullable<SampleComment["replies"]> = [];
      const walk = (rows?: ServerReply[]) => {
        for (const r of rows ?? []) {
          flat.push({
            id: r.id + REPLY_OFF,
            name: r.user?.name || r.user?.username || "DeenLink",
            handle: r.user?.username || "deenlink",
            avatar: r.user?.profile_image_url ?? null,
            badge: (r.user?.verification_badge as SampleComment["badge"]) ?? null,
            text: r.text,
            nav: r.nav ?? undefined,
            isAI: !!r.is_ai,
            time: r.time_ago || "",
            likes: r.like_count,
            liked: r.liked_by_me,
            parentId: r.parent_reply_id ?? r.parent_id ?? null,
          });
          walk(r.replies);
        }
      };
      walk(c.replies);
      return flat;
    })(),
  });
  /* pass 72 — reels load from the videos comments API */
  useEffect(() => {
    if (!visible || !liveVideo || !videoId) return;
    let dead = false;
    (async () => {
      const rows = (await videosComments(videoId)) as unknown as
        ServerComment[] | null;
      if (dead || !rows) return;
      const mapped = rows.map(mapServer);
      setItems(mapped);
      const l: Record<number, boolean> = {};
      for (const c of mapped) {
        if (c.liked) l[c.id] = true;
        c.replies?.forEach((r) => {
          if (r.liked) l[r.id] = true;
        });
      }
      setLikedMap(l);
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, videoId, liveVideo]);
  useEffect(() => {
    if (!visible || !live || liveVideo || !postId) return;
    let dead = false;
    (async () => {
      const rows = await getComments(postId);
      if (dead || !rows) return;
      const mapped = rows.map(mapServer);
      setItems(mapped);
      const l: Record<number, boolean> = {};
      for (const c of mapped) {
        if (c.liked) l[c.id] = true;
        c.replies?.forEach((r) => {
          if (r.liked) l[r.id] = true;
        });
      }
      setLikedMap(l);
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, postId, live]);
  /* pass 41 — typing "@" opens the mention picker: DeenLink AI first, then friends/search */
  const mentionMatch = /@([A-Za-z0-9_.]*)$/.exec(draft);
  const mentionQuery = (mentionMatch?.[1] ?? "").toLowerCase();
  /* pass 83-38 — mentions come from the REAL follow graph (was demo roster) */
  const [mentionPeople, setMentionPeople] = useState<
    Array<{ username: string; full_name: string }>
  >([]);
  useEffect(() => {
    if (!visible) return;
    let dead = false;
    api
      .getConnections("following", mentionQuery)
      .then((r) => {
        if (!dead)
          setMentionPeople(
            (r?.items ?? [])
              .filter((it) => !it.is_me)
              .slice(0, 6)
              .map((it) => ({
                username: it.username,
                full_name: it.name || it.username,
              })),
          );
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [visible, mentionQuery]);
  const mentionCandidates = useMemo(() => {
    const people = mentionPeople.map((a) => ({
      handle: a.username,
      name: a.full_name,
      ai: false,
    }));
    return [{ handle: "deenlinkai", name: "DeenLink AI", ai: true }, ...people];
  }, [mentionQuery, mentionPeople]);
  const pickMention = (handle: string) => {
    /* pass 54 — tapping a suggestion never types "@user " into the comment box
     * (that was the confusing part). Picking DeenLink AI instead sets an explicit
     * tag chip, which is what actually triggers its answer — the old behaviour
     * relied on the literal text "@deenlinkai" being present, so removing the
     * injection had silently broken AI tagging altogether. */
    /* pass 55 — @username injection is BACK in the comment box (the user wants
     * the original behaviour here; it was only meant to be removed from the
     * CHAT screen). Tagging DeenLink AI also sets its chip as a visible cue. */
    setDraft((prev) => prev.replace(/@([A-Za-z0-9_.]*)$/, `@${handle} `));
    if (handle === "deenlinkai") setAiTagged(true);
    haptic.light();
  };
  const inputRef = useRef<TextInput>(null);
  /* pass 54 — tagging DeenLink AI is now an explicit chip, NOT injected text. */
  const [aiTagged, setAiTagged] = useState(false);
  /* pass 100 — moved here from below the `if (!post) return null;` guard (see
   * the delete handler further down): a hook after that guard changes the hook
   * count between renders → React #310 whenever a comment thread is opened. */
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  /* pass 28: LIVE drag-to-resize via pointer events (PanResponder was dead on
   * iOS Safari web). The sheet follows the finger; release snaps. */
  const vh = Dimensions.get("window").height;
  const H_MAX = Math.round(vh * 0.94);
  const H_TALL = Math.round(vh * 0.85);
  const H_MID = Math.round(vh * 0.7);
  const H_MIN = Math.round(vh * 0.5);
  const [sheetH, setSheetH] = useState(() =>
    Math.round(Dimensions.get("window").height * 0.85),
  );
  const dragStart = useRef<{ y: number; h: number } | null>(null);
  const moveBy = (pageY: number) => {
    if (!dragStart.current) return;
    const dy = dragStart.current.y - pageY;
    setSheetH(Math.min(H_MAX, Math.max(H_MIN, dragStart.current.h + dy)));
  };
  const endDrag = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setSheetH((h) =>
      h > H_TALL + 30 ? H_MAX : h < H_MID - 30 ? H_MID : H_TALL,
    );
  };
  const onHandleDown = (e: any) => {
    dragStart.current = { y: e.nativeEvent.pageY, h: sheetH };
  };
  const onHandleMove = (e: any) => moveBy(e.nativeEvent.pageY ?? 0);

  /* pass 28b: RN-web (this version) doesn't map onPointerDown props — attach
   * REAL DOM pointer listeners to the handle node; RN responder stays as the
   * native fallback. The Modal's DOM mounts one frame AFTER `visible` flips. */
  const handleRef = useRef<any>(null);
  const handleEl = useRef<any>(null);
  const handlers = useRef<{
    down: (e: PointerEvent) => void;
    move: (e: PointerEvent) => void;
    up: () => void;
  } | null>(null);
  const sheetHRef = useRef(sheetH);
  sheetHRef.current = sheetH;
  const detach = () => {
    const el = handleEl.current;
    const h = handlers.current;
    if (!el || !h) return;
    el.removeEventListener("pointerdown", h.down as EventListener);
    window.removeEventListener("pointermove", h.move as EventListener);
    window.removeEventListener("pointerup", h.up);
    window.removeEventListener("pointercancel", h.up);
    handleEl.current = null;
    handlers.current = null;
  };
  const attach = (el: any) => {
    const down = (e: PointerEvent) => {
      dragStart.current = { y: e.pageY, h: sheetHRef.current };
      try {
        (
          el as unknown as { setPointerCapture: (i: number) => void }
        ).setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (dragStart.current) {
        e.preventDefault();
        moveBy(e.pageY);
      }
    };
    const up = () => endDrag();
    handleEl.current = el;
    handlers.current = { down, move, up };
    el.addEventListener("pointerdown", down as EventListener);
    window.addEventListener("pointermove", move as EventListener);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const bindHandle = (el: any) => {
    if (handleEl.current === el) return; /* same node — keep listeners */
    detach();
    handleRef.current = el;
    if (el && typeof el.addEventListener === "function") attach(el);
  };

  const colors = useMemo(
    () => ({
      txt: txt as string,
      sub: sub as string,
      faint: faint as string,
      hairline: hairline as string,
      bubble: bubble as string,
      emerald: emerald as string,
      isDark,
    }),
    [txt, sub, faint, hairline, bubble, emerald, isDark],
  );

  // re-seed whenever a different post opens
  const seedKey = post?.id ?? -1;
  /* pass 36 — comments loader: shows a shimmer for a beat when the sheet
   * opens, so slow networks never present an empty sheet */
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(t);
  }, [seedKey, visible]);
  useEffect(() => {
    if (visible) {
      setItems(
        seed.map((c) => ({ ...c, replies: c.replies?.map((r) => ({ ...r })) })),
      );
      const l: Record<number, boolean> = {};
      for (const c of seed) {
        if (c.liked) l[c.id] = true;
        c.replies?.forEach((r) => {
          if (r.liked) l[r.id] = true;
        });
      }
      setLikedMap(l);
      setOpenReplies(new Set());
      setDraft("");
      setReplyingTo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, visible]);

  useEffect(() => {
    if (
      highlightCommentId &&
      items.some((c) => c.replies?.some((r) => r.id === highlightCommentId))
    )
      setOpenReplies((v) =>
        new Set(v).add(
          items.find((c) =>
            c.replies?.some((r) => r.id === highlightCommentId),
          )!.id,
        ),
      );
  }, [highlightCommentId, items]);

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  if (!post) return null;
  const user = post.user;
  const name = user.full_name ?? user.username;
  const img =
    (user as { profile_image_url?: string | number | null })
      .profile_image_url ?? null;

  const isLiked = (id: number) => !!likedMap[id];
  const toggleLike = (id: number) => {
    const want = !likedMap[id];
    setLikedMap((m) => {
      const n = { ...m };
      if (n[id]) delete n[id];
      else n[id] = true;
      return n;
    });
    if (!live) return;
    const isReply = id >= REPLY_OFF;
    const call = liveVideo
      ? videosCommentLike(isReply ? id - REPLY_OFF : id, want)
      : isReply
        ? toggleReplyLike(id - REPLY_OFF, want)
        : toggleCommentLike(id, want);
    void call.then((res) => {
      if (!res) return;
      setItems((prev) =>
        prev.map((c) => {
          if (isReply) {
            if (!(c.replies ?? []).some((r) => r.id === id)) return c;
            return {
              ...c,
              replies: (c.replies ?? []).map((r) =>
                r.id === id
                  ? { ...r, likes: res.like_count, liked: res.liked }
                  : r,
              ),
            };
          }
          return c.id === id
            ? { ...c, likes: res.like_count, liked: res.liked }
            : c;
        }),
      );
    });
  };

  const toggleReplies = (id: number) =>
    setOpenReplies((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const startReply = (c: SampleComment) => {
    haptic.selection();
    // No @handle in the textfield — just the "Replying to …" indicator.
    setReplyingTo({ id: c.id, name: c.name ?? c.handle, handle: c.handle });
  };

  /** Opens a public profile — closes this sheet first so it never lingers. */
  const openProfile = (handle: string) => {
    const clean = String(handle).replace(/^@/, '').toLowerCase();
    const mine = String(authUser?.username ?? '').replace(/^@/, '').toLowerCase();
    if (mine && clean === mine) return;
    haptic.selection();
    onClose?.();
    setTimeout(() => router.push(clean === "deenlinkai" ? "/tools/ai" : `/profile/${handle}`), 140);
  };

  /* pass 83-39 — comment reporting: reason picker → /api/feed/report_comment.php
   * pass 88 — the useState MUST stay above the `if (!post) return null`
   * early return: a hook after it changes the hook count between renders and
   * React threw #310 (“rendered more hooks…”) the moment comments were opened
   * — the whole app died on the CrashBoundary screen. */
  const handleReportComment = (c: SampleComment) => {
    const reasons = [
      "Spam or scam",
      "Abuse or harassment",
      "Hate speech",
      "Misinformation",
      "Something else",
    ];
    Alert.alert("Report comment", "Why are you reporting this comment?", [
      { text: "Cancel", style: "cancel" },
      ...reasons.map((rn) => ({
        text: rn,
        onPress: () => {
          /* pass 97 — the right endpoint per thread: a reel comment lives in
           * video_comments, and the feed endpoint answered "Comment not found"
           * for it (the owner: "the report flag in comment section is not
           * working"). */
          const isReplyRow = c.id >= REPLY_OFF;
          const realId = isReplyRow ? c.id - REPLY_OFF : c.id;
          setReportingIds((prev) => new Set(prev).add(c.id));
          const send =
            liveVideo && videoId
              ? api.videosReportComment(videoId, realId, rn)
              : isReplyRow
                ? api.reportReply(realId, rn)
                : api.reportComment(realId, rn);
          void send.catch(() => false).then((okR) => {
            setReportingIds((prev) => { const next = new Set(prev); next.delete(c.id); return next; });
            if (okR) {
              setReportedIds((prev) => new Set(prev).add(c.id));
              Alert.alert(
                "Reported",
                "Jazakallahu khairan. Our moderators will review this comment.",
              );
            } else {
              Alert.alert(
                "Failed",
                "Could not submit the report right now. Please try again.",
              );
            }
          });
        },
      })),
    ]);
  };

  /* pass 97 — DELETE. owner: "unable to delete". A comment/reply could be
   * written but never taken back: /api/feed/delete_comment.php and
   * delete_reply.php were never called from anywhere in the app. The rules are
   * the server's (the author, or the owner of the post being commented on), and
   * the row disappears locally the moment the server confirms.
   * pass 100 — this useState MUST stay ABOVE the `if (!post) return null` guard
   * a few lines up (exactly like the pass-88 comment above says): pass 97 added
   * it below the guard, so opening any comment thread rendered one more hook
   * than the previous render → React #310 ("rendered more hooks than during the
   * previous render") → CrashBoundary: "DeenLink hit a problem" — the owner's
   * "anytime Comment is clicked the app will show error deenlink hit a
   * problem". Reproduced on the rig, then verified fixed. */
  const myHandle = String(me.handle ?? "").toLowerCase();
  const postOwnerHandle = String(
    (post as { user?: { username?: string } } | null)?.user?.username ?? "",
  ).toLowerCase();
  const canDeleteComment = (c: SampleComment): boolean => {
    const h = String(c.handle ?? "").toLowerCase();
    if (!h) return false;
    return h === myHandle || (postOwnerHandle !== "" && h === postOwnerHandle);
  };
  const canReportComment = (c: SampleComment): boolean => {
    const h = String(c.handle ?? "").toLowerCase();
    return h !== myHandle;
  };
  const handleDeleteComment = (c: SampleComment) => {
    const isReply = c.id >= REPLY_OFF;
    const label = isReply ? "reply" : "comment";
    Alert.alert(`Delete this ${label}?`, "It will be removed for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const realId = isReply ? c.id - REPLY_OFF : c.id;
          setDeletingIds((prev) => new Set(prev).add(c.id));
          /* Remove immediately so the thread behaves like a live conversation.
           * Keep a snapshot only to restore the row if the server rejects it. */
          const snapshot = items;
          const removeLocal = (prev: SampleComment[]) => prev
            .filter((x) => x.id !== c.id)
            .map((x) => ({ ...x, replies: (x.replies ?? []).filter((r) => r.id !== c.id) }));
          setItems(removeLocal);
          const done = (ok: boolean) => {
            setDeletingIds((prev) => {
              const n = new Set(prev);
              n.delete(c.id);
              return n;
            });
            if (!ok) {
              setItems(snapshot);
              Alert.alert("Could not delete", "Please try again in a moment.");
              return;
            }
            onDeleted?.(realId, isReply);
          };
          if (liveVideo && videoId) {
            void videosCommentDeleteApi(videoId, realId).then((left) => done(left !== null));
          } else if (c.id < 0) {
            /* still an optimistic row — nothing on the server yet */
            done(true);
          } else if (isReply) {
            void api.deleteReply(realId).then(done);
          } else {
            void api.deleteComment(realId).then(done);
          }
        },
      },
    ]);
  };

  const pushComment = (nc: SampleComment, explicitParentId?: number) => {
    setItems((prev) => {
      const parentTarget = explicitParentId != null ? explicitParentId : replyingTo?.id;
      if (parentTarget != null) {
        /* pass 74 — a reply-to-a-reply carries the direct parent for the label */
        const child =
          parentTarget >= REPLY_OFF
            ? { ...nc, parentId: parentTarget - REPLY_OFF }
            : nc;
        return prev.map((c) => {
          if (c.id === parentTarget)
            return { ...c, replies: [...(c.replies ?? []), child] };
          const ri = (c.replies ?? []).find((r) => r.id === parentTarget);
          if (ri) return { ...c, replies: [...(c.replies ?? []), child] };
          return c;
        });
      }
      return [...prev, nc];
    });
    const openId = explicitParentId ?? replyingTo?.id;
    if (openId != null) {
      const rootId = openId >= REPLY_OFF ? items.find((c) => (c.replies ?? []).some((r) => r.id === openId))?.id : openId;
      if (rootId != null) setOpenReplies((v) => new Set(v).add(rootId));
    }
    if (explicitParentId == null) setReplyingTo(null);
  };

  const addComment = async () => {
    const t = draft.trim();
    if (!t) return;
    haptic.light();
    const tempId = Date.now();
    const nc: SampleComment = {
      id: tempId,
      name: me.name,
      handle: me.handle,
      avatar: (authUser?.profile_image_url ?? authUser?.profile_image ?? null) as string | number | null,
      text: t,
      time: "now",
      likes: 0,
    };
    /* pass 66-night — optimistic push; the server id swaps in when it answers. */
    const target = replyingTo;
    let aiParentId = target?.id ?? tempId;
    pushComment(nc);
    setDraft("");
    if (liveVideo && videoId) {
      const vIsReply = !!target && target.id >= REPLY_OFF;
      const parent = target
        ? vIsReply
          ? items.find((c) => (c.replies ?? []).some((r) => r.id === target.id))
          : items.find((c) => c.id === target.id)
        : null;
      /* pass 77 — reply-to-reply on a video: parent_id = the comment/reply
       * being answered, not the root comment. */
      const vParentId =
        vIsReply && target && target.id < 100_000_000_000
          ? target.id - REPLY_OFF
          : parent
            ? parent.id
            : undefined;
      const res = await videosCommentAdd(videoId, t, vParentId);
      if (res) {
        if (!target) aiParentId = res.comment_id;
        setItems((prev) =>
          prev.map((c) =>
            (c.replies ?? []).some((r) => r.id === tempId)
              ? {
                  ...c,
                  replies: (c.replies ?? []).map((r) =>
                    r.id === tempId
                      ? { ...r, id: res.comment_id + REPLY_OFF }
                      : r,
                  ),
                }
              : c.id === tempId
                ? { ...c, id: res.comment_id }
                : c,
          ),
        );
      }
    } else if (live && postId) {
      if (target) {
        const isReply = target.id >= REPLY_OFF;
        const parent = isReply
          ? items.find((c) => (c.replies ?? []).some((r) => r.id === target.id))
          : items.find((c) => c.id === target.id);
        const res = await srvAddReply(
          postId,
          parent ? parent.id : target.id,
          t,
          isReply && target.id < 100_000_000_000 ? target.id - REPLY_OFF : 0,
        );
        if (res) {
          setItems((prev) =>
            prev.map((c) =>
              (c.replies ?? []).some((r) => r.id === tempId)
                ? {
                    ...c,
                    replies: (c.replies ?? []).map((r) =>
                      r.id === tempId ? { ...r, id: res.id + REPLY_OFF } : r,
                    ),
                  }
                : c,
            ),
          );
        }
      } else {
        const res = await srvAddComment(postId, t);
        if (res) {
          aiParentId = res.id;
          setItems((prev) =>
            prev.map((c) => (c.id === tempId ? { ...c, id: res.id } : c)),
          );
        }
      }
    }
    /* pass 40 — mention @DeenLink AI (including the displayed spaced name)
     * → answer in-thread. Waiting for a live comment id first prevents the AI
     * reply from becoming orphaned when the optimistic id is replaced. */
    if (aiTagged || hasAiMention(t))
      void answerAsDeenLinkAI(t, post, aiParentId);
    setAiTagged(false);
  };

  const answerAsDeenLinkAI = async (question: string, forPost: Post | null, parentCommentId: number) => {
    setAiTyping(true);
    const postText = (forPost?.content_text ?? "").slice(0, 700);
    const hasVisualMedia = !!(forPost?.image_url || forPost?.video_url || forPost?.media?.length);
    const mediaLimit = hasVisualMedia
      ? "The post has image/video media. You cannot inspect pixels, audio, or video here. Use only the supplied text; explicitly say you cannot read/watch the media if the question depends on it. Never identify a person or infer facts from the media."
      : "Use only the supplied post and comment text; do not invent missing context.";
    const q = withoutAiMention(question) || "Is this post accurate?";
    /* Include the actual thread text, not merely the post caption. This keeps a
     * reply grounded in the asking user's words when the caption is unrelated. */
    const threadRow = parentCommentId >= REPLY_OFF
      ? items.flatMap((c) => c.replies ?? []).find((r) => r.id === parentCommentId)
      : items.find((c) => c.id === parentCommentId);
    const threadContext = threadRow?.text ? `\nAsking comment context: "${threadRow.text.slice(0, 700)}"` : "";
    let answer = "";
    try {
      const key = await getApiKey();
      if (key && detectProvider(key)) {
        /* keyed mode — full reasoning, then a single inserted reply */
        const sources = await retrieveLocal(
          `${q} ${postText.slice(0, 220)}`,
        ).catch(() => []);
        const ctx = sources
          .slice(0, 5)
          .map((x) => `[${x.label}] ${x.excerpt.slice(0, 260)}`)
          .join("\n");
        const model = await getModel();
        answer = await new Promise<string>((resolve) => {
          let acc = "";
          streamLLM(
            key,
            model,
            [
              {
                role: "system",
                content: `${SYSTEM_PROMPT}\nYou are replying INLINE as DeenLink AI beneath the user's asking comment. Keep it under 110 words. First state what the supplied text/context does or does not establish; then answer cautiously. Never claim a post is true merely because it has a caption. For religious questions, distinguish a verified source from general guidance and advise a qualified scholar for a personal ruling. ${mediaLimit} No markdown headings. If the user asks WHERE something is in the app or how to do it in DeenLink, give short numbered steps and end with a final line exactly: NAV: /route (one of the routes you know).`,
              },
              {
                role: "user",
                content: `Post text: "${postText || "(no readable post text supplied)"}"${threadContext}\nUser asked: "${q}"\n\nVerified library context:\n${ctx || "(nothing directly on-topic retrieved)"}`,
              },
            ],
            false,
            (e: { delta?: string; done?: boolean; error?: string }) => {
              if (e.delta) acc += e.delta;
              if (e.done || e.error)
                resolve(acc.trim());
            },
          ).catch(() => resolve(""));
        });
      }
      if (!answer) {
        /* On-device fallback — never guesses about the post or media. */
        const sources = await retrieveLocal(
          `${q} ${postText.slice(0, 220)}`,
        ).catch(() => [] as never[]);
        answer = hasVisualMedia && !postText
          ? "I cannot read or watch the image/video from this comment context, so I cannot verify the claim. Please provide the visible text or a description, and ask a qualified scholar for a personal ruling."
          : composeLocalAnswer(q, sources);
      }
    } catch {
      answer =
        "I could not verify this safely right now, so I will not guess. Please try again or ask a qualified scholar for a personal ruling.";
    }
    /* let the typing dots breathe, then post the reply */
    await new Promise((r) => setTimeout(r, Math.max(0, 1100)));
    setAiTyping(false);
    /* pass 42 — pull the NAV directive OUT of the text; it becomes a button,
     * and on-device nav questions get real steps + a route too */
    const navMatch = answer.match(/^\s*NAV:\s*(\/[^\s]+)\s*$/im);
    let navRoute = navMatch?.[1];
    let clean = answer
      .replace(/^\s*NAV:\s*\/?[a-z0-9/()\-]*.*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    /* strip markdown emphasis/code/bullets so the inline reply reads clean — no stray * or _ */
    clean = clean
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1$2")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^\s*[*\-]\s+/gm, "• ")
      .trim();
    if (!navRoute) {
      const nav = navAnswer(question);
      if (nav) {
        navRoute = nav.route;
        clean = `${clean}\n\n${nav.text}`.trim();
      }
    }
    const aiText = `✅ ${clean}`;
    const ai: SampleComment = {
      id: Date.now() + 1,
      name: "DeenLink AI",
      handle: "deenlinkai",
      avatar: null,
      badge: "green",
      isAI: true,
      text: aiText,
      nav: navRoute,
      time: "now",
      likes: 0,
    };
    /* The AI response is a real threaded child of the asker’s comment, not a
     * new root. This keeps the question and answer together in both normal and
     * reel comments. In live mode also write a system-authored row to the
     * database; it must never be saved as the asking user's own reply. */
    pushComment(ai, parentCommentId);
    const aiRootId = parentCommentId >= REPLY_OFF
      ? items.find((c) => (c.replies ?? []).some((r) => r.id === parentCommentId))?.id ?? 0
      : parentCommentId;
    if (live && aiRootId > 0) {
      const surface = liveVideo ? "video" : "post";
      const contentId = liveVideo ? videoId : postId;
      if (contentId) {
        void saveAiCommentReply(surface, contentId, aiRootId, aiText, navRoute).catch(() => null);
      }
    }
    haptic.success();
  };

  const total = (list: SampleComment[]) =>
    list.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  const sheet = (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      accessibilityLabel="comments sheet"
      style={{
        height: sheetH,
        maxHeight: "94%",
        backgroundColor: card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: hairline,
        shadowColor: "#000",
        shadowOpacity: isDark ? 0.4 : 0.18,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: -8 },
        elevation: 16,
      }}
    >
      {/* drag handle — pull up/down to resize (pass 28: live pointer drag) */}
      <View
        ref={bindHandle}
        accessibilityLabel="comments drag handle"
        onStartShouldSetResponder={() => Platform.OS !== "web"}
        onResponderGrant={onHandleDown}
        onResponderMove={onHandleMove}
        onResponderRelease={endDrag}
        style={
          {
            alignItems: "center",
            paddingTop: 10,
            paddingBottom: 8,
            touchAction: "none",
          } as never
        }
      >
        <View
          style={{
            width: 52,
            height: 5,
            borderRadius: 3,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.28)"
              : "rgba(0,0,0,0.2)",
          }}
        />
        <T
          v="meta"
          style={{
            fontSize: 9.5,
            marginTop: 7,
            letterSpacing: 0.4,
            color: faint as string,
          }}
        >
          drag to resize
        </T>
      </View>

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: hairline,
        }}
      >
        <View style={{ flex: 1 }} />
        <T v="body" style={{ fontWeight: "700", fontSize: 14, color: txt }}>
          Comments
        </T>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <FontAwesome5 name="times" size={15} color={faint} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 10,
        }}
      >
        {/* Post summary */}
        <View style={{ flexDirection: "row", gap: 9, marginBottom: 4 }}>
          <AvatarImage
            source={img}
            name={name}
            size={32}
            tint={isDark ? "rgba(255,255,255,0.08)" : "rgba(20,36,28,0.08)"}
            border={hairline}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <T
                v="caption"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontWeight: "700",
                  fontSize: 11.5,
                  color: txt,
                  flexShrink: 1,
                }}
              >
                {name}
              </T>
              {user.verification_badge ? (
                <VerificationBadge type={user.verification_badge} size={11} />
              ) : null}
              <T
                v="caption"
                style={{ fontSize: 10, color: faint, flexShrink: 0 }}
              >
                · {post.time_ago}
              </T>
            </View>
            {post.content_text ? (
              <T
                v="bodyS"
                numberOfLines={3}
                ellipsizeMode="tail"
                style={{
                  fontSize: 12,
                  lineHeight: 17,
                  color: sub,
                  marginTop: 3,
                }}
              >
                {post.content_text}
              </T>
            ) : null}
          </View>
        </View>
        <T
          v="caption"
          style={{
            fontSize: 10,
            color: faint,
            fontWeight: "700",
            letterSpacing: 0.6,
            marginTop: 10,
          }}
        >
          {total(items)} COMMENTS
        </T>

        {loading ? (
          <View style={{ gap: 14, marginTop: 12 }} pointerEvents="none">
            {[...Array(3)].map((_, i) => (
              <View
                key={i}
                style={{ flexDirection: "row", gap: 9, opacity: 1 - i * 0.22 }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: isDark
                      ? "rgba(242,247,243,0.08)"
                      : "rgba(20,36,28,0.07)",
                  }}
                />
                <View style={{ flex: 1, gap: 6, marginTop: 2 }}>
                  <View
                    style={{
                      height: 9,
                      borderRadius: 5,
                      width: `${38 + i * 9}%`,
                      backgroundColor: isDark
                        ? "rgba(242,247,243,0.08)"
                        : "rgba(20,36,28,0.07)",
                    }}
                  />
                  <View
                    style={{
                      height: 9,
                      borderRadius: 5,
                      width: `${84 - i * 12}%`,
                      backgroundColor: isDark
                        ? "rgba(242,247,243,0.06)"
                        : "rgba(20,36,28,0.05)",
                    }}
                  />
                </View>
              </View>
            ))}
            <ActivityIndicator
              size="small"
              color={emerald}
              style={{ marginTop: 2 }}
            />
          </View>
        ) : (
          <>
            {/* pass 52 — the AI is answering the ORIGINAL comment, so its typing
             * indicator belongs at the TOP of the thread, not buried under every
             * reply where the user cannot see it. */}
            {aiTyping ? (
              <View style={{ flexDirection: "row", gap: 9, marginTop: 12 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(74,227,143,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FontAwesome5 name="robot" size={14} color="#4AE38F" />
                </View>
                <View
                  style={{
                    borderRadius: 13,
                    backgroundColor: colors.bubble,
                    paddingHorizontal: 12,
                    alignSelf: "flex-start",
                  }}
                >
                  <TypingDots color={colors.emerald} />
                </View>
              </View>
            ) : null}
            {[...items].reverse().map((c) => (
              <CommentRow
                key={c.id}
                c={c}
                isLiked={isLiked}
                onToggleLike={toggleLike}
                onReply={startReply}
                onToggleReplies={toggleReplies}
                repliesOpen={openReplies.has(c.id)}
                onOpenProfile={openProfile}
                onClose={onClose}
                onReport={handleReportComment}
                canReport={canReportComment}
                reportedIds={reportedIds}
                reportingIds={reportingIds}
                onDelete={handleDeleteComment}
                canDelete={canDeleteComment}
                highlightId={highlightCommentId}
                colors={colors}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* pass 54 — DeenLink AI tag chip (replaces typing "@deenlinkai") */}
      {aiTagged ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "rgba(74,227,143,0.12)",
              borderWidth: 1,
              borderColor: "rgba(74,227,143,0.4)",
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 7,
            }}
          >
            <FontAwesome5 name="robot" size={10} color="#4AE38F" />
            <T
              v="caption"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                flexShrink: 1,
                fontSize: 10.5,
                fontWeight: "700",
                color: "#4AE38F",
              }}
            >
              DeenLink AI will answer this comment
            </T>
          </View>
          <Pressable
            onPress={() => setAiTagged(false)}
            hitSlop={10}
            style={{ padding: 5 }}
          >
            <FontAwesome5 name="times-circle" size={14} color={faint} />
          </Pressable>
        </View>
      ) : null}

      {/* Reply indicator */}
      {replyingTo ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: `${gold}14`,
              borderWidth: 1,
              borderColor: "rgba(212,175,55,0.4)",
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 7,
            }}
          >
            <FontAwesome5 name="reply" size={10} color={gold} />
            <T
              v="caption"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                flexShrink: 1,
                fontSize: 10.5,
                fontWeight: "700",
                color: gold,
              }}
            >
              Replying to › {replyingTo.name}
              {replyingTo.handle && replyingTo.handle !== replyingTo.name
                ? ` (@${replyingTo.handle})`
                : ""}
            </T>
          </View>
          <Pressable
            onPress={() => setReplyingTo(null)}
            hitSlop={10}
            style={{ padding: 5 }}
          >
            <FontAwesome5 name="times-circle" size={14} color={faint} />
          </Pressable>
        </View>
      ) : null}

      {/* Emoji row (IG-style) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center" }}
        style={{
          height: 46,
          flexGrow: 0,
          flexShrink: 0,
          paddingHorizontal: 12,
          paddingBottom: 4,
        }}
      >
        {EMOJIS.map((e, i) => {
          const ar = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(e);
          return (
            <Pressable
              key={`e${i}`}
              onPress={() => setDraft((prev) => prev + e)}
              hitSlop={4}
              style={{ padding: 4, marginRight: 2 }}
              onPressIn={() => haptic.selection()}
            >
              <T
                v="caption"
                style={{
                  fontSize: ar
                    ? e.length > 4
                      ? 13
                      : 21
                    : e.length > 2
                      ? 12
                      : 20,
                  fontWeight: "400",
                  fontFamily: ar ? "Amiri" : undefined,
                }}
              >
                {e}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* pass 41 — mention picker (DeenLink AI first, then friends/search) */}
      {mentionMatch ? (
        <View
          style={{
            maxHeight: 176,
            borderTopWidth: 1,
            borderTopColor: hairline,
            backgroundColor: isDark ? "rgba(9,16,12,0.98)" : "#FFFFFF",
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              gap: 2,
            }}
          >
            <T
              v="caption"
              style={{
                fontSize: 8.5,
                fontWeight: "900",
                letterSpacing: 0.8,
                color: faint,
                paddingVertical: 4,
              }}
            >
              MENTION — DEENLINK AI FIRST
            </T>
            {mentionCandidates.map((m) => (
              <Pressable
                key={m.handle}
                onPress={() => pickMention(m.handle)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  borderRadius: 11,
                  paddingHorizontal: 9,
                  paddingVertical: 7,
                  backgroundColor: m.ai
                    ? "rgba(212,175,55,0.09)"
                    : pressed
                      ? bubble
                      : "transparent",
                  borderWidth: 1,
                  borderColor: m.ai ? "rgba(212,175,55,0.35)" : "transparent",
                })}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    backgroundColor: m.ai
                      ? "rgba(212,175,55,0.16)"
                      : isDark
                        ? "rgba(46,204,113,0.14)"
                        : "rgba(14,122,70,0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FontAwesome5
                    name={m.ai ? "robot" : "user"}
                    size={11}
                    color={m.ai ? "#D4AF37" : emerald}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {/* pass 61 — long names/handles truncate instead of widening the row */}
                  <T
                    v="bodyS"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: m.ai ? "#D4AF37" : txt,
                    }}
                  >
                    {m.name}
                  </T>
                  <T
                    v="caption"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ fontSize: 9.5, color: faint }}
                  >
                    @{m.handle}
                    {m.ai ? " · answers from your library" : ""}
                  </T>
                </View>
                <FontAwesome5 name="plus" size={9} color={faint} />
              </Pressable>
            ))}
            {!mentionCandidates.length ? (
              <T
                v="caption"
                style={{ fontSize: 10.5, color: faint, padding: 8 }}
              >
                No matches
              </T>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {/* Add a comment (font 16px → no iOS auto-zoom on focus) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: hairline,
        }}
      >
        <AvatarImage
          source={(authUser?.profile_image_url ?? authUser?.profile_image ?? null) as string | number | null}
          name={authUser?.full_name || authUser?.username || "You"}
          gender={authUser?.gender}
          size={34}
          tint={isDark ? "rgba(46,204,113,0.16)" : "rgba(14,122,70,0.12)"}
          border={isDark ? "rgba(46,204,113,0.4)" : "rgba(14,122,70,0.35)"}
        />
        <View style={{ flex: 1 }}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={
              replyingTo ? `Reply to ${replyingTo.name}…` : "Add a comment…"
            }
            placeholderTextColor={faint}
            onSubmitEditing={addComment}
            returnKeyType="send"
            selectionColor={emerald}
            style={{
              width: "100%",
              fontFamily: "Poppins-Medium",
              fontSize: 16,
              lineHeight: 20,
              color: draft ? "transparent" : txt,
              backgroundColor: inputBg,
              borderRadius: 17,
              paddingHorizontal: 13,
              paddingVertical: 9,
            }}
          />
          {/* green @mention highlight rendered over the (transparent-text) input */}
          {draft ? (
            <Text
              pointerEvents="none"
              numberOfLines={1}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                fontFamily: "Poppins-Medium",
                fontSize: 16,
                lineHeight: 20,
                paddingHorizontal: 13,
                paddingVertical: 9,
                color: txt,
              }}
            >
              {draft.split(/(@[A-Za-z0-9_.]+)/g).map((part, i) =>
                part.startsWith("@") ? (
                  <Text key={i} style={{ color: emerald, fontWeight: "700" }}>
                    {part}
                  </Text>
                ) : (
                  <Text key={i}>{part}</Text>
                ),
              )}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={addComment}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            opacity: (draft.trim() ? 1 : 0.45) * (pressed ? 0.6 : 1),
          })}
        >
          <FontAwesome5
            name="paper-plane"
            size={13}
            color={draft.trim() ? gold : faint}
          />
          <T
            v="caption"
            style={{
              fontWeight: "700",
              fontSize: 11,
              color: draft.trim() ? gold : faint,
            }}
          >
            Post
          </T>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  if (inline) {
    if (!visible) return null;
    return (
      <View
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 90,
          backgroundColor: bg,
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        {sheet}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{ flex: 1, backgroundColor: bg, justifyContent: "flex-end" }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        {sheet}
      </View>
    </Modal>
  );
}
