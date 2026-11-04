import type { FilterCondition, FilterGroup } from '@ordo/shared';
import { ME } from '@ordo/shared';

export type MyTasksPeriod = 'today' | 'tomorrow' | 'week';

export const MY_TASKS_PERIODS: { value: MyTasksPeriod; label: string }[] = [
  { value: 'today', label: 'Aujourd’hui' },
  { value: 'tomorrow', label: 'Demain' },
  { value: 'week', label: 'Cette semaine' },
];

/**
 * Filter condition.
 * @param {FilterCondition['field']} field Field.
 * @param {string} operator Operator.
 * @param {FilterCondition['value']} [value] Value. Optional.
 * @returns {FilterCondition} Condition.
 */
function condition(field: FilterCondition['field'], operator: string, value?: FilterCondition['value']): FilterCondition {
  return { type: 'condition', id: `${field}-${operator}`, field, operator, value: value ?? null };
}

/**
 * Filter group.
 * @param {'and' | 'or'} combinator Combinator.
 * @param {FilterGroup['children']} children Children.
 * @returns {FilterGroup} Group.
 */
function group(combinator: 'and' | 'or', children: FilterGroup['children']): FilterGroup {
  return { type: 'group', id: `${combinator}-${children.length}`, combinator, children };
}

/**
 * "My tasks" of a period: open tasks assigned to me or to nobody that are overdue, in progress, or due,
 * starting or running during the period.
 * @param {MyTasksPeriod} period Period.
 * @returns {FilterGroup} Filter.
 */
export function myTasksFilter(period: MyTasksPeriod): FilterGroup {
  const day = period === 'tomorrow' ? 'today+1' : 'today';
  const onPeriod: FilterCondition[] =
    period === 'week' ? [condition('endDate', 'within', 'thisWeek'), condition('startDate', 'within', 'thisWeek')] : [condition('endDate', 'is', day), condition('startDate', 'is', day)];
  return group('and', [
    group('or', [condition('assignees', 'anyOf', [ME]), condition('assignees', 'isEmpty')]),
    condition('closed', 'isFalse'),
    group('or', [
      condition('overdue', 'isTrue'),
      condition('statusCategory', 'in', ['IN_PROGRESS']),
      ...onPeriod,
      // Running on that day: started before and ending after.
      group('and', [condition('startDate', 'onOrBefore', day), condition('endDate', 'onOrAfter', day)]),
    ]),
  ]);
}
