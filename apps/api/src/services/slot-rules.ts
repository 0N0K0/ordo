import { addDays, allowedAt, blockingEvent, effectiveSlotRule, kindedSlots, knownSlotRule, readSlotRule, scheduleKinds, type KindedSlot } from '@ordo/shared';
import { prisma } from '../db';
import { currentWorkspace } from '../workspace-context';
import { eventOccurrences } from './calendar-events';
import { scheduleRule, subscribedSchedules } from './work-schedules';

/**
 * Slots of the schedules of the current workspace and of those it shows from others, with their kind.
 * @param {string} from First date (YYYY-MM-DD).
 * @param {string} to Last date (YYYY-MM-DD).
 * @returns {Promise<{ slots: KindedSlot[], known: Set<string> }>} Slots, in order, and the kinds that have schedules.
 */
export async function workspaceSlots(from: string, to: string): Promise<{ slots: KindedSlot[]; known: Set<string> }> {
  const [own, foreign] = await Promise.all([prisma.workSchedule.findMany(), subscribedSchedules()]);
  const rules = own.map(scheduleRule);
  const shown = foreign.map((item) => ({ workspaceId: item.workspace.id, rule: item.rule }));
  return {
    slots: kindedSlots(rules, shown, from, to),
    known: scheduleKinds(
      rules,
      shown.map(({ workspaceId, rule }) => ({ workspaceId, typeId: rule.typeId })),
    ),
  };
}

/**
 * Current moment of the user: their day and time.
 * @param {number} utcOffset User's offset from UTC in minutes.
 * @returns {{ date: string, time: string }} YYYY-MM-DD and HH:MM.
 */
export function userNow(utcOffset: number): { date: string; time: string } {
  const iso = new Date(Date.now() + utcOffset * 60_000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/**
 * Open tasks of the current workspace that can be done now: their slot rule (else the default of the
 * workspace) allows the user's current moment, and no event keeps their assignees (none: « Moi ») busy, but one about
 * the task.
 * @param {number} utcOffset User's offset from UTC in minutes.
 * @param {string | null} meId Contributor profile of the user (« Moi »).
 * @returns {Promise<string[]>} Task ids.
 */
export async function doableTaskIds(utcOffset: number, meId: string | null): Promise<string[]> {
  const now = userNow(utcOffset);
  const perso = currentWorkspace().kind === 'PERSO';
  const [{ slots, known }, tasks, events] = await Promise.all([
    workspaceSlots(addDays(now.date, -1), now.date),
    prisma.task.findMany({ where: { closedAt: null, archivedAt: null }, select: { id: true, slotRule: true, assignees: { select: { id: true } } } }),
    eventOccurrences(addDays(now.date, -1), now.date),
  ]);
  const at = new Date();
  return tasks
    .filter(
      (task) =>
        allowedAt(knownSlotRule(effectiveSlotRule(readSlotRule(task.slotRule), perso), known), slots, now.date, now.time) &&
        !blockingEvent(events, { assigneeIds: task.assignees.map((assignee) => assignee.id), taskId: task.id }, meId, at, now.date),
    )
    .map((task) => task.id);
}
