import { dayIn, parisParts } from '../dates/days';
import { parisInstant } from '../dates/reminders';
import { windowsAllowed, type TimeWindow } from '../calendar/slot-conditions';

/** Day (YYYY-MM-DD) and time (HH:MM) in Paris a time of the day of a routine was (or is said to be) done at. */
export interface RoutineDoneAt {
  day: string;
  time: string;
}

/** A time of the day of an occurrence to tick, as a « Faite le » form reads it. */
export interface RoutineTickTarget {
  /** Due day of its occurrence (YYYY-MM-DD). */
  dueDate: string;
  /** Its « dès » (HH:MM); null: none. */
  fromTime: string | null;
  /** Its « jusqu’à » (HH:MM); null: none. */
  dueTime: string | null;
}

/**
 * Day and time a « Faite le » form proposes to tick a time of the day of an occurrence: when it is scheduled (its
 * « jusqu’à », else its « dès ») on its due day, or on the day it is ticked from (a past day shown in « Ma journée »),
 * once that is past; else now, or the day it is ticked from at the time of now when that day is already past. Every day
 * and time is read in Paris.
 * @param {RoutineTickTarget} target Time of the day to tick.
 * @param {Date} now Now.
 * @param {string | null} [day] Day it is ticked from (a past day shown in « Ma journée »); null: its due day. Optional. Default = null.
 * @returns {RoutineDoneAt} Day and time proposed.
 */
export function routineTickPrefill({ dueDate, fromTime, dueTime }: RoutineTickTarget, now: Date, day: string | null = null): RoutineDoneAt {
  const current = parisParts(now);
  const target = day ?? dueDate;
  const scheduled = dueTime ?? fromTime;
  if (scheduled && parisInstant(target, scheduled).getTime() <= now.getTime()) return { day: target, time: scheduled };
  if (day && day < current.date) return { day, time: current.time };
  return { day: current.date, time: current.time };
}

/** An occurrence as a list of a day (« Ma journée », the badge of the menu) places it. */
export interface RoutineDayOccurrence {
  /** First day it can be done (its « Ouverture »), YYYY-MM-DD. */
  startDate: string;
  /** Due day (its last day), YYYY-MM-DD. */
  dueDate: string;
  /** Cancelled: not due, never shown by this rule. Optional. Default = false. */
  cancelled?: boolean;
}

/**
 * Whether a time of the day of an occurrence shows on a day (« Ma journée », the badge of the menu): once done, on the
 * day it was done (in Paris), whichever day that is; not done yet, on each day it is open, from its first day to its
 * due day; never when the occurrence is cancelled.
 * @param {RoutineDayOccurrence} occurrence Occurrence.
 * @param {Date | string | null} doneAt When the time of the day was done (its tick); null: not done.
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {boolean} It shows that day.
 */
export function routineSlotShownOn(occurrence: RoutineDayOccurrence, doneAt: Date | string | null, day: string): boolean {
  if (occurrence.cancelled) return false;
  if (doneAt) return dayIn(typeof doneAt === 'string' ? new Date(doneAt) : doneAt) === day;
  return occurrence.startDate <= day && day <= occurrence.dueDate;
}

/** Time of the day given to a time of the day ticked on a day without a time of its own, when that day is not today. */
export const ROUTINE_BULK_DEFAULT_TIME = '12:00';

/**
 * When a time of the day ticked in bulk « Faites le » a day was done: that day at its scheduled time (its
 * « jusqu’à », else its « dès »); without any, now on today and noon (`ROUTINE_BULK_DEFAULT_TIME`) another day; never
 * later than now (a time still to come is now). Every day and time is read in Paris.
 * @param {string} day Day chosen (YYYY-MM-DD).
 * @param {{ fromTime: string | null, dueTime: string | null }} slot Its times that day.
 * @param {Date} now Now.
 * @returns {Date} When it was done.
 */
export function routineBulkDoneAt(day: string, { fromTime, dueTime }: { fromTime: string | null; dueTime: string | null }, now: Date): Date {
  const scheduled = dueTime ?? fromTime;
  const at = scheduled ? parisInstant(day, scheduled) : day === parisParts(now).date ? now : parisInstant(day, ROUTINE_BULK_DEFAULT_TIME);
  return at.getTime() > now.getTime() ? now : at;
}

/** A routine as its groups read it: its parent, archived or not. */
export interface RoutineGroupMember {
  id: string;
  parentId: string | null;
  archived: boolean;
}

/**
 * Routines that are groups: those with at least one sub-routine not archived. A group (a « parente ») is a template its
 * sub-routines follow, never a thing to do: never ticked, never late, its state of a day read from its sub-routines
 * (`routineGroupStatesOn`). Without any sub-routine not archived, a routine is an ordinary one again.
 * @param {readonly RoutineGroupMember[]} routines Routines of the workspace.
 * @returns {Set<string>} Ids of the groups.
 */
export function routineGroupIds(routines: readonly RoutineGroupMember[]): Set<string> {
  return new Set(routines.flatMap((routine) => (routine.parentId && !routine.archived ? [routine.parentId] : [])));
}

/** A time of the day of an occurrence, as its tick reads it. */
export interface RoutineTickSlot {
  /** Its rank among the times of the day of the occurrence (0 first). */
  index: number;
  /** Not needed for the occurrence to be done. */
  optional: boolean;
  /** When it was ticked; null: not ticked. Optional. Default = null. */
  doneAt?: Date | string | null;
  /** Its « dès » (HH:MM). Optional. Default = null. */
  fromTime?: string | null;
  /** Its « jusqu’à » (HH:MM). Optional. Default = null. */
  dueTime?: string | null;
}

/** An occurrence of a routine with its times of the day and their ticks. */
export interface RoutineTickOccurrence extends RoutineDayOccurrence {
  routineId: string;
  /** Day that identifies it (YYYY-MM-DD). */
  date: string;
  slots: readonly RoutineTickSlot[];
  /** Of an archived routine (read only). Optional. Default = false. */
  archived?: boolean;
}

/** The single required time of the day of an occurrence without any. */
const LONE_SLOT: RoutineTickSlot = { index: 0, optional: false, doneAt: null };

/**
 * Required times of the day of an occurrence (a single one not ticked when it has no time of the day at all).
 * @param {readonly RoutineTickSlot[]} slots Times of the day of the occurrence.
 * @returns {RoutineTickSlot[]} Required times of the day.
 */
function requiredSlots(slots: readonly RoutineTickSlot[]): RoutineTickSlot[] {
  return (slots.length ? slots : [LONE_SLOT]).filter((slot) => !slot.optional);
}

/**
 * Day (in Paris) a time of the day was ticked; null: not ticked.
 * @param {RoutineTickSlot} slot Time of the day.
 * @returns {string | null} Day (YYYY-MM-DD).
 */
const tickDay = (slot: RoutineTickSlot): string | null => (slot.doneAt ? dayIn(new Date(slot.doneAt)) : null);

/**
 * Day (in Paris) an occurrence was done: the day of the last of its required times of the day ticked, once all are;
 * ticked before its first day (« Ouverture »), its first day.
 * @param {Pick<RoutineTickOccurrence, 'startDate' | 'slots'>} occurrence Occurrence, with its ticks.
 * @returns {string | null} Day (YYYY-MM-DD); null: not done, or without any required time of the day.
 */
export function routineDoneDay({ startDate, slots }: Pick<RoutineTickOccurrence, 'startDate' | 'slots'>): string | null {
  const days = requiredSlots(slots).map(tickDay);
  if (!days.length || days.some((day) => !day)) return null;
  const last = (days as string[]).sort().pop() as string;
  return last < startDate ? startDate : last;
}

/**
 * Whether an occurrence of a sub-routine counts for its group on a day: on each day it is open, from its first day
 * (« Ouverture ») to its due day, both included, until the day it is done (`routineDoneDay`: that day counted, as done;
 * the following days of its window no longer); never when it is cancelled, nor without any required time of the day
 * (nothing to do). A late one (past due) never counts.
 * @param {Pick<RoutineTickOccurrence, 'startDate' | 'dueDate' | 'cancelled' | 'slots'>} occurrence Occurrence, with its ticks.
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {boolean} It counts that day.
 */
export function routineCountsOn(occurrence: Pick<RoutineTickOccurrence, 'startDate' | 'dueDate' | 'cancelled' | 'slots'>, day: string): boolean {
  if (occurrence.cancelled || day < occurrence.startDate || day > occurrence.dueDate || !requiredSlots(occurrence.slots).length) return false;
  const doneDay = routineDoneDay(occurrence);
  return doneDay === null || doneDay >= day;
}

/** A moment of a group on a day: moment `index` of its sub-routines that count that day (`routineCountsOn`). */
export interface RoutineGroupMoment {
  index: number;
  /** Hours of the moment, those of the first sub-routine counting that day having it. */
  fromTime: string | null;
  dueTime: string | null;
  /** Ticked, that day or before, by every sub-routine counting that day having it as a required moment. */
  done: boolean;
}

/** State of a group on a day, read from its sub-routines that count that day (`routineCountsOn`). */
export interface RoutineGroupState {
  /** Sub-routines that count that day (`routineCountsOn`; not archived; a sub-routine that is a group itself: present that day). */
  due: number;
  /** Those done (« 2/3 »: done / counted). */
  done: number;
  /** Every sub-routine counting that day is done. */
  complete: boolean;
  /** Its moments that day, by rank (required moments of its sub-routines only). */
  moments: RoutineGroupMoment[];
}

/** State of a member of a group on a day: done, and its moments. */
interface MemberState {
  complete: boolean;
  moments: Map<number, RoutineGroupMoment>;
}

/**
 * Adds a required moment of a member to the moments of a group: done only when every member having it did it.
 * @param {Map<number, RoutineGroupMoment>} moments Moments gathered.
 * @param {RoutineGroupMoment} moment Moment of a member.
 * @returns {void}
 */
function gather(moments: Map<number, RoutineGroupMoment>, moment: RoutineGroupMoment): void {
  const known = moments.get(moment.index);
  moments.set(moment.index, known ? { ...known, done: known.done && moment.done } : { ...moment });
}

/**
 * State on a day of every group (`routineGroupIds`) present that day, computed from its sub-routines, never stored:
 * - a sub-routine counts when it is not archived and one of its occurrences counts that day (`routineCountsOn`: open
 *   that day, from its « Ouverture » to its due day, until the day it is done; a sub-routine that is a group itself:
 *   present that day); the others do not count;
 * - a group is present on a day when at least one of its sub-routines counts (absent from the map otherwise);
 * - a sub-routine is done when every required moment of each of its occurrences counting that day is ticked by that
 *   day (ticked on that day or before; a day shown again before the day it was ticked: not done), optional moments
 *   aside; a group when all those that count are (progress: done / due);
 * - moment M of a group is done when moment M of every sub-routine that counts and has M as a required moment is.
 * @param {readonly RoutineGroupMember[]} routines Routines of the workspace.
 * @param {readonly RoutineTickOccurrence[]} occurrences Their occurrences around that day, with their ticks.
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {Map<string, RoutineGroupState>} State of each group present that day, by id.
 */
export function routineGroupStatesOn(routines: readonly RoutineGroupMember[], occurrences: readonly RoutineTickOccurrence[], day: string): Map<string, RoutineGroupState> {
  const groups = routineGroupIds(routines);
  const children = new Map<string, RoutineGroupMember[]>();
  for (const routine of routines) if (routine.parentId && !routine.archived) children.set(routine.parentId, [...(children.get(routine.parentId) ?? []), routine]);
  const dueOf = new Map<string, RoutineTickOccurrence[]>();
  for (const occurrence of occurrences) {
    if (!routineCountsOn(occurrence, day)) continue;
    dueOf.set(occurrence.routineId, [...(dueOf.get(occurrence.routineId) ?? []), occurrence]);
  }
  const states = new Map<string, RoutineGroupState>();
  const memo = new Map<string, MemberState | null>();
  /**
   * State of a routine that day as a member of its group; null when it does not count (no occurrence counting, or a group absent).
   * @param {string} id Routine id.
   * @param {Set<string>} seen Groups being computed (a loop stops).
   * @returns {MemberState | null} State.
   */
  const stateOf = (id: string, seen: Set<string>): MemberState | null => {
    if (memo.has(id)) return memo.get(id) ?? null;
    if (seen.has(id)) return null;
    let state: MemberState | null = null;
    if (groups.has(id)) {
      const members = (children.get(id) ?? []).flatMap((child) => {
        const member = stateOf(child.id, new Set([...seen, id]));
        return member ? [member] : [];
      });
      if (members.length) {
        const moments = new Map<number, RoutineGroupMoment>();
        for (const member of members) for (const moment of member.moments.values()) gather(moments, moment);
        const done = members.filter((member) => member.complete).length;
        states.set(id, { due: members.length, done, complete: done === members.length, moments: [...moments.values()].sort((a, b) => a.index - b.index) });
        state = { complete: done === members.length, moments };
      }
    } else {
      const due = dueOf.get(id) ?? [];
      if (due.length) {
        const moments = new Map<number, RoutineGroupMoment>();
        for (const occurrence of due) {
          for (const slot of requiredSlots(occurrence.slots)) {
            const ticked = tickDay(slot);
            gather(moments, { index: slot.index, fromTime: slot.fromTime ?? null, dueTime: slot.dueTime ?? null, done: ticked !== null && ticked <= day });
          }
        }
        state = { complete: [...moments.values()].every((moment) => moment.done), moments };
      }
    }
    memo.set(id, state);
    return state;
  };
  for (const id of groups) stateOf(id, new Set());
  return states;
}

/** A routine as the list of a day reads it: its tree, its current occurrence and its times of the day. */
export interface RoutineDayRoutine<S extends RoutineTickSlot = RoutineTickSlot> extends RoutineGroupMember {
  /** Current occurrence (the day that identifies it); null: none. */
  currentDate: string | null;
  /** Due day of its current occurrence; null: none. */
  currentDueDate: string | null;
  /** Its current occurrence is done. */
  done: boolean;
  /** Times of the day of its current occurrence. */
  slots: readonly S[];
}

/** Current occurrence of a late routine, as the list of a day shows it. */
export interface RoutineLateOccurrence<S extends RoutineTickSlot = RoutineTickSlot> {
  routineId: string;
  date: string;
  dueDate: string;
  startDate: string;
  cancelled: false;
  archived: false;
  slots: S[];
}

/** A time of the day of an occurrence of a routine shown on a day. */
export interface RoutineDayEntry<R extends RoutineDayRoutine, O extends RoutineTickOccurrence> {
  routine: R;
  occurrence: O | RoutineLateOccurrence<R['slots'][number]>;
  slot: O['slots'][number] | R['slots'][number];
  /** Late: today, its current occurrence past due. */
  late: boolean;
  /** Windows it is placed by (a late one: those allowed today); null: its own. */
  windows: TimeWindow[] | null;
}

/** What the list of a day keeps of the routines. */
export interface RoutineDayOptions<R> {
  /** Today (YYYY-MM-DD). */
  today: string;
  /** Routines shown (a filter). Optional. Default = all. */
  shown?: (routine: R) => boolean;
  /**
   * Windows a late routine can be done in today (`itemWindowsOn`: its condition, the slots « Indisponible »); null: any
   * time. Optional. Default = no late routine listed.
   */
  allowedToday?: (routine: R) => TimeWindow[] | null;
}

/**
 * Times of the day of the routines a day shows (« Ma journée », the badge of the menu), each once: every time of the
 * day of an occurrence open that day (`routineSlotShownOn`: done, on the day it was done), a cancelled occurrence on
 * its due day; today, the required times of the day not done of the current occurrence of a late routine (past due),
 * kept to the hours `allowedToday` allows (none: not listed). Neither an archived routine (nor an archived
 * occurrence), nor a group (`routineGroupIds`: seen through its sub-routines), nor the optional times of the day not
 * done of a sub-routine of a group done before that day (`routineDoneDay`).
 * @param {readonly R[]} routines Routines of the workspace.
 * @param {readonly O[]} occurrences Their occurrences around that day.
 * @param {string} day Day (YYYY-MM-DD).
 * @param {RoutineDayOptions<R>} options Today, the routines shown, the windows of the late ones.
 * @returns {RoutineDayEntry<R, O>[]} Times of the day, those of the occurrences first.
 */
export function routineDayEntries<R extends RoutineDayRoutine, O extends RoutineTickOccurrence>(
  routines: readonly R[],
  occurrences: readonly O[],
  day: string,
  { today, shown = () => true, allowedToday }: RoutineDayOptions<R>,
): RoutineDayEntry<R, O>[] {
  const groups = routineGroupIds(routines);
  const byId = new Map(routines.map((routine) => [routine.id, routine]));
  const listed = (routine: R | undefined): routine is R => routine !== undefined && !routine.archived && !groups.has(routine.id) && shown(routine);
  const entries: RoutineDayEntry<R, O>[] = [];
  const keys = new Set<string>();
  /**
   * Adds a time of the day once.
   * @param {RoutineDayEntry<R, O>} entry Time of the day.
   * @returns {void}
   */
  const add = (entry: RoutineDayEntry<R, O>) => {
    const key = `${entry.routine.id}:${entry.occurrence.date}:${entry.slot.index}`;
    if (keys.has(key)) return;
    keys.add(key);
    entries.push(entry);
  };
  for (const occurrence of occurrences) {
    const routine = byId.get(occurrence.routineId);
    if (!listed(routine) || occurrence.archived) continue;
    // A sub-routine of a group done before that day: its optional times of the day not done are no longer shown.
    const doneDay = routine.parentId && groups.has(routine.parentId) ? routineDoneDay(occurrence) : null;
    for (const slot of occurrence.slots) {
      if (doneDay && doneDay < day && slot.optional && !slot.doneAt) continue;
      // Cancelled: on its due day; else on each day it is open, once done on the day it was done.
      const on = occurrence.cancelled ? occurrence.dueDate === day : routineSlotShownOn(occurrence, slot.doneAt ?? null, day);
      if (on) add({ routine, occurrence, slot, late: false, windows: null });
    }
  }
  if (day !== today || !allowedToday) return entries;
  for (const routine of routines) {
    if (!listed(routine) || !routine.currentDate || !routine.currentDueDate || routine.currentDueDate >= today || routine.done) continue;
    const occurrence: RoutineLateOccurrence<R['slots'][number]> = {
      routineId: routine.id,
      date: routine.currentDate,
      dueDate: routine.currentDueDate,
      startDate: routine.currentDate,
      cancelled: false,
      archived: false,
      slots: [...routine.slots],
    };
    const allowed = allowedToday(routine);
    for (const slot of routine.slots) {
      if (slot.doneAt || slot.optional) continue;
      const windows = windowsAllowed({ fromTime: slot.fromTime ?? null, dueTime: slot.dueTime ?? null }, allowed);
      if (windows.length) add({ routine, occurrence, slot, late: true, windows });
    }
  }
  return entries;
}
