import { ActionIcon, Anchor, Badge, Button, Group, Paper, SegmentedControl, Skeleton, Stack, Table, Tabs, Text, ThemeIcon } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { BasketIcon, DotsThreeVerticalIcon, ListChecksIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageTitle } from '../../components/PageTitle';
import { LabelManager } from '../../components/settings/LabelManager';
import { PageSettings } from '../../layouts/PageSettings';
import { notifyError, notifySuccess } from '../../lib/notify';
import cellClasses from '../tasks/views/inline-cells.module.css';
import { TaskRef, TaskSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useActiveWorkspace } from '../workspaces/api';
import { useShoppingData, useShoppingLists, useShoppingMutations, type ShoppingList } from './api';
import { BaseLists } from './BaseLists';
import { ShoppingCategories } from './ShoppingCategories';
import { shoppingTotal } from './export';
import { openNewList } from './open-new-list';
import { ListActionsMenu } from './ListActions';
import { money, taskChoices, type ShoppingGrouping } from './shopping-format';
import classes from './Shopping.module.css';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Number of products and items of each category or store, for the settings.
 * @param {(item: { categoryId?: string | null, storeId?: string | null }) => string | null | undefined} key Category or store of a row.
 * @param {{ categoryId?: string | null, storeId?: string | null }[]} rows Products and items.
 * @returns {Map<string, number>} Usage by id.
 */
function usageOf(key: (row: { categoryId?: string | null; storeId?: string | null }) => string | null | undefined, rows: { categoryId?: string | null; storeId?: string | null }[]) {
  const usage = new Map<string, number>();
  for (const row of rows) {
    const id = key(row);
    if (id) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
}

/**
 * Shopping lists, open or archived (by hand, or along with their task), latest first: the task of an open one chosen
 * in place, the actions of each one in its menu (as on its page).
 * @returns {JSX.Element} Lists.
 */
function ListsPanel() {
  const { data: lists, isPending } = useShoppingLists();
  const { context } = useTaskContext();
  const { updateList } = useShoppingMutations();
  const [grouping] = useLocalStorage<ShoppingGrouping>({ key: 'ordo.shopping.listGrouping', defaultValue: 'category' });
  const { tasks, labelOf } = taskChoices(context);
  const [state, setState] = useState<'open' | 'closed'>('open');
  const closedOf = (list: ShoppingList) => list.closed || Boolean(list.taskId && context?.taskById.get(list.taskId)?.closed);
  const shown = (lists ?? []).filter((list) => closedOf(list) === (state === 'closed'));

  return (
    <Stack gap="md">
      <Group gap="sm">
        <SegmentedControl
          size="xs"
          value={state}
          onChange={(value) => setState(value as 'open' | 'closed')}
          data={[
            { value: 'open', label: 'En cours' },
            { value: 'closed', label: 'Archivées' },
          ]}
          aria-label="Listes affichées"
        />
        <Button ml="auto" leftSection={<PlusIcon aria-hidden />} onClick={() => openNewList()}>
          Nouvelle liste
        </Button>
      </Group>
      {isPending ? (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={48} />
          ))}
        </Stack>
      ) : shown.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <ListChecksIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {state === 'open' ? 'Aucune liste en cours.' : 'Aucune liste archivée : une liste l’est à la main, ou quand sa tâche est fermée.'}
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Paper withBorder radius="md" className={classes.group}>
          <div className={classes.scroller}>
            <Table verticalSpacing="xs" highlightOnHover miw={640}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Liste</Table.Th>
                  <Table.Th>Tâche</Table.Th>
                  <Table.Th>Achats</Table.Th>
                  <Table.Th ta="right">Total estimé</Table.Th>
                  <Table.Th>Créée le</Table.Th>
                  <Table.Th w={1} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown.map((list) => {
                  const task = list.taskId ? context?.taskById.get(list.taskId) : undefined;
                  const bought = list.items.filter((item) => item.purchasedAt).length;
                  const total = shoppingTotal(list.items);
                  return (
                    <Table.Tr key={list.id}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Anchor component={Link} to={`/shopping/${list.id}`} size="sm">
                            {list.name}
                          </Anchor>
                          {list.entryId && (
                            <Badge size="xs" variant="light" tt="none">
                              Payée
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td miw={200}>
                        {closedOf(list) || !context ? (
                          task && <TaskRef task={task} blocked={context?.isBlocked(task)} />
                        ) : (
                          <TaskSelect
                            variant="unstyled"
                            size="xs"
                            classNames={{ root: cellClasses.root, input: cellClasses.input, section: cellClasses.section }}
                            comboboxProps={{ withinPortal: true, width: 'max-content', position: 'bottom-start' }}
                            aria-label={`Tâche de la liste ${list.name}`}
                            placeholder="—"
                            tasks={task && !tasks.includes(task) ? [task, ...tasks] : tasks}
                            labelOf={labelOf}
                            value={list.taskId ?? null}
                            onChange={(taskId) =>
                              updateList.mutate(
                                { id: list.id, name: list.name, taskId: taskId ?? null },
                                { onSuccess: () => notifySuccess(taskId ? 'Liste rattachée à la tâche.' : 'Liste détachée de sa tâche.'), onError: (error) => notifyError(error.message) },
                              )
                            }
                          />
                        )}
                      </Table.Td>
                      <Table.Td className={classes.nowrap}>
                        <Badge size="sm" variant="light" color={list.items.length && bought === list.items.length ? 'green' : 'gray'}>
                          {bought} / {list.items.length}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right" ff="monospace" className={classes.nowrap}>
                        {total > 0 ? money(total) : null}
                      </Table.Td>
                      <Table.Td className={classes.nowrap}>{dayFormat.format(new Date(list.createdAt))}</Table.Td>
                      <Table.Td>
                        <ListActionsMenu
                          list={list}
                          grouping={grouping}
                          target={
                            <ActionIcon variant="subtle" color="gray" aria-label={`Actions de la liste ${list.name}`}>
                              <DotsThreeVerticalIcon aria-hidden />
                            </ActionIcon>
                          }
                        />
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
  const { perso } = useActiveWorkspace();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'lists' ? 'lists' : 'base';
  const { data } = useShoppingData();
  const { data: lists } = useShoppingLists();
  const mutations = useShoppingMutations();
  const rows = [...(data?.shoppingProducts ?? []), ...(lists ?? []).flatMap((list) => list.items)];

  return (
    <Stack gap="lg" className={classes.root}>
      <PageTitle>Courses</PageTitle>
      <PageSettings title="Paramètres des courses">
        <Stack gap="md">
          <ShoppingCategories categories={data?.shoppingCategories ?? []} usage={usageOf((row) => row.categoryId, rows)} />
          <LabelManager
            title="Magasins"
            description={perso ? 'Où vous achetez les produits.' : 'Magasins et fournisseurs des produits.'}
            noun="le magasin"
            usageNoun="produits"
            labels={data?.shoppingStores ?? []}
            usage={usageOf((row) => row.storeId, rows)}
            create={mutations.createStore}
            update={mutations.updateStore}
            remove={mutations.deleteStore}
            move={mutations.moveStore}
          />
        </Stack>
      </PageSettings>
      <Tabs
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
        <Tabs.List mb="md">
          <Tabs.Tab value="base" leftSection={<BasketIcon aria-hidden />}>
            Listes types
          </Tabs.Tab>
          <Tabs.Tab value="lists" leftSection={<ListChecksIcon aria-hidden />}>
            Listes
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="base">
          <BaseLists />
        </Tabs.Panel>
        <Tabs.Panel value="lists">
          <ListsPanel />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
