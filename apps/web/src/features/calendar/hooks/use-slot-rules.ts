import * as fmt from '../../../lib/format';
import { addDays, blockingEvent, type BusyEvent, busyUntil, conditionAllowsAt, nextConditionMoment, readSlotCondition, scheduleSlotsOn } from '@ordo/shared';
import { useMemo } from 'react';
import { useNow } from '../../../lib/use-now';
import { scheduleRules, useCalendarEvents } from '../api';
import { localDay, localInstant } from '../../../lib/dates';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { slotChoices } from '../lib/slot-choices';
import { useSlotSources } from './use-slot-sources';
import { describeSlotCondition } from '../lib/slot-condition-text';

/** Days ahead the next allowed moment is looked for. */
const LOOKAHEAD_DAYS = 14;

/** Task or routine, as far as when it can be done goes: its slot condition, its assignees, and the item it is. */
export interface Doable {
  /** Condition on calendar schedules (JSON); none: any time. Optional. */
  slotCondition?: unknown;
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
   * Whether a task or a routine can be done at a moment (now by default): its condition allows it (none: any time), and
   * no event keeps its assignees busy (but one about it).
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
   * Event keeping the assignees of a task or a routine busy at a moment (now by default), if any.
   * @param {Doable} item Task or routine.
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {BusyEvent | undefined} Event.
   */
  blocking: (item: Doable, at?: Date) => BusyEvent | undefined;
  /**
   * First moment a task or a routine can be done from a moment on (within two weeks), null when none.
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
  const { data: events } = useCalendarEvents({ from: addDays(today, -1), to: addDays(today, LOOKAHEAD_DAYS) });
  const { context } = useTaskContext();
  const meId = context?.meId ?? null;

  return useMemo(() => {
    // The schedules of the workspace and of the other ones, archived ones too (as the API).
    const foreign = sources.foreignSchedules ?? [];
    const slotsOn = scheduleSlotsOn(
      scheduleRules(sources.schedules ?? []),
      scheduleRules(foreign).map((rule, index) => ({ workspaceId: foreign[index].workspaceId, rule })),
    );
    const { names } = slotChoices(sources);
    /**
     * Whether a condition allows a moment.
     * @param {unknown} value Condition (JSON).
     * @param {Date} at Moment.
     * @returns {boolean} Allowed.
     */
    const inSlotsAt = (value: unknown, at: Date) => conditionAllowsAt(readSlotCondition(value), slotsOn, localDay(at), fmt.time(at));
    /**
     * Event keeping a task or a routine busy at a moment.
     * @param {Doable} item Task or routine.
     * @param {Date} at Moment.
     * @returns {BusyEvent | undefined} Event.
     */
    const blockingAt = (item: Doable, at: Date) => blockingEvent(events ?? [], item, meId, at, localDay(at));

    return {
      allowed: (item, at = new Date(minute)) => inSlotsAt(item.slotCondition, at) && !blockingAt(item, at),
      blocking: (item, at = new Date(minute)) => blockingAt(item, at),
      inSlots: (value, at = new Date(minute)) => inSlotsAt(value, at),
      nextAllowedAt: (item, from) => {
        // The next moment its condition allows, past the events keeping it busy then (a few rounds at most).
        const condition = readSlotCondition(item.slotCondition);
        let at = from;
        for (let round = 0; round < 20; round++) {
          const moment = nextConditionMoment(condition, slotsOn, localDay(at), fmt.time(at), LOOKAHEAD_DAYS);
          if (!moment) return null;
          const candidate = localInstant(moment.date, moment.time);
          const busy = blockingAt(item, candidate);
          if (!busy) return candidate;
          at = busyUntil(busy);
        }
        return null;
      },
      describe: (value) => fmt.capitalize(describeSlotCondition(readSlotCondition(value), names)) || null,
    };
  }, [sources, minute, events, meId]);
}
