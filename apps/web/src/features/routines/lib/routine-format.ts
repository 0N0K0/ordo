import {
  byPosition,
  childrenByParent,
  DAILY_RECURRENCE,
  mapById,
  moveKey,
  pathOf,
  type Recurrence,
  recurrenceSchema,
  type RoutineCase,
  type RoutineMove,
  routineSchedule,
  routineState,
  windowText,
  type RoutineState,
} from '@ordo/shared';
import { describeRecurrence } from '../../../components/recurrence/describe-recurrence';

import { treeOptions, type TreeOption } from '../../../components/tree/tree-select';
import type { Routine } from '../api';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { inProjectTree } from '../../tasks/lib/task-links';
import * as fmt from '../../../lib/format';

/** Rule of a new routine: every day (`DAILY_RECURRENCE`, also that of a task turned into a routine). */
export const DAILY: Recurrence = DAILY_RECURRENCE;

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
  const state = routineState(routine.currentDueDate, isDone(routine), today);
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
 * Routines a routine can be linked to (« Dépend de », « Bloque », « Relative à »), as the tasks: not itself, not
 * archived, in its project tree (those without project with those without project); those already linked stay offered.
 * @param {Pick<TaskContext, 'rootOf'>} context Task context (its project trees).
 * @param {string | null} projectId Project of the routine.
 * @param {string | null} selfId The routine (none: a new one).
 * @param {readonly string[]} [linked] Routines linked already. Optional. Default = none.
 * @returns {(other: Routine) => boolean} Whether a routine is offered.
 */
export function linkableRoutine(context: Pick<TaskContext, 'rootOf'>, projectId: string | null, selfId: string | null, linked: readonly string[] = []): (other: Routine) => boolean {
  const inTree = inProjectTree(context, projectId);
  return (other) => linked.includes(other.id) || (other.id !== selfId && !other.archived && inTree(other.projectId ?? null));
}

/**
 * Routines a routine blocks (« Bloque »): those that depend on it.
 * @param {readonly Routine[]} routines Routines.
 * @param {string} id The routine.
 * @returns {string[]} Ids of the routines waiting for it.
 */
export const blockedRoutineIds = (routines: readonly Routine[], id: string): string[] => routines.filter((other) => other.requiredIds.includes(id)).map((other) => other.id);

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

/** Window as words (« 8:20–8:30 », « avant 8:30 »): the shared brick, also used by the rings pushed by the API. */
export { windowText };

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
 * Occurrence of a routine open in its panel when none is chosen (its comments are those of it): the
 * current one, else the next one, else the first one (a routine whose repetition has ended).
 * @param {Pick<Routine, 'currentDate' | 'nextDate' | 'firstDate'>} routine Routine.
 * @returns {string | null} Day of the occurrence, null without any.
 */
export const panelOccurrence = (routine: Pick<Routine, 'currentDate' | 'nextDate' | 'firstDate'>): string | null =>
  routine.currentDate || routine.nextDate || routine.firstDate || null;

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
 * @param {string | null} date Occurrence (the day that identifies it: `moveKey`).
 * @returns {RoutineMove | undefined} Move.
 */
export const moveTo = (routine: Routine, date: string | null): (RoutineMove & { to: string }) | undefined =>
  date ? (movesOf(routine).find((move) => move.to !== null && move.to !== move.from && moveKey(move) === date) as (RoutineMove & { to: string }) | undefined) : undefined;

/**
 * Due day of the current or next occurrence of a routine, from the day that identifies it (another one only when it
 * was moved onto a day that has its own and kept apart); another day is given back as it is.
 * @param {Pick<Routine, 'currentDate' | 'currentDueDate' | 'nextDate' | 'nextDueDate'>} routine Routine.
 * @param {string} date Occurrence (the day that identifies it).
 * @returns {string} Due day.
 */
export const dueDayOf = (routine: Pick<Routine, 'currentDate' | 'currentDueDate' | 'nextDate' | 'nextDueDate'>, date: string): string =>
  (date === routine.currentDate ? routine.currentDueDate : date === routine.nextDate ? routine.nextDueDate : null) ?? date;

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
