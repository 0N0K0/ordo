import { routineGroupStatesOn, type RoutineGroupState } from '@ordo/shared';
import { useMemo } from 'react';
import { useRoutineOccurrences, useRoutinesData } from '../api';

/**
 * State on a day of each parent routine (a group) present that day, read from its sub-routines due that day
 * (`routineGroupStatesOn`): the routines table shows today's.
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {Map<string, RoutineGroupState>} States, by routine id (none while loading).
 */
export function useRoutineGroupStates(day: string): Map<string, RoutineGroupState> {
  const { data } = useRoutinesData();
  const { data: occurrences } = useRoutineOccurrences({ from: day, to: day, doneInPeriod: true });
  return useMemo(() => routineGroupStatesOn(data?.routines ?? [], occurrences ?? [], day), [data, occurrences, day]);
}
