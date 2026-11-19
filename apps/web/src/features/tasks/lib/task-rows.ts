import { commentTotal } from '../../comments/lib/comment-column';
import type { TaskColumn } from '@ordo/shared';

/** What a task is sorted by: a column, or its number. */
type TaskSortKey = TaskColumn | 'number';
import type { EventOccurrence } from '../../calendar/api';
import type { Task } from '../api';
import type { TaskContext } from '../hooks/use-task-context';
import { beneficiaryNames } from '../../beneficiaries/hooks/use-beneficiaries';
import { collator } from '../../../lib/text';

type SortValue = string | number | null;

/**
 * Value a task is sorted by; null (empty) always goes last.
 * @param {Task} task Task.
 * @param {TaskSortKey} column Sort key (column id or number).
 * @param {TaskContext} context Task context.
 * @returns {SortValue} Comparable value.
 */
export function sortValue(task: Task, column: TaskSortKey, context: TaskContext): SortValue {
  switch (column) {
    case 'number':
      return task.number;
    case 'label':
      return task.label;
    case 'project':
      return context.projectLabel(task.projectId);
    case 'status':
      return task.statusId ? (context.statusById.get(task.statusId)?.position ?? null) : null;
    case 'priority':
      return task.priorityId ? (context.priorityById.get(task.priorityId)?.position ?? null) : null;
    case 'type':
      return task.typeId ? (context.typeById.get(task.typeId)?.position ?? null) : null;
    case 'beneficiaries':
      return beneficiaryNames(task, context).sort(collator.compare)[0] ?? null;
    case 'minDate':
      return task.minDate || null;
    case 'subtasks':
      return context.childrenOf(task.id).length || null;
    case 'progress': {
      // Share of the sub-tasks closed.
      const children = context.childrenOf(task.id);
      return children.length ? children.filter((child) => child.closed).length / children.length : null;
    }
    case 'slots':
    case 'timer':
    case 'alarms':
    case 'shopping':
      return null;
    case 'assignees': {
      const names = task.assigneeIds.map((id) => context.contributorById.get(id)?.name ?? '').sort(collator.compare);
      return names[0] ?? null;
    }
    case 'tags': {
      const names = task.tagIds.map((id) => context.tagById.get(id)?.label ?? '').sort(collator.compare);
      return names[0] ?? null;
    }
    case 'effort':
      return task.effort;
    case 'trackedTime':
      return task.trackedSeconds || null;
    case 'startDate':
      return task.startDate;
    case 'endDate':
      return task.endDate;
    case 'deadline':
      return task.deadline;
    case 'parent':
      return task.parentId ? (context.taskById.get(task.parentId)?.number ?? null) : null;
    case 'milestone': {
      // In the milestone order chosen by the user.
      return task.milestoneId ? (context.milestoneRank.get(task.milestoneId) ?? null) : null;
    }
    case 'sprint': {
      // The earliest of its sprints.
      const keys = task.sprintIds
        .map((id) => context.sprintById.get(id))
        .filter((sprint) => sprint !== undefined)
        .map((sprint) => `${sprint.startDate} ${sprint.label}`)
        .sort();
      return keys[0] ?? null;
    }
    case 'blockedBy':
      return task.blockedByIds.length || null;
    case 'blocking':
      return task.blockingIds.length || null;
    case 'related':
      return task.relatedIds.length || null;
    case 'comments':
      // A description counts as a comment.
      return commentTotal(task.commentCount, task.description) || null;
    case 'createdAt':
      return task.createdAt;
    case 'updatedAt':
      return task.updatedAt;
  }
}

/**
 * Value an event is sorted by: its title, project, people and dates; null for what only tasks have.
 * @param {EventOccurrence} event Occurrence.
 * @param {TaskSortKey} column Sort key.
 * @param {TaskContext} context Task context.
 * @returns {SortValue} Comparable value.
 */
export function eventSortValue(event: EventOccurrence, column: TaskSortKey, context: TaskContext): SortValue {
  switch (column) {
    case 'label':
      return event.label;
    case 'project':
      return event.projectId ? context.projectLabel(event.projectId) : null;
    case 'assignees': {
      const names = event.contributorIds.map((id) => context.contributorById.get(id)?.name ?? '').sort(collator.compare);
      return names[0] ?? null;
    }
    case 'startDate':
      return `${event.startDate} ${event.startTime ?? ''}`.trim();
    case 'endDate':
      return `${event.endDate} ${event.endTime ?? ''}`.trim();
    default:
      return null;
  }
}
