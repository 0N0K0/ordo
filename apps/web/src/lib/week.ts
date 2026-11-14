import { DEFAULT_WEEK, readWeek, type WeekSpan } from '@ordo/shared';
import type { WorkspacesQuery } from '../graphql/graphql';
import { queryClient } from './query-client';

/**
 * Week of the workspace the app shows (its first and last days), read from the loaded workspaces (they load before
 * the pages): Monday to Sunday until then.
 * @returns {WeekSpan} Week.
 */
export function currentWeek(): WeekSpan {
  const data = queryClient.getQueryData<WorkspacesQuery>(['workspaces']);
  const workspace = data?.workspaces.find((item) => item.id === data.currentWorkspaceId);
  return workspace ? readWeek(workspace) : DEFAULT_WEEK;
}

/**
 * First day of the week for the date pickers (Mantine, FullCalendar): 0 (Sunday) to 6 (Saturday).
 * @param {WeekSpan} week Week.
 * @returns {0 | 1 | 2 | 3 | 4 | 5 | 6} Day.
 */
export const pickerFirstDay = (week: WeekSpan) => (week.start % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
