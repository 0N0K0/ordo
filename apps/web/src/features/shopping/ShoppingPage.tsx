import { PageHeader } from '../../components/actions/PageHeader';
import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { ActionIcon, Badge, Group, Paper, Stack, Table, Text, Tooltip } from '@mantine/core';
import { SHOPPING_LIST_FILTER_FIELDS, SHOPPING_LIST_GROUP_BY, SHOPPING_LIST_SORT_KEYS, type ShoppingListFilterField, type ShoppingListGroupBy } from '@ordo/shared';
import { useLocalStorage } from '@mantine/hooks';
import { ArrowSquareInIcon, BasketIcon, ListChecksIcon, PlusIcon } from '@phosphor-icons/react';
import { useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageTabs } from '../../components/PageTabs';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTaskContext } from '../tasks/use-task-context';
import { DataColumnsPanel } from '../../components/data-table/ColumnsPanel';
import { EditableText } from '../../components/data-table/EditableCells';
import { ExportButtons } from '../../components/data-table/DataViewBar';
import { ROW_ACTIONS_WIDTH } from '../../components/data-table/RowActions';
import { newConditionFor } from '../tasks/views/filter-meta';
import { shownColumns, tableWidth, type DataColumn } from '../../components/data-table/data-table';
import { DataTableHeader } from '../../components/data-table/DataTableHeader';
import tableClasses from '../../components/data-table/DataTable.module.css';
import { localToday } from '../../lib/dates';
import { SavedViewToolbar } from '../tasks/views/SavedViewToolbar';
import { ViewTabs } from '../tasks/views/ViewTabs';
import { useShoppingData, useShoppingLists, useShoppingMutations, type ShoppingList } from './api';
import { keptByListView, listRows, SHOPPING_LIST_GROUP_BY_LABELS, SHOPPING_LIST_SORT_LABELS, shoppingListFilterFields, sortLists, useShoppingListView } from './shopping-list-view';
import { BaseLists } from './BaseLists';
import { ShoppingSettings } from './ShoppingSettings';
import { shoppingTotal } from './export';
import { openNewList } from './open-new-list';
import { ListActionsMenu } from './ListActions';
import { TasksCell } from './shopping-cells';
import { listClosed, listsOfProjects, listTasks, taskOptions, type ShoppingGrouping } from './shopping-format';
import classes from './Shopping.module.css';
import * as fmt from '../../lib/format';

/** Width of the actions column. */
const ACTIONS_WIDTH = ROW_ACTIONS_WIDTH;

/** Groups offered from the menu of a column. */
const COLUMN_GROUP_BY: Partial<Record<string, ShoppingListGroupBy>> = { project: 'project', createdAt: 'month' };

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
  const { data: shopping } = useShoppingData();
  const { context } = useTaskContext();
  const { updateList } = useShoppingMutations();
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
                  progress: (list) => `${list.items.filter((item) => item.purchasedAt).length} / ${list.items.length}`,
                  remaining: (list) => String(list.items.filter((item) => !item.purchasedAt).length),
                  itemCount: (list) => String(list.items.length),
                  total: (list) => (shoppingTotal(list.items) > 0 ? fmt.money(shoppingTotal(list.items)) : ''),
                  createdAt: (list) => fmt.day(new Date(list.createdAt)),
                  closedAt: (list) => (list.closedAt ? fmt.day(new Date(list.closedAt)) : ''),
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
            <Table verticalSpacing="xs" highlightOnHover ref={tableRef} className={tableClasses.table} style={{ width: tableWidth(shownList, ACTIONS_WIDTH), minWidth: '100%' }}>
              <DataTableHeader
                columns={LIST_COLUMNS}
                shown={shownList}
                layout={layout}
                onLayoutChange={(next) => view.change((current) => ({ ...current, ...next }))}
                sorting={config.sorting}
                onSortingChange={(sorting) => view.change((current) => ({ ...current, sorting: sorting as typeof current.sorting }))}
                tableRef={tableRef}
                trailing={<Table.Th w={ACTIONS_WIDTH} />}
                columnExtras={(id) => {
                  const field = id in SHOPPING_LIST_FILTER_FIELDS ? (id as ShoppingListFilterField) : null;
                  const groupBy = COLUMN_GROUP_BY[id];
                  return {
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
                {rows.map((row) => {
                  if (row.kind === 'group')
                    return (
                      <Table.Tr key={`group:${row.key}`} className={classes.groupRow}>
                        <Table.Td colSpan={shownList.length + 1} style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${row.depth} * var(--mantine-spacing-lg))` }}>
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
                  const bought = list.items.filter((item) => item.purchasedAt).length;
                  const total = shoppingTotal(list.items);
                  const cells: Record<string, ReactNode> = {
                    name: (
                      <Group gap="xs" wrap="nowrap">
                        <EditableText
                          value={list.name}
                          label={`Nom de la liste ${list.name}`}
                          strong
                          readOnly={closedOf(list)}
                          onSave={(name) => name && updateList.mutate({ id: list.id, name, taskIds: list.taskIds }, { onError: (error) => notifyError(error.message) })}
                        />
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
                        onSave={(taskIds) =>
                          updateList.mutate(
                            { id: list.id, name: list.name, taskIds },
                            { onSuccess: () => notifySuccess(taskIds.length ? 'Tâches de la liste modifiées.' : 'Liste détachée de ses tâches.'), onError: (error) => notifyError(error.message) },
                          )
                        }
                      />
                    ),
                    progress: (
                      <Badge size="sm" variant="light" color={list.items.length && bought === list.items.length ? 'green' : 'gray'}>
                        {bought} / {list.items.length}
                      </Badge>
                    ),
                    remaining: list.items.length - bought || '',
                    itemCount: list.items.length,
                    total: total > 0 ? fmt.money(total) : null,
                    createdAt: fmt.day(new Date(list.createdAt)),
                    closedAt: list.closedAt ? fmt.day(new Date(list.closedAt)) : null,
                  };
                  return (
                    <Table.Tr key={row.key}>
                      {shownList.map((column, index) => (
                        <Table.Td
                          key={column.id}
                          className={tableClasses.cell}
                          data-numeric={column.numeric || undefined}
                          ff={column.numeric ? 'monospace' : undefined}
                          style={index === 0 ? { paddingLeft: `calc(var(--mantine-spacing-xs) + ${row.depth} * var(--mantine-spacing-lg))` } : undefined}
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
                })}
              </Table.Tbody>
            </Table>
          </div>
        </Paper>
      )}
    </Stack>
  );
}

/**
 * Shopping page (consumables in a professional workspace): the base lists ("listes types"), where what is missing is
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
            Listes types
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
