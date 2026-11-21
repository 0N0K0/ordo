import { addDays, dayIn } from '../dates/days';
import { zonedInstant } from '../dates/recurrence';

/** Event occurrence as far as being busy goes. */
export interface BusyEvent {
  label: string;
  allDay: boolean;
  /** First and last days (YYYY-MM-DD, the last one included). */
  startDate: string;
  endDate: string;
  /** Start and end instants (timed events). */
  start: string | Date;
  end: string | Date;
  /** Contributors taking part; none: « Moi ». */
  contributorIds: readonly string[];
  /** Tasks the event is about: they are done during it, it does not block them. */
  taskIds: readonly string[];
  /** Routines of a day the event is about: on that day it does not block them. Optional. */
  routineLinks?: readonly { routineId: string; date: string }[];
  calledOff: boolean;
}

/** What is done by someone: its assignees (none: « Moi »), and the task it is, if any. */
export interface BusyItem {
  assigneeIds: readonly string[];
  /** Task (an event about it does not block it). Optional. */
  taskId?: string | null;
  /** Routine (the same). Optional. */
  routineId?: string | null;
}

/**
 * Contributors of a list, « Moi » when there are none.
 * @param {readonly string[]} ids Contributors.
 * @param {string | null} meId « Moi ».
 * @returns {string[]} Contributors.
 */
const peopleOf = (ids: readonly string[], meId: string | null) => (ids.length ? [...ids] : meId ? [meId] : []);

/**
 * Event that keeps a task or a routine from being done at a moment: not called off, at that moment (an all-day one
 * the whole day), with one of its contributors (an event without any, and an item without assignee, count as
 * « Moi »), and not about that task, nor about that routine that day.
 * @param {readonly BusyEvent[]} events Event occurrences around the moment.
 * @param {BusyItem} item Task or routine.
 * @param {string | null} meId « Moi ».
 * @param {Date} at Moment.
 * @param {string} day Local day of the moment (YYYY-MM-DD).
 * @returns {BusyEvent | undefined} Event, if any.
 */
export function blockingEvent(events: readonly BusyEvent[], item: BusyItem, meId: string | null, at: Date, day: string): BusyEvent | undefined {
  const people = new Set(peopleOf(item.assigneeIds, meId));
  if (people.size === 0) return undefined;
  return events.find(
    (event) =>
      !event.calledOff &&
      !(item.taskId && event.taskIds.includes(item.taskId)) &&
      !(item.routineId && event.routineLinks?.some((link) => link.routineId === item.routineId && link.date === day)) &&
      peopleOf(event.contributorIds, meId).some((id) => people.has(id)) &&
      (event.allDay ? event.startDate <= day && day <= event.endDate : new Date(event.start).getTime() <= at.getTime() && at.getTime() < new Date(event.end).getTime()),
  );
}

/**
 * Moment an event stops keeping someone busy: its end, or the midnight after its last day for an all-day one (in a
 * time zone, else the local one).
 * @param {BusyEvent} event Event.
 * @param {string} [timeZone] Time zone of its days. Optional. Default = the local one.
 * @returns {Date} Moment.
 */
export function busyUntil(event: BusyEvent, timeZone?: string): Date {
  if (!event.allDay) return new Date(event.end);
  const next = addDays(event.endDate, 1);
  if (timeZone) return zonedInstant(next, '00:00', timeZone);
  const [year, month, day] = next.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Days ahead the next moment a task or a routine can be done is looked for. */
export const NEXT_ALLOWED_DAYS = 14;

/** What the next moment a task or a routine can be done is found from. */
export interface NextAllowedContext {
  /** Event occurrences of the days ahead. */
  events: readonly BusyEvent[];
  /** « Moi ». */
  meId: string | null;
  /** Time zone of the days (Paris: the app and the server find the same moment). */
  timeZone: string;
  /** Next moment its condition on calendar schedules allows from a moment on, null: none; missing: any moment. Optional. */
  nextInSlots?: (at: Date) => Date | null;
}

/**
 * First moment from a moment on a task or a routine can be done (within `NEXT_ALLOWED_DAYS`): the next moment its
 * condition allows, past the events keeping its assignees busy then (a few rounds at most); null when none. The one
 * way the app and the server defer a reminder of a routine.
 * @param {BusyItem} item Task or routine.
 * @param {Date} from Moment.
 * @param {NextAllowedContext} context Events, « Moi », time zone, condition.
 * @returns {Date | null} Moment.
 */
export function nextAllowedMoment(item: BusyItem, from: Date, { events, meId, timeZone, nextInSlots }: NextAllowedContext): Date | null {
  const last = from.getTime() + NEXT_ALLOWED_DAYS * 24 * 3600_000;
  let at = from;
  for (let round = 0; round < 20; round++) {
    const candidate = nextInSlots ? nextInSlots(at) : at;
    if (!candidate || candidate.getTime() > last) return null;
    const busy = blockingEvent(events, item, meId, candidate, dayIn(candidate, timeZone));
    if (!busy) return candidate;
    at = busyUntil(busy, timeZone);
  }
  return null;
}

/**
 * Whether a task can be about an event (attached to it): its assignees and the contributors of the event have someone
 * in common, or one of the sides has nobody.
 * @param {readonly string[]} assigneeIds Assignees of the task.
 * @param {readonly string[]} contributorIds Contributors of the event.
 * @returns {boolean} It can.
 */
export const sharePeople = (assigneeIds: readonly string[], contributorIds: readonly string[]) =>
  assigneeIds.length === 0 || contributorIds.length === 0 || assigneeIds.some((id) => contributorIds.includes(id));
