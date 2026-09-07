import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { storage } from '@/lib/storage';
import { isGuestNow } from '@/lib/guest';

export default function Index() {
  const { ready, user } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    storage.getItem('dl.onboarded').then((v) => setOnboarded(v === '1'));
  }, []);

  if (!ready || onboarded === null) return null;
  if (user) return <Redirect href="/(tabs)" />;
  /* pass 82 — guests browse Home like everyone else (locked actions pop the
     LoginRequired modal); the Skip button still lands them on Tools first.
     Redirecting guests away from '/' made the Home tab unreachable. */
  if (isGuestNow()) return <Redirect href="/(tabs)" />;
  return <Redirect href={onboarded ? '/(auth)/login' : '/onboarding'} />;
}
