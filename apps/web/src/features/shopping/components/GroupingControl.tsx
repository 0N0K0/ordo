import { Select, Switch } from '@mantine/core';
import { EMPTY_GROUPS_LABEL, SHOPPING_GROUPINGS, type ShoppingGrouping } from '../lib/shopping-format';

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

/**
 * Display options of a list of products: their grouping, and whether the empty groups show.
 * @param {{ grouping: ShoppingGrouping, onGrouping: (grouping: ShoppingGrouping) => void, showEmpty: boolean, onShowEmpty: (show: boolean) => void }} props Component props.
 * @returns {JSX.Element} Options.
 */
export function GroupingOptions({
  grouping,
  onGrouping,
  showEmpty,
  onShowEmpty,
}: {
  grouping: ShoppingGrouping;
  onGrouping: (grouping: ShoppingGrouping) => void;
  showEmpty: boolean;
  onShowEmpty: (show: boolean) => void;
}) {
  return (
    <>
      <GroupingControl value={grouping} onChange={onGrouping} />
      <Switch label={EMPTY_GROUPS_LABEL[grouping]} checked={showEmpty} onChange={(event) => onShowEmpty(event.currentTarget.checked)} />
    </>
  );
}
