import { SegmentedControl, Stack, Title } from '@mantine/core';
import { addDays, filterPeriod } from '@ordo/shared';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { localToday } from '../lib/dates';
import { MY_TASKS_PERIODS, myTasksFilter, type MyTasksPeriod } from '../features/tasks/my-tasks';
import { TaskBoard } from '../features/tasks/TaskBoard';

/**
 * My tasks of today, tomorrow or this week, across every project, with their own saved views.
 * @returns {JSX.Element} Page.
 */
export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const period = (MY_TASKS_PERIODS.find((item) => item.value === params.get('period'))?.value ?? 'today') as MyTasksPeriod;
  const baseFilter = useMemo(() => myTasksFilter(period), [period]);
  // Events of the same days as the tasks.
  const today = localToday();
  const eventRange = useMemo(() => {
    if (period === 'week') {
      const [from, end] = filterPeriod('thisWeek', today);
      return { from, to: addDays(end, -1) };
    }
    const day = period === 'tomorrow' ? addDays(today, 1) : today;
    return { from: day, to: day };
  }, [period, today]);

  return (
    <Stack gap="md">
      <Title order={1} size="h2">
        Mes tâches
      </Title>
      <TaskBoard
        projectId={null}
        baseFilter={baseFilter}
        emptyMessage="Rien de prévu sur cette période."
        title={`Mes tâches — ${MY_TASKS_PERIODS.find((item) => item.value === period)?.label}`}
        eventRange={eventRange}
        header={
          <SegmentedControl
            aria-label="Période"
            data={MY_TASKS_PERIODS}
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
