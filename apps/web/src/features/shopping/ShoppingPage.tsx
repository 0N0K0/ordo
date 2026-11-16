import { PageHeader } from '../../components/actions/PageHeader';
import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { ActionIcon, Badge, Group, Paper, Stack, Table, Text, Tooltip } from '@mantine/core';
import { SHOPPING_LIST_FILTER_FIELDS, SHOPPING_LIST_GROUP_BY, SHOPPING_LIST_SORT_KEYS, type ShoppingListFilterField, type ShoppingListGroupBy } from '@ordo/shared';
import { useLocalStorage } from '@mantine/hooks';
import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowSquareInIcon, BasketIcon, ListChecksIcon, PlusIcon } from '@phosphor-icons/react';
import { useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageTabs } from '../../components/PageTabs';
import { notifyError } from '../../lib/notify';
import { useTaskContext } from '../tasks/use-task-context';
import { DataColumnsPanel } from '../../components/data-table/ColumnsPanel';
import { EditableText } from '../../components/data-table/EditableCells';
import { applyDiff, bulkSaver } from '../../components/data-table/bulk-edit';
import { useBulkSelection } from '../../components/data-table/bulk-selection';
import { BulkHint } from '../../components/data-table/BulkHint';
import { ExportButtons } from '../../components/data-table/DataViewBar';
import { ROW_ACTIONS_WIDTH } from '../../components/data-table/RowActions';
import { newConditionFor } from '../tasks/views/filter-meta';
import { shownColumns, tableWidth, type DataColumn } from '../../components/data-table/data-table';
import { DataTableHeader } from '../../components/data-table/DataTableHeader';
import { AllRowsCheck, ROW_CHECK_WIDTH, RowCheck } from '../../components/data-table/RowCheck';
import tableClasses from '../../components/data-table/DataTable.module.css';
import { localToday } from '../../lib/dates';
import { SavedViewToolbar } from '../tasks/views/SavedViewToolbar';
import { ViewTabs } from '../tasks/views/ViewTabs';
import { useShoppingData, useShoppingLists, useShoppingMutations, type ShoppingList } from './api';
import { keptByListView, listRows, type ListRow, SHOPPING_LIST_GROUP_BY_LABELS, SHOPPING_LIST_SORT_LABELS, shoppingListFilterFields, sortLists, useShoppingListView } from './shopping-list-view';
import { BaseLists } from './BaseLists';
import { ShoppingSettings } from './ShoppingSettings';
import { shoppingTotal } from './export';
import { openNewList } from './open-new-list';
import { ListActionsMenu } from './ListActions';
import { TasksCell } from './shopping-cells';
import { listClosed, listsOfProjects, listTasks, taskOptions, type ShoppingGrouping, leftToBuy, shoppingProgress } from './shopping-format';
import classes from './Shopping.module.css';
import * as fmt from '../../lib/format';
import { useCommentCounts } from '../comments/api';
import { SelectionBar } from '../../components/data-table/SelectionBar';
import { deleteRowsAction, duplicateRowsAction, forEachRow } from '../../components/data-table/selection-actions';
import { selectedLabel } from '../../components/data-table/selection-label';
import { GroupFooter, TableFooter } from '../../components/data-table/TableFooter';

/** Width of the actions column. */
const ACTIONS_WIDTH = ROW_ACTIONS_WIDTH;

/** Groups offered from the menu of a column. */
const COLUMN_GROUP_BY: Partial<Record<string, ShoppingListGroupBy>> = { project: 'project', createdAt: 'month' };

/** Columns of the lists edited in bulk. */
const BULK_LIST_COLUMNS = ['name', 'tasks'];

/** Columns of the table of the lists (sorted through the sorts of the view: same ids). */
const LIST_COLUMNS: DataColumn<ShoppingList>[] = [
  { id: 'name', label: 'Liste', size: 260, locked: true, sortValue: () => null },
  { id: 'tasks', label: 'Tâches', size: 260 },
  { id: 'progress', label: 'Achats', size: 100, sortValue: () => null },
  { id: 'remaining', label: 'Restant', size: 90, numeric: true, hiddenByDefault: true, sortValue: () => null },
  { id: 'itemCount', label: 'Produits', size: 90, numeric: true, hiddenByDefault: true, sortValue: () => null },
  { id: 'total', label: 'Total estimé', size: 120, numeric: true, sortValue: () => null },
  { id: 'createdAt', label: 'Créée le', size: 110, sortValue: () => null },
  { id: 'closedAt', label: 'Archivée le', size: 110, hiddenByDefault: true, sortValue: () => null },
  { id: 'comments', label: 'Commentaires', size: 120, numeric: true, hiddenByDefault: true },
];

/**
 * Shopping lists through saved views, as the tasks and the routines: tabs of views, each with its search, filters,
 * sorts and groups (« En cours » and « Archivées » made at first); the tasks of an open list chosen in place, the
 * actions of each one in its menu (as on its page). On a project page, only the lists of its tasks, with the views
 * of the project.
 * @param {{ projectId?: string, projectIds?: ReadonlySet<string> }} props Component props.
 * @param {string} [props.projectId] Project of the page (its views). Optional.
 * @param {ReadonlySet<string>} [props.projectIds] Projects (a project and its sub-projects) whose lists are shown. Optional.
 * @returns {JSX.Element} Lists.
 */
export function ListsPanel({ projectId, projectIds }: { projectId?: string; projectIds?: ReadonlySet<string> }) {
  const { data: lists, isPending } = useShoppingLists();
  const listComments = useCommentCounts(
    'SHOPPING_LIST',
    (lists ?? []).map((list) => list.id),
  );
  const { data: shopping } = useShoppingData();
  const { context } = useTaskContext();
  const { updateList, duplicateList, setClosed, deleteList } = useShoppingMutations();
  const [grouping] = useLocalStorage<ShoppingGrouping>({ key: 'ordo.shopping.listGrouping', defaultValue: 'category' });
  const view = useShoppingListView(projectId ?? null);
  const { config } = view;
  const today = localToday();
  const env = { today, context, categories: shopping?.shoppingCategories ?? [], stores: shopping?.shoppingStores ?? [] };
  const closedOf = (list: ShoppingList) => listClosed(list, context);
  const scoped = projectIds ? listsOfProjects(lists ?? [], context, projectIds) : (lists ?? []);
  const shown = config
    ? sortLists(
        scoped.filter((list) => keptByListView(config, list, env)),
        config.sorting,
        env,
      )
    : [];
  const rows = listRows(shown, config?.groupBy ?? null, env);
  const tableRef = useRef<HTMLTableElement>(null);
  const layout = { columnOrder: config?.columnOrder ?? [], hiddenColumns: config?.hiddenColumns ?? [], columnSizing: config?.columnSizing ?? {} };
  const shownList = shownColumns(LIST_COLUMNS, layout);
  const [filterOpened, setFilterOpened] = useState(false);
  // Names and tasks of the lists, edited in bulk.
  const listRowsShown = rows.filter((row): row is Extract<ListRow, { kind: 'list' }> => row.kind === 'list');
  const bulkSelection = useBulkSelection({ keys: listRowsShown.map((row) => row.key), isBulk: (id) => BULK_LIST_COLUMNS.includes(id) });

  /**
   * Saves lists, each once (a list shows under each of its groups), the closed ones left as they are.
   * @param {Extract<ListRow, { kind: 'list' }>[]} targets Rows.
   * @param {(row: Extract<ListRow, { kind: 'list' }>) => { name?: string, taskIds?: string[] }} changeFor Change of each.
   * @returns {void}
   */
  const saveLists = (targets: Extract<ListRow, { kind: 'list' }>[], changeFor: (row: Extract<ListRow, { kind: 'list' }>) => { name?: string; taskIds?: string[] }) => {
    const seen = new Set<string>();
    for (const row of targets) {
      if (seen.has(row.list.id) || closedOf(row.list)) continue;
      seen.add(row.list.id);
      const change = changeFor(row);
      updateList.mutate({ id: row.list.id, name: change.name ?? row.list.name, taskIds: change.taskIds ?? row.list.taskIds }, { onError: (error) => notifyError(error.message) });
    }
  };
  // Lists checked: every field of each edited at once, and the actions of the bar.
  const rowSelection = { isChecked: bulkSelection.isChecked, check: bulkSelection.check, setChecked: bulkSelection.setChecked, keys: bulkSelection.keys };
  const checkedLists = listRowsShown.flatMap((row) => (rowSelection.isChecked(row.key) ? [row.list] : []));
  const allClosed = checkedLists.length > 0 && checkedLists.every((list) => list.closedAt);
  const bulk = bulkSaver<Extract<ListRow, { kind: 'list' }>, { name?: string; taskIds?: string[] }>(
    { selection: bulkSelection.selection, keyOf: (row) => row.key, rows: listRowsShown },
    (row, change) => saveLists([row], () => change),
    saveLists,
  );

  /**
   * Row of the table of the lists: a group heading, or a list.
   * @param {ListRow} row Row.
   * @returns {JSX.Element} Row.
   */
  const renderRow = (row: ListRow) => {
    if (row.kind === 'group')
      return (
        <Table.Tr key={`group:${row.key}`} className={classes.groupRow}>
          <Table.Td colSpan={shownList.length + 2} style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${row.depth} * var(--mantine-spacing-lg))` }}>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={row.depth === 0 ? 700 : 600}>
                {row.name}
              </Text>
              <Badge size="sm" variant="light" color="gray">
                {row.count}
              </Badge>
            </Group>
          </Table.Td>
        </Table.Tr>
      );
    const { list } = row;
    // Its required items (the optional ones apart).
    const { bought, total: required } = shoppingProgress(list.items);
    const total = shoppingTotal(list.items);
    const cells: Record<string, ReactNode> = {
      name: (
        <Group gap="xs" wrap="nowrap">
          <EditableText value={list.name} label={`Nom de la liste ${list.name}`} strong readOnly={closedOf(list)} onSave={(name) => name && bulk('name')(row, { name })} />
          <Tooltip label="Ouvrir la liste">
            <ActionIcon component={Link} to={`/shopping/${list.id}`} variant="subtle" color="gray" size="sm" aria-label={`Ouvrir la liste ${list.name}`}>
              <ArrowSquareInIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          {list.entryId && (
            <Badge size="xs" variant="light" tt="none">
              Payée
            </Badge>
          )}
        </Group>
      ),
      tasks: (
        <TasksCell
          label={`Tâches de la liste ${list.name}`}
          readOnly={closedOf(list) || !context}
          items={listTasks(list, context).map((task) => ({ id: task.id, label: context?.taskLabel(task) ?? `#${task.number} ${task.title}` }))}
          options={taskOptions(context, list.taskIds)}
          value={list.taskIds}
          onSave={(taskIds) => bulk('tasks')(row, (target) => ({ taskIds: applyDiff(target.list.taskIds, list.taskIds, taskIds) }))}
        />
      ),
      progress: (
        <Badge size="sm" variant="light" color={required && bought === required ? 'green' : 'gray'}>
          {bought} / {required}
        </Badge>
      ),
      remaining: required - bought || '',
      itemCount: list.items.length,
      total: total > 0 ? fmt.money(total) : null,
      createdAt: fmt.day(new Date(list.createdAt)),
      closedAt: list.closedAt ? fmt.day(new Date(list.closedAt)) : null,
      comments: listComments.get(list.id) || null,
    };
    return (
      <Table.Tr key={row.key}>
        <Table.Td w={ROW_CHECK_WIDTH} px={4}>
          <RowCheck selection={rowSelection} rowKey={row.key} label={list.name} />
        </Table.Td>
        {shownList.map((column, index) => (
          <Table.Td
            key={column.id}
            className={tableClasses.cell}
            data-numeric={column.numeric || undefined}
            ff={column.numeric ? 'monospace' : undefined}
            style={index === 0 ? { paddingLeft: `calc(var(--mantine-spacing-xs) + ${row.depth} * var(--mantine-spacing-lg))` } : undefined}
            {...bulkSelection.cellProps(column.id, row.key)}
          >
            {cells[column.id]}
          </Table.Td>
        ))}
        <Table.Td>
          <Group justify="flex-end">
            <ListActionsMenu list={list} grouping={grouping} />
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  };

  // Columns of the footers: numbers of the counted columns, a text for the others (counted).
  const footerCols = shownList.map((column) => ({
    ...column,
    // Numbers of the counted columns, a text for the others (counted).
    sortValue:
      column.id === 'remaining'
        ? (list: ShoppingList) => leftToBuy(list.items).length
        : column.id === 'itemCount'
          ? (list: ShoppingList) => list.items.length
          : column.id === 'total'
            ? (list: ShoppingList) => shoppingTotal(list.items) || null
            : column.id === 'comments'
              ? (list: ShoppingList) => listComments.get(list.id) || null
              : (list: ShoppingList) => (column.id === 'tasks' ? (list.taskIds.length ? list.taskIds.length : null) : column.id === 'closedAt' ? list.closedAt : list.name),
    numeric: ['remaining', 'itemCount', 'total', 'comments'].includes(column.id),
    formatTotal: column.id === 'total' ? (amount: number) => fmt.money(amount) : undefined,
  }));

  return (
    <Stack gap="md">
      <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-end">
        <div style={{ minWidth: 0, flex: 1 }}>
          <ViewTabs state={view} />
        </div>
        <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openNewList({ projectIds })}>
          Nouvelle liste
        </ActionButton>
      </Group>
      {config && (
        <SavedViewToolbar
          config={config}
          change={view.change}
          fields={shoppingListFilterFields(env)}
          searchLabel="Rechercher (liste, produit)"
          sortKeys={SHOPPING_LIST_SORT_KEYS}
          sortLabels={SHOPPING_LIST_SORT_LABELS}
          manualText="Sans tri : les listes les plus récentes d’abord."
          groupBy={SHOPPING_LIST_GROUP_BY}
          groupLabels={SHOPPING_LIST_GROUP_BY_LABELS}
          dirty={view.dirty}
          onSave={view.save}
          onRevert={view.revert}
          filterOpened={filterOpened}
          onFilterOpenedChange={setFilterOpened}
          columns={<DataColumnsPanel columns={LIST_COLUMNS} layout={layout} onLayoutChange={(next) => view.change((current) => ({ ...current, ...next }))} />}
          exports={
            <ExportButtons
              disabled={shown.length === 0}
              table={() => {
                const texts: Record<string, (list: ShoppingList) => string> = {
                  name: (list) => list.name,
                  tasks: (list) =>
                    listTasks(list, context)
                      .map((task) => context?.taskLabel(task) ?? `#${task.number} ${task.title}`)
                      .join(', '),
                  progress: (list) => `${shoppingProgress(list.items).bought} / ${shoppingProgress(list.items).total}`,
                  remaining: (list) => String(leftToBuy(list.items).length),
                  itemCount: (list) => String(list.items.length),
                  total: (list) => (shoppingTotal(list.items) > 0 ? fmt.money(shoppingTotal(list.items)) : ''),
                  createdAt: (list) => fmt.day(new Date(list.createdAt)),
                  closedAt: (list) => (list.closedAt ? fmt.day(new Date(list.closedAt)) : ''),
                  comments: (list) => String(listComments.get(list.id) || ''),
                };
                return {
                  title: 'Listes d’achats',
                  subtitle: view.current?.name ?? '',
                  columns: shownList.map((column) => ({ ...column, text: texts[column.id] })),
                  groups: [{ key: '', label: '', rows: shown }],
                  grouped: false,
                };
              }}
            />
          }
        />
      )}
      <BulkHint selection={bulkSelection.selection} labelOf={(id) => LIST_COLUMNS.find((column) => column.id === id)?.label ?? ''} onClear={() => bulkSelection.setSelection(null)} />
      {isPending || !config || (projectIds && !context) ? (
        <TableSkeleton rows={3} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<ListChecksIcon aria-hidden />}
          message={scoped.length === 0 ? (projectIds ? 'Aucune liste : une liste rattachée à une tâche du projet s’affiche ici.' : 'Aucune liste pour le moment.') : 'Aucune liste dans cette vue.'}
        />
      ) : (
        <Paper withBorder radius="md" className={classes.group}>
          <div className={classes.scroller}>
            <Table
              verticalSpacing="xs"
              highlightOnHover
              ref={tableRef}
              className={tableClasses.table}
              style={{ width: tableWidth(shownList, ROW_CHECK_WIDTH + ACTIONS_WIDTH), minWidth: '100%' }}
              data-checking={rowSelection.keys.some((key) => rowSelection.isChecked(key)) || undefined}
            >
              <DataTableHeader
                columns={LIST_COLUMNS}
                shown={shownList}
                layout={layout}
                onLayoutChange={(next) => view.change((current) => ({ ...current, ...next }))}
                sorting={config.sorting}
                onSortingChange={(sorting) => view.change((current) => ({ ...current, sorting: sorting as typeof current.sorting }))}
                tableRef={tableRef}
                leadingCount={1}
                leading={
                  <Table.Th w={ROW_CHECK_WIDTH} px={4}>
                    <AllRowsCheck selection={rowSelection} />
                  </Table.Th>
                }
                trailing={<Table.Th w={ACTIONS_WIDTH} />}
                columnExtras={(id) => {
                  const field = id in SHOPPING_LIST_FILTER_FIELDS ? (id as ShoppingListFilterField) : null;
                  const groupBy = COLUMN_GROUP_BY[id];
                  return {
                    onSelect: BULK_LIST_COLUMNS.includes(id) ? () => bulkSelection.selectColumn(id) : undefined,
                    onFilter: field
                      ? () => {
                          view.change((current) => ({ ...current, filter: { ...current.filter, children: [...current.filter.children, newConditionFor(SHOPPING_LIST_FILTER_FIELDS, field)] } }));
                          setFilterOpened(true);
                        }
                      : undefined,
                    group: groupBy
                      ? { active: config.groupBy === groupBy, onToggle: () => view.change((current) => ({ ...current, groupBy: current.groupBy === groupBy ? null : groupBy })) }
                      : undefined,
                  };
                }}
              />
              <Table.Tbody>
                {rows.flatMap((row, index) => {
                  // A group ends with the totals chosen in the footer of the table, over its lists.
                  const next = rows[index + 1];
                  const groupIndex = rows.slice(0, index + 1).findLastIndex((item) => item.kind === 'group');
                  const ends = config.footer && groupIndex >= 0 && row.kind === 'list' && (!next || next.kind === 'group' || next.depth < row.depth);
                  const footer = ends ? (
                    <GroupFooter
                      key={`footer:${rows[groupIndex].key}`}
                      shown={footerCols}
                      rows={[...new Set(rows.slice(groupIndex + 1, index + 1).flatMap((item) => (item.kind === 'list' ? [item.list] : [])))]}
                      totals={config.footer!}
                      label={(rows[groupIndex] as Extract<ListRow, { kind: 'group' }>).name}
                      before={1}
                      after={1}
                    />
                  ) : null;
                  return [renderRow(row), footer];
                })}
              </Table.Tbody>
              {config?.footer && (
                <TableFooter shown={footerCols} rows={shown} totals={config.footer} onChange={(totals) => view.change((current) => ({ ...current, footer: totals }))} before={1} after={1} />
              )}
            </Table>
          </div>
        </Paper>
      )}
      {checkedLists.length > 0 && (
        <SelectionBar
          label={selectedLabel(checkedLists.length, ['liste', 'listes'])}
          onClear={() => rowSelection.setChecked([])}
          actions={[
            duplicateRowsAction(checkedLists, { duplicate: (list) => duplicateList.mutateAsync({ id: list.id }), done: `${checkedLists.length} liste(s) dupliquée(s).` }),
            allClosed
              ? {
                  label: 'Rouvrir',
                  icon: <ArrowCounterClockwiseIcon aria-hidden />,
                  onClick: () => void forEachRow(checkedLists, (list) => setClosed.mutateAsync({ id: list.id, closed: false }), `${checkedLists.length} liste(s) rouverte(s).`),
                }
              : {
                  label: 'Archiver',
                  icon: <ArchiveIcon aria-hidden />,
                  onClick: () =>
                    void forEachRow(checkedLists, (list) => setClosed.mutateAsync({ id: list.id, closed: true }), `${checkedLists.length} liste(s) archivée(s).`).then(
                      (all) => all && rowSelection.setChecked([]),
                    ),
                },
            deleteRowsAction(checkedLists, {
              title: 'Supprimer les listes',
              risks: `${checkedLists.length} liste(s) et leurs éléments seront supprimés définitivement. Les références et la répartition d’un mouvement rattaché ne changent pas. Cette action est irréversible.`,
              remove: (list) => deleteList.mutateAsync({ id: list.id }),
              done: `${checkedLists.length} liste(s) supprimée(s).`,
              clear: () => rowSelection.setChecked([]),
            }),
          ]}
        />
      )}
    </Stack>
  );
}

/**
 * Shopping page (consumables in a professional workspace): the base lists ("références"), where what is missing is
 * marked, and the lists made from them; the settings hold the categories (a tree) and the stores.
 * @returns {JSX.Element} Page.
 */
export function ShoppingPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'lists' ? 'lists' : 'base';

  return (
    <Stack gap="lg">
      <PageHeader title="Achats" />
      <ShoppingSettings />
      <PageTabs
        value={tab}
        onChange={(value) =>
          setParams(
            (current) => {
              const next = new URLSearchParams(current);
              if (value === 'lists') next.set('tab', 'lists');
              else next.delete('tab');
              return next;
            },
            { replace: true },
          )
        }
        keepMounted={false}
      >
        <PageTabs.List>
          <PageTabs.Tab value="base" leftSection={<BasketIcon aria-hidden />}>
            Références
          </PageTabs.Tab>
          <PageTabs.Tab value="lists" leftSection={<ListChecksIcon aria-hidden />}>
            Listes
          </PageTabs.Tab>
        </PageTabs.List>
        <PageTabs.Panel value="base">
          <BaseLists />
        </PageTabs.Panel>
        <PageTabs.Panel value="lists">
          <ListsPanel />
        </PageTabs.Panel>
      </PageTabs>
    </Stack>
  );
}
