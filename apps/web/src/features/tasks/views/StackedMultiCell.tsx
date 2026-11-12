import { Anchor, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import classes from './inline-cells.module.css';

/** Values listed in a cell before « X de plus ». */
const SHOWN_VALUES = 3;

/** Value listed in a stacked cell. */
export interface StackedItem {
  id: string;
  /** Name shown. */
  label: string;
  /** Full name (a category path…), on hover. */
  title?: string;
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
 * Multi-value cell of a table: its values one under the other (3 at most, the others behind « X de plus »); a click
 * opens its multi-select, open at once, which gives its choices when its list closes.
 * @param {StackedMultiCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function StackedMultiCell({ label, readOnly = false, items, renderSelect }: StackedMultiCellProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const shown = expanded ? items : items.slice(0, SHOWN_VALUES);
  const hidden = items.length - SHOWN_VALUES;

  // The select opens as soon as it shows (as if clicked).
  useEffect(() => {
    if (!editing) return;
    const input = container.current?.querySelector('input');
    input?.focus();
    input?.click();
  }, [editing]);

  if (editing) return <div ref={container}>{renderSelect({ onDropdownClose: () => setEditing(false) })}</div>;

  return (
    <Stack gap={2} align="flex-start">
      <UnstyledButton
        className={classes.root}
        onClick={() => setEditing(true)}
        disabled={readOnly}
        aria-label={`${label} : ${items.map((item) => item.title ?? item.label).join(', ') || 'aucun'}`}
        style={{ width: '100%' }}
      >
        <Stack gap={2}>
          {items.length === 0 && (
            <Text size="xs" c="dimmed">
              {readOnly ? '' : '—'}
            </Text>
          )}
          {shown.map((item) => (
            <Group key={item.id} gap={6} wrap="nowrap" title={item.title}>
              {item.icon}
              <Text size="xs" truncate>
                {item.label}
              </Text>
            </Group>
          ))}
        </Stack>
      </UnstyledButton>
      {hidden > 0 && (
        <Anchor component="button" type="button" size="xs" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? 'Moins' : `${hidden} de plus`}
        </Anchor>
      )}
    </Stack>
  );
}
