import { filterDay, filterPeriod, ME, type FilterCondition, type FilterGroup } from '@ordo/shared';
import type { EventOccurrence } from '../../calendar/api';
import { descendantIds } from '../../workspace/api';
import type { TaskContext } from '../use-task-context';
import { currentWeek } from '../../../lib/week';

/**
 * Text compared without case or accents.
 * @param {string | null | undefined} value Text.
 * @returns {string} Folded text.
 */
function fold(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Whether an event matches a condition. Conditions on what only tasks have (status, priority, effort,
 * blocked…) leave events in: they do not apply to them.
 * @param {EventOccurrence} event Occurrence.
 * @param {FilterCondition} condition Condition.
 * @param {TaskContext} context Task context.
 * @param {string} today User's day (YYYY-MM-DD).
 * @returns {boolean} Match.
 */
function conditionMatches(event: EventOccurrence, condition: FilterCondition, context: TaskContext, today: string): boolean {
  const { field, operator, value } = condition;
  const text = typeof value === 'string' ? value : '';
  const ids = (Array.isArray(value) ? value : []).map((id) => (id === ME ? (context.meId ?? ME) : id));

  if (field === 'title' || field === 'description') {
    const own = fold(field === 'title' ? event.title : event.description);
    switch (operator) {
      case 'contains':
        return own.includes(fold(text));
      case 'notContains':
        return !own.includes(fold(text));
      case 'is':
        return own === fold(text);
      case 'isNot':
        return own !== fold(text);
      case 'isEmpty':
        return own === '';
      default:
        return own !== '';
    }
  }

  if (field === 'project') {
    const projectId = event.projectId ?? null;
    const tree = new Set(ids.flatMap((id) => [id, ...descendantIds(context.projects, id)]));
    switch (operator) {
      case 'in':
        return projectId !== null && ids.includes(projectId);
      case 'notIn':
        return projectId === null || !ids.includes(projectId);
      case 'inTree':
        return projectId !== null && tree.has(projectId);
      case 'isEmpty':
        return projectId === null;
      default:
        return projectId !== null;
    }
  }

  if (field === 'assignees') {
    const people = event.contributorIds;
    switch (operator) {
      case 'anyOf':
        return ids.some((id) => people.includes(id));
      case 'allOf':
        return ids.every((id) => people.includes(id));
      case 'noneOf':
        return !ids.some((id) => people.includes(id));
      case 'isEmpty':
        return people.length === 0;
      default:
        return people.length > 0;
    }
  }

  if (field === 'startDate' || field === 'endDate') {
    // An event always has its dates.
    const day = field === 'startDate' ? event.startDate : event.endDate;
    if (operator === 'isEmpty') return false;
    if (operator === 'isNotEmpty') return true;
    if (operator === 'within') {
      const [start, end] = filterPeriod(text, today, currentWeek());
      return day >= start && day < end;
    }
    const target = filterDay(text, today);
    switch (operator) {
      case 'is':
        return day === target;
      case 'before':
        return day < target;
      case 'onOrBefore':
        return day <= target;
      case 'after':
        return day > target;
      default:
        return day >= target;
    }
  }

  // Task-only fields.
  return true;
}

/**
 * Whether an event matches a filter group (an empty group matches).
 * @param {EventOccurrence} event Occurrence.
 * @param {FilterGroup} group Group.
 * @param {TaskContext} context Task context.
 * @param {string} today User's day (YYYY-MM-DD).
 * @returns {boolean} Match.
 */
export function eventMatches(event: EventOccurrence, group: FilterGroup, context: TaskContext, today: string): boolean {
  if (group.children.length === 0) return true;
  const results = group.children.map((child) =>
    child.type === 'group' ? eventMatches(event, child, context, today) : conditionMatches(event, child, context, today),
  );
  return group.combinator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Whether an event matches the quick search (title, description, place).
 * @param {EventOccurrence} event Occurrence.
 * @param {string} search Search text.
 * @returns {boolean} Match.
 */
export function eventMatchesSearch(event: EventOccurrence, search: string): boolean {
  const query = fold(search.trim());
  return !query || [event.title, event.description, event.location].some((value) => fold(value).includes(query));
}
