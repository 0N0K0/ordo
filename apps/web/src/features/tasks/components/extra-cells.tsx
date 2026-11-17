import { stopClick } from '../../../components/data-table/cells/cell-field';
import { ActionIcon, Anchor, Badge, Group, Menu, Popover, Progress, Text, Tooltip } from '@mantine/core';
import { formatDuration, readSlotRule } from '@ordo/shared';
import { AlarmIcon, BasketIcon, PlayIcon, PlusIcon, StopIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useAlarmForm } from '../../alarms/hooks/use-alarm-form';
import { useShoppingMutations, type ShoppingList } from '../../shopping/api';
import { openNewList } from '../../shopping/lib/open-new-list';
import { SlotRuleInput } from '../../calendar/components/SlotRuleInput';
import { useSlotRules } from '../../calendar/hooks/use-slot-rules';
import { useRunningTimer, useTimeMutations } from '../../time/api';
import type { Task } from '../api';
import { TaskRef } from './task-ui';
import { useCellEdit } from '../lib/cell-edit';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import type { TaskContext } from '../hooks/use-task-context';

/**
 * « Plages » cell: the slots of the task told in words, changed in a popover.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function SlotsCell({ task }: { task: Task }) {
  const { apply } = useCellEdit(task, 'slots');
  const { describe, ruleOf } = useSlotRules();
  const own = readSlotRule(task.slotRule);
  return (
    <Popover position="bottom-start" withinPortal shadow="md" width={420}>
      <Popover.Target>
        <Anchor component="button" type="button" size="sm" c={own ? undefined : 'dimmed'} onClick={stopClick} style={{ textAlign: 'left' }}>
          {describe(ruleOf(task.slotRule)) ?? 'Partout'}
          {!own && ' (défaut)'}
        </Anchor>
      </Popover.Target>
      <Popover.Dropdown onClick={stopClick}>
        <SlotRuleInput value={own} onChange={(slotRule) => apply({ slotRule })} />
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * « Lancer un chrono » cell: starts a timer on the task (of its project), or stops the one running on it.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimerCell({ task }: { task: Task }) {
  const running = useRunningTimer();
  const { start, stop: stopTimer } = useTimeMutations();
  const on = running.data?.taskIds.includes(task.id) ?? false;
  const onError = { onError: onMutationError };
  return (
    <Tooltip label={on ? 'Arrêter le chrono' : 'Lancer un chrono'}>
      <ActionIcon
        variant="subtle"
        color={on ? 'red' : 'gray'}
        aria-label={on ? `Arrêter le chrono de ${task.title}` : `Lancer un chrono sur ${task.title}`}
        loading={start.isPending || stopTimer.isPending}
        onClick={(event) => {
          stopClick(event);
          if (on) stopTimer.mutate(undefined, onError);
          else start.mutate({ projectId: task.projectId, taskIds: [task.id] }, { onSuccess: () => notifySuccess('Chrono lancé.'), ...onError });
        }}
      >
        {on ? <StopIcon aria-hidden /> : <PlayIcon aria-hidden />}
      </ActionIcon>
    </Tooltip>
  );
}

/**
 * « Temps passé » cell: the time tracked, a link to the times of the task.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element | null} Cell.
 */
export function TrackedCell({ task }: { task: Task }) {
  if (task.trackedSeconds <= 0) return null;
  return (
    <Anchor component={Link} to={`/time?task=${task.id}`} size="sm" onClick={stopClick} style={{ display: 'block', textAlign: 'right' }}>
      {formatDuration(task.trackedSeconds)}
    </Anchor>
  );
}

/**
 * « Sous-tâches » cell: the sub-tasks, and a button adding one.
 * @param {{ task: Task, context: TaskContext, onAdd: () => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function SubtasksCell({ task, context, onAdd }: { task: Task; context: TaskContext; onAdd: () => void }) {
  const children = context.childrenOf(task.id);
  return (
    <Group gap={4} wrap="nowrap" align="flex-start" onClick={stopClick} style={{ minWidth: 0 }}>
      <StackedValues>
        {children.map((child) => (
          <TaskRef key={child.id} task={child} blocked={context.isBlocked(child)} />
        ))}
      </StackedValues>
      <Tooltip label="Ajouter une sous-tâche">
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Ajouter une sous-tâche à ${task.title}`} onClick={onAdd} style={{ flex: 'none' }}>
          <PlusIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

/**
 * « Avancement » cell: sub-tasks closed among them.
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element | null} Cell.
 */
export function ProgressCell({ task, context }: { task: Task; context: TaskContext }) {
  const children = context.childrenOf(task.id);
  if (children.length === 0) return null;
  const done = children.filter((child) => child.closed).length;
  return (
    <Tooltip label={`${done} sur ${children.length} sous-tâches fermées`}>
      <Group gap={6} wrap="nowrap">
        <Progress value={(done / children.length) * 100} size="sm" style={{ flex: 1 }} aria-label="Avancement des sous-tâches" />
        <Text size="xs" c="dimmed">
          {done}/{children.length}
        </Text>
      </Group>
    </Tooltip>
  );
}

/**
 * « Alertes » cell: the active alerts of the task (a bell), and a button adding one.
 * @param {{ task: Task, context: TaskContext, count: number }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function AlarmsCell({ task, context, count }: { task: Task; context: TaskContext; count: number }) {
  const openForm = useAlarmForm(context);
  return (
    <Group gap={4} wrap="nowrap" onClick={stopClick}>
      {count > 0 && (
        <Badge size="sm" variant="light" color="orange" leftSection={<AlarmIcon aria-hidden />}>
          {count}
        </Badge>
      )}
      <Tooltip label="Nouvelle alerte">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={`Nouvelle alerte pour ${task.title}`}
          onClick={() => openForm(undefined, { defaults: { taskId: task.id, projectId: task.projectId, title: task.title } })}
        >
          <PlusIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

/**
 * « Achats » cell: the shopping lists of the task, linked to one more or a new one from its menu.
 * @param {{ task: Task, lists: ShoppingList[] }} props Task and every list.
 * @returns {JSX.Element} Cell.
 */
export function ShoppingCell({ task, lists }: { task: Task; lists: ShoppingList[] }) {
  const { updateList } = useShoppingMutations();
  // On a selection, the list goes to each selected task.
  const { targets } = useCellEdit(task, 'shopping');
  const own = lists.filter((list) => list.taskIds.includes(task.id));
  const free = lists.filter((list) => !list.taskIds.includes(task.id) && !list.closed);
  return (
    <Group gap={4} wrap="nowrap" align="flex-start" onClick={stopClick} style={{ minWidth: 0 }}>
      <StackedValues>
        {own.map((list) => (
          <Anchor key={list.id} component={Link} to={`/shopping/${list.id}`} size="sm" truncate>
            <BasketIcon aria-hidden style={{ verticalAlign: 'middle' }} /> {list.name}
          </Anchor>
        ))}
      </StackedValues>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Achats de ${task.title}`} style={{ flex: 'none' }}>
            <PlusIcon aria-hidden />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<PlusIcon aria-hidden />} onClick={() => openNewList({ taskIds: targets, projectIds: task.projectId ? new Set([task.projectId]) : undefined })}>
            Nouvelle liste
          </Menu.Item>
          {free.length > 0 && <Menu.Label>Rattacher une liste</Menu.Label>}
          {free.map((list) => (
            <Menu.Item
              key={list.id}
              leftSection={<BasketIcon aria-hidden />}
              onClick={() =>
                updateList.mutate(
                  { id: list.id, name: list.name, taskIds: [...new Set([...list.taskIds, ...targets])] },
                  {
                    onSuccess: () => notifySuccess(targets.length > 1 ? `Liste rattachée aux ${targets.length} tâches.` : 'Liste rattachée à la tâche.'),
                    onError: onMutationError,
                  },
                )
              }
            >
              {list.name}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
