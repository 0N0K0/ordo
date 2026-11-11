import { useTreasurySettings } from '../treasury/api';
import type { TaskContext } from '../tasks/use-task-context';
import type { ShoppingCategory, ShoppingStore } from './api';

const moneyFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const quantityFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/**
 * Price as euros.
 * @param {number} value Amount.
 * @returns {string} Text.
 */
export const money = (value: number) => moneyFormat.format(value);

/**
 * Quantity and unit of a product or an item ("2 kg", "3 boîte"), empty without quantity nor unit.
 * @param {{ quantity: number | null, unit: string | null }} item Product or item.
 * @returns {string} Text.
 */
export const quantityText = ({ quantity, unit }: { quantity?: number | null; unit?: string | null }) => [quantity != null ? quantityFormat.format(quantity) : null, unit].filter(Boolean).join(' ');

/** Way products and items are grouped. */
export type ShoppingGrouping = 'category' | 'store';

export interface ShoppingGroup<T> {
  /** Category or store id, null for the items without one. */
  id: string | null;
  name: string;
  color: string | null;
  items: T[];
}

/**
 * Products or items grouped by category (in the order of the aisles) or by store; the ones without come last.
 * @param {T[]} items Products or items.
 * @param {ShoppingGrouping} grouping Grouping.
 * @param {{ categories: ShoppingCategory[], stores: ShoppingStore[] }} labels Categories and stores.
 * @returns {ShoppingGroup<T>[]} Groups (empty ones left out).
 */
export function groupShopping<T extends { categoryId?: string | null; storeId?: string | null }>(
  items: T[],
  grouping: ShoppingGrouping,
  { categories, stores }: { categories: ShoppingCategory[]; stores: ShoppingStore[] },
): ShoppingGroup<T>[] {
  const labels = grouping === 'category' ? categories : stores;
  const key = (item: T) => (grouping === 'category' ? item.categoryId : item.storeId) ?? null;
  const groups: ShoppingGroup<T>[] = [...labels]
    .sort((a, b) => a.position - b.position)
    .map((label) => ({ id: label.id, name: label.name, color: label.color, items: items.filter((item) => key(item) === label.id) }));
  const known = new Set(labels.map((label) => label.id));
  groups.push({ id: null, name: grouping === 'category' ? 'Sans catégorie' : 'Sans magasin', color: null, items: items.filter((item) => !known.has(key(item) ?? '')) });
  return groups.filter((group) => group.items.length > 0);
}

/**
 * Members of the team or household and relations, by id, to name the people of a product or an item.
 * @returns {{ members: Map<string, string>, relations: Map<string, string>, options: object[] }} Names and select options.
 */
export function usePeople() {
  const { data } = useTreasurySettings();
  const members = new Map((data?.treasuryMembers ?? []).map((member) => [member.id, member.isMe ? 'Moi' : member.name]));
  const relations = new Map((data?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
  const options = [
    { group: 'Membres', items: [...members].map(([id, name]) => ({ value: `m:${id}`, label: name })) },
    { group: 'Relations', items: [...relations].map(([id, name]) => ({ value: `r:${id}`, label: name })) },
  ].filter((group) => group.items.length > 0);
  return { members, relations, options };
}

/**
 * Open tasks a list can be attached to, with their place.
 * @param {TaskContext | null} context Task context.
 * @returns {object} Tasks and their label.
 */
export function taskChoices(context: TaskContext | null) {
  const tasks = (context?.tasks ?? []).filter((task) => !task.closed && !task.archived);
  const labelOf = (task: (typeof tasks)[number]) => context?.taskLabel(task) ?? `#${task.number} ${task.title}`;
  return { tasks, labelOf };
}
