import { routineSlotShownOn } from '@ordo/shared';
import { useMemo } from 'react';
import { unarchived } from '../../../lib/archive';
import { useRoutineOccurrences, useRoutinesData } from '../api';

/** Times of the day of the routines on a day: how many it shows, how many are done that day. */
export interface RoutineDayCount {
  /** Times of the day shown that day. */
  shown: number;
  /** Those done that day. */
  done: number;
  loading: boolean;
}

/**
 * Times of the day of the routines on a day (the badge of the menu): each one done that day (on the day it was ticked,
 * whichever its due day) and each one not done yet open that day (`routineSlotShownOn`), cancelled occurrences left
 * out, by the rule « Ma journée » places them with (without its late routines of today nor its cancelled ones);
 * neither those of an archived routine nor those of a routine that has
 * sub-routines (ticked with them: theirs count); and how many are done.
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {RoutineDayCount} Counts.
 */
export function useRoutineDayCount(day: string): RoutineDayCount {
  const { data: routinesData } = useRoutinesData();
  const { data: occurrences, isPending } = useRoutineOccurrences({ from: day, to: day, doneInPeriod: true });
  return useMemo(() => {
    const counted = new Set(unarchived(routinesData?.routines ?? []).filter((routine) => !routine.tickedWithSubRoutines).map((routine) => routine.id));
    const slots = unarchived(occurrences ?? [], null, (occurrence) => occurrence.date)
      .filter((occurrence) => counted.has(occurrence.routineId))
      .flatMap((occurrence) => occurrence.slots.filter((slot) => routineSlotShownOn(occurrence, slot.doneAt ?? null, day)));
    return { shown: slots.length, done: slots.filter((slot) => slot.doneAt).length, loading: isPending };
  }, [routinesData, occurrences, day, isPending]);
}
