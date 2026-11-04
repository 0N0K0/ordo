import { addDays, type ChartConfig, type ChartDimension, type ChartGroupDimension, type ChartMeasure } from '@ordo/shared';
import type { Task } from '../tasks/api';
import type { TaskContext } from '../tasks/use-task-context';
import { aggregate, localDay, none, round, type ChartData, type Key } from './aggregate';

const CATEGORY_LABELS: Record<string, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminée',
  CANCELLED: 'Annulée',
};
const dayLabel = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/**
 * Day of a task for a date dimension, or null when the task has none.
 * @param {Task} task Task.
 * @param {ChartDimension} dimension Date dimension.
 * @returns {string | null} YYYY-MM-DD.
 */
function taskDay(task: Task, dimension: ChartDimension): string | null {
  switch (dimension) {
    case 'createdAt':
      return localDay(task.createdAt);
    case 'closedAt':
      return task.closedAt ? localDay(String(task.closedAt)) : null;
    case 'startDate':
      return task.startDate ? String(task.startDate) : null;
    case 'endDate':
      return task.endDate ? String(task.endDate) : null;
    default:
      return null;
  }
}

/**
 * Values of a field for a task (several for assignees; "none" when empty).
 * @param {Task} task Task.
 * @param {ChartGroupDimension} dimension Field.
 * @param {TaskContext} context Task context.
 * @returns {Key[]} Values.
 */
function groupKeys(task: Task, dimension: ChartGroupDimension, context: TaskContext): Key[] {
  switch (dimension) {
    case 'sprint': {
      const sprint = task.sprintId ? context.sprintById.get(task.sprintId) : undefined;
      if (!sprint) return none('Sans sprint');
      const shared = context.sprints.some((other) => other.name === sprint.name && other.projectId !== sprint.projectId);
      return [
        {
          key: sprint.id,
          label: shared ? `${sprint.name} — ${context.projectById.get(sprint.projectId)?.title ?? ''}` : sprint.name,
          order: `${sprint.startDate} ${sprint.name}`,
        },
      ];
    }
    case 'milestone': {
      const milestone = task.milestoneId ? context.milestoneById.get(task.milestoneId) : undefined;
      if (!milestone) return none('Sans jalon');
      const shared = context.milestones.some((other) => other.title === milestone.title && other.projectId !== milestone.projectId);
      const label = shared ? `${milestone.title} — ${context.projectById.get(milestone.projectId)?.title ?? ''}` : milestone.title;
      return [
        {
          key: milestone.id,
          label,
          order: `${milestone.dueDate ?? '9999'} ${milestone.title}`,
        },
      ];
    }
    case 'project':
      return [
        {
          key: task.projectId,
          label: context.projectById.get(task.projectId)?.title ?? '',
          order: context.projectLabel(task.projectId),
        },
      ];
    case 'status':
    case 'priority':
    case 'type': {
      const id = {
        status: task.statusId,
        priority: task.priorityId,
        type: task.typeId,
      }[dimension];
      const label = id
        ? {
            status: context.statusById,
            priority: context.priorityById,
            type: context.typeById,
          }[dimension].get(id)
        : undefined;
      if (!label)
        return none(
          {
            status: 'Sans statut',
            priority: 'Sans priorité',
            type: 'Sans type',
          }[dimension],
        );
      return [
        {
          key: label.id,
          label: label.name,
          order: label.position,
          color: label.color ?? undefined,
        },
      ];
    }
    case 'statusCategory': {
      const category = task.statusId ? context.statusById.get(task.statusId)?.category : undefined;
      if (!category) return none('Sans statut');
      return [
        {
          key: category,
          label: CATEGORY_LABELS[category] ?? category,
          order: Object.keys(CATEGORY_LABELS).indexOf(category),
        },
      ];
    }
    case 'assignees': {
      const people = task.assigneeIds.map((id) => context.contributorById.get(id)).filter((contributor) => contributor !== undefined);
      return people.length
        ? people.map((person) => ({
            key: person.id,
            label: person.name,
            order: person.name,
          }))
        : none('Non assignées');
    }
    case 'tags': {
      const tags = task.tagIds.map((id) => context.tagById.get(id)).filter((tag) => tag !== undefined);
      return tags.length
        ? tags.map((tag) => ({
            key: tag.id,
            label: tag.name,
            order: tag.position,
            color: tag.color,
          }))
        : none('Sans étiquette');
    }
    case 'state':
      return context.isClosed(task) ? [{ key: 'closed', label: 'Fermées', order: 1, color: 'violet.6' }] : [{ key: 'open', label: 'Ouvertes', order: 0, color: 'green.6' }];
    default:
      return none('—');
  }
}

/**
 * Value a task adds: 1, its effort (tasks without sub-tasks: a parent's effort is its sub-tasks'), or its
 * tracked hours.
 * @param {Task} task Task.
 * @param {ChartMeasure} measure Measure.
 * @param {TaskContext} context Task context.
 * @returns {number} Value.
 */
function valueOf(task: Task, measure: ChartMeasure, context: TaskContext): number {
  if (measure === 'count') return 1;
  if (measure === 'effort') return context.childrenOf(task.id).length === 0 ? (task.effort ?? 0) : 0;
  if (measure === 'trackedTime') return task.trackedSeconds / 3600;
  return 0;
}

/**
 * Burndown of a sprint: what is left (tasks or effort) at the end of each day of the sprint, against the
 * ideal straight line. Tasks closed after the sprint count as still open on its days.
 * @param {Task[]} tasks Matching tasks.
 * @param {ChartConfig} config Configuration.
 * @param {TaskContext} context Task context.
 * @param {string} today User's day.
 * @returns {ChartData} Data.
 */
function burndown(tasks: Task[], config: ChartConfig, context: TaskContext, today: string): ChartData {
  const sprint = config.sprintId ? context.sprintById.get(config.sprintId) : undefined;
  const empty: ChartData = {
    rows: [],
    series: [],
    slices: [],
    taskCount: 0,
    empty: true,
  };
  if (!sprint) return empty;
  const measure = config.measure === 'effort' ? 'effort' : 'count';
  const inSprint = tasks.filter((task) => task.sprintId === sprint.id);
  const total = inSprint.reduce((sum, task) => sum + valueOf(task, measure, context), 0);
  const days: string[] = [];
  for (let day = String(sprint.startDate); day <= String(sprint.endDate); day = addDays(day, 1)) days.push(day);
  const rows = days.map((day, index) => ({
    x: dayLabel.format(new Date(`${day}T00:00:00Z`)),
    Restant: day > today ? null : round(inSprint.filter((task) => !task.closedAt || localDay(String(task.closedAt)) > day).reduce((sum, task) => sum + valueOf(task, measure, context), 0)),
    Idéal: round(days.length > 1 ? total * (1 - index / (days.length - 1)) : 0),
  }));
  return {
    rows,
    series: [
      { name: 'Restant', color: 'blue.6' },
      { name: 'Idéal', color: 'gray.5', strokeDasharray: '5 5' },
    ],
    slices: [],
    taskCount: inSprint.length,
    empty: inSprint.length === 0,
  };
}

/**
 * Data of a task chart: the matching tasks spread over the axis and the series, measured in number, effort
 * (tasks without sub-tasks) or tracked time; a task with several assignees or tags counts for each.
 * Burndowns follow a sprint day by day.
 * @param {Task[]} tasks Matching tasks.
 * @param {ChartConfig} config Configuration.
 * @param {TaskContext} context Task context.
 * @param {string} today User's day (YYYY-MM-DD).
 * @returns {ChartData} Data.
 */
export function taskChartData(tasks: Task[], config: ChartConfig, context: TaskContext, today: string): ChartData {
  if (config.type === 'burndown') return burndown(tasks, config, context, today);
  return aggregate(
    tasks.map((task) => ({
      day: (dimension: ChartDimension) => taskDay(task, dimension),
      keys: (dimension: ChartGroupDimension) => groupKeys(task, dimension, context),
      value: (measure: ChartMeasure) => valueOf(task, measure, context),
    })),
    config,
    today,
  );
}
