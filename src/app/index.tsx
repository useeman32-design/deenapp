import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { storage } from '@/lib/storage';

export default function Index() {
  const { ready, user } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    storage.getItem('dl.onboarded').then((v) => setOnboarded(v === '1'));
  }, []);

  if (!ready || onboarded === null) return null;
  if (user) return <Redirect href="/(tabs)" />;
  return <Redirect href={onboarded ? '/(auth)/login' : '/onboarding'} />;
}
