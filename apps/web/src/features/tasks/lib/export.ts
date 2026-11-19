import { commentTotal } from '../../comments/lib/comment-column';
import { formatDuration, printedDay, type TaskColumn } from '@ordo/shared';
import type { EventOccurrence } from '../../calendar/api';
import type { Task } from '../api';
import type { TaskContext } from '../hooks/use-task-context';
import { EVENT_STATES, eventState, eventWhen } from './event-format';
import * as fmt from '../../../lib/format';
import { beneficiaryNames } from '../../beneficiaries/hooks/use-beneficiaries';
import { taskNumbered } from '../hooks/use-task-context';
import { taskShortRef } from '../../../components/markdown/remark-references';

/**
 * Text of a task cell.
 * @param {Task} task Task.
 * @param {TaskColumn} column Column.
 * @param {TaskContext} context Task context.
 * @returns {string} Text.
 */
export function taskCell(task: Task, column: TaskColumn, context: TaskContext): string {
  // Linked tasks: "#12" in the project of the task, with their project otherwise (numbers are per project).
  const numbers = (ids: string[]) =>
    ids
      .map((id) => context.taskById.get(id))
      .filter((other) => other !== undefined)
      .map((other) => taskShortRef(other, task.projectId, context.projectLabel(other.projectId)))
      .join(', ');
  switch (column) {
    case 'label':
      return taskNumbered(task);
    case 'project':
      return context.projectLabel(task.projectId);
    case 'status':
      return (task.statusId && context.statusById.get(task.statusId)?.label) || '';
    case 'priority':
      return (task.priorityId && context.priorityById.get(task.priorityId)?.label) || '';
    case 'type':
      return (task.typeId && context.typeById.get(task.typeId)?.label) || '';
    case 'beneficiaries':
      return beneficiaryNames(task, context).join(', ');
    case 'assignees':
      return task.assigneeIds
        .map((id) => context.contributorById.get(id))
        .filter((contributor) => contributor !== undefined)
        .map(context.contributorName)
        .join(', ');
    case 'tags':
      return task.tagIds
        .map((id) => context.tagById.get(id)?.label)
        .filter(Boolean)
        .join(', ');
    case 'effort':
      return task.effort === null ? '' : fmt.number(task.effort, 2);
    case 'trackedTime':
      return task.trackedSeconds > 0 ? formatDuration(task.trackedSeconds) : '';
    case 'startDate':
      return task.startDate ? printedDay(task.startDate) : '';
    case 'endDate':
      return task.endDate ? printedDay(task.endDate) : '';
    case 'deadline':
      return task.deadline ? printedDay(task.deadline) : '';
    case 'minDate':
      return task.minDate ? fmt.exportDay(task.minDate) : '';
    case 'slots':
      return '';
    case 'timer':
      return '';
    case 'subtasks':
      return context
        .childrenOf(task.id)
        .map((child) => taskNumbered(child))
        .join(', ');
    case 'progress': {
      const children = context.childrenOf(task.id);
      return children.length ? `${children.filter((child) => child.closed).length} / ${children.length}` : '';
    }
    case 'alarms':
    case 'shopping':
      return '';
    case 'parent': {
      const parent = task.parentId ? context.taskById.get(task.parentId) : undefined;
      return parent ? context.taskLabel(parent, task.projectId) : '';
    }
    case 'milestone': {
      const milestone = task.milestoneId ? context.milestoneById.get(task.milestoneId) : undefined;
      return milestone ? context.milestoneLabel(milestone) : '';
    }
    case 'sprint':
      return task.sprintIds
        .map((id) => {
          const sprint = context.sprintById.get(id);
          return sprint ? context.sprintLabel(sprint) : undefined;
        })
        .filter(Boolean)
        .join(', ');
    case 'blockedBy':
      return numbers(task.blockedByIds);
    case 'blocking':
      return numbers(task.blockingIds);
    case 'related':
      return numbers(task.relatedIds);
    case 'comments': {
      // A description counts as a comment.
      const count = commentTotal(task.commentCount, task.description);
      return fmt.count(count);
    }
    case 'createdAt':
      return fmt.exportDay(task.createdAt);
    case 'updatedAt':
      return fmt.exportDay(task.updatedAt);
  }
}

/**
 * Text of an event cell (title, project, people, status, tracked time, comments, dates; empty elsewhere).
 * @param {EventOccurrence} event Occurrence.
 * @param {TaskColumn} column Column.
 * @param {TaskContext} context Task context.
 * @param {number} [comments] Its comments (its description counting as one). Optional. Default = 0.
 * @returns {string} Text.
 */
export function eventCell(event: EventOccurrence, column: TaskColumn, context: TaskContext, comments = 0): string {
  switch (column) {
    case 'comments':
      return fmt.count(comments);
    case 'label':
      return event.location ? `${event.label} (${event.location})` : event.label;
    case 'project':
      return event.projectId ? context.projectLabel(event.projectId) : '';
    case 'beneficiaries':
      return beneficiaryNames(event, context).join(', ');
    case 'assignees':
      return event.contributorIds
        .map((id) => context.contributorById.get(id))
        .filter((contributor) => contributor !== undefined)
        .map(context.contributorName)
        .join(', ');
    case 'status':
      return EVENT_STATES[eventState(event, Date.now())].label;
    case 'trackedTime':
      return event.trackedSeconds ? formatDuration(event.trackedSeconds) : '';
    case 'startDate':
      return eventWhen(event, 'start', true);
    case 'endDate':
      return eventWhen(event, 'end', true);
    default:
      return '';
  }
}
