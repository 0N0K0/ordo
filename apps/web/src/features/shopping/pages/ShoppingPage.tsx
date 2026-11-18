import { IconAction } from '../../../components/actions/IconAction';
import { PAGES } from '../../../app/pages';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { plural, countOf } from '../../../lib/text';
import { PageHeader } from '../../../components/page/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Group, Stack } from '@mantine/core';

import { ArrowCounterClockwiseIcon, ArrowSquareInIcon, BasketIcon, CheckCircleIcon, ListChecksIcon, PlusIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { ON_ERROR } from '../../../lib/notify';
import { taskRef, useTaskContext, type TaskContext } from '../../tasks/hooks/use-task-context';
import { EditableText } from '../../../components/data-table/cells/EditableCells';
import { applyDiff, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { withArchived, type DataColumn } from '../../../components/data-table/table/data-table';
import { useDataView, type FirstTableView } from '../../../components/data-table/views/use-data-view';
import { categoryOptions } from '../../../components/tree/category-tree';
import { shoppingKey, useShoppingData, useShoppingLists, useShoppingMutations, type ShoppingCategory, type ShoppingList, type ShoppingStore } from '../api';
import { BaseLists } from '../components/BaseLists';
import { ShoppingSettings } from '../components/ShoppingSettings';
import { shoppingTotal } from '../lib/export';
import { openNewList } from '../lib/open-new-list';
import { ListActionsMenu } from '../components/ListActions';
import { TasksCell } from '../components/shopping-cells';
import { listClosed, listsOfProjects, listTasks, taskOptions, leftToBuy, shoppingProgress } from '../lib/shopping-format';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { archiveItemsAction, deleteRowsAction, duplicateRowsAction, forEachRow } from '../../../components/data-table/selection/selection-actions';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { localDay } from '../../../lib/dates';
import { useSetArchived, useArchivedToggle } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { useShoppingGrouping } from '../hooks/use-shopping-grouping';

/** Views made the first time: the lists in progress, the closed ones. */
const LIST_VIEWS: FirstTableView[] = [
  { name: 'En cours', config: { filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'open', field: 'state', operator: 'in', value: ['OPEN'] }] } } },
  { name: 'Clôturées', config: { filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'closed', field: 'state', operator: 'in', value: ['CLOSED'] }] } } },
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
      text: (list) => (stateOf(list) === 'CLOSED' ? 'Clôturée' : 'En cours'),
      filter: {
        kind: 'choice',
        value: stateOf,
        options: [
          { value: 'OPEN', label: 'En cours' },
          { value: 'CLOSED', label: 'Clôturée' },
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
      sortValue: (list) => list.createdAt,
      text: (list) => fmt.day(list.createdAt),
      filter: { kind: 'date', value: (list) => localDay(list.createdAt) },
    },
    {
      id: 'closedAt',
      label: 'Clôturée le',
      size: 110,
      hiddenByDefault: true,
      sortValue: (list) => (list.closedAt ? list.closedAt : null),
      text: (list) => (list.closedAt ? fmt.day(list.closedAt) : ''),
      filter: { kind: 'date', value: (list) => (list.closedAt ? localDay(list.closedAt) : null) },
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
        options: withArchived(categoryOptions(env.categories), env.categories),
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
        options: env.stores.map((store) => ({ value: store.id, label: store.name, archived: store.archived })),
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
 * Shopping lists, the data table of every table: tabs of views (« En cours » and « Clôturées » made at first), each with
 * its search, filters, sorts and groups; the name and the tasks of an open list changed in place (or of the lists
 * checked), the actions of each one in its menu (as on its page). The archived lists are hidden until « Afficher les
 * archivées », read only. On a project page, only the lists of its tasks, with
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
  const setArchived = useSetArchived('SHOPPING_LIST', [shoppingKey]);
  const { grouping } = useShoppingGrouping('list');
  const closedOf = (list: ShoppingList) => listClosed(list, context);
  // Archived or closed: read only.
  const lockedOf = (list: ShoppingList) => list.archived || closedOf(list);
  const columns = useMemo(
    () => [...listColumns({ context, categories: shopping?.shoppingCategories ?? [], stores: shopping?.shoppingStores ?? [] }), commentColumn<ShoppingList>(listComments, (list) => list.id)],
    [context, shopping, listComments],
  );
  // Without sort, the latest first.
  const scoped = useMemo(() => (projectIds ? listsOfProjects(lists ?? [], context, projectIds) : (lists ?? [])), [lists, context, projectIds]);
  const { shown, toggle: archivedToggle } = useArchivedToggle(scoped);
  const rows = useMemo(() => [...shown].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [shown]);
  const view = useDataView({ tableKey: 'shopping-lists', projectId: projectId ?? null, columns, rows, title: 'Listes d’achats', first: LIST_VIEWS, getKey: (list) => list.id });

  /**
   * Saves lists, the closed and archived ones left as they are.
   * @param {ShoppingList[]} targets Lists.
   * @param {(list: ShoppingList) => { name?: string, taskIds?: string[] }} changeFor Change of each.
   * @returns {void}
   */
  const saveLists = (targets: ShoppingList[], changeFor: (list: ShoppingList) => { name?: string; taskIds?: string[] }) => {
    for (const list of targets) {
      if (lockedOf(list)) continue;
      const change = changeFor(list);
      updateList.mutate({ id: list.id, name: change.name ?? list.name, taskIds: change.taskIds ?? list.taskIds }, ON_ERROR);
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
          <Group gap="md">
            <ShowArchivedSwitch {...archivedToggle} label="Afficher les archivées" />
            <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openNewList({ projectIds })}>
              Nouvelle liste
            </ActionButton>
          </Group>
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
              <EditableText value={list.name} label={`Nom de la liste ${list.name}`} strong readOnly={lockedOf(list)} onSave={(name) => name && bulk('name')(list, { name })} />
              <IconAction label="Ouvrir la liste" component={Link} to={`/shopping/${list.id}`} size="sm" aria-label={`Ouvrir la liste ${list.name}`}>
                <ArrowSquareInIcon aria-hidden />
              </IconAction>
              {list.archived && <ArchivedBadge feminine size="sm" />}
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
              readOnly={lockedOf(list) || !context}
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
      isArchived={lockedOf}
      selectionLabel={(count) => selectedLabel(count, ['liste', 'listes'])}
      selectionActions={(checked, clear) => {
        const allClosed = checked.every((list) => list.closedAt);
        // An archived list is read only: no copy, no close.
        const changes: SelectionAction[] = checked.some((list) => list.archived)
          ? []
          : [
              duplicateRowsAction(checked, { duplicate: (list) => duplicateList.mutateAsync({ id: list.id }), done: `${countOf(checked.length, 'liste')} ${plural(checked.length, 'dupliquée')}.` }),
              allClosed
                ? {
                    label: 'Rouvrir',
                    icon: <ArrowCounterClockwiseIcon aria-hidden />,
                    onClick: () =>
                      void forEachRow(checked, (list) => setClosed.mutateAsync({ id: list.id, closed: false }), `${countOf(checked.length, 'liste')} ${plural(checked.length, 'rouverte')}.`),
                  }
                : {
                    label: 'Clôturer',
                    icon: <CheckCircleIcon aria-hidden />,
                    onClick: () =>
                      void forEachRow(checked, (list) => setClosed.mutateAsync({ id: list.id, closed: true }), `${countOf(checked.length, 'liste')} ${plural(checked.length, 'clôturée')}.`).then(
                        (all) => all && clear(),
                      ),
                  },
            ];
        return [
          ...changes,
          archiveItemsAction(checked, setArchived, { noun: 'liste', feminine: true, clear }),
          deleteRowsAction(checked, {
            title: 'Supprimer les listes',
            risks: `${countOf(checked.length, 'liste')} et leurs éléments seront supprimés définitivement. Les références et la répartition d’un mouvement rattaché ne changent pas.`,
            remove: (list) => deleteList.mutateAsync({ id: list.id }),
            done: `${countOf(checked.length, 'liste')} ${plural(checked.length, 'supprimée')}.`,
            clear,
          }),
        ];
      }}
    />
  );
}

/** Tabs of the shopping page. */
const SHOPPING_TABS = ['base', 'lists'] as const;

/**
 * Shopping page (consumables in a professional workspace): the base lists ("références"), where what is missing is
 * marked, and the lists made from them; the settings hold the categories (a tree) and the stores.
 * @returns {JSX.Element} Page.
 */
export function ShoppingPage() {
  const [tab, setTab] = usePageTab(SHOPPING_TABS);

  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.shopping.title} />
      <ShoppingSettings />
      <PageTabs value={tab} onChange={(value) => setTab(value)} keepMounted={false}>
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
