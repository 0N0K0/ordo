import { useLocalStorage } from '@mantine/hooks';
import type { ShoppingGrouping } from '../lib/shopping-format';

/** Keys of the grouping kept for each kind of table: the lists of purchases, the reference lists. */
const GROUPING_KEYS = { list: 'ordo.shopping.listGrouping', base: 'ordo.shopping.baseGrouping' } as const;

/**
 * Grouping of a table of products or items, kept in the browser: by category (or store, way of keeping, person), and
 * whether the empty groups show (the same for every table).
 * @param {'list' | 'base'} kind Lists of purchases, or reference lists.
 * @returns {{ grouping: ShoppingGrouping, onGrouping: (grouping: ShoppingGrouping) => void, showEmpty: boolean, onShowEmpty: (show: boolean) => void }} Grouping, to spread into GroupingOptions.
 */
export function useShoppingGrouping(kind: 'list' | 'base') {
  const [grouping, onGrouping] = useLocalStorage<ShoppingGrouping>({ key: GROUPING_KEYS[kind], defaultValue: 'category' });
  const [showEmpty, onShowEmpty] = useLocalStorage({ key: 'ordo.shopping.showEmptyCategories', defaultValue: false });
  return { grouping, onGrouping, showEmpty, onShowEmpty };
}
