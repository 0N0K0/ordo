import { anyOccurrenceAfter, marksInherited, readOpens, storedRecurrence, type RoutineCase, type RoutineInheritableField } from '@ordo/shared';
import { withSkippedOn } from '../../../components/recurrence/exceptions';
import type { Routine, RoutinePatchValues } from '../api';
import { DAILY } from './routine-format';

/** Refusal of « Supprimer » « Cette occurrence » on a sub-routine that goes by the repetition of its parent. */
export const INHERITED_SKIP_REFUSAL = 'Cette routine suit la répétition de sa parente : supprimez l’occurrence depuis la parente, ou annulez-la.';

/**
 * Repetition of a routine with a « rien » exception on a day of its rule (« Supprimer » « Cette occurrence »): given
 * to its rule, or to every case that has that day (each counted from its « Début », else from its first time). A
 * sub-routine going by the repetition of its parent has none of its own to change: null.
 * @param {Routine} routine Routine.
 * @param {string} day Day of the rule of the occurrence.
 * @returns {RoutinePatchValues | null} Change to save (`patch`), null for a repetition inherited.
 */
export function skippedRepetition(routine: Routine, day: string): RoutinePatchValues | null {
  if (marksInherited({ parentId: routine.parentId, inheritedFields: routine.inheritedFields as RoutineInheritableField[] }, 'RECURRENCE')) return null;
  const { effective } = routine;
  const rule = (effective.recurrence as RoutinePatchValues['recurrence'] | null) ?? DAILY;
  const startDate = effective.startDate ?? routine.startDate;
  const cases = ((effective.cases as RoutineCase[] | null) ?? []).map((item) => ({ ...item, opens: readOpens(item.opens) }));
  if (!cases.length) return { recurrence: withSkippedOn([{ rule, start: startDate }], day)[0] ?? rule };
  const rules = withSkippedOn(
    cases.map((item) => ({ rule: item.recurrence, start: item.from ?? startDate })),
    day,
  );
  return { recurrence: rule, cases: cases.map((item, index) => ({ ...item, recurrence: rules[index] ?? item.recurrence })) };
}

/**
 * Whether « Celle-ci et les suivantes » is offered for an occurrence of a routine: its rule, or one of its cases, has
 * an occurrence after it (never on its last one, `anyOccurrenceAfter`).
 * @param {Routine} routine Routine (its repetition as it goes: `effective`).
 * @param {string} day Day of the rule of the occurrence.
 * @returns {boolean} Offered.
 */
export function routineFollowingOffered(routine: Routine, day: string): boolean {
  const { effective } = routine;
  const startDate = effective.startDate ?? routine.startDate;
  const cases = (effective.cases as RoutineCase[] | null) ?? [];
  return anyOccurrenceAfter(cases.length ? cases.map((item) => ({ rule: item.recurrence, start: item.from ?? startDate })) : [{ rule: storedRecurrence(effective.recurrence), start: startDate }], day);
}
