import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { PAGES } from '../../../app/pages';
import { ArchivedBadge } from '../../../components/items/ItemBadge';
import { BackLink } from '../../../components/page/BackLink';
import { unarchived } from '../../../lib/archive';
import { countOf, plural } from '../../../lib/text';
import { byPosition } from '@ordo/shared';
import { PageHeader } from '../../../components/page/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TableSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { ActionIcon, Anchor, Badge, Group, Stack, Switch, Text, Title } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import {
  ArchiveIcon,
  BankIcon,
  CalendarPlusIcon,
  DotsThreeVerticalIcon,
  ListPlusIcon,
  PencilSimpleIcon,
  PencilSimpleLineIcon,
  ClipboardTextIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
  TruckIcon,
  CheckIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DataViewBar } from '../../../components/data-table/toolbar/DataViewBar';
import { useDataView, type FirstTableView } from '../../../components/data-table/views/use-data-view';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { ON_ERROR, onMutationError, toastCallbacks } from '../../../lib/notify';
import { TaskRef } from '../../tasks/components/task-ui';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useShoppingData, useShoppingLists, useShoppingMutations, type ShoppingList } from '../api';
import { shoppingTotal } from '../lib/export';
import { openShoppingForm } from '../lib/open-shopping-form';
import { ListActionsMenu } from '../components/ListActions';
import { SheetPicker } from '../../sheets/components/SheetPicker';
import { useSheetMutations } from '../../sheets/api';
import { openFormPanel } from '../../../components/panels/panels';
import { ProductPicker } from '../components/ProductPicker';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { blankInput, EMPTY_GROUPS_LABEL, listClosed, listTasks, usePeople, type ShoppingGrouping, shoppingProgress } from '../lib/shopping-format';
import { ShoppingSettings } from '../components/ShoppingSettings';
import { GroupingControl } from '../components/GroupingControl';
import { itemColumns, optionalColumn } from '../lib/shopping-columns';
import { ShoppingTable } from '../components/ShoppingTable';
import { StoreMode } from '../components/StoreMode';
import { OrderPanel } from '../components/OrderPanel';
import { deliveryInput, deliveryWindow } from '../lib/delivery-format';
import { StockPurchaseForm } from '../../stock/components/StockPurchaseForm';
import { useStockProposal } from '../../stock/hooks/use-stock-proposal';
import { useProductStock, useStockMutations } from '../../stock/api';
import { bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import * as fmt from '../../../lib/format';
import { deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { Comments } from '../../comments/components/Comments';

type ShoppingItem = ShoppingList['items'][number];

/**
 * Sheets the items of a list come from, each once.
 * @param {ShoppingItem[]} items Items.
 * @returns {{ sheetId: string, name: string }[]} Sheets.
 */
const listSheets = (items: ShoppingItem[]) => [
  ...new Map(items.flatMap((item) => item.sheetSources.map((source) => [source.sheetId, { sheetId: source.sheetId, name: source.name }] as const))).values(),
];

/** Views made the first time a list is shown: every item (opened first), what is left to buy. */
const LIST_VIEWS: FirstTableView[] = [
  { name: 'Tout' },
  { name: 'À acheter', config: { filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'bought', field: 'bought', operator: 'isFalse', value: null }] } } },
];

/**
 * Page of a shopping list: its items by category or by store, ticked as bought (their products of the base list
 * follow), products of the base list or other items added, the estimated total; its task and the treasury entry
 * paying it; copy, export, store mode, closing, archive and deletion. Closed or archived, it is read only.
 * @returns {JSX.Element} Page.
 */
export function ShoppingListPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: lists, isPending } = useShoppingLists();
  const { data } = useShoppingData();
  const { context } = useTaskContext();
  const mutations = useShoppingMutations();
  const [grouping, setGrouping] = useLocalStorage<ShoppingGrouping>({ key: 'ordo.shopping.listGrouping', defaultValue: 'category' });
  const [storeMode, setStoreMode] = useState(false);
  const [showEmpty, setShowEmpty] = useLocalStorage({ key: 'ordo.shopping.showEmptyCategories', defaultValue: false });
  const list = lists?.find((item) => item.id === id);
  // Projects of the list, through its tasks: their contributors are the members offered.
  const people = usePeople();
  const sheetMutations = useSheetMutations();
  const stockMutations = useStockMutations();
  const inStock = useProductStock();
  const propose = useStockProposal();
  const deliveries = list?.deliveries ?? [];
  const deliveryName = (id: string | null | undefined) => {
    const delivery = deliveries.find((item) => item.id === id);
    return delivery ? delivery.label || `${delivery.pickup ? 'Retrait' : 'Livraison'} ${deliveryWindow(delivery)}`.trim() : '';
  };
  const itemComments = useCommentCounts(
    'SHOPPING_ITEM',
    (list?.items ?? []).map((item) => item.id),
  );
  const columns = itemColumns<ShoppingItem>(
    grouping,
    {
      categories: data?.shoppingCategories ?? [],
      stores: data?.shoppingStores ?? [],
      storages: data?.shoppingStorages ?? [],
      members: people.members,
      relations: people.relations,
      archivedPeople: people.archived,
    },
    [
      optionalColumn<ShoppingItem>(),
      {
        id: 'bought',
        label: 'Acheté',
        size: 100,
        hiddenByDefault: true,
        sortValue: (item) => (item.purchasedAt ? 1 : 0),
        text: (item) => (item.purchasedAt ? 'Acheté' : ''),
        filter: { kind: 'boolean', value: (item) => Boolean(item.purchasedAt) },
      },
      {
        id: 'inStock',
        label: 'En stock',
        size: 100,
        numeric: true,
        sortValue: (item) => (item.productId && inStock.has(item.productId) ? inStock.get(item.productId)! : null),
        text: (item) => (item.productId && inStock.has(item.productId) ? fmt.number(inStock.get(item.productId)!, 3) : ''),
        filter: { kind: 'number', value: (item) => (item.productId ? (inStock.get(item.productId) ?? null) : null) },
      },
      {
        id: 'delivery',
        label: 'Livraison',
        size: 170,
        bulk: true,
        hiddenByDefault: !list?.remote,
        sortValue: (item) => deliveryName(item.deliveryId) || null,
        text: (item) => deliveryName(item.deliveryId),
        filter: { kind: 'choice', value: (item) => item.deliveryId ?? null, options: deliveries.map((delivery) => ({ value: delivery.id, label: deliveryName(delivery.id) })) },
        groupable: true,
      },
      {
        id: 'sheets',
        label: 'Fiches',
        size: 180,
        sortValue: (item) => item.sheetSources.map((source) => source.name).join(', ') || null,
        text: (item) => item.sheetSources.map((source) => source.name).join(', '),
        filter: {
          kind: 'choices',
          value: (item) => item.sheetSources.map((source) => source.sheetId),
          options: listSheets(list?.items ?? []).map((sheet) => ({ value: sheet.sheetId, label: sheet.name })),
        },
      },
      commentColumn<ShoppingItem>(
        itemComments,
        (item) => item.id,
        (item) => item.note,
      ),
    ],
  );
  const view = useDataView({
    tableKey: 'shopping-list',
    getKey: (item) => item.id,
    columns,
    rows: [...(list?.items ?? [])].sort(byPosition),
    title: list?.name ?? 'Liste d’achats',
    first: LIST_VIEWS,
    bulkColumns: [{ id: 'bought', label: 'Acheté' }],
  });

  /**
   * Puts items in a delivery (or out of any): the deliveries they leave and the one they join are saved.
   * @param {ShoppingItem[]} moved Items.
   * @param {string | null} deliveryId Delivery (none: out of any).
   * @returns {void}
   */
  const assignDelivery = (moved: ShoppingItem[], deliveryId: string | null) => {
    const ids = new Set(moved.map((item) => item.id));
    for (const delivery of deliveries) {
      const own = (list?.items ?? []).filter((item) => item.deliveryId === delivery.id).map((item) => item.id);
      const next = delivery.id === deliveryId ? [...new Set([...own, ...ids])] : own.filter((id) => !ids.has(id));
      if (next.length !== own.length || next.some((id) => !own.includes(id))) stockMutations.updateDelivery.mutate({ id: delivery.id, input: deliveryInput(delivery, next) }, ON_ERROR);
    }
  };
  const bulkDelivery = bulkSaver<ShoppingItem, string | null>(
    view,
    (item, deliveryId) => assignDelivery([item], deliveryId),
    (moved, deliveryFor) => assignDelivery(moved, deliveryFor(moved[0])),
  )('delivery');

  if (isPending) {
    return <TableSkeleton rows={4} />;
  }
  if (!list) {
    return <DetailNotFound what="Cette liste" feminine backTo="/shopping?tab=lists" backLabel="Listes d’achats" />;
  }

  const tasks = listTasks(list, context);
  // Closed (by hand or with its tasks) or archived: read only.
  const closed = listClosed(list, context) || list.archived;
  const baseLists = unarchived(data?.shoppingBaseLists ?? []);
  const total = shoppingTotal(list.items);
  const spent = shoppingTotal(list.items.filter((item) => item.purchasedAt));
  // Its required items (the optional ones apart).
  const { bought, total: required } = shoppingProgress(list.items);

  return (
    <Stack gap="lg">
      <ShoppingSettings />
      <Group gap="sm" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <BackLink to="/shopping?tab=lists">Listes d’achats</BackLink>
          <PageHeader title={PAGES.shopping.title} />
          <Group gap="xs">
            <Title order={2} size="h3" style={{ wordBreak: 'break-word' }}>
              {list.name}
            </Title>
            {list.archived ? (
              <ArchivedBadge feminine />
            ) : (
              closed && (
                <Badge variant="light" color="gray" tt="none">
                  Clôturée
                </Badge>
              )
            )}
          </Group>
          <Group gap="md">
            {tasks.map((task) => (
              <TaskRef key={task.id} task={task} blocked={context?.isBlocked(task)} />
            ))}
            {list.entry && (
              <Group gap={4} wrap="nowrap">
                <BankIcon aria-hidden size={14} />
                <Anchor component={Link} to="/treasury" size="sm">
                  {list.entry.label} · {fmt.money(list.entry.amount)} · {fmt.day(list.entry.date)}
                </Anchor>
              </Group>
            )}
            <Text size="sm" c="dimmed">
              {bought} sur {required} {plural(bought, 'acheté')}
              {total > 0 && ` · ${fmt.money(spent)} sur ${fmt.money(total)} estimés`}
            </Text>
          </Group>
        </Stack>
      </Group>

      <DataViewBar
        view={view}
        searchLabel="Rechercher un produit"
        manualText="Sans tri : l’ordre de la liste, dans ses catégories."
        displayOptions={
          <>
            <GroupingControl value={grouping} onChange={setGrouping} />
            <Switch label={EMPTY_GROUPS_LABEL[grouping]} checked={showEmpty} onChange={(event) => setShowEmpty(event.currentTarget.checked)} />
          </>
        }
        actions={
          <Group gap="sm" ml="auto" wrap="wrap">
            {!closed && (
              <ActionButton
                priority="secondary"
                icon={<PlusIcon aria-hidden />}
                menu={[
                  {
                    label: 'Depuis les références…',
                    icon: <ListPlusIcon aria-hidden />,
                    disabled: baseLists.length === 0,
                    onClick: () => openFormPanel('Ajouter des produits des références', (close) => <ProductPicker list={list} onDone={close} />),
                  },
                  { label: 'Hors références…', icon: <PencilSimpleLineIcon aria-hidden />, onClick: () => openShoppingForm({ kind: 'item', listId: list.id }) },
                  {
                    label: 'Depuis une fiche…',
                    icon: <ClipboardTextIcon aria-hidden />,
                    onClick: () =>
                      openFormPanel('Ajouter une fiche', (close) => (
                        <SheetPicker
                          present={listSheets(list.items)}
                          onAdd={(sheetId, multiplier) => sheetMutations.addToShoppingList.mutateAsync({ listId: list.id, sheetId, multiplier })}
                          onRemove={(sheetId) => sheetMutations.removeFromShoppingList.mutateAsync({ listId: list.id, sheetId })}
                          onDone={close}
                        />
                      )),
                  },
                ]}
              >
                Ajouter un produit
              </ActionButton>
            )}
            <ActionButton priority="secondary" icon={<TruckIcon aria-hidden />} disabled={list.archived} onClick={() => openFormPanel('Commande à distance', () => <OrderPanel listId={list.id} />)}>
              {list.remote ? `Commande · ${countOf(list.deliveries.filter((delivery) => !delivery.receivedAt).length, 'livraison')} en cours` : 'Commande à distance'}
            </ActionButton>
            <ActionButton icon={<ShoppingCartIcon aria-hidden />} disabled={list.items.length === 0 || list.archived} onClick={() => setStoreMode(true)}>
              Mode collecte
            </ActionButton>
            <ListActionsMenu
              list={list}
              grouping={grouping}
              onDeleted={() => navigate('/shopping?tab=lists')}
              target={
                <ActionIcon variant="default" size="input-sm" aria-label={`Actions de la liste ${list.name}`}>
                  <DotsThreeVerticalIcon aria-hidden />
                </ActionIcon>
              }
            />
          </Group>
        }
      />

      {list.items.length === 0 ? (
        <EmptyState icon={<ListPlusIcon aria-hidden />} message="La liste est vide : ajoutez des produits des références ou d’autres éléments." />
      ) : (
        <ShoppingTable
          view={view}
          selectionLabel={(count) => selectedLabel(count, ['élément', 'éléments'], false)}
          selectionActions={(rows, clear) => [
            { label: 'Ajouter au stock…', icon: <ArchiveIcon aria-hidden />, onClick: () => openFormPanel('Ajouter au stock', (close) => <StockPurchaseForm items={rows} onDone={close} />) },
            {
              ...deleteRowsAction(rows, {
                label: 'Retirer de la liste',
                title: 'Retirer les éléments',
                risks: `${countOf(rows.length, 'élément')} seront retirés de la liste ; ceux qui ne sont dans aucune référence seront supprimés définitivement.`,
                remove: (item) => mutations.deleteItem.mutateAsync({ id: item.id }),
                done: `${countOf(rows.length, 'élément')} ${plural(rows.length, 'retiré')}.`,
                clear,
              }),
              disabled: closed,
            },
          ]}
          items={[...list.items].sort(byPosition)}
          grouping={grouping}
          label={`Éléments de ${list.name}`}
          readOnly={closed}
          showEmpty={showEmpty}
          add={
            closed
              ? undefined
              : {
                  label: 'Ajouter un élément hors références',
                  onCreate: (name, place) => mutations.addItem.mutateAsync({ listId: list.id, input: blankInput(name, place) }),
                  onPick: baseLists.length ? () => openFormPanel('Ajouter des produits des références', (close) => <ProductPicker list={list} onDone={close} />) : undefined,
                }
          }
          onSave={(item, input) => mutations.updateItem.mutate({ id: item.id, input }, ON_ERROR)}
          extraCells={(item) => ({
            inStock: item.productId && inStock.has(item.productId) && (
              <Text span size="sm" c="dimmed" ff="monospace">
                {fmt.number(inStock.get(item.productId)!, 3)}
              </Text>
            ),
            delivery: list.remote && (
              <EditableSelect
                value={item.deliveryId ?? null}
                label={`Livraison de ${item.name}`}
                nullable
                data={deliveries.map((delivery) => ({ value: delivery.id, label: deliveryName(delivery.id) }))}
                onSave={(deliveryId) => bulkDelivery(item, deliveryId)}
              />
            ),
          })}
          done={(item) => Boolean(item.purchasedAt)}
          toggle={{
            id: 'bought',
            name: 'Acheté',
            value: (item) => Boolean(item.purchasedAt),
            label: (item) => `${item.name} acheté`,
            hint: (item) => (item.purchasedAt ? 'Acheté (cliquer : pas encore acheté)' : 'À acheter (cliquer : acheté)'),
            icon: <CheckIcon aria-hidden />,
            color: 'green',
            // Bought: the references followed in stock are proposed for the stock (unless they go there by themselves).
            onChange: (items, purchased) => {
              const changed = items.filter((item) => Boolean(item.purchasedAt) !== purchased);
              Promise.all(changed.map((item) => mutations.setPurchased.mutateAsync({ id: item.id, purchased })))
                .then(() => purchased && changed.length > 0 && propose(changed))
                .catch(onMutationError);
            },
          }}
          badge={(item) =>
            !item.productId && (
              <Badge size="xs" variant="outline" color="gray" tt="none" style={{ flex: 'none' }}>
                hors liste
              </Badge>
            )
          }
          summary={(items) => `${items.filter((item) => item.purchasedAt).length} / ${items.length}`}
          actions={(item) => (
            <RowActions
              name={item.name}
              primary={!closed && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openShoppingForm({ kind: 'item', listId: list.id, item }) }}
              items={[
                ...(!item.productId && !closed
                  ? baseLists.map((baseList) => ({
                      label: `Ajouter à « ${baseList.name} »`,
                      icon: <ListPlusIcon aria-hidden />,
                      onClick: () => mutations.saveToBase.mutate({ id: item.id, baseListId: baseList.id }, toastCallbacks(`Ajouté à « ${baseList.name} ».`)),
                    }))
                  : []),
                item.perishable && {
                  label: 'Ajouter avec une autre date',
                  icon: <CalendarPlusIcon aria-hidden />,
                  hint: 'Le même produit, acheté avec une autre date de péremption',
                  disabled: closed,
                  onClick: () => mutations.duplicateItem.mutate({ id: item.id }, toastCallbacks('Ligne ajoutée : indiquez sa date.')),
                },
                { label: 'Ajouter au stock…', icon: <ArchiveIcon aria-hidden />, onClick: () => openFormPanel('Ajouter au stock', (close) => <StockPurchaseForm items={[item]} onDone={close} />) },
                {
                  label: 'Retirer de la liste',
                  icon: <TrashIcon aria-hidden />,
                  danger: true,
                  disabled: closed,
                  onClick: () => {
                    const remove = () => mutations.deleteItem.mutate({ id: item.id }, ON_ERROR);
                    // An item of this list only is lost with it; a product of a base list can be added back.
                    if (item.productId) remove();
                    else
                      confirmDestructive({
                        title: 'Retirer l’élément',
                        risks: `« ${item.name} » n’est dans aucune référence : il sera supprimé définitivement. Cette action est irréversible.`,
                        confirmLabel: 'Retirer',
                        onConfirm: remove,
                      });
                  },
                },
              ]}
            />
          )}
        />
      )}
      {total > 0 && (
        <Group justify="flex-end">
          <Text size="sm" fw={600}>
            Total estimé : {fmt.money(total)}
          </Text>
        </Group>
      )}
      <Comments target="SHOPPING_LIST" id={list.id} />
      {storeMode && <StoreMode list={list} onClose={() => setStoreMode(false)} />}
    </Stack>
  );
}
