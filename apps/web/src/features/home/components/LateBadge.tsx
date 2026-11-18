import { Badge } from '@mantine/core';
import * as fmt from '../../../lib/format';

/**
 * Lateness of a row of the home page, the same on every card (decision AI): « 3 j de retard », in orange.
 * @param {{ due: string, today: string }} props Component props: the day it was due, today (YYYY-MM-DD).
 * @returns {JSX.Element} Badge.
 */
export function LateBadge({ due, today }: { due: string; today: string }) {
  return (
    <Badge color="orange" variant="light">
      {fmt.daysLate(due, today)}
    </Badge>
  );
}
