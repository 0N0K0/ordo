import { z } from 'zod';
import { addDays } from './recurrence';
import { plannedSlots, type PlannedSlot, type WorkScheduleRule } from './work-schedules';

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

const kindsSchema = z.array(z.string().min(1).max(120)).max(30).default([]);

/**
 * Slots a task or a routine is done on and out of (whatever the day), by kind, of this workspace or shown from
 * others: during one of the `inside` kinds (any moment when none), and out of every `outside` kind. Both empty:
 * anywhere.
 */
export const slotRuleSchema = z
  .object({ inside: kindsSchema, outside: kindsSchema })
  .refine((rule) => !rule.inside.some((kind) => rule.outside.includes(kind)), { path: ['outside'], message: 'Un type de plages ne peut pas être à la fois choisi et exclu.' });
export type SlotRule = z.infer<typeof slotRuleSchema>;

/** Anywhere. */
export const ANY_SLOT_RULE: SlotRule = { inside: [], outside: [] };

/**
 * Rule stored or received (JSON), validated: null when none or invalid. The former form ({ mode, kinds }) is read too.
 * @param {unknown} value Rule.
 * @returns {SlotRule | null} Rule.
 */
export function readSlotRule(value: unknown): SlotRule | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && 'mode' in value) {
    const { mode, kinds } = value as { mode?: unknown; kinds?: unknown };
    const list = Array.isArray(kinds) ? kinds.filter((kind): kind is string => typeof kind === 'string') : [];
    if (mode === 'ANY') return ANY_SLOT_RULE;
    if (mode === 'INSIDE') return { inside: list, outside: [] };
    if (mode === 'OUTSIDE') return { inside: [], outside: list };
    return null;
  }
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
  return perso ? ANY_SLOT_RULE : { inside: [DEFAULT_SLOT_KIND], outside: [] };
}

/**
 * Whether a rule constrains nothing (anywhere).
 * @param {SlotRule} rule Rule.
 * @returns {boolean} Anywhere.
 */
export const isAnySlotRule = (rule: SlotRule) => rule.inside.length === 0 && rule.outside.length === 0;

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
 * Whether a moment is allowed by a rule: on a slot of one of its `inside` kinds (any moment when none), and on none of
 * its `outside` kinds.
 * @param {SlotRule} rule Rule.
 * @param {readonly KindedSlot[]} slots Slots of the day (or more).
 * @param {string} date YYYY-MM-DD.
 * @param {string} time HH:MM.
 * @returns {boolean} Allowed.
 */
export function allowedAt(rule: SlotRule, slots: readonly KindedSlot[], date: string, time: string): boolean {
  if (isAnySlotRule(rule)) return true;
  const on = (kinds: readonly string[]) => slots.some((slot) => slot.date === date && kinds.includes(slot.kind) && slot.start <= time && time < slot.end);
  return (rule.inside.length === 0 || on(rule.inside)) && !on(rule.outside);
}

/**
 * First allowed moment from a moment on, within the slots given: the moment itself, else the earliest allowed start of
 * an `inside` slot or end of an `outside` slot; null when none in the slots given.
 * @param {SlotRule} rule Rule.
 * @param {readonly KindedSlot[]} slots Slots, in order, from the date on.
 * @param {string} date YYYY-MM-DD.
 * @param {string} time HH:MM.
 * @returns {{ date: string, time: string } | null} Moment.
 */
export function nextAllowed(rule: SlotRule, slots: readonly KindedSlot[], date: string, time: string): { date: string; time: string } | null {
  if (allowedAt(rule, slots, date, time)) return { date, time };
  const later = (slot: KindedSlot, at: string) => slot.date > date || (slot.date === date && at >= time);
  const starts = slots.filter((slot) => rule.inside.includes(slot.kind) && later(slot, slot.start)).map((slot) => ({ date: slot.date, time: slot.start }));
  const ends = slots
    .filter((slot) => rule.outside.includes(slot.kind) && later(slot, slot.end))
    .map((slot) => (slot.end >= '24:00' ? { date: addDays(slot.date, 1), time: '00:00' } : { date: slot.date, time: slot.end }));
  return [...starts, ...ends].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).find((moment) => allowedAt(rule, slots, moment.date, moment.time)) ?? null;
}

/**
 * Rule restricted to the kinds that have schedules: a kind without any constrains nothing (a professional workspace
 * without working hours yet does not block everything).
 * @param {SlotRule} rule Rule.
 * @param {ReadonlySet<string>} known Kinds with at least one schedule.
 * @returns {SlotRule} Rule.
 */
export function knownSlotRule(rule: SlotRule, known: ReadonlySet<string>): SlotRule {
  return { inside: rule.inside.filter((kind) => known.has(kind)), outside: rule.outside.filter((kind) => known.has(kind)) };
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
