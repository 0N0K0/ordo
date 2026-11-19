import { addDays, blockingEvent, conditionAllowsAt, conditionScheduleIds, dayPart, readSlotCondition, scheduleSlotsOn, type SlotCondition, type SlotsOn } from '@ordo/shared';
import { prisma } from '../../db';
import { assertAllExist } from '../core/lookup';
import { assertNoneArchived } from '../core/archive';
import { eventOccurrences } from './calendar-events';
import { scheduleRule } from './work-schedules';

/**
 * Slots of the schedules of the current workspace (archived ones too), loaded once, those of a day computed when first
 * asked: what the conditions of tasks and routines are evaluated on.
 * @returns {Promise<SlotsOn>} Slots of some schedules on a day.
 */
export async function loadSlotsOn(): Promise<SlotsOn> {
  return scheduleSlotsOn((await prisma.workSchedule.findMany()).map(scheduleRule));
}

/**
 * Checks the schedules a condition (or several: a routine and its cases) names: they exist, and none is archived but
 * those already there.
 * @param {readonly (SlotCondition | null | undefined)[]} conditions Conditions saved.
 * @param {readonly (SlotCondition | null | undefined)[] | true} kept Conditions already there (their archived schedules
 * stay), true: every schedule counts as kept (undo).
 * @returns {Promise<void>}
 */
export async function assertConditionSchedules(conditions: readonly (SlotCondition | null | undefined)[], kept: readonly (SlotCondition | null | undefined)[] | true): Promise<void> {
  const ids = [...new Set(conditions.flatMap(conditionScheduleIds))];
  await assertAllExist(prisma.workSchedule, ids, 'Plage', { field: 'slotCondition' });
  await assertNoneArchived('workSchedule', ids, { keep: kept === true ? ids : kept.flatMap(conditionScheduleIds) });
}

/**
 * Current moment of the user: their day and time.
 * @param {number} utcOffset User's offset from UTC in minutes.
 * @returns {{ date: string, time: string }} YYYY-MM-DD and HH:MM.
 */
function userNow(utcOffset: number): { date: string; time: string } {
  const iso = new Date(Date.now() + utcOffset * 60_000).toISOString();
  return { date: dayPart(iso), time: iso.slice(11, 16) };
}

/**
 * Open tasks of the current workspace that can be done now: their condition on calendar schedules (none: any time)
 * allows the user's current moment, and no event keeps their assignees (none: « Moi ») busy, but one about the task.
 * @param {number} utcOffset User's offset from UTC in minutes.
 * @param {string | null} meId Contributor profile of the user (« Moi »).
 * @returns {Promise<string[]>} Task ids.
 */
export async function doableTaskIds(utcOffset: number, meId: string | null): Promise<string[]> {
  const now = userNow(utcOffset);
  const [slotsOn, tasks, events] = await Promise.all([
    loadSlotsOn(),
    prisma.task.findMany({ where: { closedAt: null, archivedAt: null }, select: { id: true, slotCondition: true, assignees: { select: { id: true } } } }),
    // Archived events (and those of archived calendars) keep nobody busy.
    eventOccurrences(addDays(now.date, -1), now.date, undefined, true),
  ]);
  const at = new Date();
  return tasks
    .filter(
      (task) =>
        conditionAllowsAt(readSlotCondition(task.slotCondition), slotsOn, now.date, now.time) &&
        !blockingEvent(events, { assigneeIds: task.assignees.map((assignee) => assignee.id), taskId: task.id }, meId, at, now.date),
    )
    .map((task) => task.id);
}
