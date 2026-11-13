import { Badge, Group, Paper, Skeleton, Stack, Table, Text, ThemeIcon } from '@mantine/core';
import { entrySeconds, formatDuration } from '@ordo/shared';
import { ClockIcon, CopyIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { DataColumnsPanel } from '../../components/data-table/ColumnsPanel';
import { ROW_ACTIONS_WIDTH, RowActions } from '../../components/data-table/RowActions';
import { TableOptions, TableToolbar } from '../../components/data-table/TableToolbar';
import { shownColumns, sortRows, tableWidth, type DataColumn, type ShownColumn } from '../../components/data-table/data-table';
import { DataTableHeader } from '../../components/data-table/DataTableHeader';
import tableClasses from '../../components/data-table/DataTable.module.css';
import { useTableLayout } from '../../components/data-table/use-table-layout';
import { useFillHeight } from '../tasks/column-fit';
import { TaskRef } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import type { TimeEntry } from './api';
import classes from './TimeLog.module.css';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Local day key of an instant, YYYY-MM-DD.
 * @param {string} iso Instant.
 * @returns {string} Day.
 */
function dayKey(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Width of the actions column. */
const ACTIONS_WIDTH = ROW_ACTIONS_WIDTH;

/**
 * Columns of the tracked times.
 * @param {TaskContext | null} context Task context (names of the projects, to sort them).
 * @returns {DataColumn<TimeEntry>[]} Columns.
 */
function timeColumns(context: TaskContext | null): DataColumn<TimeEntry>[] {
  return [
    { id: 'hours', label: 'Horaires', size: 130, sortValue: (entry) => entry.startedAt },
    { id: 'duration', label: 'Durée', size: 100, sortValue: (entry) => entrySeconds(entry) },
    { id: 'project', label: 'Projet', size: 180, sortValue: (entry) => (entry.projectId ? (context?.projectById.get(entry.projectId)?.title ?? null) : null) },
    { id: 'tasks', label: 'Tâches', size: 220 },
    { id: 'description', label: 'Description', size: 300, locked: true, sortValue: (entry) => entry.description ?? null },
    { id: 'invoice', label: 'Facture', size: 150, sortValue: (entry) => entry.documentNumber ?? null },
  ];
}

interface EntryRowProps {
  entry: TimeEntry;
  /** Columns shown. */
  shown: ShownColumn<TimeEntry>[];
  context: TaskContext;
  /** Project of the list (null: every project): times of other projects show theirs. */
  projectId: string | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * One tracked time, a row of the table: hours, duration, project, tasks, description, invoice and actions.
 * @param {EntryRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function EntryRow({ entry, shown, context, projectId, onEdit, onDuplicate, onDelete }: EntryRowProps) {
  const running = entry.endedAt === null;
  const tasks = entry.taskIds.map((id) => context.taskById.get(id)).filter((task) => task !== undefined);
  const cells: Record<string, ReactNode> = {
    hours: (
      <span className={classes.nowrap}>
        {timeFormat.format(new Date(entry.startedAt))}
        {entry.endedAt && ` – ${timeFormat.format(new Date(entry.endedAt))}`}
      </span>
    ),
    duration: running ? (
      <Badge size="sm" color="red" variant="light">
        En cours
      </Badge>
    ) : (
      <Text span size="sm" ff="monospace">
        {formatDuration(entrySeconds(entry))}
      </Text>
    ),
    project: (
      <>
        {entry.projectId && entry.projectId !== projectId ? context.projectById.get(entry.projectId)?.title : null}
        {entry.routineTitle && (
          <Text size="xs" c="dimmed">
            Routine : {entry.routineTitle}
          </Text>
        )}
      </>
    ),
    tasks: (
      <Group gap={4}>
        {tasks.map((task) => (
          <TaskRef key={task.id} task={task} blocked={context.isBlocked(task)} />
        ))}
        {tasks.length > 1 && (
          <Text size="xs" c="dimmed">
            ({formatDuration(entrySeconds(entry) / tasks.length)} par tâche)
          </Text>
        )}
      </Group>
    ),
    description: (
      <span className={classes.description}>
        {entry.description || (
          <Text span size="sm" c="dimmed" fs="italic">
            Sans description
          </Text>
        )}
      </span>
    ),
    invoice: entry.documentId && (
      <Badge size="sm" variant="light" color={entry.documentNumber ? 'green' : 'gray'} component={Link} to={`/accounting/${entry.documentId}`} style={{ cursor: 'pointer' }}>
        {entry.documentNumber ? `Facturé : ${entry.documentNumber}` : 'Brouillon'}
      </Badge>
    ),
  };
  return (
    <Table.Tr>
      {shown.map((column) => (
        <Table.Td key={column.id} className={tableClasses.cell} data-numeric={column.numeric || undefined}>
          {cells[column.id]}
        </Table.Td>
      ))}
      <Table.Td>
        {/* The running timer is edited from the timer; time on a final invoice is part of it (copied still). */}
        {!running && (
          <RowActions
            name="ce temps"
            primary={!entry.documentNumber && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: onEdit }}
            items={[
              { label: 'Dupliquer', icon: <CopyIcon aria-hidden />, onClick: onDuplicate },
              !entry.documentNumber && { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: onDelete },
            ]}
          />
        )}
      </Table.Td>
    </Table.Tr>
  );
}

interface TimeLogProps {
  entries: TimeEntry[] | undefined;
  context: TaskContext | null;
  projectId: string | null;
  emptyMessage: string;
  onEdit: (entry: TimeEntry) => void;
  onDuplicate: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
  /** Tools of the toolbar, before its options (period, project…). Optional. */
  tools?: ReactNode;
}

/**
 * Tracked times in a table, by day (latest first), each day headed by its total; its toolbar above (the tools of the
 * page, then the options with the columns).
 * @param {TimeLogProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function TimeLog({ entries, context, projectId, emptyMessage, onEdit, onDuplicate, onDelete, tools }: TimeLogProps) {
  // Scrolling inside the height left by the page: the header stays on top, the total at the bottom.
  const [fillRef, fillHeight] = useFillHeight();
  const { layout, setLayout, sorting, setSorting } = useTableLayout('time-log');
  const tableRef = useRef<HTMLTableElement>(null);
  const columns = timeColumns(context);
  const shown = shownColumns(columns, layout);
  return (
    <Stack gap="sm">
      <TableToolbar options={<TableOptions columns={<DataColumnsPanel columns={columns} layout={layout} onLayoutChange={setLayout} />} />}>{tools}</TableToolbar>
      {content()}
    </Stack>
  );

  /**
   * Content under the toolbar: loading, empty, or the times by day.
   * @returns {ReactNode} Content.
   */
  function content(): ReactNode {
    if (!entries || !context) {
      return (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={48} />
          ))}
        </Stack>
      );
    }
    const days = new Map<string, TimeEntry[]>();
    // By day (latest first), sorted within each day.
    for (const entry of entries) days.set(dayKey(entry.startedAt), []);
    for (const entry of sortRows(entries, sorting, columns)) days.set(dayKey(entry.startedAt), [...(days.get(dayKey(entry.startedAt)) ?? []), entry]);
    if (days.size === 0) {
      return (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <ClockIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {emptyMessage}
            </Text>
          </Stack>
        </Paper>
      );
    }
    return (
      <Paper withBorder radius="md">
        <div ref={fillRef} className={classes.scroller} style={{ maxHeight: fillHeight }}>
          <Table ref={tableRef} verticalSpacing="xs" highlightOnHover stickyHeader className={tableClasses.table} style={{ width: tableWidth(shown, ACTIONS_WIDTH), minWidth: '100%' }}>
            <DataTableHeader
              columns={columns}
              shown={shown}
              layout={layout}
              onLayoutChange={setLayout}
              sorting={sorting}
              onSortingChange={setSorting}
              tableRef={tableRef}
              trailing={<Table.Th w={ACTIONS_WIDTH} />}
            />
            {[...days.entries()].map(([day, dayEntries]) => (
              <Table.Tbody key={day}>
                {/* The day and its total, heading its times. */}
                <Table.Tr className={classes.dayRow}>
                  <Table.Th colSpan={shown.length + 1} scope="rowgroup">
                    {dayFormat.format(new Date(`${day}T12:00:00`)).replace(/^./, (letter) => letter.toUpperCase())}&nbsp;:{' '}
                    {formatDuration(dayEntries.filter((entry) => entry.endedAt).reduce((sum, entry) => sum + entrySeconds(entry), 0))}
                  </Table.Th>
                </Table.Tr>
                {dayEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    shown={shown}
                    context={context}
                    projectId={projectId}
                    onEdit={() => onEdit(entry)}
                    onDuplicate={() => onDuplicate(entry)}
                    onDelete={() => onDelete(entry)}
                  />
                ))}
              </Table.Tbody>
            ))}
            {/* Total of the times shown (finished ones: a running timer counts once stopped). */}
            <Table.Tfoot className={classes.total}>
              <Table.Tr>
                <Table.Th colSpan={shown.length} scope="row">
                  Total
                </Table.Th>
                <Table.Th ff="monospace" ta="right" className={classes.nowrap}>
                  {formatDuration(entries.filter((entry) => entry.endedAt).reduce((sum, entry) => sum + entrySeconds(entry), 0))}
                </Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </div>
      </Paper>
    );
  }
}
