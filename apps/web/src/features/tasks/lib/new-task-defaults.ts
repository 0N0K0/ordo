import { parsePersonKey } from '../../../components/people/people-keys';
import type { TaskGroupBy } from '@ordo/shared';
import type { TaskInputValues } from '../api';
import type { TaskContext } from '../hooks/use-task-context';

/** Values a task created in a group receives from that group. */
export interface NewTaskDefaults extends Partial<TaskInputValues> {
  projectId?: string;
  parentId?: string | null;
  /** Grouped by state: the new task is created closed. */
  closed?: boolean;
}

/**
 * Status a new task starts with: the first « to do » status not archived, else the first status not archived.
 * @param {TaskContext} context Task context.
 * @returns {string | null} Status id (none: no status defined).
 */
export function defaultStatusId(context: TaskContext): string | null {
  const statuses = context.statuses.filter((status) => !status.archived);
  return (statuses.find((status) => status.category === 'TODO') ?? statuses[0])?.id ?? null;
}

/**
 * Values of a new task created in a group: the group's status, priority, type, assignee, milestone, sprint,
 * parent, project or state. The "none" group sets nothing, nor the group of an archived value (not given anymore).
 * @param {TaskGroupBy} groupBy Grouping field.
 * @param {string} key Group key (value id, or "none").
 * @param {TaskContext} context Task context.
 * @returns {NewTaskDefaults} Defaults.
 */
export function groupDefaults(groupBy: TaskGroupBy, key: string, context: TaskContext): NewTaskDefaults {
  if (key === 'none') return {};
  switch (groupBy) {
    case 'state':
      return { closed: key === 'closed' };
    case 'project':
      return { projectId: key };
    case 'status':
      return context.statusById.get(key)?.archived ? {} : { statusId: key };
    case 'priority':
      return context.priorityById.get(key)?.archived ? {} : { priorityId: key };
    case 'type':
      return context.typeById.get(key)?.archived ? {} : { typeId: key };
    case 'assignees':
      return context.contributorById.get(key)?.archived ? {} : { assigneeIds: [key] };
    case 'tags':
      return context.tagById.get(key)?.archived ? {} : { tagIds: [key] };
    case 'milestone': {
      const milestone = context.milestoneById.get(key);
      return milestone ? { ...(!milestone.archived && { milestoneId: key }), projectId: milestone.projectId } : {};
    }
    case 'sprint': {
      const sprint = context.sprintById.get(key);
      return sprint ? { ...(!sprint.archived && { sprintIds: [key] }), projectId: sprint.projectId } : {};
    }
    case 'parent': {
      const parent = context.taskById.get(key);
      return parent ? { parentId: key, projectId: parent.projectId ?? undefined } : {};
    }
    case 'beneficiaries': {
      const person = parsePersonKey(key);
      return person?.kind === 'relation' ? { beneficiaryRelationIds: [person.id] } : person ? { beneficiaryIds: [person.id] } : {};
    }
    // Links and months: nothing set (a new task has no link, and no day within the month is chosen).
    case 'blockedBy':
    case 'blocking':
    case 'related':
    case 'startDate':
    case 'endDate':
    case 'minDate':
    case 'deadline':
      return {};
  }
}
