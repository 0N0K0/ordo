import { readSlotCondition, routineHasHours, type RoutineCase, type RoutineSlot } from '@ordo/shared';

/** Fields of a routine as GraphQL gives them, that tell whether it has hours. */
export interface RoutineHoursFields {
  fromTime?: string | null;
  dueTime?: string | null;
  moments?: unknown;
  slotCondition?: unknown;
  cases?: unknown;
}

/**
 * Whether a routine as GraphQL gives it has hours (`routineHasHours` on its stored fields): with none, its reminders are
 * at a time of the day only (its reminders cell, the panel of its reminders).
 * @param {RoutineHoursFields} routine Routine.
 * @returns {boolean} It has some.
 */
export function routineHasHoursOf(routine: RoutineHoursFields): boolean {
  return routineHasHours({
    fromTime: routine.fromTime,
    dueTime: routine.dueTime,
    moments: (routine.moments as RoutineSlot[] | null | undefined) ?? [],
    slotCondition: readSlotCondition(routine.slotCondition),
    cases: (routine.cases as RoutineCase[] | null | undefined) ?? [],
  });
}
