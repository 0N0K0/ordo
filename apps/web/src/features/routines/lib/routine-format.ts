import {
  byPosition,
  childrenByParent,
  DEFAULT_RECURRENCE,
  mapById,
  pathOf,
  type Recurrence,
  recurrenceSchema,
  type RoutineCase,
  type RoutineMove,
  routineSchedule,
  routineState,
  type RoutineState,
} from '@ordo/shared';
import { describeRecurrence } from '../../../components/recurrence/describe-recurrence';

import { treeOptions, type TreeOption } from '../../../components/tree/tree-select';
import type { Routine } from '../api';
import * as fmt from '../../../lib/format';

/** Rule of a new routine: every day. */
export const DAILY: Recurrence = { ...DEFAULT_RECURRENCE, frequency: 'DAILY' };

/**
 * Stored rule of a routine, or null when invalid.
 * @param {Routine} routine Routine.
 * @returns {Recurrence | null} Rule.
 */
export function ruleOf(routine: Routine): Recurrence | null {
  const parsed = recurrenceSchema.safeParse(routine.recurrence);
  return parsed.success ? parsed.data : null;
}

/**
 * Whether the current occurrence of a routine is ticked.
 * @param {Routine} routine Routine.
 * @returns {boolean} Done.
 */
export const isDone = (routine: Routine) => routine.done;

/**
 * State of a routine today: « à faire » only while its slots allow it now (« à venir » otherwise).
 * @param {Routine} routine Routine.
 * @param {string} today Today.
 * @param {boolean} [doable] Its slot rule allows now. Optional. Default = true.
 * @returns {RoutineState} State.
 */
export const currentRoutineState = (routine: Routine, today: string, doable = true): RoutineState => {
  const state = routineState(routine.currentDate, isDone(routine), today);
  return state === 'due' && !doable ? 'upcoming' : state;
};

/**
 * Options of a select of routines, as their tree (sub-routines under their parent, in manual order): those offered, and
 * their parents greyed out when not offered.
 * @param {readonly Routine[]} routines Routines.
 * @param {(routine: Routine) => boolean} [offered] Routines that can be chosen. Optional. Default = all.
 * @param {(routine: Routine) => string} [label] Name of a routine. Optional. Default = its title.
 * @returns {TreeOption[]} Options.
 */
export function routineTreeOptions(routines: readonly Routine[], offered: (routine: Routine) => boolean = () => true, label: (routine: Routine) => string = (routine) => routine.label): TreeOption[] {
  const byId = mapById(routines);
  return treeOptions(
    [...routines].sort(byPosition).map((routine) => ({ id: routine.id, parentId: routine.parentId ?? null, label: label(routine) })),
    (id) => {
      const routine = byId.get(id);
      return routine !== undefined && offered(routine);
    },
  );
}

/**
 * Full path of a routine: the titles of its parent routines, then its own (« Linge › Étendre »).
 * @param {Routine} routine Routine.
 * @param {ReadonlyMap<string, Routine>} byId Routines by id.
 * @returns {string} Path.
 */
export function routinePath(routine: Routine, byId: ReadonlyMap<string, Routine>): string {
  return pathOf(new Map([...byId, [routine.id, routine]]), routine.id, (item) => item.label);
}

/**
 * Required routines of a routine still to do for their current occurrence ("étendre le linge" waits for "laver le linge").
 * @param {Routine} routine Routine.
 * @param {Map<string, Routine>} byId Routines by id.
 * @returns {Routine[]} Routines it waits for.
 */
export function waitingFor(routine: Routine, byId: Map<string, Routine>): Routine[] {
  return routine.requiredIds.flatMap((id) => {
    const required = byId.get(id);
    return required && !required.archived && required.currentDate !== null && !isDone(required) ? [required] : [];
  });
}

/**
 * Time window of a routine on its current (or next) occurrence: its own times, or those of its calendar schedule.
 * @param {Routine} routine Routine.
 * @returns {{ fromTime: string | null, dueTime: string | null }} Window.
 */
export const windowOf = (routine: Routine) => ({ fromTime: routine.windowFrom, dueTime: routine.windowTo });

/**
 * When to leave and when back for a routine, from its window (its own or its schedule's), travel times and time to
 * spend on it.
 * @param {Routine} routine Routine.
 * @returns {{ leaveAt: string | null, backAt: string | null }} Times.
 */
export const scheduleOf = (routine: Routine) => routineSchedule({ ...routine, ...windowOf(routine) });

/**
 * Window as words: "8:20–8:30", "avant 8:30", "dès 16:30", "7:00–9:00 ou 17:00–20:00", or empty.
 * @param {{ fromTime: string | null, dueTime: string | null, windows?: unknown }} window Window, and the windows it can be done in.
 * @returns {string} Text.
 */
export function windowText({ fromTime, dueTime, windows }: { fromTime: string | null; dueTime: string | null; windows?: unknown }): string {
  // Several windows (free time cut by slots): each one, « or ».
  const parts = Array.isArray(windows) ? (windows as { fromTime: string | null; dueTime: string | null }[]) : [];
  if (parts.length > 1) return parts.map((part) => windowText(part)).join(' ou ');
  if (fromTime && dueTime) return `${fromTime}–${dueTime}`;
  if (dueTime) return `avant ${dueTime}`;
  return fromTime ? `dès ${fromTime}` : '';
}

/**
 * Repetition and times of a routine case in words: "Tous les jours · avant 08:00, 12:00–14:00, dès 20:00 (facultatif)".
 * @param {RoutineCase} item Case.
 * @param {string} start First date of the routine.
 * @returns {string} Description.
 */
export function describeRoutineCase(item: RoutineCase, start: string): string {
  const times = item.slots.map((slot) => `${windowText(slot) || 'dans la journée'}${slot.optional ? ' (facultatif)' : ''}`).join(', ');
  return `${describeRecurrence(item.recurrence, item.from && item.from > start ? item.from : start)} · ${times}${item.from && item.from > start ? ` · dès le ${fmt.day(item.from)}` : ''}`;
}

/**
 * Exceptions of a routine: occurrences moved to another day.
 * @param {Routine} routine Routine.
 * @returns {RoutineMove[]} Moves, by day of the rule.
 */
export const movesOf = (routine: Routine): RoutineMove[] => (routine.moves as RoutineMove[] | null) ?? [];

/**
 * Occurrence a move applies to: the current one while nothing of it is ticked, else the next one.
 * @param {Routine} routine Routine.
 * @returns {string | null} Day of the occurrence, null without any.
 */
export function movableOccurrence(routine: Routine): string | null {
  if (routine.currentDate && !routine.slots.some((slot) => slot.done)) return routine.currentDate;
  return routine.nextDate;
}

/**
 * Exception that brought an occurrence to its day from another one, if any.
 * @param {Routine} routine Routine.
 * @param {string | null} date Occurrence.
 * @returns {RoutineMove | undefined} Move.
 */
export const moveTo = (routine: Routine, date: string | null): (RoutineMove & { to: string }) | undefined =>
  date ? (movesOf(routine).find((move) => move.to === date && move.from !== date) as (RoutineMove & { to: string }) | undefined) : undefined;

/**
 * Manual order of the routines, as their list shows it: each under its parent routine, siblings by their position.
 * @param {readonly { id: string, parentId: string | null, position: number }[]} routines Routines.
 * @returns {Map<string, number>} Rank of each routine.
 */
export function manualOrder(routines: readonly { id: string; parentId: string | null; position: number }[]): Map<string, number> {
  // A routine whose parent is missing comes at the top level.
  const children = childrenByParent(routines);
  const rank = new Map<string, number>();
  /**
   * Ranks the routines under a parent, depth first.
   * @param {string | null} parent Parent.
   * @returns {void}
   */
  const visit = (parent: string | null) => {
    for (const child of [...(children.get(parent) ?? [])].sort(byPosition)) {
      if (rank.has(child.id)) continue;
      rank.set(child.id, rank.size);
      visit(child.id);
    }
  };
  visit(null);
  return rank;
}
