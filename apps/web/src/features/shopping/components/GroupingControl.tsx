import { Select } from '@mantine/core';
import { SHOPPING_GROUPINGS, type ShoppingGrouping } from '../lib/shopping-format';

/**
 * Groups of a table of products or items (in the options of its toolbar): by category, store, way of keeping or person.
 * @param {{ value: ShoppingGrouping, onChange: (grouping: ShoppingGrouping) => void }} props Component props.
 * @returns {JSX.Element} Control.
 */
export function GroupingControl({ value, onChange }: { value: ShoppingGrouping; onChange: (grouping: ShoppingGrouping) => void }) {
  return (
    <Select label="Grouper par" allowDeselect={false} value={value} onChange={(next) => next && onChange(next as ShoppingGrouping)} data={SHOPPING_GROUPINGS} comboboxProps={{ withinPortal: true }} />
  );
}
