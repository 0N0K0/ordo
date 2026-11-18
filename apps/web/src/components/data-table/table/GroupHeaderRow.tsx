import { FoldChevron } from '../../actions/FoldChevron';
import { ActionIcon, Badge, ColorSwatch, Group, Table, Text } from '@mantine/core';

import type { ReactNode } from 'react';
import classes from './DataTable.module.css';

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
          <ActionIcon variant="subtle" color="gray" size="sm" aria-label={collapsed ? `Déplier ${label}` : `Replier ${label}`} aria-expanded={!collapsed} onClick={onToggle}>
            <FoldChevron expanded={!collapsed} />
          </ActionIcon>
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
