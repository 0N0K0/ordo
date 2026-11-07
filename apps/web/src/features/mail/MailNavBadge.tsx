import { Badge, Group, Tooltip } from '@mantine/core';
import { useMailAccounts, useTodoMailCount, useUnreadMailCount } from './api';

/**
 * Counts on the "Mails" entry of the sidebar: mails to do (every folder but drafts, sent, archive, junk and
 * trash), and unread ones (inboxes).
 * @returns {JSX.Element | null} Badges.
 */
export function MailNavBadge() {
  const { data: accounts } = useMailAccounts();
  const enabled = (accounts?.length ?? 0) > 0;
  const { data: unread } = useUnreadMailCount(enabled);
  const { data: todo } = useTodoMailCount(enabled);
  if (!unread && !todo) return null;
  return (
    <Group gap={4} wrap="nowrap">
      {!!todo && (
        <Tooltip label={`${todo} à traiter`}>
          <Badge size="sm" variant="light" color="orange" aria-label={`${todo} à traiter`}>
            {todo}
          </Badge>
        </Tooltip>
      )}
      {!!unread && (
        <Tooltip label={`${unread} non lu${unread > 1 ? 's' : ''}`}>
          <Badge size="sm" variant="filled" aria-label={`${unread} non lus`}>
            {unread}
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
}
