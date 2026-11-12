import { ActionIcon, Anchor, Badge, Button, Checkbox, Group, Menu, Paper, SegmentedControl, Skeleton, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { formatMoney } from '@ordo/shared';
import {
  ArrowLeftIcon,
  BankIcon,
  BasketIcon,
  CalendarPlusIcon,
  CaretDownIcon,
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
import { PageTitle } from '../../components/PageTitle';
import { notifyError, notifySuccess } from '../../lib/notify';
import { TaskRef } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useShoppingData, useShoppingLists, useShoppingMutations } from './api';
import { shoppingTotal } from './export';
import { openShoppingForm } from './open-shopping-form';
import { ListActionsMenu } from './ListActions';
import { confirmDestructive, openModal } from './list-modals';
import { ProductPicker } from './ProductPicker';
import { blankInput, money, type ShoppingGrouping } from './shopping-format';
import { ShoppingSettings } from './ShoppingSettings';
import { ShoppingTable } from './ShoppingTable';
import { StoreMode } from './StoreMode';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

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

  if (isPending) {
    return (
      <Stack gap="xs" aria-label="Chargement">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height={48} />
        ))}
      </Stack>
    );
  }
  if (!list) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="sm">
          <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
            <BasketIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm">Cette liste n’existe pas ou a été supprimée.</Text>
          <Button component={Link} to="/shopping?tab=lists" variant="light" leftSection={<ArrowLeftIcon aria-hidden />}>
            Retour aux listes
          </Button>
        </Stack>
      </Paper>
    );
  }

  const task = list.taskId ? context?.taskById.get(list.taskId) : undefined;
  const closed = list.closed || Boolean(task?.closed);
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
          <PageTitle>Courses</PageTitle>
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
            {task && <TaskRef task={task} blocked={context?.isBlocked(task)} />}
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

      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          size="xs"
          value={grouping}
          onChange={(value) => setGrouping(value as ShoppingGrouping)}
          data={[
            { value: 'category', label: 'Par catégorie' },
            { value: 'store', label: 'Par magasin' },
          ]}
          aria-label="Regrouper"
        />
        <Checkbox size="xs" label={grouping === 'category' ? 'Catégories vides' : 'Magasins vides'} checked={showEmpty} onChange={(event) => setShowEmpty(event.currentTarget.checked)} />
        <Group gap="sm" ml="auto" wrap="wrap">
          {!closed && (
            <Menu position="bottom-end" shadow="md" withinPortal>
              <Menu.Target>
                <Button variant="default" leftSection={<PlusIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden size={12} />}>
                  Ajouter un produit
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<ListPlusIcon aria-hidden />}
                  disabled={baseLists.length === 0}
                  onClick={() => openModal('Ajouter des produits des listes types', (close) => <ProductPicker list={list} onDone={close} />, 'lg')}
                >
                  Depuis les listes types…
                </Menu.Item>
                <Menu.Item leftSection={<PencilSimpleLineIcon aria-hidden />} onClick={() => openShoppingForm({ kind: 'item', listId: list.id })}>
                  Hors liste type…
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
          <Button leftSection={<ShoppingCartIcon aria-hidden />} disabled={list.items.length === 0} onClick={() => setStoreMode(true)}>
            Mode magasin
          </Button>
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
      </Group>

      {list.items.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <ListPlusIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              La liste est vide : ajoutez des produits des listes types ou d’autres éléments.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <ShoppingTable
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
                  onPick: baseLists.length ? () => openModal('Ajouter des produits des listes types', (close) => <ProductPicker list={list} onDone={close} />, 'lg') : undefined,
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
            <>
              {!item.productId && baseLists.length > 0 && (
                <Menu position="bottom-end" shadow="md" withinPortal>
                  <Menu.Target>
                    <Tooltip label="Ajouter à une liste type">
                      <ActionIcon variant="subtle" color="gray" aria-label={`Ajouter ${item.name} à une liste type`}>
                        <ListPlusIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Ajouter à la liste type</Menu.Label>
                    {baseLists.map((baseList) => (
                      <Menu.Item
                        key={baseList.id}
                        onClick={() => mutations.saveToBase.mutate({ id: item.id, baseListId: baseList.id }, { onSuccess: () => notifySuccess(`Ajouté à « ${baseList.name} ».`), onError })}
                      >
                        {baseList.name}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              )}
              {item.perishable && (
                <Tooltip label="Ajouter une autre date (le même produit, acheté avec une autre date de péremption)">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Ajouter ${item.name} avec une autre date`}
                    disabled={closed}
                    onClick={() => mutations.duplicateItem.mutate({ id: item.id }, { onSuccess: () => notifySuccess('Ligne ajoutée : indiquez sa date.'), onError })}
                  >
                    <CalendarPlusIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label="Modifier (catégorie, note…)">
                <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${item.name}`} disabled={closed} onClick={() => openShoppingForm({ kind: 'item', listId: list.id, item })}>
                  <PencilSimpleIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Retirer de la liste">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Retirer ${item.name}`}
                  disabled={closed}
                  onClick={() => {
                    const remove = () => mutations.deleteItem.mutate({ id: item.id }, { onError });
                    // An item of this list only is lost with it; a product of a base list can be added back.
                    if (item.productId) remove();
                    else confirmDestructive('Retirer l’élément', `« ${item.name} » n’est dans aucune liste type : il sera supprimé définitivement. Cette action est irréversible.`, remove);
                  }}
                >
                  <TrashIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </>
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
