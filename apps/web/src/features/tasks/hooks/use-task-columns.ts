import { scheduleChoices } from '../../calendar/lib/schedule-choices';
import { useMemo } from 'react';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { useTaskAlarmCounts } from '../../alarms/api';
import { useWorkSchedules } from '../../calendar/api';
import { useShoppingLists } from '../../shopping/api';
import { useDoableTaskIds } from '../api';
import { taskColumns, type TaskTableRow } from '../lib/task-columns';
import type { TaskContext } from './use-task-context';

/**
 * Columns of the tasks (their filters, sorts, groups), with what some filters need that the tasks do not hold: those
 * doable now (asked only when asked for), their alerts, their shopping, the kinds of slots.
 * @param {TaskContext | null} context Task context.
 * @param {string} today Today, YYYY-MM-DD.
 * @param {{ doable?: boolean, eventComments?: ReadonlyMap<string, number> }} [options] Whether the tasks doable now are asked (a filter on them), and the comments of the events listed. Optional.
 * @returns {DataColumn<TaskTableRow>[]} Columns (none without context).
 */
export function useTaskColumns(
  context: TaskContext | null,
  today: string,
  { doable = true, eventComments }: { doable?: boolean; eventComments?: ReadonlyMap<string, number> } = {},
): DataColumn<TaskTableRow>[] {
  const alarmCounts = useTaskAlarmCounts();
  const { data: lists } = useShoppingLists();
  const { data: schedules } = useWorkSchedules();
  const doableIds = useDoableTaskIds(doable);
  return useMemo(() => {
    if (!context) return [];
    const shoppingTaskIds = new Set((lists ?? []).flatMap((list) => list.taskIds));
    const slotKinds = scheduleChoices(schedules).options;
    return taskColumns(context, today, { doableIds, shoppingTaskIds, alarmCounts, slotKinds, eventComments });
  }, [context, today, doableIds, lists, alarmCounts, schedules, eventComments]);
}
