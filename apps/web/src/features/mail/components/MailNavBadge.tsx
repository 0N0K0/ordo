import { Group } from '@mantine/core';
import { useMailAccounts, useTodoMailCount, useUnreadMailCount } from '../api';
import { MailCountBadges } from './MailCountBadges';

/**
 * Counts on the "Mails" entry of the sidebar: mails to do (every folder but drafts, sent, archive, junk and
 * trash), and unread ones (inboxes).
 * @returns {JSX.Element | null} Badges.
 */
export function MailNavBadge() {
  const { data: accounts } = useMailAccounts();
  const enabled = (accounts ?? []).some((account) => !account.archived);
  const { data: unread } = useUnreadMailCount(enabled);
  const { data: todo } = useTodoMailCount(enabled);
  if (!unread && !todo) return null;
  return (
    <Group gap={4} wrap="nowrap">
      <MailCountBadges todo={todo ?? 0} unread={unread ?? 0} />
    </Group>
  );
}
