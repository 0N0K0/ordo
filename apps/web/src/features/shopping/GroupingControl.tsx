import { Input, SegmentedControl } from '@mantine/core';
import type { ShoppingGrouping } from './shopping-format';

/**
 * Groups of a table of products or items (in the options of its toolbar): by category or by store.
 * @param {{ value: ShoppingGrouping, onChange: (grouping: ShoppingGrouping) => void }} props Component props.
 * @returns {JSX.Element} Control.
 */
export function GroupingControl({ value, onChange }: { value: ShoppingGrouping; onChange: (grouping: ShoppingGrouping) => void }) {
  return (
    <Input.Wrapper label="Grouper par">
      <SegmentedControl
        fullWidth
        value={value}
        onChange={(next) => onChange(next as ShoppingGrouping)}
        data={[
          { value: 'category', label: 'Catégorie' },
          { value: 'store', label: 'Magasin' },
        ]}
      />
    </Input.Wrapper>
  );
}
