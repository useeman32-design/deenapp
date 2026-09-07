import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * pass 67 — the back button must NEVER dead-end. Screens opened from a deep
 * link, a notification, or a restored native session have no history stack,
 * so router.back() silently does nothing and the user is trapped until they
 * kill the app. goBack() falls back to replacing into the home tabs, so
 * there is always a way out.
 */
export function goBack(router: Router, fallback: '/(tabs)' | '/(auth)/login' = '/(tabs)'): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
