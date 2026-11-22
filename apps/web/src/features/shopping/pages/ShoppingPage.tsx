import { IconAction } from '../../../components/actions/IconAction';
import { PAGES, shoppingListPath } from '../../../app/pages';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { plural, countOf } from '../../../lib/text';
import { PageHeader } from '../../../components/page/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Group, Stack } from '@mantine/core';

import { ArrowCounterClockwiseIcon, ArrowSquareInIcon, BasketIcon, CheckCircleIcon, ListChecksIcon, PlusIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { ON_ERROR } from '../../../lib/notify';
import { taskNumbered, useTaskContext } from '../../tasks/hooks/use-task-context';
import { EditableText } from '../../../components/data-table/cells/EditableCells';
import { applyDiff, bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { readOnlyCells } from '../../../components/data-table/table/data-table';
import { useDataView, type FirstTableView, conditionFilter } from '../../../components/data-table/views/use-data-view';
import { shoppingKey, useShoppingLists, useShoppingMutations, type ShoppingList } from '../api';
import { BaseLists } from '../components/BaseLists';
import { useShoppingListColumns } from '../hooks/use-shopping-columns';
import { ShoppingPageSettings } from '../components/ShoppingSettings';
import { openNewList } from '../lib/open-new-list';
import { ListActionsMenu } from '../components/ListActions';
import { TasksCell } from '../components/shopping-cells';
import { listClosed, listsOfProjects, listTasks, taskOptions } from '../lib/shopping-format';
import { archiveItemsAction, deleteRowsAction, duplicateRowsAction, forEachRow } from '../../../components/data-table/selection/selection-actions';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { useSetArchived, useArchivedToggle } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { ShoppingProgressBadge } from '../components/ShoppingProgressBadge';

/** Views made the first time: the lists in progress, the closed ones. */
const LIST_VIEWS: FirstTableView[] = [
  { label: 'En cours', config: { filter: conditionFilter('state', 'in', ['OPEN'], 'open') } },
  { label: 'Clôturées', config: { filter: conditionFilter('state', 'in', ['CLOSED'], 'closed') } },
];

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
  const { context } = useTaskContext();
  const { updateList, duplicateList, setClosed, deleteList } = useShoppingMutations();
  const navigate = useNavigate();
  const setArchived = useSetArchived('SHOPPING_LIST', [shoppingKey]);
  const closedOf = (list: ShoppingList) => listClosed(list, context);
  // Archived or closed: read only.
  const lockedOf = (list: ShoppingList) => list.archived || closedOf(list);
  const columns = useShoppingListColumns(lists);
  // Without sort, the latest first.
  const scoped = useMemo(() => (projectIds ? listsOfProjects(lists ?? [], context, projectIds) : (lists ?? [])), [lists, context, projectIds]);
  const { shown, toggle: archivedToggle } = useArchivedToggle(scoped);
  const rows = useMemo(() => [...shown].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [shown]);
  const view = useDataView({ tableKey: 'shopping-lists', projectId: projectId ?? null, columns, rows, title: 'Listes d’achats', first: LIST_VIEWS, getKey: (list) => list.id });

  /**
   * Saves lists, the closed and archived ones left as they are.
   * @param {ShoppingList[]} targets Lists.
   * @param {(list: ShoppingList) => { label?: string, taskIds?: string[] }} changeFor Change of each.
   * @returns {void}
   */
  const saveLists = (targets: ShoppingList[], changeFor: (list: ShoppingList) => { label?: string; taskIds?: string[] }) => {
    for (const list of targets) {
      if (lockedOf(list)) continue;
      const change = changeFor(list);
      updateList.mutate({ id: list.id, label: change.label ?? list.label, taskIds: change.taskIds ?? list.taskIds }, ON_ERROR);
    }
  };
  const cellLabelOf = bulkCellLabels(view, (list: ShoppingList) => list.label);
  const bulk = bulkSaver<ShoppingList, { label?: string; taskIds?: string[] }>(view, (list, change) => saveLists([list], () => change), saveLists);

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
        return {
          ...readOnlyCells(columns, list),
          label: (
            <Group gap="xs" wrap="nowrap">
              <EditableText value={list.label} label={cellLabelOf('label', list, 'Libellé')} strong readOnly={lockedOf(list)} onSave={(label) => label && bulk('label')(list, { label })} />
              <IconAction label="Ouvrir la liste" component={Link} to={shoppingListPath(list.id)} size="sm" item={list.label}>
                <ArrowSquareInIcon aria-hidden />
              </IconAction>
              {list.archived && <ArchivedBadge feminine size="sm" />}
              {list.entryId && (
                <Badge size="xs" variant="light">
                  Payée
                </Badge>
              )}
            </Group>
          ),
          tasks: (
            <TasksCell
              label={cellLabelOf('tasks', list, 'Tâches')}
              readOnly={lockedOf(list) || !context}
              items={listTasks(list, context).map((task) => ({ id: task.id, label: context?.taskLabel(task) ?? taskNumbered(task) }))}
              options={taskOptions(context, list.taskIds)}
              value={list.taskIds}
              onSave={(taskIds) => bulk('tasks')(list, (target) => ({ taskIds: applyDiff(target.taskIds, list.taskIds, taskIds) }))}
            />
          ),
          progress: <ShoppingProgressBadge items={list.items} />,
        };
      }}
      actions={(list) => (
        <Group justify="flex-end">
          <ListActionsMenu list={list} />
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
              duplicateRowsAction(checked, {
                duplicate: (list) => duplicateList.mutateAsync({ id: list.id }),
                done: checked.length > 1 ? `${countOf(checked.length, 'liste')} ${plural(checked.length, 'dupliquée')}.` : 'Liste dupliquée.',
                open: (copyId) => void navigate(shoppingListPath(copyId)),
              }),
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
            risks: `${countOf(checked.length, 'liste')} et ${plural(checked.length, 'ses', 'leurs')} éléments seront supprimés définitivement. Les références et la répartition d’un mouvement rattaché ne changent pas.`,
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
      <PageHeader title={PAGES.shopping.label} />
      <ShoppingPageSettings />
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
