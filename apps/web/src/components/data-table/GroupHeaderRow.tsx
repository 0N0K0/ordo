import { EmptyState } from '../feedback/EmptyState';
import { ActionIcon, Badge, Button, Group, Table, Text } from '@mantine/core';
import { CaretRightIcon, FunnelSimpleIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { emptyTableFilter } from '@ordo/shared';
import classes from './DataTable.module.css';
import type { DataView } from './use-data-view';

interface GroupHeaderRowProps {
  label: string;
  count: number;
  /** What the group tells of its rows (a total…), after its count. Optional. */
  summary?: ReactNode;
  /** Number of cells of a row. */
  span: number;
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Heading of a group of rows, the same in every table: folds its rows, tells their number (and a summary).
 * @param {GroupHeaderRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function GroupHeaderRow({ label, count, summary, span, collapsed, onToggle }: GroupHeaderRowProps) {
  return (
    <Table.Tr className={classes.groupRow}>
      <Table.Td colSpan={span}>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" size="sm" aria-label={collapsed ? `Déplier ${label}` : `Replier ${label}`} aria-expanded={!collapsed} onClick={onToggle}>
            <CaretRightIcon className={classes.chevron} data-expanded={!collapsed || undefined} aria-hidden />
          </ActionIcon>
          <Text size="sm" fw={600}>
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

/**
 * What a table shows when its view keeps none of its rows: the search and the filters cleared from it.
 * @param {{ view: DataView<R> }} props Component props.
 * @returns {JSX.Element} Empty state.
 */
export function NoMatch<R>({ view }: { view: DataView<R> }) {
  return (
    <EmptyState
      icon={<FunnelSimpleIcon aria-hidden />}
      message={view.total === 0 ? 'Rien pour le moment.' : 'Aucune ligne ne correspond à cette vue.'}
      action={
        <>
          {view.total > 0 && (
            <Button size="xs" variant="default" onClick={() => view.change((current) => ({ ...current, search: '', filter: emptyTableFilter() }))}>
              Effacer la recherche et les filtres
            </Button>
          )}
        </>
      }
    />
  );
}
