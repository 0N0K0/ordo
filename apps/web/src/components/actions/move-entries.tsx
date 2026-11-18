import { ArrowDownIcon, ArrowUpIcon } from '@phosphor-icons/react';
import type { RowMenuEntry } from '../data-table/cells/RowActions';

/**
 * « Monter » and « Descendre » entries of the actions of an item of an ordered list, disabled at its ends.
 * @param {number} index Index of the item in its list.
 * @param {number} count Number of items of the list.
 * @param {(index: number) => void} move Moves the item to an index (the one before or after it).
 * @returns {RowMenuEntry[]} Entries.
 */
export function moveEntries(index: number, count: number, move: (index: number) => void): RowMenuEntry[] {
  return [
    { label: 'Monter', icon: <ArrowUpIcon aria-hidden />, disabled: index === 0, onClick: () => move(index - 1) },
    { label: 'Descendre', icon: <ArrowDownIcon aria-hidden />, disabled: index === count - 1, onClick: () => move(index + 1) },
  ];
}
