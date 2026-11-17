import { PageHeader } from '../../components/actions/PageHeader';
import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ActionIcon, Badge, Group, Stack, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowSquareInIcon, BasketIcon, ListChecksIcon, PlusIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageTabs } from '../../components/PageTabs';
import { onMutationError } from '../../lib/notify';
import { taskRef, useTaskContext, type TaskContext } from '../tasks/use-task-context';
import { EditableText } from '../../components/data-table/EditableCells';
import { applyDiff, bulkSaver } from '../../components/data-table/bulk-edit';
import { DataTable } from '../../components/data-table/DataTable';
import type { DataColumn } from '../../components/data-table/data-table';
import { useDataView, type FirstTableView } from '../../components/data-table/use-data-view';
import { categoryOptions } from '../../components/category-tree/category-tree';
import { useShoppingData, useShoppingLists, useShoppingMutations, type ShoppingCategory, type ShoppingList, type ShoppingStore } from './api';
import { BaseLists } from './BaseLists';
import { ShoppingSettings } from './ShoppingSettings';
import { shoppingTotal } from './export';
import { openNewList } from './open-new-list';
import { ListActionsMenu } from './ListActions';
import { TasksCell } from './shopping-cells';
import { listClosed, listsOfProjects, listTasks, taskOptions, type ShoppingGrouping, leftToBuy, shoppingProgress } from './shopping-format';
import * as fmt from '../../lib/format';
import { useCommentCounts } from '../comments/api';
import { commentColumn } from '../comments/comment-column';
import { deleteRowsAction, duplicateRowsAction, forEachRow } from '../../components/data-table/selection-actions';
import { selectedLabel } from '../../components/data-table/selection-label';
import { localDay } from '../../lib/dates';

/** Views made the first time: the lists in progress, the archived ones. */
const LIST_VIEWS: FirstTableView[] = [
  { name: 'En cours', config: { filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'open', field: 'state', operator: 'in', value: ['OPEN'] }] } } },
  { name: 'Archivées', config: { filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'closed', field: 'state', operator: 'in', value: ['CLOSED'] }] } } },
];

/** What the columns of the lists need: the tasks, the categories and the stores. */
interface ListEnv {
  context: TaskContext | null;
  categories: ShoppingCategory[];
  stores: ShoppingStore[];
}

/**
 * Projects of the tasks of a list.
 * @param {ShoppingList} list List.
 * @param {TaskContext | null} context Task context.
 * @returns {string[]} Project ids.
 */
const projectsOf = (list: ShoppingList, context: TaskContext | null) => [...new Set(listTasks(list, context).flatMap((task) => (task.projectId ? [task.projectId] : [])))];

/**
 * Columns of the lists: shown, sorted, filtered, grouped, exported as on every table.
 * @param {ListEnv} env Tasks, categories and stores.
 * @returns {DataColumn<ShoppingList>[]} Columns.
 */
function listColumns(env: ListEnv): DataColumn<ShoppingList>[] {
  const { context } = env;
  const taskLabel = (id: string) => {
    const task = context?.taskById.get(id);
    return task ? (context?.taskLabel(task) ?? `${taskRef(task)}${task.title}`) : '';
  };
  const stateOf = (list: ShoppingList) => (listClosed(list, context) ? 'CLOSED' : 'OPEN');
  return [
    { id: 'name', label: 'Liste', size: 260, locked: true, bulk: true, sortValue: (list) => list.name, text: (list) => list.name },
    {
      id: 'tasks',
      label: 'Tâches',
      size: 260,
      bulk: true,
      sortValue: (list) => list.taskIds.map(taskLabel).sort()[0] ?? null,
      text: (list) => list.taskIds.map(taskLabel).filter(Boolean).join(', '),
      filter: { kind: 'choices', value: (list) => list.taskIds, options: context ? context.taskOptions(context.tasks) : [] },
    },
    {
      id: 'project',
      label: 'Projet',
      size: 180,
      hiddenByDefault: true,
      sortValue: (list) =>
        projectsOf(list, context)
          .map((id) => context?.projectLabel(id) ?? '')
          .sort()[0] ?? null,
      text: (list) =>
        projectsOf(list, context)
          .map((id) => context?.projectLabel(id) ?? '')
          .join(', '),
      filter: {
        kind: 'choices',
        value: (list) => projectsOf(list, context),
        options: context ? context.projectOptions(context.projects) : [],
      },
    },
    {
      id: 'state',
      label: 'État',
      size: 110,
      hiddenByDefault: true,
      sortValue: (list) => (stateOf(list) === 'CLOSED' ? 1 : 0),
      text: (list) => (stateOf(list) === 'CLOSED' ? 'Archivée' : 'En cours'),
      filter: {
        kind: 'choice',
        value: stateOf,
        options: [
          { value: 'OPEN', label: 'En cours' },
          { value: 'CLOSED', label: 'Archivée' },
        ],
      },
    },
    {
      id: 'progress',
      label: 'Achats',
      size: 100,
      groupable: false,
      sortValue: (list) => (shoppingProgress(list.items).total ? shoppingProgress(list.items).bought / shoppingProgress(list.items).total : null),
      text: (list) => `${shoppingProgress(list.items).bought} / ${shoppingProgress(list.items).total}`,
      filter: false,
    },
    {
      id: 'remaining',
      label: 'Restant',
      size: 90,
      numeric: true,
      hiddenByDefault: true,
      sortValue: (list) => leftToBuy(list.items).length,
      text: (list) => String(leftToBuy(list.items).length || ''),
    },
    { id: 'itemCount', label: 'Produits', size: 90, numeric: true, hiddenByDefault: true, sortValue: (list) => list.items.length, text: (list) => String(list.items.length) },
    {
      id: 'total',
      label: 'Total estimé',
      size: 120,
      numeric: true,
      sortValue: (list) => shoppingTotal(list.items) || null,
      text: (list) => (shoppingTotal(list.items) > 0 ? fmt.money(shoppingTotal(list.items)) : ''),
      formatTotal: fmt.money,
    },
    {
      id: 'createdAt',
      label: 'Créée le',
      size: 110,
      sortValue: (list) => String(list.createdAt),
      text: (list) => fmt.day(new Date(list.createdAt)),
      filter: { kind: 'date', value: (list) => localDay(String(list.createdAt)) },
    },
    {
      id: 'closedAt',
      label: 'Archivée le',
      size: 110,
      hiddenByDefault: true,
      sortValue: (list) => (list.closedAt ? String(list.closedAt) : null),
      text: (list) => (list.closedAt ? fmt.day(new Date(list.closedAt)) : ''),
      filter: { kind: 'date', value: (list) => (list.closedAt ? localDay(String(list.closedAt)) : null) },
    },
    {
      id: 'paid',
      label: 'Payée',
      size: 90,
      hiddenByDefault: true,
      sortValue: (list) => (list.entryId ? 1 : 0),
      text: (list) => (list.entryId ? 'Oui' : ''),
      filter: { kind: 'boolean', value: (list) => list.entryId !== null },
    },
    {
      id: 'categories',
      label: 'Catégories',
      size: 180,
      hiddenByDefault: true,
      text: (list) => [...new Set(list.items.flatMap((item) => (item.categoryId ? [env.categories.find((category) => category.id === item.categoryId)?.name ?? ''] : [])))].join(', '),
      filter: {
        kind: 'choices',
        value: (list) => [...new Set(list.items.flatMap((item) => (item.categoryId ? [item.categoryId] : [])))],
        options: categoryOptions(env.categories),
      },
    },
    {
      id: 'stores',
      label: 'Magasins',
      size: 180,
      hiddenByDefault: true,
      text: (list) => [...new Set(list.items.flatMap((item) => (item.storeId ? [env.stores.find((store) => store.id === item.storeId)?.name ?? ''] : [])))].join(', '),
      filter: {
        kind: 'choices',
        value: (list) => [...new Set(list.items.flatMap((item) => (item.storeId ? [item.storeId] : [])))],
        options: env.stores.map((store) => ({ value: store.id, label: store.name })),
      },
    },
    {
      id: 'itemNames',
      label: 'Produits (noms)',
      size: 220,
      hiddenByDefault: true,
      groupable: false,
      text: (list) => list.items.map((item) => item.name).join(', '),
    },
  ];
}

/**
 * Shopping lists, the data table of every table: tabs of views (« En cours » and « Archivées » made at first), each with
 * its search, filters, sorts and groups; the name and the tasks of an open list changed in place (or of the lists
 * checked), the actions of each one in its menu (as on its page). On a project page, only the lists of its tasks, with
 * the views of the project.
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
  const closedOf = (list: ShoppingList) => listClosed(list, context);
  const columns = useMemo(
    () => [...listColumns({ context, categories: shopping?.shoppingCategories ?? [], stores: shopping?.shoppingStores ?? [] }), commentColumn<ShoppingList>(listComments, (list) => list.id)],
    [context, shopping, listComments],
  );
  // Without sort, the latest first.
  const rows = useMemo(
    () => [...(projectIds ? listsOfProjects(lists ?? [], context, projectIds) : (lists ?? []))].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [lists, context, projectIds],
  );
  const view = useDataView({ tableKey: 'shopping-lists', projectId: projectId ?? null, columns, rows, title: 'Listes d’achats', first: LIST_VIEWS, getKey: (list) => list.id });

  /**
   * Saves lists, the closed ones left as they are.
   * @param {ShoppingList[]} targets Lists.
   * @param {(list: ShoppingList) => { name?: string, taskIds?: string[] }} changeFor Change of each.
   * @returns {void}
   */
  const saveLists = (targets: ShoppingList[], changeFor: (list: ShoppingList) => { name?: string; taskIds?: string[] }) => {
    for (const list of targets) {
      if (closedOf(list)) continue;
      const change = changeFor(list);
      updateList.mutate({ id: list.id, name: change.name ?? list.name, taskIds: change.taskIds ?? list.taskIds }, { onError: onMutationError });
    }
  };
  const bulk = bulkSaver<ShoppingList, { name?: string; taskIds?: string[] }>(view, (list, change) => saveLists([list], () => change), saveLists);

  return (
    <DataTable
      view={view}
      getKey={(list) => list.id}
      loading={isPending || Boolean(projectIds && !context)}
      framed
      verticalSpacing="xs"
      bar={{
        searchLabel: 'Rechercher (liste, produit)',
        manualText: 'Sans tri : les listes les plus récentes d’abord.',
        actions: (
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openNewList({ projectIds })}>
            Nouvelle liste
          </ActionButton>
        ),
      }}
      empty={<EmptyState icon={<ListChecksIcon aria-hidden />} message={projectIds ? 'Aucune liste : une liste rattachée à une tâche du projet s’affiche ici.' : 'Aucune liste pour le moment.'} />}
      cells={(list) => {
        // Its required items (the optional ones apart).
        const { bought, total: required } = shoppingProgress(list.items);
        return {
          ...Object.fromEntries(columns.filter((column) => column.text).map((column) => [column.id, column.text!(list)])),
          name: (
            <Group gap="xs" wrap="nowrap">
              <EditableText value={list.name} label={`Nom de la liste ${list.name}`} strong readOnly={closedOf(list)} onSave={(name) => name && bulk('name')(list, { name })} />
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
              items={listTasks(list, context).map((task) => ({ id: task.id, label: context?.taskLabel(task) ?? `${taskRef(task)}${task.title}` }))}
              options={taskOptions(context, list.taskIds)}
              value={list.taskIds}
              onSave={(taskIds) => bulk('tasks')(list, (target) => ({ taskIds: applyDiff(target.taskIds, list.taskIds, taskIds) }))}
            />
          ),
          progress: (
            <Badge size="sm" variant="light" color={required && bought === required ? 'green' : 'gray'}>
              {bought} / {required}
            </Badge>
          ),
        };
      }}
      actions={(list) => (
        <Group justify="flex-end">
          <ListActionsMenu list={list} grouping={grouping} />
        </Group>
      )}
      isArchived={closedOf}
      selectionLabel={(count) => selectedLabel(count, ['liste', 'listes'])}
      selectionActions={(checked, clear) => {
        const allClosed = checked.every((list) => list.closedAt);
        return [
          duplicateRowsAction(checked, { duplicate: (list) => duplicateList.mutateAsync({ id: list.id }), done: `${checked.length} liste(s) dupliquée(s).` }),
          allClosed
            ? {
                label: 'Rouvrir',
                icon: <ArrowCounterClockwiseIcon aria-hidden />,
                onClick: () => void forEachRow(checked, (list) => setClosed.mutateAsync({ id: list.id, closed: false }), `${checked.length} liste(s) rouverte(s).`),
              }
            : {
                label: 'Archiver',
                icon: <ArchiveIcon aria-hidden />,
                onClick: () => void forEachRow(checked, (list) => setClosed.mutateAsync({ id: list.id, closed: true }), `${checked.length} liste(s) archivée(s).`).then((all) => all && clear()),
              },
          deleteRowsAction(checked, {
            title: 'Supprimer les listes',
            risks: `${checked.length} liste(s) et leurs éléments seront supprimés définitivement. Les références et la répartition d’un mouvement rattaché ne changent pas. Cette action est irréversible.`,
            remove: (list) => deleteList.mutateAsync({ id: list.id }),
            done: `${checked.length} liste(s) supprimée(s).`,
            clear,
          }),
        ];
      }}
    />
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
