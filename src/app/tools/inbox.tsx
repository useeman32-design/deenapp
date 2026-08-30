import { CommunityInbox } from '@/components/CommunityInbox';

/** Inbox route (pass 22) — standalone entry from quick-access shortcuts. */
export default function InboxScreen() {
  return <CommunityInbox visible standalone onClose={() => undefined} />;
}
