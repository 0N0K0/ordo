import { Badge } from '@mantine/core';
import { useMailAccounts, useUnreadMailCount } from './api';

/**
 * Unread count of the inboxes, on the "Mails" entry of the sidebar.
 * @returns {JSX.Element | null} Badge.
 */
export function MailNavBadge() {
  const { data: accounts } = useMailAccounts();
  const { data: unread } = useUnreadMailCount((accounts?.length ?? 0) > 0);
  if (!unread) return null;
  return (
    <Badge size="sm" variant="filled" aria-label={`${unread} non lus`}>
      {unread}
    </Badge>
  );
}
