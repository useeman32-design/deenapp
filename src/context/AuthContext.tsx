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
import { exitGuest } from '@/lib/guest';

type AuthValue = {
  user: User | null;
  /** True when signed in locally because the API was unreachable. */
  isDemo: boolean;
  ready: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<{ ok: boolean; message?: string; needsVerification?: boolean; email?: string }>;
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
  updateUser: (patch: Partial<User>) => void;
  adoptSession: (u: User) => Promise<void>;
};

const Ctx = createContext<AuthValue>({
  user: null,
  isDemo: false,
  ready: false,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
  updateUser: () => {},
  adoptSession: async () => {},
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
          setUser(u); void exitGuest();
          setIsDemo(!ok); // ok=false with a user means offline demo
        }
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthValue>(() => {
    const login = async (identifier: string, password: string, rememberMe = true) => {
      const res = await apiLogin(identifier, password, rememberMe);
      if (res.ok && res.user) {
        setUser(res.user); void exitGuest();
        setIsDemo(false);
        await persistSession(currentSession() ?? '', null, res.user);
        return { ok: true };
      }
      if (res.demo) {
        // Offline → demo mode so the app stays explorable in previews.
        const u: User = { ...MOCK_USER, full_name: prettyName(identifier), username: identifier.split('@')[0] || 'demo' };
        setUser(u); void exitGuest();
        setIsDemo(true);
        return { ok: true };
      }
      /* unverified account: no session was minted — the UI resumes the OTP flow */
      return { ok: false, message: res.message, needsVerification: !!res.needsVerification, email: res.email };
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
      /* pass 66-night — an unverified account is NEVER signed in: the server
       * mints no session at register; the OTP step (verify_otp) mints it. */
      if (res.ok && res.needsVerification) {
        return { ok: true, needsVerification: true };
      }
      if (res.ok && res.user) {
        setUser(res.user); void exitGuest();
        setIsDemo(false);
        await persistSession(currentSession() ?? '', null, res.user);
        return { ok: true };
      }
      if (res.demo) {
        const u: User = { ...MOCK_USER, full_name: data.full_name, username: data.username, email: data.email };
        setUser(u); void exitGuest();
        setIsDemo(true);
        return { ok: true };
      }
      return { ok: false, message: res.message };
    };

    /* pass 66-night — adopt the session the verify_otp response just minted. */
    const adoptSession = async (u: User) => {
      setUser(u); void exitGuest();
      setIsDemo(false);
      await persistSession(currentSession() ?? '', null, u);
    };

    const logout = async () => {
      await apiLogout().catch(() => {});
      setUser(null);
      setIsDemo(false);
      await clearSession();
    };

    const updateUser = (patch: Partial<User>) => setUser((u) => (u ? { ...u, ...patch } : u));
    return { user, isDemo, ready, login, register, logout, updateUser, adoptSession };
  }, [user, isDemo, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
