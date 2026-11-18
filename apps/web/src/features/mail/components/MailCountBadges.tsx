import { Badge, Tooltip } from '@mantine/core';
import { plural } from '../../../lib/text';

interface MailCountBadgesProps {
  /** Mails to do. */
  todo: number;
  /** Unread mails. */
  unread: number;
  /** Small badges, round under 10 (a folder of the list), instead of those of the sidebar entry. Optional. */
  compact?: boolean;
}

/**
 * Counts of mails « à traiter » (light, orange) and « non lus » (filled), each shown when not zero, with their tooltip.
 * @param {MailCountBadgesProps} props Component props.
 * @returns {JSX.Element} Badges.
 */
export function MailCountBadges({ todo, unread, compact = false }: MailCountBadgesProps) {
  const size = compact ? 'xs' : 'sm';
  const unreadLabel = `${unread} non ${plural(unread, 'lu')}`;
  return (
    <>
      {todo > 0 && (
        <Tooltip label={`${todo} à traiter`}>
          <Badge size={size} variant="light" color="orange" circle={compact && todo < 10} aria-label={`${todo} à traiter`}>
            {todo}
          </Badge>
        </Tooltip>
      )}
      {unread > 0 && (
        <Tooltip label={unreadLabel}>
          <Badge size={size} variant="filled" circle={compact && unread < 10} aria-label={unreadLabel}>
            {unread}
          </Badge>
        </Tooltip>
      )}
    </>
  );
}
