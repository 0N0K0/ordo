import { ME, type TableFilterGroup } from '@ordo/shared';

type MyTasksPeriod = 'today' | 'tomorrow' | 'week';

type Condition = Extract<TableFilterGroup['children'][number], { type: 'condition' }>;

/**
 * Filter condition, on a column of the task table.
 * @param {string} field Column.
 * @param {string} operator Operator.
 * @param {Condition['value']} [value] Value. Optional.
 * @returns {Condition} Condition.
 */
function condition(field: string, operator: string, value?: Condition['value']): Condition {
  return { type: 'condition', id: `${field}-${operator}`, field, operator, value: value ?? null } as Condition;
}

/**
 * Filter group.
 * @param {'and' | 'or'} combinator Combinator.
 * @param {TableFilterGroup['children']} children Children.
 * @returns {TableFilterGroup} Group.
 */
function group(combinator: 'and' | 'or', children: TableFilterGroup['children']): TableFilterGroup {
  return { type: 'group', id: `${combinator}-${children.length}`, combinator, children };
}

/**
 * "My tasks" of a period, in the words of the task table: open tasks assigned to me or to nobody that are overdue
 * (past their "Date max"), in progress, or ending, starting, running or reaching their "Date max" during the period.
 * @param {MyTasksPeriod} period Period.
 * @returns {TableFilterGroup} Filter.
 */
export function myTasksFilter(period: MyTasksPeriod): TableFilterGroup {
  const day = period === 'tomorrow' ? 'today+1' : 'today';
  const onPeriod: Condition[] =
    period === 'week'
      ? [condition('endDate', 'within', 'thisWeek'), condition('startDate', 'within', 'thisWeek'), condition('deadline', 'within', 'thisWeek')]
      : [condition('endDate', 'is', day), condition('startDate', 'is', day), condition('deadline', 'is', day)];
  return group('and', [
    group('or', [condition('assignees', 'anyOf', [ME]), condition('assignees', 'isEmpty')]),
    condition('closed', 'isFalse'),
    group('or', [
      condition('overdue', 'isTrue'),
      condition('statusCategory', 'anyOf', ['IN_PROGRESS']),
      ...onPeriod,
      // Running on that day: started before and ending after.
      group('and', [condition('startDate', 'onOrBefore', day), condition('endDate', 'onOrAfter', day)]),
    ]),
  ]);
}
