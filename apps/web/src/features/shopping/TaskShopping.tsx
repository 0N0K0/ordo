import { Anchor, Badge, Button, Group, Select, Stack, Text } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import type { Task } from '../tasks/api';
import { useShoppingLists, useShoppingMutations } from './api';
import { shoppingTotal } from './export';
import { openNewList } from './open-new-list';
import { money } from './shopping-format';

/**
 * Shopping lists of a task: their progress and total, a new list (from the missing products of base lists),
 * or an open list without task attached to it.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Section.
 */
export function TaskShopping({ task }: { task: Task }) {
  const { data: lists } = useShoppingLists();
  const { updateList } = useShoppingMutations();
  const own = (lists ?? []).filter((list) => list.taskId === task.id);
  const free = (lists ?? []).filter((list) => !list.taskId && !list.closed);

  return (
    <Stack gap="xs">
      <Group justify="space-between" gap="xs">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          Courses
        </Text>
        {!task.archived && (
          <Button variant="subtle" size="compact-xs" leftSection={<PlusIcon aria-hidden />} onClick={() => openNewList({ taskId: task.id })}>
            Nouvelle liste
          </Button>
        )}
      </Group>
      {own.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aucune liste de courses.
        </Text>
      ) : (
        own.map((list) => {
          const bought = list.items.filter((item) => item.purchasedAt).length;
          const total = shoppingTotal(list.items);
          return (
            <Group key={list.id} gap="xs" wrap="nowrap">
              <Anchor component={Link} to={`/shopping/${list.id}`} size="sm" truncate style={{ flex: 1 }}>
                {list.name}
              </Anchor>
              <Badge size="sm" variant="light" color={list.items.length && bought === list.items.length ? 'green' : 'gray'}>
                {bought} / {list.items.length}
              </Badge>
              {total > 0 && (
                <Text size="xs" c="dimmed" ff="monospace">
                  {money(total)}
                </Text>
              )}
            </Group>
          );
        })
      )}
      {!task.archived && free.length > 0 && (
        <Select
          size="xs"
          placeholder="Rattacher une liste existante"
          searchable
          data={free.map((list) => ({ value: list.id, label: list.name }))}
          value={null}
          onChange={(id) => {
            const list = free.find((item) => item.id === id);
            if (list)
              updateList.mutate({ id: list.id, name: list.name, taskId: task.id }, { onSuccess: () => notifySuccess('Liste rattachée à la tâche.'), onError: (error) => notifyError(error.message) });
          }}
          aria-label="Rattacher une liste de courses existante"
        />
      )}
    </Stack>
  );
}
