import { SegmentedControl, Stack, Title } from '@mantine/core';
import { ME, type FilterCondition, type FilterGroup } from '@ordo/shared';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useMe } from '../features/auth/api';
import { TaskBoard } from '../features/tasks/TaskBoard';
import { TimerCard } from '../features/time/TimerCard';

type Period = 'today' | 'tomorrow' | 'week';

const PERIODS: { value: Period; label: string }[] = [
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
function condition(
  field: FilterCondition['field'],
  operator: string,
  value?: FilterCondition['value'],
): FilterCondition {
  return {
    type: 'condition',
    id: `${field}-${operator}`,
    field,
    operator,
    value: value ?? null,
  };
}

/**
 * Filter group.
 * @param {'and' | 'or'} combinator Combinator.
 * @param {FilterGroup['children']} children Children.
 * @returns {FilterGroup} Group.
 */
function group(
  combinator: 'and' | 'or',
  children: FilterGroup['children'],
): FilterGroup {
  return {
    type: 'group',
    id: `${combinator}-${children.length}`,
    combinator,
    children,
  };
}

/**
 * "My tasks" of a period: open tasks assigned to me or to nobody that are overdue, in progress, or due,
 * starting or running during the period.
 * @param {Period} period Period.
 * @returns {FilterGroup} Filter.
 */
function myTasksFilter(period: Period): FilterGroup {
  const day = period === 'tomorrow' ? 'today+1' : 'today';
  const onPeriod: FilterCondition[] =
    period === 'week'
      ? [
          condition('endDate', 'within', 'thisWeek'),
          condition('startDate', 'within', 'thisWeek'),
        ]
      : [condition('endDate', 'is', day), condition('startDate', 'is', day)];
  return group('and', [
    group('or', [
      condition('assignees', 'anyOf', [ME]),
      condition('assignees', 'isEmpty'),
    ]),
    condition('closed', 'isFalse'),
    group('or', [
      condition('overdue', 'isTrue'),
      condition('statusCategory', 'in', ['IN_PROGRESS']),
      ...onPeriod,
      // Running on that day: started before and ending after.
      group('and', [
        condition('startDate', 'onOrBefore', day),
        condition('endDate', 'onOrAfter', day),
      ]),
    ]),
  ]);
}

/**
 * Home page: my tasks of today, tomorrow or this week, across every project, with their own saved views.
 * @returns {JSX.Element} Home page.
 */
export function HomePage() {
  const { data: user } = useMe();
  const [params, setParams] = useSearchParams();
  const period = (PERIODS.find((item) => item.value === params.get('period'))
    ?.value ?? 'today') as Period;
  const baseFilter = useMemo(() => myTasksFilter(period), [period]);

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={1} size="h2">
          Bonjour {user?.username}
        </Title>
      </Stack>
      <TimerCard />
      <TaskBoard
        projectId={null}
        baseFilter={baseFilter}
        emptyMessage="Rien de prévu sur cette période."
        header={
          <SegmentedControl
            aria-label="Période"
            data={PERIODS}
            value={period}
            onChange={(value) => {
              const next = new URLSearchParams(params);
              if (value === 'today') next.delete('period');
              else next.set('period', value);
              setParams(next, { replace: true });
            }}
          />
        }
      />
    </Stack>
  );
}
