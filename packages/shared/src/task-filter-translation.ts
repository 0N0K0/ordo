import { z } from 'zod';
import { emptyTableFilter, tableFilterSchema, type TableFilterGroup } from './table-views';
import type { FilterConditionOf, FilterGroupOf } from './task-filters';

/** Fields of the former task filters named otherwise by the columns of the task table. */
const RENAMED: Record<string, string> = { dependsOn: 'blockedBy', blocks: 'blocking', relatedTo: 'related', trackedHours: 'trackedTime' };

/** Fields filtered by a list of values in the task table (a project or a parent with those above it, the sprints). */
const LISTED = new Set(['project', 'parent', 'sprint']);

/** Relative sprints of the former filters: an operator there, a value of the sprint column here. */
const RELATIVE_SPRINTS = new Set(['current', 'previous', 'next', 'past', 'future']);

/**
 * Condition of the former task filters in the words of the task table (its columns): `inTree` is « one of » (the
 * values of a project or a parent hold those above it), a relative sprint is one of the values of the sprint column
 * (« Sprint en cours »…), a few fields renamed. A condition already in those words stays as it is.
 * @param {FilterConditionOf<string>} condition Condition.
 * @returns {FilterConditionOf<string>} Condition.
 */
function translateCondition(condition: FilterConditionOf<string>): FilterConditionOf<string> {
  const field = RENAMED[condition.field] ?? condition.field;
  if (!LISTED.has(field)) return { ...condition, field };
  if (field === 'sprint' && RELATIVE_SPRINTS.has(condition.operator)) return { ...condition, field, operator: 'anyOf', value: [condition.operator] };
  const operator = condition.operator === 'in' || condition.operator === 'inTree' ? 'anyOf' : condition.operator === 'notIn' ? 'noneOf' : condition.operator;
  return { ...condition, field, operator: operator as FilterConditionOf<string>['operator'] };
}

/**
 * Filter of the former task filters (dashboards, saved before) in the words of the task table: the same groups, each
 * condition translated. A filter already in those words stays as it is.
 * @param {FilterGroupOf<string>} group Filter.
 * @returns {TableFilterGroup} Filter.
 */
export function translateTaskFilter(group: FilterGroupOf<string>): TableFilterGroup {
  return {
    ...group,
    children: group.children.map((child) => (child.type === 'group' ? translateTaskFilter(child) : translateCondition(child))),
  };
}

/** Filter of tasks (charts of the dashboards…) in the words of the task table, the former ones translated as read. */
export const taskTableFilterSchema = z.preprocess(
  (value) => (value && typeof value === 'object' && (value as { type?: unknown }).type === 'group' ? translateTaskFilter(value as FilterGroupOf<string>) : value),
  tableFilterSchema,
);

/** Empty filter of tasks: every task. */
export const emptyTaskTableFilter = emptyTableFilter;
