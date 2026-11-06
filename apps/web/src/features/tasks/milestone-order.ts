import { useLocalStorage } from '@mantine/hooks';
import type { Milestone } from './api';

/** How milestones are ordered: by due date, by title, or in their manual order. */
export type MilestoneOrder = 'dueDate' | 'title' | 'manual';

export const MILESTONE_ORDER_OPTIONS: { value: MilestoneOrder; label: string }[] = [
  { value: 'dueDate', label: 'Échéance' },
  { value: 'title', label: 'Titre' },
  { value: 'manual', label: 'Manuel' },
];

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/**
 * Milestone order chosen by the user, remembered in this browser.
 * @returns {[MilestoneOrder, (order: MilestoneOrder) => void]} Order and its setter.
 */
export function useMilestoneOrder() {
  return useLocalStorage<MilestoneOrder>({ key: 'ordo.milestones.order', defaultValue: 'dueDate' });
}

/**
 * Sorts milestones in the chosen order; milestones without due date come last when sorted by date.
 * @param {Milestone[]} milestones Milestones.
 * @param {MilestoneOrder} order Chosen order.
 * @returns {Milestone[]} Sorted copy.
 */
export function sortMilestones(milestones: Milestone[], order: MilestoneOrder): Milestone[] {
  return [...milestones].sort((a, b) => {
    if (order === 'title') return collator.compare(a.title, b.title) || a.position - b.position;
    if (order === 'manual') return a.position - b.position;
    return (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99') || a.position - b.position;
  });
}
