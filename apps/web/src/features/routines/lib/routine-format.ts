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
  type RoutineSlot,
  type SlotCondition,
  routineSchedule,
  routineState,
  windowText,
  type RoutineState,
} from '@ordo/shared';
import { describeRecurrence } from '../../../components/recurrence/describe-recurrence';
import { describeSlotCondition } from '../../calendar/lib/slot-condition-text';
import { exceptionText, skippedLines, type ExceptionLine } from '../../../components/recurrence/exceptions';

import { treeOptions, type TreeOption } from '../../../components/tree/tree-select';
import type { Routine } from '../api';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { inProjectTree } from '../../tasks/lib/task-links';
import * as fmt from '../../../lib/format';
import { parisParts } from '../../../lib/dates';
import type { RoutineDoneAt } from '@ordo/shared';

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
 * Whether the current occurrence of a routine is ticked; never a routine that has sub-routines (a group, never ticked:
 * its ticks of before, kept, are not read).
 * @param {Routine} routine Routine.
 * @returns {boolean} Done.
 */
export const isDone = (routine: Routine) => routine.done && !routine.hasSubRoutines;

/**
 * When a time of the day of a routine was done, in words: « faite le 5 nov. à 08:12 ».
 * @param {string} doneAt Instant (ISO).
 * @returns {string} Text.
 */
export const doneAtText = (doneAt: string): string => `faite le ${fmt.dayShort(doneAt)} à ${fmt.time(doneAt)}`;

/**
 * Day and time a time of the day was done at, in Paris: what « Faite le » shows to change it.
 * @param {string} doneAt Instant (ISO).
 * @returns {RoutineDoneAt} Day and time.
 */
export const doneAtParts = (doneAt: string): RoutineDoneAt => {
  const { date, time } = parisParts(doneAt);
  return { day: date, time };
};

/**
 * State of a routine today: « à faire » only while its slots allow it now (« à venir » otherwise). A routine that has
 * sub-routines (a group) is never to do itself, nor late: « à venir » (its progress is read from its sub-routines).
 * @param {Routine} routine Routine.
 * @param {string} today Today.
 * @param {boolean} [doable] Its slot rule allows now. Optional. Default = true.
 * @returns {RoutineState} State.
 */
export const currentRoutineState = (routine: Routine, today: string, doable = true): RoutineState => {
  if (routine.hasSubRoutines) return 'upcoming';
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
 * Required routines of a routine still to do for their current occurrence ("étendre le linge" waits for "laver le linge");
 * a routine that has sub-routines (a group, never ticked) is not waited for.
 * @param {Routine} routine Routine.
 * @param {Map<string, Routine>} byId Routines by id.
 * @returns {Routine[]} Routines it waits for.
 */
export function waitingFor(routine: Routine, byId: Map<string, Routine>): Routine[] {
  return routine.requiredIds.flatMap((id) => {
    const required = byId.get(id);
    // A group is never ticked: nothing to wait for.
    return required && !required.archived && !required.hasSubRoutines && required.currentDate !== null && !isDone(required) ? [required] : [];
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
 * Moments as text: "avant 08:00, 12:00–14:00 (facultatif)".
 * @param {readonly RoutineSlot[]} moments Moments.
 * @returns {string} Text.
 */
export const describeMoments = (moments: readonly RoutineSlot[]): string => moments.map((moment) => `${windowText(moment) || 'dans la journée'}${moment.optional ? ' (facultatif)' : ''}`).join(', ');

/**
 * Repetition and times of a routine case in words: "Tous les jours · avant 08:00, 12:00–14:00, dès 20:00 (facultatif)".
 * @param {RoutineCase} item Case.
 * @param {string} start First date of the routine.
 * @returns {string} Description.
 */
export function describeRoutineCase(item: RoutineCase, start: string): string {
  return `${describeRecurrence(item.recurrence, item.from && item.from > start ? item.from : start)} · ${describeMoments(item.slots)}${item.from && item.from > start ? ` · dès le ${fmt.day(item.from)}` : ''}`;
}

/**
 * Repetition of a routine in words, a line each: its cases one under the other, or its rule (with its moments when
 * given) and its condition on calendar schedules; nothing without a rule.
 * @param {{ startDate: string, cases: readonly RoutineCase[], recurrence: Recurrence | null, slotCondition: SlotCondition | null, moments?: readonly RoutineSlot[] }} value Repetition. Optional `moments`.
 * @param {Map<string, string>} names Names of the calendar schedules.
 * @returns {string[]} Lines.
 */
export function routineRepetitionLines(
  value: { startDate: string; cases: readonly RoutineCase[]; recurrence: Recurrence | null; slotCondition: SlotCondition | null; moments?: readonly RoutineSlot[] },
  names: Map<string, string>,
): string[] {
  if (value.cases.length) return value.cases.map((item) => describeRoutineCase(item, value.startDate));
  if (!value.recurrence) return [];
  return [[describeRecurrence(value.recurrence, value.startDate), value.moments && describeMoments(value.moments), describeSlotCondition(value.slotCondition, names)].filter(Boolean).join(' · ')];
}

/**
 * Exceptions of a routine: occurrences moved to another day; those it goes by (`effective`: of the routine it follows
 * when it inherits them, none when emptied on purpose), as its occurrences are computed.
 * @param {Pick<Routine, 'moves' | 'effective'>} routine Routine.
 * @returns {RoutineMove[]} Moves, by day of the rule.
 */
export const movesOf = (routine: Pick<Routine, 'moves' | 'effective'>): RoutineMove[] =>
  // eslint-disable-next-line no-restricted-syntax -- the exceptions it goes by: not a field of the row (its own ones are given back by an undo).
  ((routine.effective.moves ?? routine.moves) as RoutineMove[] | null) ?? [];

/**
 * What an exception of a routine makes of its occurrence: « annulée », « autres horaires », « fusionnée avec celle du
 * ven. 13 nov. », « reportée au ven. 13 nov., autres horaires, à part de celle du jour ».
 * @param {RoutineMove} move Exception.
 * @returns {string} Text.
 */
export function routineMoveKind(move: RoutineMove): string {
  if (move.to === null) return 'annulée';
  if (move.to === move.from) return 'autres horaires';
  if (move.merged) return `fusionnée avec celle du ${fmt.weekday(move.to)}`;
  return `${move.to > move.from ? 'reportée' : 'avancée'} au ${fmt.weekday(move.to)}${move.times ? ', autres horaires' : ''}${move.apart ? ', à part de celle du jour' : ''}`;
}

/**
 * One move of a routine as an exception line: « 13 novembre 2026 : annulée ».
 * @param {RoutineMove} move Exception.
 * @returns {ExceptionLine} Line.
 */
export const routineMoveLine = (move: RoutineMove): ExceptionLine => ({ key: `move-${move.from}`, day: move.from, text: exceptionText(move.from, routineMoveKind(move)) });

/**
 * Exceptions of a routine in words: its occurrences cancelled, moved or with other times (those it goes by), and the
 * « rien » days of its rule or of the rules of its cases.
 * @param {Pick<Routine, 'moves' | 'effective'> | undefined} routine Routine (none: a new one, without moves).
 * @param {readonly (Recurrence | null)[]} rules Its rule, or the rules of its cases, as edited.
 * @returns {ExceptionLine[]} Lines.
 */
export const routineExceptionLines = (routine: Pick<Routine, 'moves' | 'effective'> | undefined, rules: readonly (Recurrence | null)[]): ExceptionLine[] => [
  ...(routine ? movesOf(routine) : []).map(routineMoveLine),
  ...skippedLines(rules),
];

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
  date ? (movesOf(routine).find((move) => move.to !== null && move.to !== move.from && !move.merged && moveKey(move) === date) as (RoutineMove & { to: string }) | undefined) : undefined;

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
 * Due day by its rule of the current or next occurrence of a routine (before its condition moves it back; the day an
 * undo of a move goes back to), from the day that identifies it: `currentRuleDueDate` / `nextRuleDueDate`, else that day.
 * @param {Pick<Routine, 'currentDate' | 'currentRuleDueDate' | 'nextDate' | 'nextRuleDueDate'>} routine Routine.
 * @param {string} date Day that identifies the occurrence.
 * @returns {string} Due day by its rule.
 */
export const ruleDueDayOf = (routine: Pick<Routine, 'currentDate' | 'currentRuleDueDate' | 'nextDate' | 'nextRuleDueDate'>, date: string): string =>
  (date === routine.currentDate ? routine.currentRuleDueDate : date === routine.nextDate ? routine.nextRuleDueDate : null) ?? date;

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

/** Why the real due day of an occurrence differs from that of its rule (the tooltip of `RealDueDate`). */
export const ROUTINE_DUE_SHIFT_REASON = 'hors créneaux';

/** Name of the warning of an occurrence without a real due day (none of its days allows a moment). */
export const NO_ROUTINE_DUE_DAY = 'Aucun jour possible selon ses créneaux';
