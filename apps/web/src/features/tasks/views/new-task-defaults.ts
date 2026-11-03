import type { TaskGroupBy } from '@ordo/shared';
import type { TaskInputValues } from '../api';
import type { TaskContext } from '../use-task-context';

/** Values a task created in a group receives from that group. */
export interface NewTaskDefaults extends Partial<TaskInputValues> {
  projectId?: string;
  parentId?: string | null;
  /** Grouped by state: the new task is created closed. */
  closed?: boolean;
}

/**
 * Values of a new task created in a group: the group's status, priority, type, assignee, milestone, sprint,
 * parent, project or state. The "none" group sets nothing.
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
      return { statusId: key };
    case 'priority':
      return { priorityId: key };
    case 'type':
      return { typeId: key };
    case 'assignees':
      return { assigneeIds: [key] };
    case 'tags':
      return { tagIds: [key] };
    case 'milestone': {
      const milestone = context.milestoneById.get(key);
      return milestone ? { milestoneId: key, projectId: milestone.projectId } : {};
    }
    case 'sprint': {
      const sprint = context.sprintById.get(key);
      return sprint ? { sprintId: key, projectId: sprint.projectId } : {};
    }
    case 'parent': {
      const parent = context.taskById.get(key);
      return parent ? { parentId: key, projectId: parent.projectId } : {};
    }
  }
}
