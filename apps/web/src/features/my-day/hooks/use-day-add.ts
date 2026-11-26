import type { CalendarEventInput } from '@ordo/shared';
import type { AddDay } from '../../../app/layout/page-add';
import { useCalendars } from '../../calendar/api';
import { useEventForm } from '../../calendar/hooks/use-event-form';
import { newEventDefaults } from '../../calendar/lib/event-input';
import type { RoutineFormProps } from '../../routines/components/RoutineForm';
import { openRoutineForm } from '../../routines/lib/open-routine-form';
import type { TaskCreateDefaults } from '../../tasks/components/TaskCreateForm';
import { useTaskActions } from '../../tasks/hooks/use-task-actions';
import type { TaskContext } from '../../tasks/hooks/use-task-context';

/** New items opened in the side panel, prefilled with a day when one is given (« Ma journée »), all editable. */
export interface DayAdd {
  /**
   * Opens « Nouvelle tâche »: its « Ouverture » and « Échéance » the day.
   * @param {AddDay | null} on Day; null: none.
   * @param {TaskCreateDefaults} [defaults] Other fields (the project of a project page). Optional.
   * @returns {void}
   */
  task: (on: AddDay | null, defaults?: TaskCreateDefaults) => void;
  /**
   * Opens « Nouvel évènement »: all day on the day, in the first calendar not archived and not hidden there (as a day
   * picked in the agenda).
   * @param {AddDay | null} on Day; null: none.
   * @param {Partial<CalendarEventInput>} [defaults] Other fields (the project of a project page). Optional.
   * @returns {void}
   */
  event: (on: AddDay | null, defaults?: Partial<CalendarEventInput>) => void;
  /**
   * Opens « Nouvelle routine »: its « Première fois » the day (a routine has no due date).
   * @param {AddDay | null} on Day; null: none.
   * @param {Pick<RoutineFormProps, 'projectId'>} [defaults] Other fields (the project of a project page). Optional.
   * @returns {void}
   */
  routine: (on: AddDay | null, defaults?: Pick<RoutineFormProps, 'projectId'>) => void;
}

/**
 * The new items of a day, the same for the « Ajouter » of « Ma journée » and the one of the header there: a task opened
 * and due that day, an event all day that day, a routine done the first time that day (a past day too). Without a day,
 * the new items as anywhere else.
 * @param {TaskContext | null} context Task context (null while loading: nothing opens).
 * @returns {DayAdd} Openers.
 */
export function useDayAdd(context: TaskContext | null): DayAdd {
  const { data: calendarsData } = useCalendars();
  const taskActions = useTaskActions(context);
  const openEvent = useEventForm(context);
  return {
    // eslint-disable-next-line no-restricted-syntax -- the day prefill itself.
    task: (on, defaults) => taskActions.create(on ? { ...defaults, minDate: on.day, deadline: on.day } : defaults),
    event: (on, defaults) =>
      openEvent({
        defaults: on ? { ...defaults, ...newEventDefaults(calendarsData?.calendars ?? [], new Set(on.hiddenCalendarIds), { startDate: on.day, endDate: on.day }) } : defaults,
      }),
    // eslint-disable-next-line no-restricted-syntax -- the day prefill itself.
    routine: (on, defaults) => openRoutineForm(on ? { ...defaults, startDate: on.day } : { ...defaults }),
  };
}
