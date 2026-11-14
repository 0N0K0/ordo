import { PageHeader } from '../../components/actions/PageHeader';
import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { ActionIcon, Anchor, Badge, Checkbox, Group, Stack, Switch, Text, Title, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { formatMoney } from '@ordo/shared';
import {
  ArrowLeftIcon,
  BankIcon,
  BasketIcon,
  CalendarPlusIcon,
  DotsThreeVerticalIcon,
  ListPlusIcon,
  PencilSimpleIcon,
  PencilSimpleLineIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DataViewBar } from '../../components/data-table/DataViewBar';
import { useDataView, type FirstTableView } from '../../components/data-table/use-data-view';
import { RowActions } from '../../components/data-table/RowActions';
import { notifyError, notifySuccess } from '../../lib/notify';
import { TaskRef } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useShoppingData, useShoppingLists, useShoppingMutations, type ShoppingList } from './api';
import { shoppingTotal } from './export';
import { openShoppingForm } from './open-shopping-form';
import { ListActionsMenu } from './ListActions';
import { openFormPanel } from '../../components/panels/panels';
import { ProductPicker } from './ProductPicker';
import { blankInput, listClosed, listTasks, money, usePeople, type ShoppingGrouping } from './shopping-format';
import { ShoppingSettings } from './ShoppingSettings';
import { GroupingControl } from './GroupingControl';
import { itemColumns } from './shopping-columns';
import { ShoppingTable } from './ShoppingTable';
import { StoreMode } from './StoreMode';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

type ShoppingItem = ShoppingList['items'][number];

/** Views made the first time a list is shown: every item (opened first), what is left to buy. */
const LIST_VIEWS: FirstTableView[] = [
  { name: 'Tout' },
  { name: 'À acheter', config: { filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'bought', field: 'bought', operator: 'isFalse', value: null }] } } },
];

/**
 * Page of a shopping list: its items by category or by store, ticked as bought (their products of the base list
 * follow), products of the base list or other items added, the estimated total; its task and the treasury entry
 * paying it; copy, export, store mode, archive and deletion.
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
  const people = usePeople();
  const columns = itemColumns<ShoppingItem>(grouping, { categories: data?.shoppingCategories ?? [], stores: data?.shoppingStores ?? [], members: people.members, relations: people.relations }, [
    {
      id: 'bought',
      label: 'Acheté',
      size: 100,
      hiddenByDefault: true,
      sortValue: (item) => (item.purchasedAt ? 1 : 0),
      text: (item) => (item.purchasedAt ? 'Acheté' : ''),
      filter: { kind: 'boolean', value: (item) => Boolean(item.purchasedAt) },
    },
  ]);
  const view = useDataView({ tableKey: 'shopping-list', columns, rows: [...(list?.items ?? [])].sort((a, b) => a.position - b.position), title: list?.name ?? 'Liste d’achats', first: LIST_VIEWS });

  if (isPending) {
    return <TableSkeleton rows={4} />;
  }
  if (!list) {
    return (
      <EmptyState
        icon={<BasketIcon aria-hidden />}
        message="Cette liste n’existe pas ou a été supprimée."
        action={
          <ActionButton priority="secondary" to="/shopping?tab=lists" icon={<ArrowLeftIcon aria-hidden />}>
            Retour aux listes
          </ActionButton>
        }
      />
    );
  }

  const tasks = listTasks(list, context);
  const closed = listClosed(list, context);
  const baseLists = data?.shoppingBaseLists ?? [];
  const total = shoppingTotal(list.items);
  const spent = shoppingTotal(list.items.filter((item) => item.purchasedAt));
  const bought = list.items.filter((item) => item.purchasedAt).length;
  const onError = (error: Error) => notifyError(error.message);

  return (
    <Stack gap="lg">
      <ShoppingSettings />
      <Group gap="sm" align="flex-start" wrap="nowrap">
        <Tooltip label="Retour aux listes">
          <ActionIcon component={Link} to="/shopping?tab=lists" variant="subtle" color="gray" aria-label="Retour aux listes" mt={4}>
            <ArrowLeftIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <PageHeader title="Achats" />
          <Group gap="xs">
            <Title order={2} size="h3" style={{ wordBreak: 'break-word' }}>
              {list.name}
            </Title>
            {closed && (
              <Badge variant="light" color="gray">
                Archivée
              </Badge>
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
                  {list.entry.label} · {formatMoney(list.entry.amount)} · {dayFormat.format(new Date(`${list.entry.date}T00:00:00Z`))}
                </Anchor>
              </Group>
            )}
            <Text size="sm" c="dimmed">
              {bought} sur {list.items.length} acheté(s)
              {total > 0 && ` · ${money(spent)} sur ${money(total)} estimés`}
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
            <Switch label={grouping === 'category' ? 'Catégories vides' : 'Magasins vides'} checked={showEmpty} onChange={(event) => setShowEmpty(event.currentTarget.checked)} />
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
                    label: 'Depuis les listes types…',
                    icon: <ListPlusIcon aria-hidden />,
                    disabled: baseLists.length === 0,
                    onClick: () => openFormPanel('Ajouter des produits des listes types', (close) => <ProductPicker list={list} onDone={close} />),
                  },
                  { label: 'Hors liste type…', icon: <PencilSimpleLineIcon aria-hidden />, onClick: () => openShoppingForm({ kind: 'item', listId: list.id }) },
                ]}
              >
                Ajouter un produit
              </ActionButton>
            )}
            <ActionButton icon={<ShoppingCartIcon aria-hidden />} disabled={list.items.length === 0} onClick={() => setStoreMode(true)}>
              Mode magasin
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
        <EmptyState icon={<ListPlusIcon aria-hidden />} message="La liste est vide : ajoutez des produits des listes types ou d’autres éléments." />
      ) : (
        <ShoppingTable
          view={view}
          items={[...list.items].sort((a, b) => a.position - b.position)}
          grouping={grouping}
          label={`Éléments de ${list.name}`}
          readOnly={closed}
          showEmpty={showEmpty}
          add={
            closed
              ? undefined
              : {
                  label: 'Ajouter un élément hors liste type',
                  onCreate: (name, place) => mutations.addItem.mutateAsync({ listId: list.id, input: blankInput(name, place) }),
                  onPick: baseLists.length ? () => openFormPanel('Ajouter des produits des listes types', (close) => <ProductPicker list={list} onDone={close} />) : undefined,
                }
          }
          onSave={(item, input) => mutations.updateItem.mutate({ id: item.id, input }, { onError })}
          done={(item) => Boolean(item.purchasedAt)}
          check={(item) => (
            <Checkbox
              aria-label={`${item.name} acheté`}
              checked={Boolean(item.purchasedAt)}
              onChange={(event) => mutations.setPurchased.mutate({ id: item.id, purchased: event.currentTarget.checked }, { onError })}
            />
          )}
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
                ...(!item.productId
                  ? baseLists.map((baseList) => ({
                      label: `Ajouter à « ${baseList.name} »`,
                      icon: <ListPlusIcon aria-hidden />,
                      onClick: () => mutations.saveToBase.mutate({ id: item.id, baseListId: baseList.id }, { onSuccess: () => notifySuccess(`Ajouté à « ${baseList.name} ».`), onError }),
                    }))
                  : []),
                item.perishable && {
                  label: 'Ajouter avec une autre date',
                  icon: <CalendarPlusIcon aria-hidden />,
                  hint: 'Le même produit, acheté avec une autre date de péremption',
                  disabled: closed,
                  onClick: () => mutations.duplicateItem.mutate({ id: item.id }, { onSuccess: () => notifySuccess('Ligne ajoutée : indiquez sa date.'), onError }),
                },
                {
                  label: 'Retirer de la liste',
                  icon: <TrashIcon aria-hidden />,
                  danger: true,
                  disabled: closed,
                  onClick: () => {
                    const remove = () => mutations.deleteItem.mutate({ id: item.id }, { onError });
                    // An item of this list only is lost with it; a product of a base list can be added back.
                    if (item.productId) remove();
                    else
                      confirmDestructive({
                        title: 'Retirer l’élément',
                        risks: `« ${item.name} » n’est dans aucune liste type : il sera supprimé définitivement. Cette action est irréversible.`,
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
            Total estimé : {money(total)}
          </Text>
        </Group>
      )}
      {storeMode && <StoreMode list={list} onClose={() => setStoreMode(false)} />}
    </Stack>
  );
}
