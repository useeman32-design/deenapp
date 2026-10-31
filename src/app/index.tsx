import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { storage } from '@/lib/storage';
import { isGuestNow } from '@/lib/guest';

export default function Index() {
  const { ready, user } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true, settled = false;
    const finish = (v: boolean) => { if (active && !settled) { settled = true; setOnboarded(v); } };
    const timeout = setTimeout(() => finish(false), 3000);
    storage.getItem('dl.onboarded').then((v) => finish(v === '1')).catch(() => finish(false)).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); };
  }, []);

  if (!ready || onboarded === null) return null;
  if (user) return <Redirect href="/(tabs)" />;
  if (isGuestNow()) return <Redirect href="/(tabs)/tools" />; // pass 80 — guests land on Tools
  return <Redirect href={onboarded ? '/(auth)/login' : '/onboarding'} />;
}
