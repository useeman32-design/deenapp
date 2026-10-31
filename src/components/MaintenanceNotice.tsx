import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { goBack } from '@/lib/navigation';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/context/ThemeContext';

/**
 * pass 122 — the maintenance screen, done once and done properly.
 *
 * Before this there were TWO different maintenance layouts, each with its own
 * defect, and the owner noticed both:
 *
 *  · `MaintenanceGate` (master switch + top-level modules) built its box with
 *    `flex: compact ? 1 : undefined`. Without `flex: 1` its own
 *    `justifyContent: 'center'` did nothing, so the full-app screen sat glued to
 *    the top of the viewport — and its only button was rendered behind a
 *    `compact &&` test, so the master screen had NO way out at all.
 *  · `tools/_layout` (Mirath, Zakat, Prayer, Quiz, …) put its `<TopBar showBack>`
 *    INSIDE an `alignItems: 'center'` column and then tried to compensate with
 *    `marginTop: -40`. A TopBar in a centred column shrinks to its content width
 *    and floats mid-screen — which is precisely why "the back button hardly
 *    works": it was drawn at ~40% screen height over the copy instead of pinned
 *    to the top-left where the other 13 TopBar screens put it.
 *
 * One component owns the layout now: the bar at the top edge (it applies its own
 * safe-area inset and its `BackButton` already falls back to `replace('/(tabs)')`
 * when there is no history to pop — the deep-link / no-stack case), the card
 * genuinely centred, both actions at least 50px tall, and the card capped at 420
 * wide so a tablet gets a card rather than a stretched band of text.
 *
 * "Try again" is functional, not decoration: it calls
 * `maintenanceFlags({ force: true })`, bypassing the 60s TTL from pass 121, so a
 * user returns the instant an admin switches the module back on. If the area is
 * still off, the card says so and shows when it last checked — an unexplained
 * dead end is what makes a maintenance screen feel broken rather than intended.
 */
export type MaintenanceVariant = 'master' | 'module';
/** Which token set the card is drawn on: the app theme, or the tools dashboard. */
export type MaintenancePalette = 'app' | 'dash';

const AMBER = '#F57C00';
const AMBER_SOFT = 'rgba(245,124,0,0.12)';
const AMBER_LINE = 'rgba(245,124,0,0.32)';

export function MaintenanceNotice({
  variant,
  moduleName,
  bg,
  onRetry,
  palette = 'app',
}: {
  variant: MaintenanceVariant;
  /** 'dash' keeps the card on the tools dashboard palette (#0D1B13 dark, not the
   *  app's #2C3E50) — a blue-grey card floating on near-black emerald reads as a
   *  different app, which is part of what made the old screen feel unbalanced. */
  palette?: MaintenancePalette;
  /** Human label for the gated module; omit for generic wording. */
  moduleName?: string;
  /** Backdrop, so tools/* can keep its own dashboard background. */
  bg?: string;
  /** Re-check the flags. Resolves true when the area is STILL under maintenance. */
  onRetry?: () => Promise<boolean>;
}) {
  const { theme } = useTheme();
  const d = theme.dash;
  const dash = palette === 'dash';
  const cardBg = dash ? d.card : theme.card;
  const cardLine = dash ? d.cardBorder : theme.border;
  const titleColor = dash ? d.text : undefined;
  const bodyColor = dash ? d.subtext : undefined;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [stillDown, setStillDown] = useState<boolean | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const retry = useCallback(async () => {
    if (!onRetry || busy) return;
    setBusy(true);
    haptic.light();
    try {
      setStillDown((await onRetry()) === true);
    } catch {
      setStillDown(true);
    } finally {
      setCheckedAt(Date.now());
      setBusy(false);
    }
  }, [busy, onRetry]);

  const exit = useCallback(() => {
    haptic.light();
    /* The single app-wide rule: pop if there is history, otherwise replace into
     * the feed. A gated screen reached from a notification has no stack, and a
     * bare router.back() there is the "button does nothing" the owner hit. */
    goBack(router);
  }, [router]);

  const title =
    variant === 'master'
      ? 'DeenLink is under maintenance'
      : moduleName
        ? `${moduleName} is under maintenance`
        : 'This area is under maintenance';

  const body =
    variant === 'master'
      ? 'We are improving DeenLink right now. Your account, bookmarks and progress are safe — everything will be exactly where you left it.'
      : moduleName
        ? `${moduleName} is switched off for a short while so we can fix or improve it. The rest of DeenLink keeps working as normal.`
        : 'This section is temporarily unavailable while we work on improvements, in shaa Allah. The rest of DeenLink keeps working as normal.';

  const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={{ flex: 1, backgroundColor: bg ?? (dash ? d.bg : theme.background) }}>
      {variant === 'module' ? <TopBar showBack title="Under maintenance" /> : null}

      <View
        pointerEvents="box-none"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 34 }}
      >
        <View
          accessibilityLiveRegion="polite"
          style={{
            width: '100%',
            maxWidth: 420,
            alignItems: 'center',
            backgroundColor: cardBg,
            borderColor: cardLine,
            borderWidth: 1,
            borderRadius: 22,
            paddingTop: 30,
            paddingBottom: 26,
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 66,
              height: 66,
              borderRadius: 33,
              backgroundColor: AMBER_SOFT,
              borderWidth: 1,
              borderColor: AMBER_LINE,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
            }}
          >
            <FontAwesome5 name="tools" size={26} color={AMBER} />
          </View>

          <T
            v="h3"
            style={{ marginTop: 14, fontSize: 19, lineHeight: 26, fontWeight: '800', letterSpacing: -0.2, textAlign: 'center', color: titleColor }}
          >
            {title}
          </T>

          <T v="body" style={{ marginTop: 9, maxWidth: 350, fontSize: 14, lineHeight: 21.5, textAlign: 'center', opacity: 0.72, color: bodyColor }}>
            {body}
          </T>

          <View style={{ marginTop: 22, width: '100%', maxWidth: 344, flexDirection: 'row', gap: 10 }}>
            {variant === 'module' ? (
              <Action label="Back to the feed" tone="ghost" onPress={exit} style={{ flex: 11 }} />
            ) : null}
            <Action label={busy ? 'Checking…' : 'Try again'} tone="solid" onPress={onRetry ? retry : undefined} busy={busy} style={{ flex: 9 }} />
          </View>

          {checkedAt !== null ? (
            <T v="caption" style={{ marginTop: 13, fontSize: 11.5, opacity: 0.55, textAlign: 'center' }}>
              {stillDown
                ? `Still under maintenance · checked ${clock(checkedAt)}`
                : `Back online · checked ${clock(checkedAt)}`}
            </T>
          ) : variant === 'master' ? (
            <T v="caption" style={{ marginTop: 13, fontSize: 11.5, opacity: 0.5, textAlign: 'center' }}>
              This screen refreshes itself — you can also just wait a moment.
            </T>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Action({
  label,
  tone,
  onPress,
  busy,
  style,
}: {
  label: string;
  tone: 'solid' | 'ghost';
  onPress?: () => void;
  busy?: boolean;
  style?: object;
}) {
  const solid = tone === 'solid';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      disabled={!onPress || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 50,
          borderRadius: 15,
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 10,
          backgroundColor: solid ? AMBER : 'transparent',
          borderColor: solid ? AMBER : 'rgba(128,128,128,0.34)',
          opacity: !onPress ? 0.5 : pressed ? 0.82 : 1,
        },
        style as object,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={solid ? '#FFFFFF' : AMBER} /> : null}
      <T v="bodyS" style={{ fontSize: 13.5, fontWeight: '800', color: solid ? '#FFFFFF' : undefined }}>
        {label}
      </T>
    </Pressable>
  );
}
