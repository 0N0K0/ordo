import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  CloseButton,
  ColorSwatch,
  Group,
  Menu,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue, useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { formatMoney, shoppingCost, shoppingListNameSchema } from '@ordo/shared';
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  BankIcon,
  BasketIcon,
  CaretDownIcon,
  CopyIcon,
  FilePdfIcon,
  ListPlusIcon,
  PencilSimpleIcon,
  PlusIcon,
  ShoppingCartIcon,
  TextAlignLeftIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { PageTitle } from '../../components/PageTitle';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { TaskRef, TaskSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useTreasuryEntrySearch } from '../treasury/api';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useShoppingData, useShoppingLists, useShoppingMutations, type ShoppingItem, type ShoppingList } from './api';
import { downloadShoppingPdf, shoppingText, shoppingTotal } from './export';
import { openShoppingForm } from './open-shopping-form';
import { groupShopping, money, quantityText, taskChoices, usePeople, type ShoppingGrouping } from './shopping-format';
import { PeopleBadges } from './ShoppingForm';
import classes from './Shopping.module.css';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

const listSchema = z.object({ name: shoppingListNameSchema, taskId: z.string().nullable() });

/**
 * Name and task of a list.
 * @param {{ list: ShoppingList, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ListForm({ list, onDone }: { list: ShoppingList; onDone: () => void }) {
  const { context } = useTaskContext();
  const { updateList } = useShoppingMutations();
  const form = useAppForm<z.input<typeof listSchema>>({ initialValues: { name: list.name, taskId: list.taskId ?? null }, schema: listSchema });
  const { tasks, labelOf } = taskChoices(context);
  // The task of the list stays offered, even closed.
  const current = list.taskId ? context?.taskById.get(list.taskId) : undefined;
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) =>
        updateList.mutate(
          { id: list.id, name: values.name, taskId: values.taskId ?? null },
          {
            onSuccess: () => {
              notifySuccess('Liste modifiée.');
              onDone();
            },
            onError: (error) => showFormError(form, error),
          },
        ),
      )}
    >
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <TaskSelect label="Tâche" placeholder="Aucune" tasks={current && !tasks.includes(current) ? [current, ...tasks] : tasks} labelOf={labelOf} {...form.getInputProps('taskId')} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={updateList.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Treasury entry paying a list: searched by its label; attaching adds its split by person.
 * @param {{ list: ShoppingList, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Picker.
 */
function EntryPicker({ list, onDone }: { list: ShoppingList; onDone: () => void }) {
  const [text, setText] = useState('');
  const [debounced] = useDebouncedValue(text, 250);
  const { data: entries, isFetching } = useTreasuryEntrySearch(debounced);
  const { attachEntry } = useShoppingMutations();
  return (
    <Stack gap="md">
      <Text size="sm">
        Chaque personne concernée par des éléments de la liste reçoit une ligne de répartition sur le mouvement : la somme de ses éléments (partagés à parts égales entre leurs personnes). Ce qui ne
        concerne personne reste non réparti.
      </Text>
      <TextInput label="Mouvement ou prévision" placeholder="Rechercher par libellé (2 caractères au moins)" data-autofocus value={text} onChange={(event) => setText(event.currentTarget.value)} />
      <Stack gap={4}>
        {isFetching && <Skeleton height={36} />}
        {!isFetching && debounced.trim().length >= 2 && !entries?.length && (
          <Text size="sm" c="dimmed">
            Aucun mouvement trouvé.
          </Text>
        )}
        {entries?.map((entry) => (
          <UnstyledButton
            key={entry.id}
            className={classes.storeRow}
            onClick={() =>
              attachEntry.mutate(
                { id: list.id, entryId: entry.id },
                {
                  onSuccess: () => {
                    notifySuccess('Liste rattachée : la répartition a été ajoutée au mouvement.');
                    onDone();
                  },
                  onError: (error) => notifyError(error.message),
                },
              )
            }
          >
            <Stack gap={0} style={{ flex: 1 }}>
              <Text size="sm">{entry.label}</Text>
              <Text size="xs" c="dimmed">
                {dayFormat.format(new Date(`${entry.date}T00:00:00Z`))} · {entry.accountName}
                {entry.status === 'FORECAST' ? ' · prévision' : ''}
              </Text>
            </Stack>
            <Text size="sm" ff="monospace" c={entry.amount < 0 ? 'red' : 'green'}>
              {formatMoney(entry.amount)}
            </Text>
          </UnstyledButton>
        ))}
      </Stack>
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Store mode: the items to buy as big rows ticked with a thumb, the bought ones at the bottom.
 * @param {{ list: ShoppingList, grouping: ShoppingGrouping, onClose: () => void }} props Component props.
 * @returns {JSX.Element} Full screen view.
 */
function StoreMode({ list, grouping, onClose }: { list: ShoppingList; grouping: ShoppingGrouping; onClose: () => void }) {
  const { data } = useShoppingData();
  const { setPurchased } = useShoppingMutations();
  const labels = { categories: data?.shoppingCategories ?? [], stores: data?.shoppingStores ?? [] };
  const toBuy = groupShopping(
    list.items.filter((item) => !item.purchasedAt),
    grouping,
    labels,
  );
  const bought = list.items.filter((item) => item.purchasedAt);

  /**
   * One item, ticked or unticked by a tap anywhere on its row.
   * @param {ShoppingItem} item Item.
   * @returns {JSX.Element} Row.
   */
  const row = (item: ShoppingItem) => (
    <Checkbox.Card
      key={item.id}
      className={classes.storeRow}
      data-purchased={item.purchasedAt ? true : undefined}
      checked={Boolean(item.purchasedAt)}
      onClick={() => setPurchased.mutate({ id: item.id, purchased: !item.purchasedAt }, { onError: (error) => notifyError(error.message) })}
    >
      <Checkbox.Indicator size="lg" />
      <Text className={classes.storeName}>{item.name}</Text>
      {quantityText(item) && (
        <Text size="md" fw={600} className={classes.nowrap}>
          {quantityText(item)}
        </Text>
      )}
    </Checkbox.Card>
  );

  return (
    <Modal opened onClose={onClose} fullScreen withCloseButton={false} transitionProps={{ transition: 'fade', duration: 150 }}>
      <Stack gap="md" className={classes.storeList}>
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={0}>
            <Title order={2} size="h3">
              {list.name}
            </Title>
            <Text size="sm" c="dimmed">
              {bought.length} sur {list.items.length} acheté(s)
            </Text>
          </Stack>
          <CloseButton size="lg" aria-label="Quitter le mode magasin" onClick={onClose} />
        </Group>
        {toBuy.length === 0 && (
          <Alert color="green" icon={<ShoppingCartIcon aria-hidden />}>
            Tout est acheté.
          </Alert>
        )}
        {toBuy.map((group) => (
          <Stack key={group.id ?? 'none'} gap="xs">
            <Group gap="xs">
              {group.color && <ColorSwatch color={group.color} size={12} />}
              <Text fw={600} size="sm" tt="uppercase" c="dimmed">
                {group.name}
              </Text>
            </Group>
            {group.items.map(row)}
          </Stack>
        ))}
        {bought.length > 0 && (
          <Stack gap="xs">
            <Text fw={600} size="sm" tt="uppercase" c="dimmed">
              Acheté
            </Text>
            {bought.map(row)}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

let modalCount = 0;

/**
 * Opens a modal with some content.
 * @param {string} title Title.
 * @param {(close: () => void) => JSX.Element} render Content.
 * @returns {void}
 */
function openModal(title: string, render: (close: () => void) => ReactElement): void {
  const modalId = `shopping-list-${++modalCount}`;
  modals.open({ modalId, title, children: render(() => modals.close(modalId)) });
}

/**
 * Asks for confirmation before a destructive action.
 * @param {string} title Title.
 * @param {string} message Risks.
 * @param {() => void} onConfirm Action.
 * @returns {void}
 */
function confirmDestructive(title: string, message: string, onConfirm: () => void): void {
  openModal(title, (close) => (
    <Stack gap="md">
      <Text size="sm">{message}</Text>
      <DestructiveActions
        loading={false}
        onCancel={close}
        onConfirm={() => {
          close();
          onConfirm();
        }}
      />
    </Stack>
  ));
}

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
  const people = usePeople();
  const mutations = useShoppingMutations();
  const [grouping, setGrouping] = useLocalStorage<ShoppingGrouping>({ key: 'ordo.shopping.listGrouping', defaultValue: 'category' });
  const [storeMode, setStoreMode] = useState(false);
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
  const labels = { categories: data?.shoppingCategories ?? [], stores: data?.shoppingStores ?? [] };
  const groups = groupShopping(list.items, grouping, labels);
  const inList = new Set(list.items.map((item) => item.productId).filter(Boolean));
  const products = (data?.shoppingProducts ?? []).filter((product) => !inList.has(product.id));
  const total = shoppingTotal(list.items);
  const spent = shoppingTotal(list.items.filter((item) => item.purchasedAt));
  const bought = list.items.filter((item) => item.purchasedAt).length;
  const onError = (error: Error) => notifyError(error.message);

  return (
    <Stack gap="lg">
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
        <Group gap="sm" ml="auto" wrap="wrap">
          {!closed && (
            <>
              <Select
                placeholder="Ajouter depuis la liste de base"
                searchable
                data={products.map((product) => ({ value: product.id, label: product.name }))}
                value={null}
                nothingFoundMessage="Aucun produit"
                onChange={(productId) => productId && mutations.addItem.mutate({ listId: list.id, productId }, { onError })}
                aria-label="Ajouter un produit de la liste de base"
                w={260}
              />
              <Button variant="default" leftSection={<PlusIcon aria-hidden />} onClick={() => openShoppingForm({ kind: 'item', listId: list.id })}>
                Hors liste
              </Button>
            </>
          )}
          <Button leftSection={<ShoppingCartIcon aria-hidden />} disabled={list.items.length === 0} onClick={() => setStoreMode(true)}>
            Mode magasin
          </Button>
          <Menu position="bottom-end" shadow="md" withinPortal>
            <Menu.Target>
              <Button variant="default" rightSection={<CaretDownIcon aria-hidden size={12} />}>
                Actions
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openModal('Modifier la liste', (close) => <ListForm list={list} onDone={close} />)}>
                Renommer, changer de tâche
              </Menu.Item>
              {list.entryId ? (
                <Menu.Item
                  leftSection={<BankIcon aria-hidden />}
                  onClick={() => mutations.attachEntry.mutate({ id: list.id, entryId: null }, { onSuccess: () => notifySuccess('Liste détachée du mouvement (sa répartition reste).'), onError })}
                >
                  Détacher du mouvement
                </Menu.Item>
              ) : (
                <Menu.Item leftSection={<BankIcon aria-hidden />} onClick={() => openModal('Rattacher à un mouvement de trésorerie', (close) => <EntryPicker list={list} onDone={close} />)}>
                  Rattacher à un mouvement
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={<CopyIcon aria-hidden />}
                onClick={() =>
                  mutations.duplicateList.mutate(
                    { id: list.id },
                    {
                      onSuccess: (copyId) => {
                        notifySuccess('Liste dupliquée.');
                        navigate(`/shopping/${copyId}`);
                      },
                      onError,
                    },
                  )
                }
              >
                Dupliquer
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<TextAlignLeftIcon aria-hidden />}
                onClick={() =>
                  void navigator.clipboard.writeText(shoppingText(list, groups, people)).then(
                    () => notifySuccess('Liste copiée : collez-la dans un message.'),
                    () => notifyError('La liste n’a pas pu être copiée.'),
                  )
                }
              >
                Copier en texte
              </Menu.Item>
              <Menu.Item leftSection={<FilePdfIcon aria-hidden />} onClick={() => void downloadShoppingPdf(list, groups, people).catch(onError)}>
                Exporter en PDF
              </Menu.Item>
              <Menu.Divider />
              {closed ? (
                <Menu.Item
                  leftSection={<ArrowCounterClockwiseIcon aria-hidden />}
                  disabled={Boolean(task?.closed)}
                  title={task?.closed ? 'La tâche de la liste est fermée : rouvrez-la pour rouvrir la liste.' : undefined}
                  onClick={() => mutations.setClosed.mutate({ id: list.id, closed: false }, { onSuccess: () => notifySuccess('Liste rouverte.'), onError })}
                >
                  Rouvrir
                </Menu.Item>
              ) : (
                <Menu.Item
                  leftSection={<ArchiveIcon aria-hidden />}
                  onClick={() => mutations.setClosed.mutate({ id: list.id, closed: true }, { onSuccess: () => notifySuccess('Liste archivée.'), onError })}
                >
                  Archiver
                </Menu.Item>
              )}
              <Menu.Item
                color="red"
                leftSection={<TrashIcon aria-hidden />}
                onClick={() =>
                  confirmDestructive(
                    'Supprimer la liste',
                    `« ${list.name} » et ses ${list.items.length} élément(s) seront supprimés définitivement. La liste de base et la répartition d’un mouvement rattaché ne changent pas. Cette action est irréversible.`,
                    () =>
                      mutations.deleteList.mutate(
                        { id: list.id },
                        {
                          onSuccess: () => {
                            notifySuccess('Liste supprimée.');
                            navigate('/shopping?tab=lists');
                          },
                          onError,
                        },
                      ),
                  )
                }
              >
                Supprimer
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {groups.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <ListPlusIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              La liste est vide : ajoutez des produits de la liste de base ou d’autres éléments.
            </Text>
          </Stack>
        </Paper>
      ) : (
        groups.map((group) => (
          <Paper key={group.id ?? 'none'} withBorder radius="md" component="section" className={classes.group}>
            <Group gap="xs" px="md" py="xs">
              {group.color && <ColorSwatch color={group.color} size={12} />}
              <Title order={3} size="h5">
                {group.name}
              </Title>
            </Group>
            <div className={classes.scroller}>
              <Table verticalSpacing={4} highlightOnHover miw={640}>
                <Table.Tbody>
                  {group.items.map((item) => {
                    const cost = shoppingCost(item);
                    return (
                      <Table.Tr key={item.id} className={item.purchasedAt ? classes.purchased : undefined}>
                        <Table.Td w={40}>
                          <Checkbox
                            aria-label={`${item.name} acheté`}
                            checked={Boolean(item.purchasedAt)}
                            onChange={(event) => mutations.setPurchased.mutate({ id: item.id, purchased: event.currentTarget.checked }, { onError })}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Text size="sm">{item.name}</Text>
                            {item.url && (
                              <Tooltip label={item.url}>
                                <ActionIcon
                                  component="a"
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  size="sm"
                                  variant="subtle"
                                  color="gray"
                                  aria-label={`Ouvrir la page de ${item.name}`}
                                >
                                  <ArrowSquareOutIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                            )}
                            {!item.productId && (
                              <Badge size="xs" variant="outline" color="gray" tt="none">
                                hors liste
                              </Badge>
                            )}
                          </Group>
                          {item.note && (
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              {item.note}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td className={classes.nowrap}>{quantityText(item)}</Table.Td>
                        <Table.Td>
                          <PeopleBadges memberIds={item.memberIds} relationIds={item.relationIds} />
                        </Table.Td>
                        <Table.Td ta="right" ff="monospace" className={classes.nowrap}>
                          {cost !== null ? money(cost) : null}
                        </Table.Td>
                        <Table.Td w={112}>
                          <Group gap={2} wrap="nowrap" justify="flex-end">
                            {!item.productId && (
                              <Tooltip label="Ajouter à la liste de base">
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  aria-label={`Ajouter ${item.name} à la liste de base`}
                                  onClick={() => mutations.saveToBase.mutate({ id: item.id }, { onSuccess: () => notifySuccess('Ajouté à la liste de base.'), onError })}
                                >
                                  <ListPlusIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                            )}
                            <Tooltip label="Modifier">
                              <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${item.name}`} onClick={() => openShoppingForm({ kind: 'item', listId: list.id, item })}>
                                <PencilSimpleIcon aria-hidden />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Retirer de la liste">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label={`Retirer ${item.name}`}
                                onClick={() => {
                                  const remove = () => mutations.deleteItem.mutate({ id: item.id }, { onError });
                                  // An item of this list only is lost with it; a product of the base list can be added back.
                                  if (item.productId) remove();
                                  else
                                    confirmDestructive(
                                      'Retirer l’élément',
                                      `« ${item.name} » n’est pas dans la liste de base : il sera supprimé définitivement. Cette action est irréversible.`,
                                      remove,
                                    );
                                }}
                              >
                                <TrashIcon aria-hidden />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          </Paper>
        ))
      )}
      {total > 0 && (
        <Group justify="flex-end">
          <Text size="sm" fw={600}>
            Total estimé : {money(total)}
          </Text>
        </Group>
      )}
      {storeMode && <StoreMode list={list} grouping={grouping} onClose={() => setStoreMode(false)} />}
    </Stack>
  );
}
