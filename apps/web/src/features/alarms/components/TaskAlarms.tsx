import { SubSection } from '../../../components/page/SubSection';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { AlarmIcon, PlusIcon } from '@phosphor-icons/react';
import type { Task } from '../../tasks/api';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { AlarmList } from './AlarmList';
import { useAlarms } from '../api';
import { useAlarmForm } from '../hooks/use-alarm-form';

/**
 * Alerts of a task, in its panel: its alarms (on / off, edit, copy, delete) and a button for a new one, created
 * with the task, its project and its title.
 * @param {{ task: Task, context: TaskContext }} props Task and task context.
 * @param {Task} props.task Task.
 * @param {TaskContext} props.context Task context.
 * @returns {JSX.Element} Section.
 */
export function TaskAlarms({ task, context }: { task: Task; context: TaskContext }) {
  const { data, isPending } = useAlarms();
  const openForm = useAlarmForm(context);
  const alarms = (data ?? []).filter((alarm) => alarm.taskId === task.id);
  const create = () => openForm(undefined, { defaults: { label: task.label.slice(0, 120), projectId: task.projectId, taskId: task.id } });

  return (
    <SubSection
      title="Alarmes"
      gap="xs"
      action={
        <ActionButton priority="secondary" size="compact-xs" icon={<PlusIcon aria-hidden />} onClick={create}>
          Nouvelle alarme
        </ActionButton>
      }
    >
      {isPending ? (
        <ListSkeleton items={1} lines={2} />
      ) : alarms.length ? (
        <AlarmList alarms={alarms} context={context} openForm={openForm} showTarget={false} />
      ) : (
        <EmptyState compact icon={<AlarmIcon aria-hidden />} message="Aucune alarme pour cette tâche." />
      )}
    </SubSection>
  );
}
