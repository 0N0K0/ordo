import { z } from 'zod';
import { addDays } from './recurrence';
import { plannedSlots, type PlannedSlot, type WorkScheduleRule } from './work-schedules';

/** Where a task or a routine is done: anywhere, on the slots of some kinds, or out of them (whatever the day). */
export const SLOT_MODES = ['ANY', 'INSIDE', 'OUTSIDE'] as const;
export type SlotMode = (typeof SLOT_MODES)[number];

/** Kind of the slots without kind of the workspace (its working hours, « Travail »). */
export const DEFAULT_SLOT_KIND = 'default';

/**
 * Kind of slots of the workspace: its id, or the one of its slots without kind.
 * @param {string | null | undefined} typeId Kind; none: the slots without kind.
 * @returns {string} Reference.
 */
export const ownSlotKind = (typeId: string | null | undefined) => typeId ?? DEFAULT_SLOT_KIND;

/**
 * Kind of slots of another workspace, shown in this one (a subscription).
 * @param {string} workspaceId Workspace of the slots.
 * @param {string | null | undefined} typeId Kind; none: its slots without kind.
 * @returns {string} Reference.
 */
export const foreignSlotKind = (workspaceId: string, typeId: string | null | undefined) => `ws:${workspaceId}:${typeId ?? DEFAULT_SLOT_KIND}`;

/** Slots a task or a routine is done on (INSIDE) or out of (OUTSIDE): their kinds, of this workspace or shown from others. */
export const slotRuleSchema = z
  .object({
    mode: z.enum(SLOT_MODES),
    kinds: z.array(z.string().min(1).max(120)).max(30).default([]),
  })
  .refine((rule) => rule.mode === 'ANY' || rule.kinds.length > 0, { path: ['kinds'], message: 'Choisissez au moins un type de plages.' });
export type SlotRule = z.infer<typeof slotRuleSchema>;

/**
 * Rule stored or received (JSON), validated: null when none or invalid.
 * @param {unknown} value Rule.
 * @returns {SlotRule | null} Rule.
 */
export function readSlotRule(value: unknown): SlotRule | null {
  if (value === null || value === undefined) return null;
  const parsed = slotRuleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Rule that applies: the one of the task or routine, else the default of the workspace — on its working hours in a
 * professional workspace, anywhere in a personal one.
 * @param {SlotRule | null} rule Rule of its own.
 * @param {boolean} perso Personal workspace.
 * @returns {SlotRule} Rule.
 */
export function effectiveSlotRule(rule: SlotRule | null, perso: boolean): SlotRule {
  if (rule) return rule;
  return perso ? { mode: 'ANY', kinds: [] } : { mode: 'INSIDE', kinds: [DEFAULT_SLOT_KIND] };
}

/** Planned slot with the kind of its schedule. */
export interface KindedSlot extends PlannedSlot {
  kind: string;
}

/**
 * Slots of the schedules of the workspace and of those shown from others, with their kind, between two dates.
 * @param {readonly WorkScheduleRule[]} own Schedules of the workspace.
 * @param {readonly { workspaceId: string, rule: WorkScheduleRule }[]} foreign Schedules shown from other workspaces.
 * @param {string} from First date.
 * @param {string} to Last date.
 * @returns {KindedSlot[]} Slots, in order.
 */
export function kindedSlots(own: readonly WorkScheduleRule[], foreign: readonly { workspaceId: string; rule: WorkScheduleRule }[], from: string, to: string): KindedSlot[] {
  const kindOf = new Map<string, string>([
    ...own.map((schedule) => [schedule.id, ownSlotKind(schedule.typeId)] as const),
    ...foreign.map(({ workspaceId, rule }) => [rule.id, foreignSlotKind(workspaceId, rule.typeId)] as const),
  ]);
  return plannedSlots([...own, ...foreign.map(({ rule }) => rule)], from, to).map((slot) => ({ ...slot, kind: kindOf.get(slot.scheduleId) ?? DEFAULT_SLOT_KIND }));
}

/**
 * Whether a moment is allowed by a rule: on a slot of its kinds (INSIDE), on none of them (OUTSIDE), any (ANY).
 * @param {SlotRule} rule Rule.
 * @param {readonly KindedSlot[]} slots Slots of the day (or more).
 * @param {string} date YYYY-MM-DD.
 * @param {string} time HH:MM.
 * @returns {boolean} Allowed.
 */
export function allowedAt(rule: SlotRule, slots: readonly KindedSlot[], date: string, time: string): boolean {
  if (rule.mode === 'ANY') return true;
  const on = slots.some((slot) => slot.date === date && rule.kinds.includes(slot.kind) && slot.start <= time && time < slot.end);
  return rule.mode === 'INSIDE' ? on : !on;
}

/**
 * First allowed moment from a moment on, within the slots given: the moment itself, else the start of the next slot of
 * its kinds (INSIDE), or the end of the slots it falls in (OUTSIDE); null when none in the slots given.
 * @param {SlotRule} rule Rule.
 * @param {readonly KindedSlot[]} slots Slots, in order, from the date on.
 * @param {string} date YYYY-MM-DD.
 * @param {string} time HH:MM.
 * @returns {{ date: string, time: string } | null} Moment.
 */
export function nextAllowed(rule: SlotRule, slots: readonly KindedSlot[], date: string, time: string): { date: string; time: string } | null {
  if (allowedAt(rule, slots, date, time)) return { date, time };
  const later = (slot: KindedSlot, at: string) => slot.date > date || (slot.date === date && at >= time);
  const candidates =
    rule.mode === 'INSIDE'
      ? slots.filter((slot) => rule.kinds.includes(slot.kind) && later(slot, slot.start)).map((slot) => ({ date: slot.date, time: slot.start }))
      : slots
          .filter((slot) => rule.kinds.includes(slot.kind) && later(slot, slot.end))
          .map((slot) => (slot.end >= '24:00' ? { date: addDays(slot.date, 1), time: '00:00' } : { date: slot.date, time: slot.end }));
  return candidates.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).find((moment) => allowedAt(rule, slots, moment.date, moment.time)) ?? null;
}

/**
 * Rule restricted to the kinds that have schedules: a kind without any constrains nothing (a professional workspace
 * without working hours yet does not block everything). ANY when none is left.
 * @param {SlotRule} rule Rule.
 * @param {ReadonlySet<string>} known Kinds with at least one schedule.
 * @returns {SlotRule} Rule.
 */
export function knownSlotRule(rule: SlotRule, known: ReadonlySet<string>): SlotRule {
  if (rule.mode === 'ANY') return rule;
  const kinds = rule.kinds.filter((kind) => known.has(kind));
  return kinds.length ? { mode: rule.mode, kinds } : { mode: 'ANY', kinds: [] };
}

/**
 * Kinds of a set of schedules, of the workspace and shown from others.
 * @param {readonly { typeId?: string | null }[]} own Schedules of the workspace.
 * @param {readonly { workspaceId: string, typeId?: string | null }[]} foreign Schedules shown from other workspaces.
 * @returns {Set<string>} Kinds.
 */
export function scheduleKinds(own: readonly { typeId?: string | null }[], foreign: readonly { workspaceId: string; typeId?: string | null }[]): Set<string> {
  return new Set([...own.map((schedule) => ownSlotKind(schedule.typeId)), ...foreign.map((schedule) => foreignSlotKind(schedule.workspaceId, schedule.typeId))]);
}
