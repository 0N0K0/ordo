import { Badge } from '@mantine/core';
import type { TreasuryDirection } from '@ordo/shared';
import { DIRECTION_COLORS, DIRECTION_LABELS } from '../lib/direction';

/**
 * Direction of money (of a budget, of what a payment method serves): « Entrée » in green, « Sortie » in red.
 * @param {{ direction: string | undefined, plural?: boolean }} props Direction (none: nothing shown), and whether it reads « Entrées » / « Sorties ». Optional plural. Default = false.
 * @returns {JSX.Element | null} Badge.
 */
export function DirectionBadge({ direction, plural = false }: { direction: string | undefined; plural?: boolean }) {
  if (direction !== 'IN' && direction !== 'OUT') return null;
  return (
    <Badge size="xs" variant="light" color={DIRECTION_COLORS[direction as TreasuryDirection]}>
      {DIRECTION_LABELS[direction as TreasuryDirection]}
      {plural ? 's' : ''}
    </Badge>
  );
}
