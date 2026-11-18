import type { TreasuryDirection } from '@ordo/shared';

/** Name of each direction of money: in, out. */
export const DIRECTION_LABELS: Record<TreasuryDirection, string> = { IN: 'Entrée', OUT: 'Sortie' };

/** Color of each direction of money (badges, amounts). */
export const DIRECTION_COLORS: Record<TreasuryDirection, string> = { IN: 'green', OUT: 'red' };

/** Choices of the direction of money, in a segmented control. */
export const DIRECTION_OPTIONS = (['IN', 'OUT'] as const).map((value) => ({ value, label: DIRECTION_LABELS[value] }));
