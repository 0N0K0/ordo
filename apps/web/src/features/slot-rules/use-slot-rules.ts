import {
  addDays,
  allowedAt,
  blockingEvent,
  busyUntil,
  DEFAULT_SLOT_KIND,
  effectiveSlotRule,
  foreignSlotKind,
  kindedSlots,
  knownSlotRule,
  nextAllowed,
  ownSlotKind,
  readSlotRule,
  scheduleKinds,
  type BusyEvent,
  type SlotRule,
} from '@ordo/shared';
import { useEffect, useMemo, useState } from 'react';
import { scheduleRules, useCalendarEvents, useDefaultScheduleKind, useForeignScheduleKinds, useScheduleTypes, useSubscribedSchedules, useWorkSchedules } from '../calendar/api';
import { localDay } from '../../lib/dates';
import { useActiveWorkspace } from '../workspaces/api';
import { useTaskContext } from '../tasks/use-task-context';

/** Days ahead the next allowed moment is looked for. */
const LOOKAHEAD_DAYS = 14;

/** Kind of slots a rule can name: of this workspace, or shown from another one. */
export interface SlotKindOption {
  value: string;
  label: string;
  group: string;
}

/** Task or routine, as far as when it can be done goes: its slot rule, its assignees, and the task it is. */
export interface Doable {
  slotRule?: unknown;
  assigneeIds: readonly string[];
  /** Task (an event about it does not block it). Optional. */
  taskId?: string | null;
  /** Routine (the same). Optional. */
  routineId?: string | null;
}

/**
 * A routine as a doable item (an event about it does not block it).
 * @param {{ id: string, slotRule?: unknown, assigneeIds: readonly string[] }} routine Routine.
 * @returns {Doable} Item.
 */
export const routineDoable = (routine: { id: string; slotRule?: unknown; assigneeIds: readonly string[] }): Doable => ({
  slotRule: routine.slotRule,
  assigneeIds: routine.assigneeIds,
  routineId: routine.id,
});

/** Slot rules of the workspace: kinds to choose from, and whether a rule allows a moment. */
export interface SlotRules {
  /** Kinds a rule can name, grouped by workspace. */
  kinds: SlotKindOption[];
  /** Default rule of the workspace (on its working hours in a professional one, anywhere in a personal one). */
  defaultRule: SlotRule;
  /**
   * Rule that applies to an item: its own, else the default of the workspace, restricted to the kinds with schedules.
   * @param {unknown} value Rule of the item (JSON).
   * @returns {SlotRule} Rule.
   */
  ruleOf: (value: unknown) => SlotRule;
  /**
   * Whether a task or a routine can be done at a moment (now by default): its slots allow it, and no event keeps its
   * assignees busy (but one about the task).
   * @param {Doable} item Task or routine.
   * @param {Date} [at] Moment. Optional. Default = now.
   * @returns {boolean} Allowed.
   */
  allowed: (item: Doable, at?: Date) => boolean;
  /**
   * Whether the slots of a task or a routine allow a moment (now by default), whatever the events.
   * @param {unknown} value Rule of the item (JSON).
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
   * Slots of a rule, told in words (« Pendant Travail · hors de Sport »); null for « partout ».
   * @param {SlotRule} rule Rule.
   * @returns {string | null} Text.
   */
  describe: (rule: SlotRule) => string | null;
}

/**
 * Local time of a moment, HH:MM.
 * @param {Date} date Moment.
 * @returns {string} Time.
 */
const localTime = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * Current time, refreshed every minute.
 * @returns {number} Current time in ms.
 */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Slot rules of the current workspace: the kinds of slots (its own and those shown from other workspaces), and
 * whether a task or a routine can be done now or at a moment (its slots, and the events keeping its assignees busy).
 * Refreshed every minute.
 * @returns {SlotRules} Slot rules.
 */
export function useSlotRules(): SlotRules {
  const { perso } = useActiveWorkspace();
  const { data: own } = useWorkSchedules();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const { data: foreignKinds } = useForeignScheduleKinds();
  const { data: foreign } = useSubscribedSchedules();
  const minute = useMinute();
  const today = localDay(new Date(minute));
  // Events of the coming days keep their contributors (none: « Moi ») busy.
  const { data: events } = useCalendarEvents({ from: addDays(today, -1), to: addDays(today, LOOKAHEAD_DAYS) });
  const { context } = useTaskContext();
  const meId = context?.meId ?? null;

  return useMemo(() => {
    const ownRules = scheduleRules(own ?? []);
    const shown = (foreign ?? []).map((schedule) => ({ workspaceId: schedule.workspaceId, rule: scheduleRules([schedule])[0] }));
    const slots = kindedSlots(ownRules, shown, addDays(today, -1), addDays(today, LOOKAHEAD_DAYS));
    const known = scheduleKinds(
      ownRules,
      shown.map(({ workspaceId, rule }) => ({ workspaceId, typeId: rule.typeId })),
    );
    const defaultRule = effectiveSlotRule(null, perso);
    const ruleOf = (value: unknown) => knownSlotRule(effectiveSlotRule(readSlotRule(value), perso), known);

    const kinds: SlotKindOption[] = [
      { value: DEFAULT_SLOT_KIND, label: defaultKind?.name ?? 'Travail', group: 'Cet espace' },
      ...(types ?? []).map((type) => ({ value: ownSlotKind(type.id), label: type.name, group: 'Cet espace' })),
      ...(foreignKinds ?? [])
        .filter((kind) => kind.subscribed)
        .map((kind) => ({ value: foreignSlotKind(kind.workspaceId, kind.typeId), label: `${kind.name} (${kind.workspaceName})`, group: kind.workspaceName })),
    ];
    const labelOf = new Map(kinds.map((kind) => [kind.value, kind.label]));
    /**
     * Event keeping a task or a routine busy at a moment.
     * @param {Doable} item Task or routine.
     * @param {Date} at Moment.
     * @returns {BusyEvent | undefined} Event.
     */
    const blockingAt = (item: Doable, at: Date) => blockingEvent(events ?? [], item, meId, at, localDay(at));

    return {
      kinds,
      defaultRule,
      ruleOf,
      allowed: (item, at = new Date(minute)) => allowedAt(ruleOf(item.slotRule), slots, localDay(at), localTime(at)) && !blockingAt(item, at),
      blocking: (item, at = new Date(minute)) => blockingAt(item, at),
      inSlots: (value, at = new Date(minute)) => allowedAt(ruleOf(value), slots, localDay(at), localTime(at)),
      nextAllowedAt: (item, from) => {
        // The next moment its slots allow, past the events keeping it busy then (a few rounds at most).
        let at = from;
        for (let round = 0; round < 20; round++) {
          const moment = nextAllowed(ruleOf(item.slotRule), slots, localDay(at), localTime(at));
          if (!moment) return null;
          const [hours, minutes] = moment.time.split(':').map(Number);
          const [year, month, day] = moment.date.split('-').map(Number);
          const candidate = new Date(year, month - 1, day, hours, minutes);
          const busy = blockingAt(item, candidate);
          if (!busy) return candidate;
          at = busyUntil(busy);
        }
        return null;
      },
      describe: (rule) => {
        const names = (list: readonly string[]) => list.map((kind) => labelOf.get(kind) ?? 'Plages supprimées').join(', ');
        const parts = [rule.inside.length ? `pendant ${names(rule.inside)}` : null, rule.outside.length ? `hors de ${names(rule.outside)}` : null].filter(Boolean).join(' · ');
        return parts ? parts.charAt(0).toUpperCase() + parts.slice(1) : null;
      },
    };
  }, [own, types, defaultKind, foreignKinds, foreign, perso, minute, today, events, meId]);
}
