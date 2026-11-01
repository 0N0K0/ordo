import { Anchor, Group, Table, Text, Tooltip } from '@mantine/core';
import { LockIcon } from '@phosphor-icons/react';
import { columnSizingFeature, createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Task } from './api';
import classes from './TaskTable.module.css';
import { Assignees, LabelBadge } from './task-ui';
import type { TaskContext } from './use-task-context';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const effortFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/**
 * Formats a YYYY-MM-DD date.
 * @param {string | null} date Calendar date.
 * @returns {string} Formatted date, or empty.
 */
function formatDate(date: string | null): string {
  return date ? dateFormat.format(new Date(`${date}T00:00:00Z`)) : '';
}

// Stable module-level registry: optional features are added here (sorting, visibility… in the views step).
const features = tableFeatures({ columnSizingFeature });
const column = createColumnHelper<typeof features, Task>();

interface TaskTableProps {
  tasks: Task[];
  context: TaskContext;
  /** User's day (YYYY-MM-DD), for overdue end dates. */
  today: string;
}

/**
 * Task table; a row opens the task in the side panel.
 * @param {TaskTableProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function TaskTable({ tasks, context, today }: TaskTableProps) {
  const navigate = useNavigate();
  const { number: openNumber } = useParams();

  const columns = useMemo(
    () =>
      column.columns([
      column.accessor('number', {
        header: '#',
        size: 64,
        cell: ({ row }) => (
          <Text size="sm" c="dimmed" ff="monospace">
            {row.original.number}
          </Text>
        ),
      }),
      column.accessor('title', {
        header: 'Titre',
        size: 360,
        cell: ({ row }) => {
          const task = row.original;
          const blocked = task.blockedByIds.some((id) => {
            const blocker = context.taskById.get(id);
            return blocker && !blocker.archived && !context.isClosed(blocker);
          });
          return (
            <Group gap={6} wrap="nowrap">
              {blocked && (
                <Tooltip label="Bloquée par une tâche ouverte">
                  <LockIcon aria-label="Bloquée" color="var(--mantine-color-red-6)" />
                </Tooltip>
              )}
              <Anchor
                component={Link}
                to={`/tasks/${task.number}`}
                size="sm"
                c="inherit"
                fw={500}
                td={context.isClosed(task) ? 'line-through' : undefined}
                onClick={(event) => event.stopPropagation()}
                lineClamp={1}
              >
                {task.title}
              </Anchor>
              {context.childrenOf(task.id).length > 0 && (
                <Text size="xs" c="dimmed">
                  {context.childrenOf(task.id).filter((child) => context.isClosed(child)).length}/
                  {context.childrenOf(task.id).length}
                </Text>
              )}
            </Group>
          );
        },
      }),
      column.accessor('projectId', {
        id: 'project',
        header: 'Projet',
        size: 200,
        cell: ({ row }) => (
          <Text size="sm" lineClamp={1} title={context.projectLabel(row.original.projectId)}>
            {context.projectById.get(row.original.projectId)?.title}
          </Text>
        ),
      }),
      column.accessor('statusId', {
        id: 'status',
        header: 'Statut',
        size: 130,
        cell: ({ row }) => <LabelBadge label={context.statusById.get(row.original.statusId ?? '')} />,
      }),
      column.accessor('priorityId', {
        id: 'priority',
        header: 'Priorité',
        size: 120,
        cell: ({ row }) => <LabelBadge label={context.priorityById.get(row.original.priorityId ?? '')} />,
      }),
      column.accessor('typeId', {
        id: 'type',
        header: 'Type',
        size: 120,
        cell: ({ row }) => <LabelBadge label={context.typeById.get(row.original.typeId ?? '')} />,
      }),
      column.accessor('assigneeIds', {
        id: 'assignees',
        header: 'Assignés',
        size: 110,
        cell: ({ row }) => (
          <Assignees
            contributors={row.original.assigneeIds
              .map((id) => context.contributorById.get(id))
              .filter((contributor) => contributor !== undefined)}
          />
        ),
      }),
      column.accessor('effort', {
        header: 'Effort',
        size: 80,
        cell: ({ row }) => (
          <Text size="sm">{row.original.effort === null ? '' : effortFormat.format(row.original.effort)}</Text>
        ),
      }),
      column.accessor('startDate', {
        header: 'Début',
        size: 120,
        cell: ({ row }) => <Text size="sm">{formatDate(row.original.startDate)}</Text>,
      }),
      column.accessor('endDate', {
        header: 'Fin',
        size: 120,
        cell: ({ row }) => {
          const { endDate } = row.original;
          const overdue = endDate !== null && endDate < today && !context.isClosed(row.original);
          return (
            <Text size="sm" c={overdue ? 'red' : undefined} fw={overdue ? 600 : undefined}>
              {formatDate(endDate)}
            </Text>
          );
        },
      }),
    ]),
    [context, today],
  );

  const table = useTable({ features, columns, data: tasks, getRowId: (task) => task.id });

  return (
    <Table.ScrollContainer minWidth={900}>
      <Table highlightOnHover stickyHeader verticalSpacing={6} className={classes.table}>
        <Table.Thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.Tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Table.Th key={header.id} style={{ width: header.column.getSize() }}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody>
          {table.getRowModel().rows.map((row) => (
            <Table.Tr
              key={row.id}
              className={classes.row}
              data-active={String(row.original.number) === openNumber || undefined}
              data-archived={row.original.archived || undefined}
              onClick={() => navigate(`/tasks/${row.original.number}`)}
            >
              {row.getAllCells().map((cell) => (
                <Table.Td key={cell.id}>
                  <table.FlexRender cell={cell} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
