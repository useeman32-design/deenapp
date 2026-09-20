import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  currentSession,
  FORCE_DEMO,
  login as apiLogin,
  logout as apiLogout,
  persistSession,
  register as apiRegister,
  restoreSession,
  prefetchHomeData,
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
    /** pass 96 — required by the server for every new account */
    date_of_birth?: string;
  }) => Promise<{
    ok: boolean;
    message?: string;
    /* pass 88 — 'otp' | 'link' | 'none' when needsVerification is true */
    needsVerification?: boolean;
    emailDelivery?: "otp" | "link" | "none";
  }>;
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

  /* Admin moderation must reach an already-open native app, not only the next
   * cold launch. Recheck the server session periodically; /me clears the
   * session for BANNED or disabled accounts. A SUSPENDED account keeps its
   * session by design (pass 90: he can sign in and read, but every social write
   * is refused by the server) — the poll then only re-flags him, and
   * SuspensionNotice shows the strip. */
  useEffect(() => {
    if (!user || isDemo) return;
    const check = async () => {
      const result = await restoreSession();
      if (result.user) setUser(result.user);
      else setUser(null);
    };
    const timer = setInterval(() => { void check(); }, 45_000);
    return () => clearInterval(timer);
  }, [user, isDemo]);

  const value = useMemo<AuthValue>(() => {
    const login = async (identifier: string, password: string, rememberMe = true) => {
      const res = await apiLogin(identifier, password, rememberMe);
      if (res.ok && res.user) {
        setUser(res.user); void exitGuest();
        setIsDemo(false);
        await persistSession(currentSession() ?? '', null, res.user);
        return { ok: true };
      }
      if (res.demo && FORCE_DEMO) {
        // Offline → demo mode so the app stays explorable in PREVIEWS only.
        // On the live app domain a network error must NEVER mint a mock
        // identity (pass 83-1: owner was signed in as "demo" on slow network).
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
      date_of_birth?: string;
    }) => {
      const res = await apiRegister(data);
      /* pass 66-night — an unverified account is NEVER signed in: the server
       * mints no session at register; the OTP step (verify_otp) mints it. */
      if (res.ok && res.needsVerification) {
        /* pass 88 — pass the delivery mode up so the OTP screen can tell the
         * truth about what landed in the inbox (code vs. link). */
        return {
          ok: true,
          needsVerification: true,
          emailDelivery: res.emailDelivery ?? ("otp" as const),
        };
      }
      if (res.ok && res.user) {
        setUser(res.user); void exitGuest();
        setIsDemo(false);
        await persistSession(currentSession() ?? '', null, res.user);
        return { ok: true };
      }
      if (res.demo && FORCE_DEMO) {
        // Preview-only offline demo (pass 83-1: never mint mock identities on live).
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
      prefetchHomeData(); /* pass 83-36 — instant tabs after OTP resume too */
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
