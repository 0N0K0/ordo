import { openFormPanel } from '../../../components/panels/panels';
import { changedScheduleSlot, scheduleFollowingOffered, slotWords, UserError, type ScheduleSlotTime, type WorkScheduleRule } from '@ordo/shared';
import { notifyError, notifyFailure, onMutationError, toastCallbacks } from '../../../lib/notify';
import { useRoutineMutations, type Routine } from '../../routines/api';
import * as fmt from '../../../lib/format';
import { ruleScheduleInput, useWorkScheduleMutations, type CalendarEventScope } from '../api';
import { askScope } from '../../../components/recurrence/ask-scope';
import { withMovedRuleChoice } from '../../../components/recurrence/ask-moved-rule';
import { fetchLostOnDelete } from '../../time/api';
import { scopeLostNote } from '../../time/lib/lost-on-delete';
import { RoutineOccurrenceForm, SlotEditForm } from '../components/CalendarEditForms';
import { INHERITED_SKIP_REFUSAL, routineFollowingOffered, skippedRepetition } from '../../routines/lib/skipped-repetition';
import { useRoutineRowsActions } from '../../routines/components/RoutineBulkBar';
import { useDeleteSchedules } from './use-delete-schedules';
import { runAction } from '../../../components/data-table/selection/selection-actions';
import { useCancelOccurrence } from '../../routines/hooks/use-cancel-occurrence';

/** Time of the day of a routine occurrence shown in the calendar. */
interface RoutineSlotTimes {
  index: number;
  fromTime: string | null;
  dueTime: string | null;
}

/** Occurrence of a routine shown in the calendar: its day now, and one of its times of the day. */
export interface RoutineOccurrenceRef {
  routine: Routine;
  /** Day that identifies it (its ticks, comments, changes): its due day, or the day of its rule when moved and kept apart. */
  date: string;
  /** Its real due day (the day it shows on once past). */
  dueDate: string;
  /** Its due day by its rule (or the day it was moved to): what a change keeping its day sends. Optional. Default = `dueDate`. */
  ruleDueDate?: string;
  /** Day it shows on (its due day once past, today while it runs, its first day before): a drag moves it from there. Optional. Default = its due day. */
  shownDate?: string;
  slot: RoutineSlotTimes;
  /** Cancelled (shown struck through): only given back. Optional. Default = false. */
  cancelled?: boolean;
  /** Of an archived routine, before its archiving: read only. Optional. Default = false. */
  archived?: boolean;
}

/**
 * Changes of the slots of the schedules and of the occurrences of the routines from the calendar, as those of the
 * recurring events: each asks whether it is an exception (this occurrence), applies to it and the following ones, or
 * to all of them.
 * @returns {object} Changers and form openers.
 */
export function useCalendarEdits() {
  const { update } = useWorkScheduleMutations();
  const { changeOccurrence, deleteOccurrence, patch } = useRoutineMutations();
  const cancelOccurrence = useCancelOccurrence();
  const routineRowsActions = useRoutineRowsActions();
  const deleteSchedules = useDeleteSchedules();

  /**
   * Moves, stretches or deletes (no change) a slot of a schedule (a créneau or an éphéméride: its own words); an
   * éphéméride of a single day moved to another day moves with its period without asking the scope.
   * @param {WorkScheduleRule} schedule Schedule.
   * @param {ScheduleSlotTime} slot Slot.
   * @param {ScheduleSlotTime | null} change New day and hours, or null: deleted.
   * @param {() => void} [revert] Puts the slot back in the calendar (cancelled or failed). Optional.
   * @returns {Promise<void>}
   */
  const changeSlot = async (schedule: WorkScheduleRule, slot: ScheduleSlotTime, change: ScheduleSlotTime | null, revert?: () => void) => {
    const words = slotWords(schedule.ephemeris);
    // An éphéméride of a single day moved to another day moves with its period: nothing to choose.
    const wholePeriod = schedule.ephemeris && schedule.startDate === schedule.endDate && change && change.date !== slot.date;
    const scope = wholePeriod
      ? 'ALL'
      : await askScope({ action: change ? 'update' : 'delete', allowFollowing: scheduleFollowingOffered(schedule, slot), title: `${change ? 'Modifier' : 'Supprimer'} ${words.recurring}` });
    if (!scope) return revert?.();
    let next: ReturnType<typeof changedScheduleSlot>;
    try {
      // A case on the last day of the month moved to another day: its new rule is asked first (given up: put back).
      next = await withMovedRuleChoice((movedRule) => changedScheduleSlot(schedule, slot, change, scope, movedRule));
    } catch (error) {
      // Its last case deleted (« Toutes », or « Celle-ci et les suivantes » from its first day): the schedule itself goes,
      // after its usual confirmation (a schedule has a case at least); never archived.
      if (!change && error instanceof UserError && error.message === words.lastHours) return runAction(deleteSchedules([schedule]));
      notifyFailure(error, 'Changement impossible.');
      return revert?.();
    }
    update.mutate(
      { id: schedule.id, input: ruleScheduleInput(schedule, next) },
      {
        ...toastCallbacks(scope === 'THIS' ? `Exception ajoutée ${words.to} pour ce jour.` : change ? words.changed : `Horaires retirés ${words.of}.`),
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
   * @param {string | null} [movedFrom] Day of the rule it was moved from, if any (« Celle-ci et les suivantes » is judged on the day of its rule). Optional.
   * @returns {Promise<void>}
   */
  const changeRoutine = async (occurrence: RoutineOccurrenceRef, to: string, times: { fromTime: string | null; dueTime: string | null }, revert?: () => void, movedFrom: string | null = null) => {
    const { routine, date, slot } = occurrence;
    const scope = await askScope({ action: 'update', title: 'Modifier une routine', allowFollowing: routineFollowingOffered(routine, movedFrom ?? date), allowAll: true });
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
   * Deletes an occurrence of a routine, asking which ones: this one (a « rien » exception on the day of its rule, on
   * every case that has that day: its comments, checklist and links go, once confirmed), it and the following ones
   * (the repetition stops before it, the previous ones untouched; not offered on its last one), or all of them; all,
   * or it and the following ones from its first one, delete the routine itself (its usual confirmation: its
   * sub-routines, what is lost), never archive it.
   * @param {RoutineOccurrenceRef} occurrence Occurrence.
   * @param {string | null} movedFrom Day of the rule it was moved from, if any.
   * @returns {Promise<void>}
   */
  const deleteRoutine = async (occurrence: RoutineOccurrenceRef, movedFrom: string | null) => {
    const { routine, date, dueDate } = occurrence;
    const ruleDay = movedFrom ?? date;
    const following = routineFollowingOffered(routine, ruleDay);
    const FOLLOWING = following ? await fetchLostOnDelete({ routineOccurrence: { id: routine.id, date, scope: 'FOLLOWING' } }) : undefined;
    const scope = await askScope({ action: 'delete', title: 'Supprimer une occurrence de routine', allowFollowing: following, note: FOLLOWING && scopeLostNote({ FOLLOWING }) });
    if (!scope) return;
    if (scope === 'THIS') {
      const input = skippedRepetition(routine, ruleDay);
      if (!input) return notifyError(INHERITED_SKIP_REFUSAL);
      patch.mutate({ id: routine.id, input }, toastCallbacks(`Occurrence du ${fmt.dayLong(dueDate)} supprimée.`));
      return;
    }
    // All of them, or from its first one: the routine itself (as « Supprimer la routine »).
    if (scope === 'ALL' || !routine.firstDate || ruleDay <= routine.firstDate) {
      runAction(routineRowsActions([routine]).remove);
      return;
    }
    deleteOccurrence.mutate({ id: routine.id, date, scope }, toastCallbacks(`« ${routine.label} » s’arrête avant le ${fmt.dayLong(dueDate)}.`));
  };

  /**
   * Opens the panel of a slot of a schedule (a créneau or an éphéméride), saved field by field: asks first, once,
   * which days its changes apply to (dismissed: it opens read only).
   * @param {WorkScheduleRule} schedule Schedule.
   * @param {string} label Label shown (its kind).
   * @param {ScheduleSlotTime} slot Slot.
   * @returns {Promise<void>}
   */
  const openSlot = async (schedule: WorkScheduleRule, label: string, slot: ScheduleSlotTime) => {
    // Dismissed: no scope, the panel opens read only.
    const words = slotWords(schedule.ephemeris);
    const scope = await askScope({ action: 'update', allowFollowing: scheduleFollowingOffered(schedule, slot), title: `Modifier ${words.recurring}`, note: 'Les modifications faites dans le panneau, chacune enregistrée aussitôt, s’y appliqueront.' });
    openFormPanel(`${words.title} du ${fmt.dayLong(slot.date)}`, (close) => (
      <SlotEditForm
        label={label}
        schedule={schedule}
        slot={slot}
        scope={scope}
        onClose={close}
        onDelete={(current, now) => {
          close();
          void changeSlot(current, now, null);
        }}
      />
    ));
  };

  /**
   * Opens the panel of an occurrence of a routine, saved field by field: asks first, once, which
   * occurrences its changes apply to (dismissed: it opens read only); a cancelled occurrence, or one of an archived
   * routine, opens without asking.
   * @param {RoutineOccurrenceRef} occurrence Occurrence.
   * @param {string | null} movedFrom Day of the rule it was moved from, if any.
   * @returns {Promise<void>}
   */
  const openRoutine = async (occurrence: RoutineOccurrenceRef, movedFrom: string | null) => {
    // Dismissed: no scope, the panel opens read only.
    const scope: CalendarEventScope | null =
      occurrence.cancelled || occurrence.archived
        ? 'THIS'
        : await askScope({ action: 'update', title: 'Modifier une routine', allowFollowing: routineFollowingOffered(occurrence.routine, movedFrom ?? occurrence.date), note: 'Les modifications faites dans le panneau, chacune enregistrée aussitôt, s’y appliqueront.' });
    openFormPanel(`« ${occurrence.routine.label} » du ${fmt.dayLong(occurrence.dueDate)}`, (close) => (
      <RoutineOccurrenceForm
        occurrence={occurrence}
        movedFrom={movedFrom}
        scope={scope}
        onClose={close}
        onCancel={() => {
          close();
          cancelOccurrence.cancel({ routineId: occurrence.routine.id, date: occurrence.date, dueDate: occurrence.dueDate, movedFrom });
        }}
        onDelete={() => {
          close();
          void deleteRoutine(occurrence, movedFrom);
        }}
        onRestore={() => {
          close();
          // As before its cancel (its day, kept apart, its times), as « Annuler » of the cancel does.
          cancelOccurrence.restore({ routineId: occurrence.routine.id, date: occurrence.date, dueDate: occurrence.dueDate });
        }}
      />
    ));
  };

  return { changeSlot, changeRoutine, openSlot, openRoutine };
}
