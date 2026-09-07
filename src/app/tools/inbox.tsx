import { router, useLocalSearchParams } from 'expo-router';
import { CommunityInbox } from '@/components/CommunityInbox';
import { useIsGuest } from '@/lib/guest';
import { LoginRequired } from '@/components/LoginRequired';

/** pass 59 — `?u=<username>` opens that person's thread directly, so the
 *  Message button on a public profile lands you in the conversation. */
function InboxRouteInner() {
  const { u } = useLocalSearchParams<{ u?: string }>();
  const who = typeof u === 'string' && u ? u : null;
  /* pass 81 — the X must leave the inbox: back when possible, home otherwise
   * (it used to be a no-op, so the button sometimes 'didn't go back'). */
  return (
    <CommunityInbox
      visible
      standalone
      initialFriend={who}
      onClose={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)' as never); }}
    />
  );
}

/* pass 80 — guest mode: only Tools are available; this module asks for login. */
export default function InboxRoute() {
  const guest = useIsGuest();
  if (guest) return <LoginRequired module="Inbox" />;
  return <InboxRouteInner />;
}
