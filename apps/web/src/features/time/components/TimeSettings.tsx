import { Stack } from '@mantine/core';
import { ColumnDefaults } from '../../../components/data-table/views/ColumnDefaults';
import { WeekSettings } from '../../calendar/components/WeekSettings';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeColumns } from '../hooks/use-time-columns';

/**
 * Settings of the times: the week of the workspace (that of « this week »), then the columns of new views of the
 * tracked times. In the settings of the timers page and in the time tab of a project.
 * @returns {JSX.Element} Settings.
 */
export function TimeSettings() {
  const { context } = useTaskContext();
  const columns = useTimeColumns(undefined, context);
  return (
    <Stack gap="md">
      <WeekSettings />
      {/* Last: the columns of new views (a long list). */}
      <ColumnDefaults tableKey="time-log" columns={columns} label="Temps passé" />
    </Stack>
  );
}
