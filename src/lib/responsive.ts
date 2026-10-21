import { Platform, useWindowDimensions } from 'react-native';

/**
 * pass 107 — one place to ask "how wide is this device, and how should content
 * be laid out on it".
 *
 * WHY THIS EXISTS. The owner reported that the app "shows like a mobile screen
 * on big screens or PC" and that iPad / Android tablet / desktop users "will not
 * have a full experience". Two separate things were causing that:
 *
 *   1. On WEB, `_layout.tsx` injected CSS pinning #root to a hard 480px column
 *      at any viewport >= 620px. That was a deliberate letterbox added to stop
 *      content stretching, but it never grew with the screen: a 1920px monitor
 *      got a phone-shaped strip down the middle with dead space either side.
 *
 *   2. On NATIVE there was no cap at all. `Screen.tsx` looked like the shared
 *      wrapper, but **not one of the 73 screens in src/app uses it** — every
 *      screen builds its own layout from raw Views. So on an Android tablet the
 *      app stretched edge-to-edge: 1280px-wide feed cards and text lines long
 *      enough to lose your place on.
 *
 * Because no shared screen wrapper exists, per-screen fixes would have meant
 * editing 73 files. Instead the cap is applied ONCE, at the root of the tree in
 * `_layout.tsx`, which puts it above the router — so every screen, every modal
 * and the floating tab bar are constrained together, on web and native alike.
 * This hook is what that root wrapper and any grid that wants extra columns
 * consult.
 *
 * Phones are untouched: below the tablet breakpoint there is no cap at all, so
 * nothing about the existing mobile design changes.
 */

export type DeviceClass = 'phone' | 'tablet' | 'desktop';

/** Matches the 620px the old web letterbox used, so nothing shifts at that seam. */
export const BP_TABLET = 620;
export const BP_DESKTOP = 1024;

/**
 * Content column width per class. Deliberately generous on desktop — the point
 * is to USE the screen, not to reproduce a phone in the middle of it. `null`
 * means "no cap", which is what phones get.
 */
const CONTENT_MAX: Record<DeviceClass, number | null> = {
  phone: null,
  tablet: 700,
  desktop: 1100,
};

/**
 * The width a screen's layout maths should use. Inside <ResponsiveShell> a
 * screen's container is the centred column, not the window — so anything that
 * computes slide widths, page widths or absolute x positions from
 * Dimensions.get('window').width comes out too wide on a tablet or desktop and
 * spills past the column's right edge. Four call sites did exactly that; they
 * now all go through this. On a phone the cap is null and this returns the
 * window width unchanged.
 */
export function contentWidthForWindow(windowWidth: number): number {
  const cap = contentMaxWidthFor(windowWidth);
  return cap ? Math.min(windowWidth, cap) : windowWidth;
}

export function classForWidth(width: number): DeviceClass {
  if (width >= BP_DESKTOP) return 'desktop';
  if (width >= BP_TABLET) return 'tablet';
  return 'phone';
}

export function contentMaxWidthFor(width: number): number | null {
  return CONTENT_MAX[classForWidth(width)];
}

/**
 * How many columns a card grid should use. A grid written as `width: '48%'`
 * gives 2 columns at any size, which is why the tools hub looked enormous on a
 * tablet; pass `base` for the phone count and this scales it up.
 */
export function gridColumnsFor(width: number, base = 2): number {
  const c = classForWidth(width);
  if (c === 'desktop') return Math.max(base, base + 2);
  if (c === 'tablet') return Math.max(base, base + 1);
  return base;
}

/**
 * Exact item width for a flexWrap grid with a dp `gap`.
 *
 * The obvious shortcut — subtract a fixed percentage, e.g. 48% for two columns
 * — is wrong at the small end: a 12dp gap is 3.3% of a 360dp phone but 1.2% of
 * a 1000dp tablet, so one constant either leaves a visible gutter on wide
 * screens or pushes the second column onto its own row on a phone. Measure the
 * container instead and divide what is actually left after the gaps.
 */
export function gridItemWidthPx(containerWidth: number, columns: number, gap: number): number {
  const n = Math.max(1, columns);
  if (!containerWidth || containerWidth <= 0) return 0;
  return Math.max(0, (containerWidth - gap * (n - 1)) / n);
}

/**
 * Percentage form, for layouts that cannot measure. Only safe where the gap is
 * small relative to the container (tablet/desktop); on a phone prefer
 * gridItemWidthPx. The first version of this helper subtracted the gap as if it
 * were a percentage of the row, which would have dropped a phone grid to one
 * column — caught by working through a 360dp row before shipping it.
 */
export function gridItemWidth(columns: number, gapPct = 1.5): string {
  if (columns <= 1) return '100%';
  return `${(100 / columns - gapPct).toFixed(4)}%`;
}

export interface Responsive {
  /** full window width in dp */
  width: number;
  height: number;
  cls: DeviceClass;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** true when the device is wide enough that the change is worth making */
  isWide: boolean;
  /** max width for the content column, or null for "no cap" (phones) */
  contentMaxWidth: number | null;
  /** columns for a grid whose phone layout uses `base` */
  columns: (base?: number) => number;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const cls = classForWidth(width);
  return {
    width,
    height,
    cls,
    isPhone: cls === 'phone',
    isTablet: cls === 'tablet',
    isDesktop: cls === 'desktop',
    isWide: cls !== 'phone',
    contentMaxWidth: CONTENT_MAX[cls],
    columns: (base = 2) => gridColumnsFor(width, base),
  };
}

/**
 * Non-hook version for the root layout's injected web CSS, which runs outside
 * render. Kept separate so the hook stays the only thing components import.
 */
export function webContentCss(): string {
  /* The root View now caps and centres content on every platform, so the old
   * `#root { max-width: 480px }` letterbox is gone. What web still needs is for
   * the canvas BESIDE that column to be theme-coloured rather than white, and
   * for the document to scroll inside the column rather than the body. */
  return `
    @media (min-width: ${BP_TABLET}px) {
      html, body { overflow: hidden; }
    }`;
}

export const RESPONSIVE_PLATFORM_NOTE = Platform.OS;
