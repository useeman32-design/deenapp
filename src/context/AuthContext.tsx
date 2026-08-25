import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from '@/api/client';
import type { User } from '@/api/mocks';
import { storage } from '@/lib/storage';

type AuthValue = {
  user: User | null;
  /** True when signed in locally because the API was unreachable. */
  isDemo: boolean;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    username: string;
    email: string;
    password: string;
    mizhab: string;
  }) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthValue>({
  user: null,
  isDemo: false,
  ready: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

function prettyName(email: string): string {
  const base = (email.split('@')[0] || 'DeenLink User').replace(/[._-]+/g, ' ').trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase()) || 'DeenLink User';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage
      .getItem('dl.auth')
      .then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw) as { user: User; token: string; demo: boolean };
          setUser(d.user);
          setIsDemo(!!d.demo);
          setAuthToken(d.token || null);
        } catch {
          // ignore
        }
      })
      .finally(() => setReady(true));
  }, []);

  const persist = (u: User, token: string, demo: boolean) => {
    setUser(u);
    setIsDemo(demo);
    setAuthToken(token || null);
    storage.setItem('dl.auth', JSON.stringify({ user: u, token, demo }));
  };

  const value = useMemo<AuthValue>(() => {
    const login = async (email: string, password: string) => {
      try {
        const res = await api.login(email, password);
        persist(res.user, res.token, false);
      } catch {
        // Demo mode: API not reachable — sign in locally so the app is explorable.
        persist(
          { id: 'demo', name: prettyName(email), username: email.split('@')[0] || 'demo', mizhab: 'Sunni' },
          '',
          true,
        );
      }
    };
    const register = async (data: {
      name: string;
      username: string;
      email: string;
      password: string;
      mizhab: string;
    }) => {
      try {
        const res = await api.register(data);
        persist(res.user, res.token, false);
      } catch {
        persist({ id: 'demo', name: data.name, username: data.username, mizhab: data.mizhab }, '', true);
      }
    };
    const logout = () => {
      setUser(null);
      setIsDemo(false);
      setAuthToken(null);
      storage.removeItem('dl.auth');
    };
    return { user, isDemo, ready, login, register, logout };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDemo, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
