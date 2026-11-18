import { SubSection } from '../../../components/page/SubSection';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Anchor, Badge, Group, Select, Text } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { toastCallbacks } from '../../../lib/notify';
import type { Task } from '../../tasks/api';
import { useShoppingLists, useShoppingMutations } from '../api';
import { shoppingTotal } from '../lib/export';
import { openNewList } from '../lib/open-new-list';
import { shoppingProgress } from '../lib/shopping-format';
import * as fmt from '../../../lib/format';

/**
 * Shopping lists of a task: their progress and total, a new list (from the missing products of base lists),
 * or an open list attached to it too (a list can be for several tasks).
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Section.
 */
export function TaskShopping({ task }: { task: Task }) {
  const { data: lists } = useShoppingLists();
  const { updateList } = useShoppingMutations();
  // The archived lists are hidden.
  const own = (lists ?? []).filter((list) => list.taskIds.includes(task.id) && !list.archived);
  const free = (lists ?? []).filter((list) => !list.taskIds.includes(task.id) && !list.closed && !list.archived);

  return (
    <SubSection
      title="Achats"
      gap="xs"
      action={
        !task.archived && (
          <ActionButton priority="secondary" size="compact-xs" icon={<PlusIcon aria-hidden />} onClick={() => openNewList({ taskIds: [task.id] })}>
            Nouvelle liste
          </ActionButton>
        )
      }
    >
      {own.length === 0 ? (
        <EmptyState compact message="Aucune liste d’achats." />
      ) : (
        own.map((list) => {
          // Its required items (the optional ones apart).
          const { bought, total: required } = shoppingProgress(list.items);
          const total = shoppingTotal(list.items);
          return (
            <Group key={list.id} gap="xs" wrap="nowrap">
              <Anchor component={Link} to={`/shopping/${list.id}`} size="sm" truncate style={{ flex: 1 }}>
                {list.label}
              </Anchor>
              <Badge size="sm" variant="light" color={required && bought === required ? 'green' : 'gray'}>
                {bought} / {required}
              </Badge>
              {total > 0 && (
                <Text size="xs" c="dimmed" ff="monospace">
                  {fmt.money(total)}
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
          data={free.map((list) => ({ value: list.id, label: list.label }))}
          value={null}
          onChange={(id) => {
            const list = free.find((item) => item.id === id);
            if (list) updateList.mutate({ id: list.id, label: list.label, taskIds: [...list.taskIds, task.id] }, toastCallbacks('Liste rattachée à la tâche.'));
          }}
          aria-label="Rattacher une liste d’achats existante"
        />
      )}
    </SubSection>
  );
}
