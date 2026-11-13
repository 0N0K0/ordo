import { closePanel, openPanel } from '../../components/panels/panels';
import { changedScheduleSlot, type ScheduleSlotTime, type WorkScheduleRule } from '@ordo/shared';
import { notifyError, notifySuccess, notifyWithUndo } from '../../lib/notify';
import { useRoutineMutations, type Routine } from '../routines/api';
import { longDay } from '../routines/use-routine-move';
import { useWorkScheduleMutations } from './api';
import { askScope } from './ask-scope';
import { RoutineOccurrenceForm, SlotEditForm } from './CalendarEditForms';

let modalCount = 0;

/** Time of the day of a routine occurrence shown in the calendar. */
export interface RoutineSlotTimes {
  index: number;
  fromTime: string | null;
  dueTime: string | null;
}

/** Occurrence of a routine shown in the calendar: its day now, and one of its times of the day. */
export interface RoutineOccurrenceRef {
  routine: Routine;
  date: string;
  slot: RoutineSlotTimes;
}

/**
 * Whether a routine follows a calendar schedule (its days and times come from it: changed one occurrence at a time).
 * @param {Routine} routine Routine.
 * @returns {boolean} Follows a schedule.
 */
const followsSchedule = (routine: Routine) => Boolean(routine.scheduleId) && !((routine.cases as unknown[] | null) ?? []).length;

/**
 * Changes of the slots of the schedules and of the occurrences of the routines from the calendar, as those of the
 * recurring events: each asks whether it is an exception (this occurrence), applies to it and the following ones, or
 * to all of them.
 * @returns {object} Changers and form openers.
 */
export function useCalendarEdits() {
  const { update } = useWorkScheduleMutations();
  const { changeOccurrence, deleteOccurrence, removeMove } = useRoutineMutations();

  /**
   * Moves, stretches or deletes (no change) a slot of a schedule.
   * @param {WorkScheduleRule} schedule Schedule.
   * @param {ScheduleSlotTime} slot Slot.
   * @param {ScheduleSlotTime | null} change New day and hours, or null: deleted.
   * @param {() => void} [revert] Puts the slot back in the calendar (cancelled or failed). Optional.
   * @returns {Promise<void>}
   */
  const changeSlot = async (schedule: WorkScheduleRule, slot: ScheduleSlotTime, change: ScheduleSlotTime | null, revert?: () => void) => {
    const scope = await askScope({ action: change ? 'update' : 'delete', title: change ? 'Modifier une plage récurrente' : 'Supprimer une plage récurrente' });
    if (!scope) return revert?.();
    let next: ReturnType<typeof changedScheduleSlot>;
    try {
      next = changedScheduleSlot(schedule, slot, change, scope);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Changement impossible.');
      return revert?.();
    }
    update.mutate(
      { id: schedule.id, input: { name: schedule.name, startDate: schedule.startDate, endDate: schedule.endDate, typeId: schedule.typeId ?? null, ...next } },
      {
        onSuccess: () => notifySuccess(scope === 'THIS' ? 'Exception ajoutée à la plage pour ce jour.' : change ? 'Plage modifiée.' : 'Horaires retirés de la plage.'),
        onError: (error) => {
          notifyError(error.message);
          revert?.();
        },
      },
    );
  };

  /**
   * Changes the day and the times of one time of the day of an occurrence of a routine.
   * @param {RoutineOccurrenceRef} occurrence Occurrence.
   * @param {string} to New day.
   * @param {{ fromTime: string | null, dueTime: string | null }} times New times.
   * @param {() => void} [revert] Puts it back in the calendar (cancelled or failed). Optional.
   * @returns {Promise<void>}
   */
  const changeRoutine = async (occurrence: RoutineOccurrenceRef, to: string, times: { fromTime: string | null; dueTime: string | null }, revert?: () => void) => {
    const { routine, date, slot } = occurrence;
    const scope = await askScope({ action: 'update', title: 'Modifier une routine', allowFollowing: !followsSchedule(routine), allowAll: !followsSchedule(routine) });
    if (!scope) return revert?.();
    changeOccurrence.mutate(
      { id: routine.id, date, scope, to, slot: slot.index, ...times },
      {
        onSuccess: () => notifySuccess(scope === 'THIS' ? `Exception ajoutée : « ${routine.title} » le ${longDay(to)}, la règle ne change pas.` : `« ${routine.title} » modifiée.`),
        onError: (error) => {
          notifyError(error.message);
          revert?.();
        },
      },
    );
  };

  /**
   * Deletes an occurrence of a routine, or it and the following ones.
   * @param {RoutineOccurrenceRef} occurrence Occurrence.
   * @param {string | null} movedFrom Day of the rule it was moved from, if any.
   * @returns {Promise<void>}
   */
  const removeRoutine = async (occurrence: RoutineOccurrenceRef, movedFrom: string | null) => {
    const { routine, date } = occurrence;
    const scope = await askScope({ action: 'delete', title: 'Supprimer une occurrence de routine', allowFollowing: !followsSchedule(routine), allowAll: false });
    if (!scope) return;
    const onError = (error: Error) => notifyError(error.message);
    deleteOccurrence.mutate(
      { id: routine.id, date, scope },
      {
        onError,
        onSuccess: (archived) => {
          if (archived) notifySuccess(`Plus aucune occurrence : « ${routine.title} » est archivée.`);
          else if (scope === 'THIS') notifyWithUndo(`Occurrence du ${longDay(date)} supprimée.`, () => removeMove.mutate({ id: routine.id, from: movedFrom ?? date }, { onError }));
          else notifySuccess(`« ${routine.title} » s’arrête avant le ${longDay(date)}.`);
        },
      },
    );
  };

  /**
   * Opens the form of a slot of a schedule.
   * @param {WorkScheduleRule} schedule Schedule.
   * @param {string} name Name shown (its kind).
   * @param {ScheduleSlotTime} slot Slot.
   * @returns {void}
   */
  const openSlot = (schedule: WorkScheduleRule, name: string, slot: ScheduleSlotTime) => {
    const modalId = `slot-edit-${++modalCount}`;
    // The scope question is a modal: this panel closes first.
    const close = () => closePanel(modalId);
    openPanel({
      panelId: modalId,
      title: `Plage du ${longDay(slot.date)}`,
      children: (
        <SlotEditForm
          name={name}
          slot={slot}
          onClose={close}
          onSave={(change) => {
            close();
            void changeSlot(schedule, slot, change);
          }}
          onDelete={() => {
            close();
            void changeSlot(schedule, slot, null);
          }}
        />
      ),
    });
  };

  /**
   * Opens the form of an occurrence of a routine.
   * @param {RoutineOccurrenceRef} occurrence Occurrence.
   * @param {string | null} movedFrom Day of the rule it was moved from, if any.
   * @returns {void}
   */
  const openRoutine = (occurrence: RoutineOccurrenceRef, movedFrom: string | null) => {
    const modalId = `routine-occurrence-${++modalCount}`;
    const close = () => closePanel(modalId);
    openPanel({
      panelId: modalId,
      title: `« ${occurrence.routine.title} » du ${longDay(occurrence.date)}`,
      children: (
        <RoutineOccurrenceForm
          occurrence={occurrence}
          onClose={close}
          onSave={(to, times) => {
            close();
            void changeRoutine(occurrence, to, times);
          }}
          onDelete={() => {
            close();
            void removeRoutine(occurrence, movedFrom);
          }}
        />
      ),
    });
  };

  return { changeSlot, changeRoutine, openSlot, openRoutine };
}
