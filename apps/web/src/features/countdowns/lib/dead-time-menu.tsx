import { readDeadTimes } from '@ordo/shared';
import { TimerIcon } from '@phosphor-icons/react';
import type { RowMenuEntry } from '../../../components/actions/ActionsMenu';
import type { DeadTimeOutput } from '../api';
import { deadTimeLabel, type DeadTimeItem } from './countdowns';
import { openCountdownForm } from './open-countdown-form';

/**
 * Entries « Lancer « Lave-linge (1 h 30) » » of the menu of a task or a routine (its row « … », its panel), under a
 * section « Temps morts » (decision FT): each opens the form launching its timer (its duration editable). None without
 * dead times.
 * @param {readonly DeadTimeOutput[]} value Dead times of the item.
 * @param {DeadTimeItem} item Item.
 * @returns {RowMenuEntry[]} Entries.
 */
export function deadTimeMenuEntries(value: readonly DeadTimeOutput[], item: DeadTimeItem): RowMenuEntry[] {
  const deadTimes = readDeadTimes(value);
  if (!deadTimes.length) return [];
  return [
    'divider',
    { section: 'Temps morts' },
    ...deadTimes.map((deadTime) => ({ label: `Lancer « ${deadTimeLabel(deadTime)} »`, icon: <TimerIcon aria-hidden />, onClick: () => openCountdownForm({ item, deadTimes, deadTime }) })),
  ];
}
