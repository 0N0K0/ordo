import { Badge, NavLink } from '@mantine/core';
import { EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useMailAccounts, useUnreadMailCount } from './api';

/**
 * "Mails" entry of the sidebar, with the unread count of the inboxes.
 * @param {{ active: boolean }} props Component props.
 * @returns {JSX.Element} Link.
 */
export function MailNavLink({ active }: { active: boolean }) {
  const { data: accounts } = useMailAccounts();
  const { data: unread } = useUnreadMailCount((accounts?.length ?? 0) > 0);
  return (
    <NavLink
      component={Link}
      to="/mail"
      label="Mails"
      leftSection={<EnvelopeSimpleIcon aria-hidden />}
      rightSection={
        unread ? (
          <Badge size="sm" variant="filled" aria-label={`${unread} non lus`}>
            {unread}
          </Badge>
        ) : null
      }
      active={active}
    />
  );
}
