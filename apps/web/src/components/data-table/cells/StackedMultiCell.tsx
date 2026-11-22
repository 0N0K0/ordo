import { Group, Text, UnstyledButton } from '@mantine/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import classes from './EditableCells.module.css';
import { StackedValues } from './StackedValues';

/** Value listed in a stacked cell. */
export interface StackedItem {
  id: string;
  /** Name shown. */
  label: string;
  /** Full name (a category path…), on hover. */
  hint?: string;
  /** Swatch, avatar… */
  icon?: ReactNode;
}

interface StackedMultiCellProps {
  /** Accessible name of the cell (the field and its row). */
  label: string;
  readOnly?: boolean;
  /** Values chosen, in their order. */
  items: StackedItem[];
  /** Multi-select opened by a click (it must call `onDropdownClose` when its list closes). */
  renderSelect: (props: { onDropdownClose: () => void }) => ReactNode;
}

/**
 * Multi-value cell of a table: its values one under the other (5 at most; beyond, 4 and « X de plus »); a click
 * opens its multi-select, open at once, which gives its choices when its list closes.
 * @param {StackedMultiCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function StackedMultiCell({ label, readOnly = false, items, renderSelect }: StackedMultiCellProps) {
  const [editing, setEditing] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // The select opens as soon as it shows (as if clicked).
  useEffect(() => {
    if (!editing) return;
    const input = container.current?.querySelector('input');
    input?.focus();
    input?.click();
  }, [editing]);

  if (editing) return <div ref={container}>{renderSelect({ onDropdownClose: () => setEditing(false) })}</div>;

  return (
    <StackedValues
      wrap={(values) => (
        <UnstyledButton
          className={classes.root}
          onClick={() => setEditing(true)}
          disabled={readOnly}
          aria-label={`${label} : ${items.map((item) => item.hint ?? item.label).join(', ') || 'aucun'}`}
          style={{ width: '100%' }}
        >
          {values}
        </UnstyledButton>
      )}
    >
      {items.length === 0 ? (
        <Text key="none" size="xs" c="dimmed">
          {readOnly ? '' : '—'}
        </Text>
      ) : (
        items.map((item) => (
          <Group key={item.id} gap={6} wrap="nowrap" title={item.hint}>
            {item.icon}
            <Text size="xs" truncate>
              {item.label}
            </Text>
          </Group>
        ))
      )}
    </StackedValues>
  );
}
