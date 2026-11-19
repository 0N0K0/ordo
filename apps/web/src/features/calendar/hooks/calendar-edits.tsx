import { openFormPanel } from '../../../components/panels/panels';
import { changedScheduleSlot, type ScheduleSlotTime, type WorkScheduleRule } from '@ordo/shared';
import { notifyFailure, notifySuccess, notifyWithUndo, ON_ERROR, onMutationError, toastCallbacks } from '../../../lib/notify';
import { useRoutineMutations, type Routine } from '../../routines/api';
import * as fmt from '../../../lib/format';
import { useWorkScheduleMutations } from '../api';
import { askScope } from '../lib/ask-scope';
import { RoutineOccurrenceForm, SlotEditForm } from '../components/CalendarEditForms';

/** Time of the day of a routine occurrence shown in the calendar. */
interface RoutineSlotTimes {
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
    const scope = await askScope({ action: change ? 'update' : 'delete', title: change ? 'Modifier un créneau récurrent' : 'Supprimer un créneau récurrent' });
    if (!scope) return revert?.();
    let next: ReturnType<typeof changedScheduleSlot>;
    try {
      next = changedScheduleSlot(schedule, slot, change, scope);
    } catch (error) {
      notifyFailure(error, 'Changement impossible.');
      return revert?.();
    }
    update.mutate(
      { id: schedule.id, input: { label: schedule.label, startDate: schedule.startDate, endDate: schedule.endDate, typeId: schedule.typeId ?? null, ...next } },
      {
        ...toastCallbacks(scope === 'THIS' ? 'Exception ajoutée au créneau pour ce jour.' : change ? 'Créneau modifié.' : 'Horaires retirés du créneau.'),
        onError: (error) => {
          onMutationError(error);
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
    const scope = await askScope({ action: 'update', title: 'Modifier une routine', allowFollowing: true, allowAll: true });
    if (!scope) return revert?.();
    changeOccurrence.mutate(
      { id: routine.id, date, scope, to, slot: slot.index, ...times },
      {
        ...toastCallbacks(scope === 'THIS' ? `Exception ajoutée : « ${routine.label} » le ${fmt.dayLong(to)}, la règle ne change pas.` : `« ${routine.label} » modifiée.`),
        onError: (error) => {
          onMutationError(error);
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
    const scope = await askScope({ action: 'delete', title: 'Supprimer une occurrence de routine', allowFollowing: true, allowAll: false });
    if (!scope) return;
    deleteOccurrence.mutate(
      { id: routine.id, date, scope },
      {
        onError: onMutationError,
        onSuccess: (archived) => {
          if (archived) notifySuccess(`Plus aucune occurrence : « ${routine.label} » est archivée.`);
          else if (scope === 'THIS') notifyWithUndo(`Occurrence du ${fmt.dayLong(date)} supprimée.`, () => removeMove.mutate({ id: routine.id, from: movedFrom ?? date }, ON_ERROR));
          else notifySuccess(`« ${routine.label} » s’arrête avant le ${fmt.dayLong(date)}.`);
        },
      },
    );
  };

  /**
   * Opens the form of a slot of a schedule.
   * @param {WorkScheduleRule} schedule Schedule.
   * @param {string} label Label shown (its kind).
   * @param {ScheduleSlotTime} slot Slot.
   * @returns {void}
   */
  const openSlot = (schedule: WorkScheduleRule, label: string, slot: ScheduleSlotTime) => {
    // The scope question is a modal: this panel closes first.
    openFormPanel(`Créneau du ${fmt.dayLong(slot.date)}`, (close) => (
      <SlotEditForm
        label={label}
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
    ));
  };

  /**
   * Opens the form of an occurrence of a routine.
   * @param {RoutineOccurrenceRef} occurrence Occurrence.
   * @param {string | null} movedFrom Day of the rule it was moved from, if any.
   * @returns {void}
   */
  const openRoutine = (occurrence: RoutineOccurrenceRef, movedFrom: string | null) => {
    openFormPanel(`« ${occurrence.routine.label} » du ${fmt.dayLong(occurrence.date)}`, (close) => (
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
    ));
  };

  return { changeSlot, changeRoutine, openSlot, openRoutine };
}
