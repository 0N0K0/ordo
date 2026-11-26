import { itemWindowsOn, readSlotCondition, routineDayEntries } from '@ordo/shared';
import { useMemo } from 'react';
import { useToday } from '../../../lib/use-now';
import { useSlotRules } from '../../calendar/hooks/use-slot-rules';
import { useRoutineOccurrences, useRoutinesData } from '../api';

/** Times of the day of the routines on a day: how many it shows, how many are done that day. */
export interface RoutineDayCount {
  /** Times of the day shown that day (cancelled ones aside). */
  shown: number;
  /** Those done that day. */
  done: number;
  loading: boolean;
}

/**
 * Times of the day of the routines on a day (the badge of the menu), the very ones « Ma journée » lists
 * (`routineDayEntries`: each one done that day, each one not done yet open that day, today the late ones within the
 * hours allowed today; neither archived routines nor parent routines, seen through their sub-routines), its filters
 * aside, cancelled occurrences not counted; and how many are done.
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {RoutineDayCount} Counts.
 */
export function useRoutineDayCount(day: string): RoutineDayCount {
  const { data: routinesData } = useRoutinesData();
  const { data: occurrences, isPending } = useRoutineOccurrences({ from: day, to: day, doneInPeriod: true });
  const { slotsOn } = useSlotRules();
  const today = useToday();
  return useMemo(() => {
    const slots = routineDayEntries(routinesData?.routines ?? [], occurrences ?? [], day, {
      today,
      allowedToday: (routine) => itemWindowsOn(readSlotCondition(routine.slotCondition), slotsOn, today),
    }).filter((entry) => !entry.occurrence.cancelled);
    return { shown: slots.length, done: slots.filter((entry) => entry.slot.doneAt).length, loading: isPending || !routinesData };
  }, [routinesData, occurrences, day, today, slotsOn, isPending]);
}
