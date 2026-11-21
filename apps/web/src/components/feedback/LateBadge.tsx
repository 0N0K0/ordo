import { Badge } from '@mantine/core';
import * as fmt from '../../lib/format';
import { LATE_COLOR } from './feedback-colors';

/**
 * Lateness of a row of the home page, the same on every card: « 3 j de retard », in orange.
 * @param {{ due: string, today: string }} props Component props: the day it was due, today (YYYY-MM-DD).
 * @returns {JSX.Element} Badge.
 */
export function LateBadge({ due, today }: { due: string; today: string }) {
  return (
    <Badge color={LATE_COLOR} variant="light">
      {fmt.daysLate(due, today)}
    </Badge>
  );
}
