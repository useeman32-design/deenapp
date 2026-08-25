import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { ready, user } = useAuth();
  if (!ready) return null;
  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}
