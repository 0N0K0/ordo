import * as fmt from '../../../lib/format';
import {
  addDays,
  blockingEvent,
  type BusyEvent,
  conditionAllowsAt,
  NEXT_ALLOWED_DAYS,
  nextAllowedMoment,
  nextConditionMoment,
  PARIS_ZONE,
  parisInstant,
  readSlotCondition,
  readTaskHours,
  scheduleSlotsOn,
  timeIn,
} from '@ordo/shared';
import { useMemo } from 'react';
import { useNow } from '../../../lib/use-now';
import { archivedIds } from '../../../lib/archive';
import { scheduleRules, useCalendarEvents } from '../api';
import { localDay, parisDay } from '../../../lib/dates';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { slotChoices } from '../lib/slot-choices';
import { useSlotSources } from './use-slot-sources';
import { describeSlotCondition } from '../lib/slot-condition-text';

/** Task or routine, as far as when it can be done goes: its slot condition, its hours, its assignees, and the item it is. */
export interface Doable {
  /** Condition on calendar schedules (JSON); none: any time. Optional. */
  slotCondition?: unknown;
  /** « Horaires » of a task (JSON); none: any time. Optional. */
  hours?: unknown;
  assigneeIds: readonly string[];
  /** Task (an event about it does not block it). Optional. */
  taskId?: string | null;
  /** Routine (the same). Optional. */
  routineId?: string | null;
}

/**
 * A routine as a doable item: its condition already keeps its moments to the hours it allows, so only the events
 * keeping its assignees busy count (an event about it does not block it).
 * @param {{ id: string, assigneeIds: readonly string[] }} routine Routine.
 * @returns {Doable} Item.
 */
export const routineDoable = (routine: { id: string; assigneeIds: readonly string[] }): Doable => ({ assigneeIds: routine.assigneeIds, routineId: routine.id });

/** Slot conditions of the workspace: whether a task or a routine can be done at a moment. */
export interface SlotRules {
  /**
   * Whether a task or a routine can be done at a moment (now by default): its condition and its hours allow it (none:
   * any time), and no event keeps its assignees busy (but one about it).
   * @param {Doable} item Task or routine.
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {boolean} Allowed.
   */
  allowed: (item: Doable, at?: Date) => boolean;
  /**
   * Whether a condition on calendar schedules allows a moment (now by default), whatever the events.
   * @param {unknown} value Condition of the item (JSON).
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {boolean} Allowed.
   */
  inSlots: (value: unknown, at?: Date) => boolean;
  /**
   * Whether the « Horaires » of a task allow a moment (now by default), whatever its condition and the events.
   * @param {unknown} hours Hours of the task (JSON).
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {boolean} Allowed.
   */
  inHours: (hours: unknown, at?: Date) => boolean;
  /**
   * Event keeping the assignees of a task or a routine busy at a moment (now by default), if any.
   * @param {Doable} item Task or routine.
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {BusyEvent | undefined} Event.
   */
  blocking: (item: Doable, at?: Date) => BusyEvent | undefined;
  /**
   * First moment a task or a routine can be done from a moment on (within two weeks, Paris time as the server:
   * `nextAllowedMoment`), null when none.
   * @param {Doable} item Task or routine.
   * @param {Date} from Moment.
   * @returns {Date | null} Moment.
   */
  nextAllowedAt: (item: Doable, from: Date) => Date | null;
  /**
   * Condition on calendar schedules told in words (« sur « Travail » ou « Sport · Perso » »); null without condition (any time).
   * @param {unknown} value Condition (JSON).
   * @returns {string | null} Text.
   */
  describe: (value: unknown) => string | null;
}

/**
 * Slot conditions of the current workspace, the same for tasks and routines: whether a task or a routine can be done now
 * or at a moment (its condition on the schedules and kinds of the workspace and of the other workspaces of the user, and
 * the events keeping its assignees busy). Refreshed every minute.
 * @returns {SlotRules} Slot conditions.
 */
export function useSlotRules(): SlotRules {
  const sources = useSlotSources();
  const minute = useNow(true, 60_000);
  const today = localDay(new Date(minute));
  // Events of the coming days keep their contributors (none: « Moi ») busy.
  const { data: events } = useCalendarEvents({ from: addDays(today, -1), to: addDays(today, NEXT_ALLOWED_DAYS) });
  const { context } = useTaskContext();
  const meId = context?.meId ?? null;

  return useMemo(() => {
    // The schedules of the workspace and of the other ones, and the birthdays (as the API): the archived ones, those of
    // archived kinds and of archived people give no moment.
    const foreign = sources.foreignSchedules ?? [];
    const archivedKinds = archivedIds([...(sources.types ?? []), ...(sources.foreignKinds ?? []).flatMap((kind) => (kind.typeId ? [{ id: kind.typeId, archived: kind.archived }] : []))]);
    const slotsOn = scheduleSlotsOn(
      scheduleRules(sources.schedules ?? [], archivedKinds),
      scheduleRules(foreign, archivedKinds).map((rule, index) => ({ workspaceId: foreign[index].workspaceId, rule })),
      sources.birthdays ?? [],
    );
    const { names } = slotChoices(sources);
    /**
     * Whether a condition and some hours allow a moment (the shared test of the API).
     * @param {unknown} value Condition (JSON).
     * @param {Date} at Moment.
     * @param {unknown} [hours] Hours of a task (JSON). Optional. Default = none.
     * @returns {boolean} Allowed.
     */
    const inSlotsAt = (value: unknown, at: Date, hours?: unknown) => conditionAllowsAt(readSlotCondition(value), slotsOn, localDay(at), fmt.time(at), readTaskHours(hours));
    /**
     * Event keeping a task or a routine busy at a moment.
     * @param {Doable} item Task or routine.
     * @param {Date} at Moment.
     * @returns {BusyEvent | undefined} Event.
     */
    const blockingAt = (item: Doable, at: Date) => blockingEvent(events ?? [], item, meId, at, localDay(at));

    return {
      allowed: (item, at = new Date(minute)) => inSlotsAt(item.slotCondition, at, item.hours) && !blockingAt(item, at),
      blocking: (item, at = new Date(minute)) => blockingAt(item, at),
      inSlots: (value, at = new Date(minute)) => inSlotsAt(value, at),
      inHours: (hours, at = new Date(minute)) => inSlotsAt(null, at, hours),
      nextAllowedAt: (item, from) => {
        // The next moment its condition and its hours allow, past the events keeping it busy then, in Paris time (the server defers the same way).
        const condition = readSlotCondition(item.slotCondition);
        const hours = readTaskHours(item.hours);
        return nextAllowedMoment(item, from, {
          events: events ?? [],
          meId,
          timeZone: PARIS_ZONE,
          nextInSlots: (at) => {
            const moment = nextConditionMoment(condition, slotsOn, parisDay(at), timeIn(at, PARIS_ZONE), NEXT_ALLOWED_DAYS, hours);
            return moment ? parisInstant(moment.date, moment.time) : null;
          },
        });
      },
      describe: (value) => fmt.capitalize(describeSlotCondition(readSlotCondition(value), names)) || null,
    };
  }, [sources, minute, events, meId]);
}
