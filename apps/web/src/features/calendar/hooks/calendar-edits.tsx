import { openFormPanel } from '../../../components/panels/panels';
import { changedScheduleSlot, slotWords, type ScheduleSlotTime, type WorkScheduleRule } from '@ordo/shared';
import { notifyFailure, notifySuccess, notifyWithUndo, ON_ERROR, onMutationError, toastCallbacks } from '../../../lib/notify';
import { useRoutineMutations, type Routine } from '../../routines/api';
import * as fmt from '../../../lib/format';
import { ruleScheduleInput, useWorkScheduleMutations, type CalendarEventScope } from '../api';
import { askScope } from '../lib/ask-scope';
import { fetchLostOnDelete } from '../../time/api';
import { scopeLostNote } from '../../time/lib/lost-on-delete';
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
  /** Day that identifies it (its ticks, comments, changes): its due day, or the day of its rule when moved and kept apart. */
  date: string;
  /** Its due day (the day it shows on once past). */
  dueDate: string;
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
  const { changeOccurrence, deleteOccurrence, removeMove } = useRoutineMutations();

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
    const scope = wholePeriod ? 'ALL' : await askScope({ action: change ? 'update' : 'delete', title: `${change ? 'Modifier' : 'Supprimer'} ${words.recurring}` });
    if (!scope) return revert?.();
    let next: ReturnType<typeof changedScheduleSlot>;
    try {
      next = changedScheduleSlot(schedule, slot, change, scope);
    } catch (error) {
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
   * Cancels an occurrence of a routine (it stays shown struck through, with its comments), or deletes it and
   * the following ones, telling the comments deleted with them; « Annuler » gives a single occurrence back.
   * @param {RoutineOccurrenceRef} occurrence Occurrence.
   * @param {string | null} movedFrom Day of the rule it was moved from, if any.
   * @returns {Promise<void>}
   */
  const removeRoutine = async (occurrence: RoutineOccurrenceRef, movedFrom: string | null) => {
    const { routine, date, dueDate } = occurrence;
    const [THIS, FOLLOWING] = await Promise.all((['THIS', 'FOLLOWING'] as const).map((scope) => fetchLostOnDelete({ routineOccurrence: { id: routine.id, date, scope } })));
    // This one is cancelled (it stays, struck through), it and the following ones really disappear.
    const scope = await askScope({
      action: 'cancelOrDelete',
      title: 'Annuler ou supprimer une occurrence de routine',
      allowFollowing: true,
      allowAll: false,
      note: scopeLostNote({ THIS, FOLLOWING }),
    });
    if (!scope) return;
    deleteOccurrence.mutate(
      { id: routine.id, date, scope },
      {
        onError: onMutationError,
        onSuccess: ({ archived, comments }) => {
          if (archived) notifySuccess(`Plus aucune occurrence : « ${routine.label} » est archivée.`);
          // « Annuler » gives the occurrence back as it was before (its day, kept apart, its times), with its comments.
          else if (scope === 'THIS') notifyWithUndo(`Occurrence du ${fmt.dayLong(dueDate)} annulée.`, () => removeMove.mutate({ id: routine.id, from: movedFrom ?? date, comments, undo: true }, ON_ERROR));
          else notifySuccess(`« ${routine.label} » s’arrête avant le ${fmt.dayLong(dueDate)}.`);
        },
      },
    );
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
    const scope = await askScope({ action: 'update', title: `Modifier ${words.recurring}`, note: 'Les modifications faites dans le panneau, chacune enregistrée aussitôt, s’y appliqueront.' });
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
        : await askScope({ action: 'update', title: 'Modifier une routine', note: 'Les modifications faites dans le panneau, chacune enregistrée aussitôt, s’y appliqueront.' });
    openFormPanel(`« ${occurrence.routine.label} » du ${fmt.dayLong(occurrence.dueDate)}`, (close) => (
      <RoutineOccurrenceForm
        occurrence={occurrence}
        movedFrom={movedFrom}
        scope={scope}
        onClose={close}
        onDelete={() => {
          close();
          void removeRoutine(occurrence, movedFrom);
        }}
        onRestore={() => {
          close();
          // As before its cancel (its day, kept apart, its times), as « Annuler » of the cancel does.
          removeMove.mutate({ id: occurrence.routine.id, from: occurrence.date, undo: true }, toastCallbacks(`Occurrence du ${fmt.dayLong(occurrence.date)} rétablie.`));
        }}
      />
    ));
  };

  return { changeSlot, changeRoutine, openSlot, openRoutine };
}
