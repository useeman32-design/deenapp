import { useLocalSearchParams } from 'expo-router';
import { CommunityInbox } from '@/components/CommunityInbox';

/** pass 59 — `?u=<username>` opens that person's thread directly, so the
 *  Message button on a public profile lands you in the conversation. */
export default function InboxRoute() {
  const { u } = useLocalSearchParams<{ u?: string }>();
  const who = typeof u === 'string' && u ? u : null;
  return <CommunityInbox visible standalone initialFriend={who} onClose={() => undefined} />;
}
