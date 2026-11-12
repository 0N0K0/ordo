import { ActionIcon, Anchor, Badge, Button, Group, Paper, SegmentedControl, Skeleton, Stack, Table, Tabs, Text, ThemeIcon } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { BasketIcon, DotsThreeVerticalIcon, ListChecksIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageTitle } from '../../components/PageTitle';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTaskContext } from '../tasks/use-task-context';
import { useShoppingLists, useShoppingMutations, type ShoppingList } from './api';
import { BaseLists } from './BaseLists';
import { ShoppingSettings } from './ShoppingSettings';
import { shoppingTotal } from './export';
import { openNewList } from './open-new-list';
import { ListActionsMenu } from './ListActions';
import { TasksCell } from './shopping-cells';
import { listClosed, listsOfProjects, listTasks, money, taskOptions, type ShoppingGrouping } from './shopping-format';
import classes from './Shopping.module.css';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Shopping lists, open or archived (by hand, or along with their tasks), latest first: the tasks of an open one chosen
 * in place, the actions of each one in its menu (as on its page). On a project page, only the lists of its tasks.
 * @param {{ projectIds?: ReadonlySet<string> }} props Component props.
 * @param {ReadonlySet<string>} [props.projectIds] Projects (a project and its sub-projects) whose lists are shown. Optional.
 * @returns {JSX.Element} Lists.
 */
export function ListsPanel({ projectIds }: { projectIds?: ReadonlySet<string> }) {
  const { data: lists, isPending } = useShoppingLists();
  const { context } = useTaskContext();
  const { updateList } = useShoppingMutations();
  const [grouping] = useLocalStorage<ShoppingGrouping>({ key: 'ordo.shopping.listGrouping', defaultValue: 'category' });
  const [state, setState] = useState<'open' | 'closed'>('open');
  const closedOf = (list: ShoppingList) => listClosed(list, context);
  const scoped = projectIds ? listsOfProjects(lists ?? [], context, projectIds) : (lists ?? []);
  const shown = scoped.filter((list) => closedOf(list) === (state === 'closed'));

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
        {!projectIds && (
          <Button ml="auto" leftSection={<PlusIcon aria-hidden />} onClick={() => openNewList()}>
            Nouvelle liste
          </Button>
        )}
      </Group>
      {isPending || (projectIds && !context) ? (
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
              {state === 'open'
                ? projectIds
                  ? 'Aucune liste en cours : une liste rattachée à une tâche du projet s’affiche ici.'
                  : 'Aucune liste en cours.'
                : 'Aucune liste archivée : une liste l’est à la main, ou quand ses tâches sont toutes fermées.'}
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
                  <Table.Th>Tâches</Table.Th>
                  <Table.Th>Achats</Table.Th>
                  <Table.Th ta="right">Total estimé</Table.Th>
                  <Table.Th>Créée le</Table.Th>
                  <Table.Th w={1} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown.map((list) => {
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
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'lists' ? 'lists' : 'base';

  return (
    <Stack gap="lg">
      <PageTitle>Courses</PageTitle>
      <ShoppingSettings />
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
