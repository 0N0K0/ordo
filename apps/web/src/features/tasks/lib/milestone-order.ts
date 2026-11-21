import { useLocalStorage } from '@mantine/hooks';
import type { Milestone } from '../api';
import { collator } from '../../../lib/text';

/** How milestones are ordered: by due date, by label, or in their manual order. */
export type MilestoneOrder = 'dueDate' | 'label' | 'manual';

export const MILESTONE_ORDER_OPTIONS: { value: MilestoneOrder; label: string }[] = [
  { value: 'dueDate', label: 'Échéance' },
  { value: 'label', label: 'Libellé' },
  { value: 'manual', label: 'Manuel' },
];

/**
 * Milestone order read from this browser, the old `title` read as `label`.
 * @param {string} stored Stored value (JSON).
 * @returns {MilestoneOrder} Order.
 */
function readMilestoneOrder(stored: string): MilestoneOrder {
  try {
    const order = JSON.parse(stored) as unknown;
    if (order === 'title') return 'label';
    return MILESTONE_ORDER_OPTIONS.some((option) => option.value === order) ? (order as MilestoneOrder) : 'dueDate';
  } catch {
    return 'dueDate';
  }
}

/**
 * Milestone order chosen by the user, remembered in this browser.
 * @returns {[MilestoneOrder, (order: MilestoneOrder) => void]} Order and its setter.
 */
export function useMilestoneOrder() {
  return useLocalStorage<MilestoneOrder>({ key: 'ordo.milestones.order', defaultValue: 'dueDate', deserialize: (stored) => (stored === undefined ? 'dueDate' : readMilestoneOrder(stored)) });
}

/**
 * Sorts milestones in the chosen order; milestones without due date come last when sorted by date.
 * @param {Milestone[]} milestones Milestones.
 * @param {MilestoneOrder} order Chosen order.
 * @returns {Milestone[]} Sorted copy.
 */
export function sortMilestones(milestones: Milestone[], order: MilestoneOrder): Milestone[] {
  return [...milestones].sort((a, b) => {
    if (order === 'label') return collator.compare(a.label, b.label) || a.position - b.position;
    if (order === 'manual') return a.position - b.position;
    return (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99') || a.position - b.position;
  });
}
