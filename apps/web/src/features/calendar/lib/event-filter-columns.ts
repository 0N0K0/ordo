import { booleanColumn } from '../../../components/data-table/table/boolean-column';
import { withArchived, type DataColumn } from '../../../components/data-table/table/data-table';
import { stateColumn, type ColumnState } from '../../../components/data-table/table/state-column';
import { itemChoices } from '../../../components/items/item-look';
import { categoryOptions } from '../../../components/tree/category-tree';
import { EVENT_STATES, eventState } from '../../tasks/lib/event-format';
import { eventRowKey, type TaskTableRow } from '../../tasks/lib/task-columns';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import type { Calendar, CalendarCategory, EventOccurrence } from '../api';

/** Columns of the task table an event fills, filtered as there (label, project, people, place, dates, time, documents). */
const EVENT_TASK_COLUMNS = ['label', 'project', 'assignees', 'beneficiaries', 'location', 'startDate', 'endDate', 'trackedTime', 'description', 'documents'];

/** States of an event (to come, ongoing, past, cancelled, postponed), with their badges. */
const EVENT_STATE_BADGES = Object.entries(EVENT_STATES).map(([id, look]) => ({ id, ...look })) as ColumnState<keyof typeof EVENT_STATES>[];

/**
 * Row of an event in the words of the task table (where the events are listed with the tasks).
 * @param {EventOccurrence} event Occurrence.
 * @returns {TaskTableRow} Row.
 */
export const eventRow = (event: EventOccurrence): TaskTableRow => ({ kind: 'event', key: eventRowKey(event), event });

/**
 * Event of a row of the task table, none for a task.
 * @param {TaskTableRow} row Row.
 * @returns {EventOccurrence | null} Event.
 */
const eventOf = (row: TaskTableRow): EventOccurrence | null => (row.kind === 'event' ? row.event : null);

/**
 * Fields the events of the calendar are filtered by: the columns of the task table an event fills (the same filters as
 * there), then those of the events alone: calendar, categories, linked tasks, state, all day, recurring.
 * @param {readonly DataColumn<TaskTableRow>[]} taskColumns Columns of the task table.
 * @param {TaskContext} context Task context (the tasks offered).
 * @param {readonly Calendar[]} calendars Calendars of the workspace.
 * @param {readonly CalendarCategory[]} categories Categories of the calendar.
 * @returns {DataColumn<TaskTableRow>[]} Columns.
 */
export function eventFilterColumns(taskColumns: readonly DataColumn<TaskTableRow>[], context: TaskContext, calendars: readonly Calendar[], categories: readonly CalendarCategory[]): DataColumn<TaskTableRow>[] {
  const shared = EVENT_TASK_COLUMNS.flatMap((id) => taskColumns.filter((column) => column.id === id));
  return [
    ...shared,
    {
      id: 'calendar',
      label: 'Calendrier',
      size: 160,
      required: true,
      text: (row) => calendars.find((calendar) => calendar.id === eventOf(row)?.calendarId)?.label ?? '',
      filter: { kind: 'choice', value: (row) => eventOf(row)?.calendarId ?? null, options: itemChoices(calendars) },
    },
    {
      id: 'categories',
      label: 'Catégories',
      size: 180,
      filter: { kind: 'choices', value: (row) => eventOf(row)?.categoryIds ?? [], options: withArchived(categoryOptions(categories), categories) },
    },
    {
      id: 'tasks',
      label: 'Tâches',
      size: 200,
      filter: { kind: 'choices', value: (row) => eventOf(row)?.taskIds ?? [], options: context.taskOptions(context.tasks) },
    },
    stateColumn<TaskTableRow, keyof typeof EVENT_STATES>({
      id: 'state',
      required: true,
      label: 'État',
      size: 110,
      states: EVENT_STATE_BADGES,
      value: (row) => {
        const event = eventOf(row);
        return event ? eventState(event, Date.now()) : null;
      },
    }),
    booleanColumn<TaskTableRow>({ id: 'allDay', label: 'Journée entière', size: 110, groupLabels: { yes: 'Journée entière', no: 'À heures' }, value: (row) => eventOf(row)?.allDay ?? null }),
    booleanColumn<TaskTableRow>({ id: 'recurring', label: 'Récurrent', size: 110, groupLabels: { yes: 'Récurrent', no: 'Ponctuel' }, value: (row) => Boolean(eventOf(row)?.recurrence) }),
  ];
}
