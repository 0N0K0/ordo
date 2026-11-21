import { PAGES } from '../../../app/pages';
import { alarmTarget } from '../../alarms/lib/alarm-labels';
import type { DeadTimeItem } from '../../countdowns/lib/countdowns';
import type { Task } from '../api';
import type { TaskContext } from '../hooks/use-task-context';

/**
 * A task as the timers of its dead times keep it: its ring links to the task, as its alarms.
 * @param {Task} task Task.
 * @param {Pick<TaskContext, 'projectById'> | null} context Task context (the label of its project).
 * @returns {DeadTimeItem} Item.
 */
export function taskDeadTimeItem(task: Task, context: Pick<TaskContext, 'projectById'> | null): DeadTimeItem {
  const target = alarmTarget(
    { taskId: task.id, projectId: null },
    () => task,
    (id) => context?.projectById.get(id),
  );
  return { taskId: task.id, subject: task.label, path: target?.to ?? PAGES.tasks.path, linkLabel: target?.label ?? 'Ouvrir la tâche' };
}
