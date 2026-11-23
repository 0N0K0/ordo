import { joinedKey, mapById } from '@ordo/shared';
import { useMemo } from 'react';
import { useRoutineChecks, useRoutineOccurrences, useRoutinesData, type Routine, type RoutineCheck, type RoutineOccurrence } from '../api';
import type { HistoryItem } from '../components/RoutineDayAgenda';
import { collator } from '../../../lib/text';

/**
 * What a day held: each time of the day planned for the routines that day (done or not, with its tick; two
 * occurrences of a routine that day, one moved there and kept apart, each with its own); nothing else (not a late
 * occurrence of another day); by time of the day, then by title.
 * @param {RoutineOccurrence[]} occurrences Occurrences of the day.
 * @param {RoutineCheck[]} checks Ticks of those occurrences (by the day that identifies each).
 * @param {Map<string, Routine>} byId Routines by id.
 * @returns {HistoryItem[]} Items.
 */
function historyItems(occurrences: RoutineOccurrence[], checks: RoutineCheck[], byId: Map<string, Routine>): HistoryItem[] {
  const tickOf = new Map(checks.map((check) => [joinedKey(check.routineId, check.date, check.slot), check]));
  const items: HistoryItem[] = occurrences.flatMap((occurrence) =>
    occurrence.slots.map((slot) => ({
      key: joinedKey(occurrence.routineId, occurrence.date, slot.index),
      routineId: occurrence.routineId,
      date: occurrence.date,
      dueDate: occurrence.dueDate,
      startDate: occurrence.startDate,
      slot: slot.index,
      fromTime: slot.fromTime,
      dueTime: slot.dueTime,
      planned: true,
      optional: slot.optional,
      movedFrom: occurrence.movedFrom,
      check: tickOf.get(joinedKey(occurrence.routineId, occurrence.date, slot.index)),
    })),
  );
  const timeOf = (item: HistoryItem) => item.fromTime ?? item.dueTime ?? '99:99';
  return items.sort((a, b) => timeOf(a).localeCompare(timeOf(b)) || collator.compare(byId.get(a.routineId)?.label ?? '', byId.get(b.routineId)?.label ?? ''));
}

/** Routines of a day: what was planned and what is ticked. */
export interface RoutineDay {
  /** Routines of the workspace. */
  routines: Routine[];
  byId: Map<string, Routine>;
  /** Each time of the day planned that day, by time of the day then title. */
  items: HistoryItem[];
  /** How many of them are ticked. */
  doneCount: number;
  loading: boolean;
}

/**
 * Routines of a day (« Historique » tab, navigation badge): each time of the day planned that day (cancelled
 * occurrences left out), for every routine or for one, and how many are ticked.
 * @param {string} day Day.
 * @param {string | null} [routineId] Routine alone, or null for all. Optional. Default = null.
 * @returns {RoutineDay} Day.
 */
export function useRoutineDay(day: string, routineId: string | null = null): RoutineDay {
  const { data: routinesData } = useRoutinesData();
  const { data: occurrences, isPending: occurrencesPending } = useRoutineOccurrences({ from: day, to: day });
  // Due that day: an occurrence moved there and kept apart is identified (ticked) by the day of its rule.
  const ofDay = useMemo(
    () => (occurrences ?? []).filter((occurrence) => occurrence.dueDate === day && !occurrence.cancelled && (!routineId || occurrence.routineId === routineId)),
    [occurrences, day, routineId],
  );
  const first = ofDay.reduce((earliest, occurrence) => (occurrence.date < earliest ? occurrence.date : earliest), day);
  const { data: checks, isPending } = useRoutineChecks(first, day);
  return useMemo(() => {
    const routines = routinesData?.routines ?? [];
    const byId = mapById(routines);
    const keys = new Set(ofDay.map((occurrence) => joinedKey(occurrence.routineId, occurrence.date)));
    // A cancelled occurrence is not planned (struck through in the calendar).
    const items = historyItems(
      ofDay,
      (checks ?? []).filter((check) => keys.has(joinedKey(check.routineId, check.date))),
      byId,
    );
    return { routines, byId, items, doneCount: items.filter((item) => item.check).length, loading: isPending || occurrencesPending };
  }, [routinesData, checks, ofDay, isPending, occurrencesPending]);
}
