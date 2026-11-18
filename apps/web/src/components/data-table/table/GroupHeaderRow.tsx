import { Badge, ColorSwatch, Group, Table, Text } from '@mantine/core';

import type { ReactNode } from 'react';
import classes from './DataTable.module.css';
import { FoldButton } from '../../actions/FoldButton';

interface GroupHeaderRowProps {
  label: string;
  count: number;
  /** What the group tells of its rows (a total…), after its count. Optional. */
  summary?: ReactNode;
  /** Number of cells of a row. */
  span: number;
  collapsed: boolean;
  onToggle: () => void;
  /** Color of the group (a category). Optional. */
  color?: string | null;
  /** Depth in a tree of groups (indented). Optional. Default = 0. */
  depth?: number;
  /** Props of its row (measured, a drop target…). Optional. */
  trProps?: Record<string, unknown>;
}

/**
 * Heading of a group of rows, the same in every table: folds its rows, tells their number (and a summary).
 * @param {GroupHeaderRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function GroupHeaderRow({ label, count, summary, span, collapsed, onToggle, color = null, depth = 0, trProps }: GroupHeaderRowProps) {
  return (
    <Table.Tr {...trProps} className={classes.groupRow} data-depth={depth}>
      <Table.Td colSpan={span} style={depth ? { paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth} * var(--mantine-spacing-lg))` } : undefined}>
        <Group gap="xs" wrap="nowrap">
          <FoldButton expanded={!collapsed} item={label} onToggle={onToggle} />
          {color && <ColorSwatch color={color} size={12} />}
          <Text size="sm" fw={depth === 0 ? 700 : 600}>
            {label}
          </Text>
          <Badge size="sm" variant="light" color="gray">
            {count}
          </Badge>
          {summary && (
            <Text size="sm" c="dimmed" ml="auto">
              {summary}
            </Text>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
