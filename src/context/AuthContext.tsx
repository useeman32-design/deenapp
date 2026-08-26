import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  currentSession,
  login as apiLogin,
  logout as apiLogout,
  persistSession,
  register as apiRegister,
  restoreSession,
} from '@/api/client';
import type { User } from '@/api/types';
import { MOCK_USER } from '@/api/mocks';

type AuthValue = {
  user: User | null;
  /** True when signed in locally because the API was unreachable. */
  isDemo: boolean;
  ready: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<{ ok: boolean; message?: string }>;
  register: (data: {
    full_name: string;
    username: string;
    email: string;
    password: string;
    aqeedah?: string;
    country?: string;
    gender?: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthValue>({
  user: null,
  isDemo: false,
  ready: false,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
});

function prettyName(identifier: string): string {
  const base = (identifier.split('@')[0] || 'DeenLink User').replace(/[._-]+/g, ' ').trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase()) || 'DeenLink User';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    restoreSession()
      .then(({ user: u, ok }) => {
        if (u) {
          setUser(u);
          setIsDemo(!ok); // ok=false with a user means offline demo
        }
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthValue>(() => {
    const login = async (identifier: string, password: string, rememberMe = true) => {
      const res = await apiLogin(identifier, password, rememberMe);
      if (res.ok && res.user) {
        setUser(res.user);
        setIsDemo(false);
        await persistSession(currentSession() ?? '', null, res.user);
        return { ok: true };
      }
      if (res.demo) {
        // Offline → demo mode so the app stays explorable in previews.
        const u: User = { ...MOCK_USER, full_name: prettyName(identifier), username: identifier.split('@')[0] || 'demo' };
        setUser(u);
        setIsDemo(true);
        return { ok: true };
      }
      return { ok: false, message: res.message };
    };

    const register = async (data: {
      full_name: string;
      username: string;
      email: string;
      password: string;
      aqeedah?: string;
      country?: string;
      gender?: string;
    }) => {
      const res = await apiRegister(data);
      if (res.ok && res.user) {
        setUser(res.user);
        setIsDemo(false);
        await persistSession(currentSession() ?? '', null, res.user);
        return { ok: true };
      }
      if (res.demo) {
        const u: User = { ...MOCK_USER, full_name: data.full_name, username: data.username, email: data.email };
        setUser(u);
        setIsDemo(true);
        return { ok: true };
      }
      return { ok: false, message: res.message };
    };

    const logout = async () => {
      await apiLogout().catch(() => {});
      setUser(null);
      setIsDemo(false);
      await clearSession();
    };

    return { user, isDemo, ready, login, register, logout };
  }, [user, isDemo, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
