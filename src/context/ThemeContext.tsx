import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Theme } from '@/constants/theme';
import { storage } from '@/lib/storage';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeCtx = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: Theme;
  isDark: boolean;
};

const Ctx = createContext<ThemeCtx>({
  mode: 'system',
  setMode: () => {},
  theme: light,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    storage.getItem('dl.theme').then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const theme = isDark ? dark : light;

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    storage.setItem('dl.theme', m);
  };

  const value = useMemo(
    () => ({ mode, setMode, theme, isDark }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, isDark, theme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
