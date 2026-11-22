import { ColumnDefaults } from '../../../components/data-table/views/ColumnDefaults';
import { useActiveWorkspace } from '../../workspaces/api';
import { useScheduleColumns } from '../hooks/use-schedule-columns';
import { EPHEMERIDES_TITLE, schedulesTitle } from '../lib/schedule-text';

/**
 * Columns new views of the tables of the créneaux and of the éphémérides start with, in the settings of the calendar.
 * @returns {JSX.Element} Sections.
 */
export function ScheduleColumnDefaults() {
  const { perso } = useActiveWorkspace();
  const schedules = useScheduleColumns(false);
  const ephemerides = useScheduleColumns(true);
  return (
    <>
      <ColumnDefaults tableKey="work-schedules" columns={schedules.columns} label={schedulesTitle(perso)} />
      <ColumnDefaults tableKey="ephemerides" columns={ephemerides.columns} label={EPHEMERIDES_TITLE} />
    </>
  );
}
