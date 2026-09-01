import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { storage } from '@/lib/storage';

/**
 * pass 35 — global UI text scale ("Display size").
 *
 * WHY: on Android the OS "Font size" setting scales every <Text> down (e.g.
 * 80%), which made the whole native app look zoomed-out compared to web.
 * <T> now ignores the OS font scale (allowFontScaling=false) and applies
 * OUR scale instead — default 1.0 = pixel-exact design sizes, and the user
 * can bump to 110 / 125% in Profile → Settings if they want it larger.
 */

export const UI_SCALES = [
  { id: 0.9, label: 'S' },
  { id: 1, label: 'M' },
  { id: 1.1, label: 'L' },
  { id: 1.25, label: 'XL' },
] as const;

export const UI_SCALE_KEY = 'dl.ui.scale';

const ScaleCtx = createContext<number>(1);
const SetCtx = createContext<(s: number) => void>(() => {});

export function UIScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    storage.getItem(UI_SCALE_KEY)
      .then((raw) => {
        const n = parseFloat(String(raw ?? '1'));
        if (Number.isFinite(n) && n > 0.5 && n < 1.6) setScale(n);
      })
      .catch(() => {});
  }, []);
  const apply = (s: number) => {
    storage.setItem(UI_SCALE_KEY, String(s)).catch(() => {});
    setScale(s);
  };
  return (
    <ScaleCtx.Provider value={Platform.OS === 'web' ? 1 : scale}>
      <SetCtx.Provider value={apply}>{children}</SetCtx.Provider>
    </ScaleCtx.Provider>
  );
}

export const useUIScale = () => useContext(ScaleCtx);
export const useSetUIScale = () => useContext(SetCtx);
