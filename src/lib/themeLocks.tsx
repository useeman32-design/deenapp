import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { T } from "@/components/T";
import { storage } from "@/lib/storage";
import * as api from "@/api/client";
import { useDeenPoints } from "@/components/DeenPoints";

/**
 * pass 88 — PREMIUM LOOKS, shared by the mushaf page-theme picker and the
 * compass ("Change compass") picker.
 *
 *  · the PRICE LIST comes from api/themes/list.php (admin edits
 *    api/themes/catalogue in the repo → every device follows);
 *  · OWNERSHIP too, so a look bought on the phone is already owned on the web;
 *  · offline/demo falls back to the bundled list below + a local ownership
 *    mirror, so the paywall never disappears just because the network did.
 *
 * A locked swatch renders the DeenPoints coin and its price; tapping it asks
 * for confirmation, spends the points, and returns the unlocked look ready to
 * apply. Nothing here persists a theme — the caller applies + saves it, exactly
 * like before, so unlocking never changes what a user sees until they tap it.
 */

export type ThemeKind = "mushaf" | "qibla";

/** Mirrors api/themes/common.php:dl_theme_catalogue() — keep the two in sync. */
export const FALLBACK_CATALOGUE: Record<ThemeKind, Record<string, number>> = {
  mushaf: { cream: 0, white: 0, night: 0, sepia: 120, madina: 180, emerald: 260, sand: 150 },
  qibla: { classic: 0, minimal: 0, bedouin: 120, night: 180, digital: 240, royal: 320 },
};

const MIRROR_KEY = "dl.themeOwns.v1";
let cache: { catalogue: Record<string, Record<string, number>>; owns: Record<string, string[]> } | null = null;
let inflight: Promise<void> | null = null;

const priceOf = (kind: ThemeKind, key: string): number => {
  const fromServer = cache?.catalogue?.[kind]?.[key];
  if (typeof fromServer === "number") return fromServer;
  return FALLBACK_CATALOGUE[kind]?.[key] ?? 0;
};

const ownsLocal = (kind: ThemeKind, key: string): boolean =>
  (cache?.owns?.[kind] ?? []).includes(key);

/** Read the mirror of owned themes from disk (demo/offline path). */
function readMirror(): void {
  if (cache) return;
  cache = { catalogue: {}, owns: {} };
  try {
    void storage.getItem(MIRROR_KEY).then((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string[]>;
      cache = { catalogue: cache?.catalogue ?? {}, owns: parsed ?? {} };
      bump();
    }).catch(() => {});
  } catch { /* ignore */ }
}

const writeMirror = (owns: Record<string, string[]>) => {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    void storage.setItem(MIRROR_KEY, JSON.stringify(owns)).catch(() => {});
  } else {
    try { window.localStorage.setItem(MIRROR_KEY, JSON.stringify(owns)); } catch { /* ignore */ }
  }
};

const listeners = new Set<() => void>();
const bump = () => listeners.forEach((l) => l());

async function load(): Promise<void> {
  readMirror();
  if (inflight) return inflight;
  inflight = (async () => {
    const r = await api.themesList().catch(() => null);
    if (!r) return;
    const cat: Record<string, Record<string, number>> = {};
    Object.entries(r.catalogue ?? {}).forEach(([kind, row]) => {
      cat[kind] = {};
      Object.entries(row ?? {}).forEach(([key, meta]) => {
        cat[kind][key] = Number((meta as { price?: number })?.price ?? 0);
      });
    });
    const owns = r.unlocked ?? {};
    cache = { catalogue: Object.keys(cat).length ? cat : cache?.catalogue ?? {}, owns };
    bump();
  })();
  try { await inflight; } finally { inflight = null; }
}

export type ThemeLocks = {
  priceOf: (kind: ThemeKind, key: string) => number;
  /** true when the look costs points AND this account does not own it yet */
  isLocked: (kind: ThemeKind, key: string) => boolean;
  /** Ask (nicely) to buy. Resolves true when the look may be applied. */
  request: (kind: ThemeKind, key: string, label: string) => Promise<boolean>;
};

export function useThemeLocks(): ThemeLocks {
  const [, tick] = useState(0);
  const dp = useDeenPoints();

  useEffect(() => {
    readMirror();
    void load();
    const fn = () => tick((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const isLocked = useCallback(
    (kind: ThemeKind, key: string) => priceOf(kind, key) > 0 && !ownsLocal(kind, key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );

  const request = useCallback(
    async (kind: ThemeKind, key: string, label: string): Promise<boolean> => {
      const price = priceOf(kind, key);
      if (price <= 0 || ownsLocal(kind, key)) return true;
      const balance = dp.points;
      const answer = await new Promise<"buy" | "cancel">((resolve) => {
        Alert.alert(
          `Unlock ${label}?`,
          price > balance
            ? `This look costs ${price} DeenPoints and your balance is ${balance}. Top up DeenPoints to buy it.`
            : `Costs ${price} DeenPoints · your balance ${balance}. The look is yours forever, on every device.`,
          [
            { text: price > balance ? "Top up later" : "Cancel", style: "cancel", onPress: () => resolve("cancel") },
            { text: price > balance ? "Get DeenPoints" : `Unlock for ${price}`, onPress: () => resolve("buy") },
          ],
        );
      });
      if (answer !== "buy") return false;
      if (price > balance) {
        /* send them to the wallet — the coin modal is the only way in */
        try {
          const { router } = require("expo-router") as { router?: { push: (href: string) => void } };
          router?.push("/tools/deenpoints");
        } catch { /* noop */ }
        return false;
      }
      if (!api.isLive()) {
        /* demo/offline: spend the local coin and remember it on this device */
        dp.spend(price);
        const owns = { ...(cache?.owns ?? {}) };
        owns[kind] = [...(owns[kind] ?? []), key];
        cache = { catalogue: cache?.catalogue ?? {}, owns };
        writeMirror(owns);
        bump();
        return true;
      }
      const out = await api.themeUnlock(kind, key);
      if (!out.ok) {
        Alert.alert("Could not unlock", out.message ?? "Try again in a moment.");
        return false;
      }
      if (out.balance != null) void dp.sync(out.balance);
      if (out.unlocked) {
        cache = { catalogue: cache?.catalogue ?? {}, owns: out.unlocked };
        writeMirror(out.unlocked);
      }
      void load();
      bump();
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dp.points, tick],
  );

  return { priceOf, isLocked, request };
}

/** The little coin + price chip that replaces a lock emoji (owner: no padlocks). */
export function ThemePriceChip({
  price,
  compact = false,
}: {
  price: number;
  compact?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(184,135,11,0.45)",
        backgroundColor: "rgba(184,135,11,0.12)",
        paddingHorizontal: compact ? 5 : 7,
        paddingVertical: compact ? 1.5 : 2.5,
        alignSelf: "flex-start",
      }}
    >
      <Image
        source={require("../../assets/img/deenpoints.png")}
        style={{ width: compact ? 10 : 12, height: compact ? 10 : 12, borderRadius: 3 }}
        contentFit="contain"
      />
      <T v="caption" style={{ color: "#B8870B", fontWeight: "900", fontSize: compact ? 8.5 : 9.5 }}>
        {price}
      </T>
    </View>
  );
}

/** A pressed-through wrapper: fires onPick immediately when the look is owned. */
export function LockedThemePressable({
  locked,
  onPress,
  onUnlock,
  children,
  style,
  accessibilityLabel,
}: {
  locked: boolean;
  onPress: () => void;
  onUnlock: () => void;
  children: React.ReactNode;
  style?: object;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={() => (locked ? onUnlock() : onPress())}
      style={style}
    >
      {children}
    </Pressable>
  );
}
