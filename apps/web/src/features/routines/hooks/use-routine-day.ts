import { inRoutineHistoryOn, joinedKey, mapById } from '@ordo/shared';
import { useMemo } from 'react';
import { useRoutineOccurrences, useRoutinesData, type Routine, type RoutineOccurrence } from '../api';
import type { HistoryItem } from '../components/RoutineDayAgenda';
import { collator } from '../../../lib/text';

/**
 * What a day of the history holds: each time of the day of the routines done that day (on the day it was ticked,
 * whichever its due day), and each one not done yet open that day (on every day from its first day to its due day,
 * `inRoutineHistoryOn`); two occurrences of a routine that day, one moved there and kept apart, each with its own;
 * by time of the day, then by title.
 * @param {string} day Day (YYYY-MM-DD).
 * @param {RoutineOccurrence[]} occurrences Occurrences open that day, and those with a time of the day done that day.
 * @param {Map<string, Routine>} byId Routines by id.
 * @returns {HistoryItem[]} Items.
 */
function historyItems(day: string, occurrences: RoutineOccurrence[], byId: Map<string, Routine>): HistoryItem[] {
  const items: HistoryItem[] = occurrences.flatMap((occurrence) =>
    occurrence.slots
      .filter((slot) => inRoutineHistoryOn(occurrence, slot.doneAt ?? null, day))
      .map((slot) => ({
        key: joinedKey(occurrence.routineId, occurrence.date, slot.index),
        routineId: occurrence.routineId,
        date: occurrence.date,
        dueDate: occurrence.dueDate,
        startDate: occurrence.startDate,
        slot: slot.index,
        fromTime: slot.fromTime,
        dueTime: slot.dueTime,
        planned: occurrence.startDate <= day && day <= occurrence.dueDate,
        optional: slot.optional,
        movedFrom: occurrence.movedFrom,
        doneAt: slot.doneAt ?? null,
      })),
  );
  const timeOf = (item: HistoryItem) => item.fromTime ?? item.dueTime ?? '99:99';
  return items.sort((a, b) => timeOf(a).localeCompare(timeOf(b)) || collator.compare(byId.get(a.routineId)?.label ?? '', byId.get(b.routineId)?.label ?? ''));
}

/** Routines of a day: what was done that day and what was still to do. */
export interface RoutineDay {
  /** Routines of the workspace. */
  routines: Routine[];
  byId: Map<string, Routine>;
  /** Each time of the day of the history of that day, by time of the day then title. */
  items: HistoryItem[];
  /** How many of them are done (that day). */
  doneCount: number;
  loading: boolean;
}

/**
 * Routines of a day (« Historique » tab, navigation badge): each time of the day done that day, and each one not done
 * yet open that day (cancelled occurrences left out), for every routine or for one, and how many are done.
 * @param {string} day Day.
 * @param {string | null} [routineId] Routine alone, or null for all. Optional. Default = null.
 * @returns {RoutineDay} Day.
 */
export function useRoutineDay(day: string, routineId: string | null = null): RoutineDay {
  const { data: routinesData } = useRoutinesData();
  const { data: occurrences, isPending } = useRoutineOccurrences({
    from: day,
    to: day,
    doneInPeriod: true,
  });
  return useMemo(() => {
    const routines = routinesData?.routines ?? [];
    const byId = mapById(routines);
    const items = historyItems(
      day,
      (occurrences ?? []).filter((occurrence) => !routineId || occurrence.routineId === routineId),
      byId,
    );
    return {
      routines,
      byId,
      items,
      doneCount: items.filter((item) => item.doneAt).length,
      loading: isPending,
    };
  }, [routinesData, occurrences, day, routineId, isPending]);
}
