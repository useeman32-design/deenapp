import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { scholarTagLabel } from "@/lib/blockNotice";
import { useTheme, type ThemeMode } from "@/context/ThemeContext";
import { storage } from "@/lib/storage";
import { consumeProfileDirty } from "@/lib/userPosts";
import { markActive, markGoal } from "@/lib/routine";
import * as api from "@/api/client";
import type { Post } from "@/api/types";
import { T } from "@/components/T";
import { AvatarImage } from "@/components/FeedCard";
import { VerificationBadge } from "@/components/VerificationBadge";
import { FeedCard } from "@/components/FeedCard";
import { FeedSkeleton } from "@/components/Skeletons";
import { CommentsModal } from "@/components/CommentsModal";
import { haptic } from "@/lib/haptics";
import { Platform } from "react-native";
import { UI_SCALES, useUIScale, useSetUIScale } from "@/context/UIScale";
import {
  DeenPointsBuyModal,
  RewardModal,
  useDeenPoints,
  formatDP,
} from "@/components/DeenPoints";
import { ConfirmDialog } from "@/components/ConfirmDialog";
const deenPointsLogo = require("../../../assets/img/deenpoints.png");
import { savedRefresh, useSaved } from "@/lib/savedPosts";
import { useIsGuest } from "@/lib/guest";
import {
  emitPostDeleted,
  onPostChanged,
  onPostDeleted,
} from "@/lib/postEvents";
import { LoginRequired } from "@/components/LoginRequired";

const patternDark = require("../../../assets/img/pattern-dark.png");
const patternLight = require("../../../assets/img/pattern-light.png");

type Tab = "posts" | "videos" | "saved";

/**
 * Personal profile (pass 15) — rebuilt on the public-profile design: pattern
 * header, gold-ring identity card, 4-stat row, tabbed Posts / Settings.
 */
function ProfileInner() {
  const { theme, mode, setMode, isDark } = useTheme();
  /* pass 89 — the profile feed rendered FeedCard without an onComments handler, so the
   * speech bubble was a dead tap. The comments modal is mounted by the screen, the way
   * the community feed does it, so it works for posts, videos and saved alike. */
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const uiScale = useUIScale();
  const setUiScale = useSetUIScale();
  const d = theme.dash;
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("posts");
  const saved = useSaved().saved;
  /* pass 88 — the Saved tab re-reads the server every time the tab is focused,
   * so a bookmark tapped in Home/Community is there without a page reload. */
  useFocusEffect(
    useCallback(() => {
      void savedRefresh();
    }, []),
  );
  const [posts, setPosts] = useState<Post[]>([]);
  /* pass 91 — owner: "when i switch account am finding posts of the old account
   * in profile instead of loading the new logged account posts … instead of
   * showing empty it should show a loading, maybe a breathing skeleton."
   * Two defects: the cached page lived under ONE key ("dl.myprofile.v1") for
   * every account, and the screen painted "No posts yet" while the request was
   * still in flight. The cache is now keyed by the signed-in account id and the
   * empty note waits for the request to settle. */
  const [loadingPosts, setLoadingPosts] = useState(true);
  const profileCacheKey = user?.id != null ? `dl.myprofile.v2.${user.id}` : null;
  useEffect(() => {
    if (!profileCacheKey) {
      setPosts([]);
      return;
    }
    /* a different account must never inherit the previous one's page */
    setPosts([]);
    void storage
      .getItem(profileCacheKey)
      .then((s) => {
        if (!s) return;
        try {
          const rows = JSON.parse(s) as Post[];
          if (Array.isArray(rows) && rows.length)
            setPosts((cur) => (cur.length ? cur : rows));
        } catch {
          /* junk cache — network will replace */
        }
      })
      .catch(() => {});
  }, [profileCacheKey]);
  useEffect(() => {
    if (posts.length && profileCacheKey)
      void storage
        .setItem(profileCacheKey, JSON.stringify(posts.slice(0, 60)))
        .catch(() => {});
  }, [posts, profileCacheKey]);
  useEffect(() => {
    const offD = onPostDeleted((id) =>
      setPosts((ps) => ps.filter((p) => p.id !== id)),
    );
    const offC = onPostChanged(() => {});
    return () => {
      offD();
      offC();
    };
  }, []);
  const [counts, setCounts] = useState({
    posts: 0,
    followers: 0,
    following: 0,
  });
  const [checkin, setCheckin] = useState<"idle" | "done" | "already">("idle");
  /* pass 94 — owner: "the checking button add loading checking in, because its
   * just user waiting blindly". The chip had no busy state, so on a slow
   * network the tap looked like nothing happened. */
  const [checkinBusy, setCheckinBusy] = useState(false);
  /* pass 83-20 — the server is the source of truth for today's check-in;
   * local storage alone reset the button to unchecked (owner: "if i checked
   * in and comeback again i will see the button as uncheck"). */
  useEffect(() => {
    if ((user as { checked_in_today?: boolean } | null)?.checked_in_today) {
      setCheckin("already");
      void storage.setItem(
        "dl.checkin.date",
        new Date().toISOString().slice(0, 10),
      );
    }
  }, [(user as { checked_in_today?: boolean } | null)?.checked_in_today]);
  /* pass 83-24 — the login payload can predate today's check-in (owner:
   * "when ever i logged out and comeback i will see the button as unchecked").
   * Ask the server directly whenever this screen mounts. */
  useEffect(() => {
    if (!api.isLive()) {
      return;
    }
    let dead = false;
    void api
      .authMe()
      .then((u) => {
        if (dead) {
          return;
        }
        if ((u as { checked_in_today?: boolean } | null)?.checked_in_today) {
          setCheckin("already");
          void storage.setItem(
            "dl.checkin.date",
            new Date().toISOString().slice(0, 10),
          );
        }
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [user?.id]);
  /* pass 38 — the DeenPoints chip opens the BUY modal (it used to fire the check-in!) */
  const [buyOpen, setBuyOpen] = useState(false);
  const [reward, setReward] = useState<{
    amount: number;
    streak: boolean;
  } | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const dp = useDeenPoints();

  useEffect(() => {
    setLoadingPosts(true);
    api
      .userPosts(user?.id != null ? Number(user.id) : undefined)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
    if (user?.id != null) api.profileCounts(Number(user.id)).then(setCounts);
  }, [user?.id]);

  /* pass 83-37 — posting syncs straight into the profile: any screen that
   * committed a post marks the profile dirty and this refetches the moment
   * the tab regains focus (no pull-to-refresh, no long wait). */
  useFocusEffect(() => {
    if (!consumeProfileDirty()) return;
    api
      .userPosts(user?.id != null ? Number(user.id) : undefined)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
    if (user?.id != null) api.profileCounts(Number(user.id)).then(setCounts);
  });

  const name =
    (user?.full_name as string) || (user?.username as string) || "Muslim";
  const badge = (user?.verification_badge as string) || "";
  const username = (user?.username as string) || "";
  const bio = (user?.bio as string) || "";
  const aqeedah = (user?.aqeedah as string) || "";
  /* pass 90 — the desk badge counts the questions WAITING ON HIM (pending +
   * reviewing in his own queue). It used to read askUnreadCount(), which is the
   * number of unread answers on the ASKER's side — a scholar with a full inbox
   * saw no number at all. */
  const [scholarAskCount, setScholarAskCount] = useState<number>(0);
  const isScholarMe =
    ((user as { user_type?: string } | null)?.user_type ?? "") === "scholar" ||
    String(
      (user as { scholar?: { approval_status?: string } | null } | null)?.scholar
        ?.approval_status ?? "",
    ).toLowerCase() === "approved";
  useEffect(() => {
    if (!isScholarMe) return;
    let alive = true;
    (async () => {
      try {
        const c = await api.scholarDeskCounts();
        if (alive && c) setScholarAskCount(Number(c.toAnswer + c.reviewing) || 0);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [isScholarMe]);
  /* refresh the badge when he comes back from answering */
  useFocusEffect(
    useCallback(() => {
      if (!isScholarMe) return;
      api
        .scholarDeskCounts()
        .then((c) => {
          if (c) setScholarAskCount(Number(c.toAnswer + c.reviewing) || 0);
        })
        .catch(() => {});
    }, [isScholarMe]),
  );
  /* pass 80 — the chip follows the SYNCED ledger (dp), not the auth snapshot:
   * after a check-in the auth object never refreshes, so the balance on screen
   * used to stay stale until the next app start. */
  const deenpoints = api.isLive()
    ? dp.points
    : ((user?.deenpoints_balance as number) ?? 0);
  const photo = (user?.profile_image_url as string | number | null) ?? null;

  const doCheckIn = async () => {
    if (checkinBusy || checkin !== "idle") return;
    setCheckinBusy(true);
    haptic.success();
    try {
      await runCheckIn();
    } finally {
      setCheckinBusy(false);
    }
  };

  const runCheckIn = async () => {
    const k = "dl.checkin.date";
    const today = new Date().toISOString().slice(0, 10);
    /* pass 71 — live: the SERVER decides (unique per day) and returns the real
     * points_awarded + new_balance; the coin is pinned to the server value and
     * the earn shows up in Notifications */
    if (api.isLive()) {
      const r = await api.dailyCheckin().catch(() => null);
      if (r?.ok) {
        if (r.balance != null) dp.sync(r.balance);
        if (r.already) {
          await storage.setItem(k, today);
          setCheckin("already");
          return;
        }
        await storage.setItem(k, today);
        markActive();
        markGoal("checkin");
        setCheckin("done");
        /* pass 83-7 — show the REAL awarded amount; >5 means the 7-day
         * streak bonus (+20) fired on the server — celebrate it properly. */
        setReward({ amount: r.points ?? 5, streak: (r.points ?? 0) > 5 });
        return;
      }
    }
    const last = (await storage.getItem(k)) || "";
    if (last === today) {
      setCheckin("already");
      return;
    }
    await storage.setItem(k, today);
    await api.dailyCheckin().catch(() => {});
    markActive();
    markGoal("checkin");
    dp.add(5); /* pass 35 — daily check-in reward (demo fallback) */
    setCheckin("done");
    setReward({ amount: 5, streak: false });
  };

  const like = (id: number) =>
    setPosts((ps) =>
      ps.map((p) =>
        p.id === id
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              like_count: p.like_count + (p.liked_by_me ? -1 : 1),
            }
          : p,
      ),
    );

  const signOut = () => setSignOutOpen(true);

  /* pass 52 — use the shared formatter so the profile chip shows 12.4k / 1.2M
   * exactly like every other screen (this local copy only did 'k'). */
  const fmt = formatDP;

  const Setting = ({
    icon,
    label,
    desc,
    tint,
    onPress,
  }: {
    icon: string;
    label: string;
    desc: string;
    tint: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 13,
        paddingHorizontal: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: `${tint}18`,
          borderWidth: 1,
          borderColor: `${tint}44`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FontAwesome5 name={icon as never} size={13} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="body" style={{ color: d.text, fontWeight: "700", fontSize: 13 }}>
          {label}
        </T>
        <T v="caption" style={{ color: d.faint, fontSize: 10.5, marginTop: 1 }}>
          {desc}
        </T>
      </View>
      <FontAwesome5 name="chevron-right" size={11} color={d.faint} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* header pattern */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 250,
            overflow: "hidden",
          }}
        >
          <Image
            source={isDark ? patternDark : patternLight}
            style={{
              width: "100%",
              height: "100%",
              opacity: d.patternOpacity * 0.5,
            }}
          />
          <LinearGradient
            colors={["transparent", d.bg] as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: "absolute", inset: 0 }}
          />
        </View>

        {/* top bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: insets.top + 8,
            paddingBottom: 6,
          }}
        >
          <T
            v="h2"
            style={{ flex: 1, fontWeight: "800", fontSize: 18, color: d.text }}
          >
            Profile
          </T>
          <Pressable
            accessibilityLabel="get deenpoints"
            onPress={() => {
              haptic.light();
              router.push("/tools/deenpoints");
            }}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              borderWidth: 1,
              borderColor: "rgba(212,175,55,0.45)",
              backgroundColor: isDark
                ? "rgba(212,175,55,0.12)"
                : "rgba(212,175,55,0.08)",
              borderRadius: 16,
              paddingHorizontal: 9,
              paddingVertical: 6,
              marginRight: 8,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Image
              source={deenPointsLogo}
              style={{ width: 14, height: 14 }}
              resizeMode="contain"
            />
            <T
              v="caption"
              style={{
                color: isDark ? "#E8C96A" : "#8C6D1F",
                fontWeight: "800",
                fontSize: 11,
              }}
            >
              {fmt(deenpoints)}
            </T>
          </Pressable>
          {/* pass 87/90 — scholars get a MY QUESTIONS button on their own
           * profile with the number of questions waiting (owner: "in the
           * scholars profile add a button of My Questions with the number of
           * questions"). Tapping it opens the desk where he answers; public
           * answers are posted to his profile automatically by the server. */}
          {isScholarMe ? (
            <Pressable
              accessibilityLabel="My questions — scholar desk"
              onPress={() => { haptic.light(); router.push("/tools/scholar-inbox" as never); }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                height: 32,
                borderRadius: 16,
                paddingHorizontal: 11,
                backgroundColor: isDark ? "rgba(212,175,55,0.14)" : "rgba(29,111,66,0.08)",
                borderWidth: 1,
                borderColor: isDark ? "rgba(212,175,55,0.4)" : "rgba(29,111,66,0.25)",
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <FontAwesome5 name="inbox" size={12} color={isDark ? "#D4AF37" : "#1D6F42"} />
              <T v="caption" style={{ fontSize: 10.5, fontWeight: "800", color: isDark ? "#E8C96A" : "#1D6F42", letterSpacing: 0.2 }}>
                My Questions
              </T>
              {(scholarAskCount ?? 0) > 0 ? (
                <View
                  style={{ minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#E74C3C", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}
                >
                  <T v="caption" style={{ fontSize: 9.5, fontWeight: "900", color: "#fff" }}>{scholarAskCount > 99 ? "99+" : scholarAskCount}</T>
                </View>
              ) : null}
            </Pressable>
          ) : null}
<Pressable
            onPress={() => {
              haptic.selection();
              router.push("/settings");
            }}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: d.cardBorder,
              backgroundColor: d.card,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <FontAwesome5 name="cog" size={14} color={d.subtext} />
          </Pressable>
        </View>

        {/* identity card */}
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <View
            style={{
              backgroundColor: d.card,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: d.cardBorder,
              padding: 16,
              gap: 12,
            }}
          >
            <View
              style={{ flexDirection: "row", gap: 14, alignItems: "center" }}
            >
              <View
                style={{
                  borderWidth: 2,
                  borderColor: d.gold,
                  borderRadius: 40,
                  padding: 2.5,
                }}
              >
                <AvatarImage
                  source={photo}
                  name={name}
                  size={76}
                  tint={d.bgSoft}
                  border="transparent"
                  gender={(user?.gender as string | undefined) ?? null}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  <T
                    v="h3"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color: d.text,
                      fontWeight: "800",
                      fontSize: 16.5,
                      flexShrink: 1,
                    }}
                  >
                    {name}
                  </T>
                  {badge ? (
                    <VerificationBadge
                      type={badge as "blue" | "green" | "gold"}
                      size={14}
                    />
                  ) : null}
                </View>
                <T
                  v="caption"
                  numberOfLines={1}
                  style={{ color: d.faint, fontSize: 11.5, fontWeight: "600" }}
                >
                  @{username}
                </T>
                {aqeedah ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: d.cardBorder,
                      paddingHorizontal: 7,
                      paddingVertical: 2.5,
                      alignSelf: "flex-start",
                    }}
                  >
                    <FontAwesome5
                      name="check-circle"
                      size={8.5}
                      color={d.emerald}
                    />
                    <T
                      v="caption"
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: d.subtext,
                        letterSpacing: 0.4,
                      }}
                    >
                      {aqeedah.toUpperCase()}
                    </T>
                  </View>
                ) : null}
                {/* pass 90 — owner: "he should see himself as scholar with
                 * scholars tag". Approved → the same gold tag the posts carry
                 * ("Scholar · Sunni"); applied but not reviewed yet → an
                 * honest under-review chip that opens the application page. */}
                {(() => {
                  const tag = scholarTagLabel(user as never);
                  if (tag) {
                    return (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          borderRadius: 9,
                          borderWidth: 1,
                          borderColor: "rgba(212,175,55,0.55)",
                          backgroundColor: "rgba(212,175,55,0.12)",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          alignSelf: "flex-start",
                        }}
                      >
                        <T v="caption" style={{ fontSize: 10, fontWeight: "900", color: isDark ? "#E8C96A" : "#8C6D1F", letterSpacing: 0.3 }}>
                          🎓 {tag}
                        </T>
                      </View>
                    );
                  }
                  const st = String(
                    (user as { scholar?: { approval_status?: string } | null } | null)?.scholar
                      ?.approval_status ?? "",
                  ).toLowerCase();
                  /* pass 95 — the owner's rule: a status is a BADGE, never a
                   * spinner, and a rejected application must say so. This chip
                   * was silent for `rejected`, so a refused applicant saw
                   * nothing at all on his own profile. */
                  if (st === "pending" || st === "reviewing" || st === "rejected") {
                    const rejected = st === "rejected";
                    const tone = rejected ? "#F58FB0" : d.faint;
                    return (
                      <Pressable
                        onPress={() => router.push("/tools/scholar-apply" as never)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          borderRadius: 9,
                          borderWidth: 1,
                          borderColor: rejected ? "rgba(245,143,176,0.5)" : d.cardBorder,
                          backgroundColor: d.card,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          alignSelf: "flex-start",
                        }}
                      >
                        <FontAwesome5 name={rejected ? "times-circle" : "hourglass-half"} size={8.5} color={tone} />
                        <T v="caption" style={{ fontSize: 9.5, fontWeight: "800", color: tone, letterSpacing: 0.3 }}>
                          {rejected ? "SCHOLAR APPLICATION · REJECTED — TAP TO FIX" : "SCHOLAR ACCOUNT · UNDER REVIEW"}
                        </T>
                      </Pressable>
                    );
                  }
                  return null;
                })()}
              </View>
            </View>

            {bio ? (
              <T
                v="bodyS"
                style={{ color: d.subtext, fontSize: 12.5, lineHeight: 18 }}
              >
                {bio}
              </T>
            ) : null}

            {/* stats */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { label: "Posts", value: fmt(counts.posts), tab: null },
                {
                  label: "Followers",
                  value: fmt(counts.followers),
                  tab: "followers",
                },
                {
                  label: "Following",
                  value: fmt(counts.following),
                  tab: "following",
                },
              ].map((s) => {
                const inner = (
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 13,
                      backgroundColor: d.bgSoft,
                      borderWidth: 1,
                      borderColor: d.cardBorder,
                      paddingVertical: 9,
                      alignItems: "center",
                    }}
                  >
                    <T
                      v="stat"
                      style={{
                        color: d.text,
                        fontWeight: "800",
                        fontSize: 13.5,
                      }}
                    >
                      {s.value}
                    </T>
                    <T
                      v="caption"
                      style={{
                        color: d.faint,
                        fontSize: 9,
                        fontWeight: "700",
                        letterSpacing: 0.3,
                        marginTop: 1,
                      }}
                    >
                      {s.label.toUpperCase()}
                    </T>
                  </View>
                );
                return s.tab ? (
                  <Pressable
                    key={s.label}
                    style={{ flex: 1 }}
                    onPress={() => {
                      haptic.selection();
                      router.push({
                        pathname: "/tools/connections",
                        params: { tab: s.tab! },
                      } as never);
                    }}
                  >
                    {inner}
                  </Pressable>
                ) : (
                  <View key={s.label} style={{ flex: 1 }}>
                    {inner}
                  </View>
                );
              })}
            </View>

            {/* actions */}
            <View style={{ flexDirection: "row", gap: 9 }}>
              <Pressable
                onPress={() => {
                  haptic.light();
                  router.push("/settings/edit-profile");
                }}
                style={({ pressed }) => ({
                  flex: 1.4,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderRadius: 12,
                  backgroundColor: d.emerald,
                  paddingVertical: 10,
                  opacity: pressed || checkinBusy ? 0.7 : 1,
                })}
              >
                <FontAwesome5 name="user-edit" size={12} color="#FFFFFF" />
                <T
                  v="button"
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "800",
                    fontSize: 12.5,
                  }}
                >
                  Edit Profile
                </T>
              </Pressable>
              <Pressable
                onPress={doCheckIn}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor:
                    checkin === "idle"
                      ? "rgba(212,175,55,0.5)"
                      : "rgba(74,227,143,0.5)",
                  backgroundColor:
                    checkin === "idle"
                      ? isDark
                        ? "rgba(212,175,55,0.1)"
                        : "rgba(212,175,55,0.07)"
                      : "rgba(46,204,113,0.12)",
                  paddingVertical: 10,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                {checkinBusy ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#E8C96A" : "#8C6D1F"}
                  />
                ) : (
                  <FontAwesome5
                    name={checkin === "idle" ? "calendar-check" : "check"}
                    size={12}
                    color={checkin === "idle" ? d.gold : d.emerald}
                  />
                )}
                <T
                  v="button"
                  style={{
                    color:
                      checkin === "idle"
                        ? isDark
                          ? "#E8C96A"
                          : "#8C6D1F"
                        : isDark
                          ? "#4AE38F"
                          : "#1D6F42",
                    fontWeight: "800",
                    fontSize: 12.5,
                  }}
                >
                  {checkinBusy
                    ? "Checking in…"
                    : checkin === "idle"
                      ? "Check In"
                      : "Checked In"}
                </T>
              </Pressable>
            </View>
          </View>
        </View>

        {/* tabs */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
        >
          {[
            { id: "posts" as Tab, label: "My Posts", icon: "th-large" },
            { id: "videos" as Tab, label: "Videos", icon: "video" },
            { id: "saved" as Tab, label: "Saved", icon: "bookmark" },
          ].map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  haptic.selection();
                  setTab(t.id);
                }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 9,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: on
                    ? isDark
                      ? "rgba(74,227,143,0.5)"
                      : "rgba(29,111,66,0.4)"
                    : d.cardBorder,
                  backgroundColor: on
                    ? isDark
                      ? "rgba(46,204,113,0.14)"
                      : "rgba(29,111,66,0.07)"
                    : d.card,
                }}
              >
                <FontAwesome5
                  name={t.icon as never}
                  size={11}
                  color={on ? (isDark ? "#4AE38F" : "#1D6F42") : d.faint}
                />
                <T
                  v="caption"
                  style={{
                    color: on ? (isDark ? "#4AE38F" : "#1D6F42") : d.subtext,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  {t.label}
                </T>
              </Pressable>
            );
          })}
        </View>

        {/* pass 35 — display size (native): the OS font scale no longer shrinks the app */}
        {Platform.OS !== "web" ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 16,
              paddingTop: 10,
            }}
          >
            <FontAwesome5 name="text-height" size={11} color={d.faint} />
            <T
              v="caption"
              style={{ fontSize: 10.5, color: d.faint, fontWeight: "700" }}
            >
              Display size
            </T>
            <View style={{ flexDirection: "row", gap: 6, marginLeft: "auto" }}>
              {UI_SCALES.map((o) => {
                const on = Math.abs(uiScale - o.id) < 0.001;
                return (
                  <Pressable
                    key={o.label}
                    onPress={() => {
                      haptic.selection();
                      setUiScale(o.id);
                    }}
                    style={{
                      width: 34,
                      height: 26,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: on ? "rgba(212,175,55,0.55)" : d.cardBorder,
                      backgroundColor: on ? "rgba(212,175,55,0.14)" : d.card,
                    }}
                  >
                    <T
                      v="caption"
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: on ? (isDark ? "#E8C96A" : "#8C6D1F") : d.faint,
                      }}
                    >
                      {o.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {tab === "posts" ? (
          <View style={{ paddingTop: 14, paddingHorizontal: 16, gap: 12 }}>
            {loadingPosts && posts.length === 0 ? (
              <FeedSkeleton card={d.card} cardBorder={d.cardBorder} count={3} />
            ) : null}
            {posts.map((p) => (
              <FeedCard
                onComments={(pp) => setCommentPost(pp)}
                key={p.id}
                dash={d}
                post={p}
                /* pass 83-25 — group posts on profiles carry a chip into the group */
                group={
                  p.group_id && p.group_name
                    ? { name: p.group_name }
                    : undefined
                }
                onOpenGroup={
                  p.group_id
                    ? () =>
                        router.push({
                          pathname: "/tools/group",
                          params: { id: `srv${p.group_id}` },
                        } as never)
                    : undefined
                }
                lockProfileNav
                onLike={like}
                onDelete={() => {
                  void api.deletePost(p.id).then((ok) => {
                    if (ok) {
                      emitPostDeleted(p.id);
                      setPosts((prev) => prev.filter((x) => x.id !== p.id));
                    }
                  });
                }}
              />
            ))}
            {posts.length === 0 && !loadingPosts ? (
              <T
                v="bodyS"
                style={{ color: d.faint, textAlign: "center", marginTop: 30 }}
              >
                No posts yet — share your first thought in the community.
              </T>
            ) : null}
          </View>
        ) : tab === "videos" ? (
          <View style={{ paddingTop: 14, paddingHorizontal: 16, gap: 12 }}>
            {posts
              .filter((p) => p.video_url || p.youtube_url)
              .map((p) => (
                <FeedCard
                  onComments={(pp) => setCommentPost(pp)}
                  key={p.id}
                  /* pass 90 — owner: "profile video tab posts container on dark
                   * theme, its background is still not same as the normal
                   * Community posts background". This card was the only feed
                   * card rendered without the active dash theme, so it fell
                   * back to a fixed palette. */
                  dash={d}
                  post={p}
                  /* pass 83-25 — group posts on profiles carry a chip into the group */
                  group={
                    p.group_id && p.group_name
                      ? { name: p.group_name }
                      : undefined
                  }
                  onOpenGroup={
                    p.group_id
                      ? () =>
                          router.push({
                            pathname: "/tools/group",
                            params: { id: `srv${p.group_id}` },
                          } as never)
                      : undefined
                  }
                  lockProfileNav
                  onLike={like}
                  onDelete={() => {
                    void api.deletePost(p.id).then((ok) => {
                      if (ok) {
                        emitPostDeleted(p.id);
                        setPosts((prev) => prev.filter((x) => x.id !== p.id));
                      }
                    });
                  }}
                />
              ))}
            {loadingPosts && posts.length === 0 ? (
              <FeedSkeleton card={d.card} cardBorder={d.cardBorder} count={2} />
            ) : null}
            {!loadingPosts && posts.filter((p) => p.video_url || p.youtube_url).length === 0 ? (
              <T
                v="bodyS"
                style={{ color: d.faint, textAlign: "center", marginTop: 30 }}
              >
                No videos yet — attach a video to a community post and it shows
                up here.
              </T>
            ) : null}
          </View>
        ) : (
          <View style={{ paddingTop: 14, paddingHorizontal: 16, gap: 12 }}>
            {saved.map((p) => (
              <FeedCard
                onComments={(pp) => setCommentPost(pp)}
                key={p.id}
                dash={d}
                post={p}
                group={
                  p.group_id && p.group_name
                    ? { name: p.group_name }
                    : undefined
                }
                onOpenGroup={
                  p.group_id
                    ? () =>
                        router.push({
                          pathname: "/tools/group",
                          params: { id: `srv${p.group_id}` },
                        } as never)
                    : undefined
                }
              />
            ))}
            {saved.length === 0 ? (
              <T
                v="bodyS"
                style={{ color: d.faint, textAlign: "center", marginTop: 30 }}
              >
                Nothing saved yet — tap the bookmark on any post to keep it
                here.
              </T>
            ) : null}
          </View>
        )}
      </ScrollView>
      <RewardModal
        visible={!!reward}
        onClose={() => setReward(null)}
        amount={reward?.amount ?? 5}
        title={
          reward?.streak
            ? "Streak bonus! \ud83d\udd25"
            : "Daily check-in complete!"
        }
      />
      <DeenPointsBuyModal
        visible={buyOpen}
        onClose={() => setBuyOpen(false)}
        onBalanceChange={dp.sync}
      />
      <ConfirmDialog
        visible={signOutOpen}
        title="Log out?"
        message="Are you sure you want to log out of DeenLink on this device?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        tone="danger"
        icon="sign-out-alt"
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => {
          setSignOutOpen(false);
          logout();
          try {
            router.dismissAll?.();
          } catch {}
          router.replace("/(auth)/login");
        }}
      />

    <CommentsModal
      visible={!!commentPost}
      post={commentPost}
      seed={[]}
      postId={commentPost?.id ?? null}
      onClose={() => setCommentPost(null)}
    />
    </View>
  );
}

/* pass 81 — guests see the profile shell with a sign-in prompt in the
 * My-Posts space (tap → login), instead of a hard popup. */
function GuestProfilePrompt() {
  const { theme, isDark } = useTheme();
  const d = theme.dash;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: d.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
        <T v="h2" style={{ fontWeight: "900", color: d.text }}>
          Profile
        </T>
      </View>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Pressable
          onPress={() => {
            haptic.selection();
            router.push("/(auth)/login" as never);
          }}
          style={({ pressed }) => ({
            width: "100%",
            maxWidth: 340,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: d.cardBorder,
            backgroundColor: d.card,
            padding: 22,
            alignItems: "center",
            gap: 10,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark
                ? "rgba(74,227,143,0.12)"
                : "rgba(14,122,70,0.08)",
            }}
          >
            <FontAwesome5
              name="user"
              size={17}
              color={isDark ? "#4AE38F" : "#0E7A46"}
            />
          </View>
          <T
            v="body"
            style={{ fontSize: 14.5, fontWeight: "900", color: d.text }}
          >
            Not signed in
          </T>
          <T
            v="caption"
            style={{
              fontSize: 12,
              color: d.subtext,
              textAlign: "center",
              lineHeight: 17,
            }}
          >
            Tap here to sign in or create an account — your posts, saves and
            DeenPoints live here.
          </T>
        </Pressable>
      </View>
    </View>
  );
}

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
export default function Profile() {
  const guest = useIsGuest();
  if (guest) return <GuestProfilePrompt />;
  return <ProfileInner />;
}
