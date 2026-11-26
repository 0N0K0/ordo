import * as fmt from '../../../lib/format';
import {
  addDays,
  blockingEvent,
  type BusyEvent,
  conditionBlockAt,
  NEXT_ALLOWED_DAYS,
  nextAllowedMoment,
  nextInSlotsOf,
  PARIS_ZONE,
  readSlotCondition,
  readTaskHours,
  scheduleSlotsOn,
  type SlotsOn,
  unavailableScheduleIds,
} from '@ordo/shared';
import { useMemo } from 'react';
import { useNow } from '../../../lib/use-now';
import { archivedIds } from '../../../lib/archive';
import { scheduleRules, useCalendarEvents } from '../api';
import { parisDay, parisParts } from '../../../lib/dates';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { slotChoices } from '../lib/slot-choices';
import { inWorkspace } from '../lib/layer-label';
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
   * any time), no slot « Indisponible » holds it, and no event keeps its assignees busy (but one about it).
   * @param {Doable} item Task or routine.
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {boolean} Allowed.
   */
  allowed: (item: Doable, at?: Date) => boolean;
  /**
   * Whether a condition on calendar schedules allows a moment (now by default), whatever the slots « Indisponible »
   * and the events.
   * @param {unknown} value Condition of the item (JSON).
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {boolean} Allowed.
   */
  inSlots: (value: unknown, at?: Date) => boolean;
  /**
   * Whether the « Horaires » of a task allow a moment (now by default), whatever its condition, the slots
   * « Indisponible » and the events.
   * @param {unknown} hours Hours of the task (JSON).
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {boolean} Allowed.
   */
  inHours: (hours: unknown, at?: Date) => boolean;
  /**
   * Names of the schedules « Indisponible » of the workspace (of it, or of another one through its subscriptions) met
   * at a moment (now by default), or between two moments (the end excluded), in Paris time.
   * @param {Date} [from] Moment, or start. Optional. Default = now.
   * @param {Date} [to] End. Optional. Default = the moment alone.
   * @returns {string[]} Names (« Sommeil », « Sport · Perso »), each once.
   */
  unavailable: (from?: Date, to?: Date) => string[];
  /**
   * Event keeping the assignees of a task or a routine busy at a moment (now by default), if any.
   * @param {Doable} item Task or routine.
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {BusyEvent | undefined} Event.
   */
  blocking: (item: Doable, at?: Date) => BusyEvent | undefined;
  /**
   * First moment a task or a routine can be done from a moment on, out of the slots « Indisponible » (within two
   * weeks, Paris time as the server: `nextAllowedMoment`), null when none.
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
  /**
   * Slots of some schedules on a day (`scheduleSlotsOn`: of the workspace, of the other workspaces of the user, the
   * birthdays), what the windows of a task or a routine on a day are read from (`itemWindowsOn`).
   */
  slotsOn: SlotsOn;
}

/**
 * Slot conditions of the current workspace, the same for tasks and routines: whether a task or a routine can be done now
 * or at a moment (its condition on the schedules and kinds of the workspace and of the other workspaces of the user, the
 * slots « Indisponible » of the workspace, and the events keeping its assignees busy). Refreshed every minute.
 * @returns {SlotRules} Slot conditions.
 */
export function useSlotRules(): SlotRules {
  const sources = useSlotSources();
  const minute = useNow(true, 60_000);
  const today = parisDay(new Date(minute));
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
    // Schedules by their plain label (of another workspace: « Sport · Perso »).
    const labels = new Map([...(sources.schedules ?? []).map((schedule) => [schedule.id, schedule.label] as const), ...foreign.map((schedule) => [schedule.id, inWorkspace(schedule.label, schedule.workspaceLabel)] as const)]);
    /**
     * What keeps a condition and some hours from a moment (the shared test of the API: its hours, its condition, the
     * slots « Indisponible »), null: allowed.
     * @param {unknown} value Condition (JSON).
     * @param {Date} at Moment.
     * @param {unknown} [hours] Hours of a task (JSON). Optional. Default = none.
     * @returns {import('@ordo/shared').ConditionBlock | null} What keeps it.
     */
    const blockAt = (value: unknown, at: Date, hours?: unknown) => {
      const { date, time } = parisParts(at);
      return conditionBlockAt(readSlotCondition(value), slotsOn, date, time, readTaskHours(hours));
    };
    /**
     * Event keeping a task or a routine busy at a moment.
     * @param {Doable} item Task or routine.
     * @param {Date} at Moment.
     * @returns {BusyEvent | undefined} Event.
     */
    const blockingAt = (item: Doable, at: Date) => blockingEvent(events ?? [], item, meId, at, parisDay(at));

    return {
      allowed: (item, at = new Date(minute)) => blockAt(item.slotCondition, at, item.hours) === null && !blockingAt(item, at),
      blocking: (item, at = new Date(minute)) => blockingAt(item, at),
      inSlots: (value, at = new Date(minute)) => blockAt(value, at) !== 'slots',
      inHours: (hours, at = new Date(minute)) => blockAt(null, at, hours) !== 'hours',
      // In Paris time, as the agenda and its panel show them.
      unavailable: (from = new Date(minute), to) => unavailableScheduleIds(slotsOn, parisParts(from), to && parisParts(to)).map((id) => labels.get(id) ?? id),
      // The next moment its condition and its hours allow out of the slots « Indisponible », past the events keeping
      // it busy then, in Paris time (the server defers the same way).
      nextAllowedAt: (item, from) =>
        nextAllowedMoment(item, from, { events: events ?? [], meId, timeZone: PARIS_ZONE, nextInSlots: nextInSlotsOf(readSlotCondition(item.slotCondition), slotsOn, readTaskHours(item.hours)) }),
      describe: (value) => fmt.capitalize(describeSlotCondition(readSlotCondition(value), names)) || null,
      slotsOn,
    };
  }, [sources, minute, events, meId]);
}
