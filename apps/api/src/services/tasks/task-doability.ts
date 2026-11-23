import { addDays, blockingEvent, conditionBlockAt, parisParts, readSlotCondition, readTaskHours, type ConditionBlock, type EffectiveTask, type TaskWaitReason } from '@ordo/shared';
import { prisma } from '../../db';
import { eventOccurrences } from '../calendar/calendar-events';
import { loadSlotsOn } from '../calendar/slot-conditions';
import { effectiveTaskOf, loadTaskInheritance } from './task-inheritance';

/** Reason a task waits for, by what keeps it from the moment. */
const WAIT_REASON_OF_BLOCK: Record<ConditionBlock, TaskWaitReason> = { hours: 'OUTSIDE_HOURS', slots: 'OUTSIDE_SLOTS', unavailable: 'UNAVAILABLE' };

/** An open task and why it cannot be done now (null: it can). */
export interface TaskDoability {
  id: string;
  reason: TaskWaitReason | null;
}

/**
 * Open tasks of the current workspace and whether they can be done now: their « Ouverture » (as they go:
 * `effectiveTask`) is not after today in Paris, their « Horaires » and their condition on calendar schedules (their
 * own or inherited; none: any time) both allow the current moment in Paris, no slot « Indisponible » of the workspace
 * holds it, and no event keeps their assignees (their own or inherited; none:
 * « Moi ») busy, but one about the task; else the first of these that fails, in this order.
 * @param {string | null} meId Contributor profile of the user (« Moi »).
 * @returns {Promise<TaskDoability[]>} Open tasks.
 */
export async function taskDoability(meId: string | null): Promise<TaskDoability[]> {
  const at = new Date();
  const now = parisParts(at);
  const [open, inheritance, events] = await Promise.all([
    prisma.task.findMany({ where: { closedAt: null, archivedAt: null }, select: { id: true } }),
    loadTaskInheritance(),
    // Archived events (and those of archived calendars) keep nobody busy.
    eventOccurrences(addDays(now.date, -1), now.date, undefined, true),
  ]);
  const tasks = open.map((task) => effectiveTaskOf(inheritance, task.id)).filter((task) => task !== null);
  const conditions = new Map(tasks.map((task) => [task.id, readSlotCondition(task.slotCondition)]));
  const slotsOn = await loadSlotsOn([...conditions.values()]);
  /**
   * Why a task cannot be done now, null: it can.
   * @param {EffectiveTask} task Task, as it goes.
   * @returns {TaskWaitReason | null} Reason.
   */
  const reasonOf = (task: EffectiveTask): TaskWaitReason | null => {
    // Not to be done before its « Ouverture ».
    if ((task.minDate ?? now.date) > now.date) return 'NOT_OPEN';
    const block = conditionBlockAt(conditions.get(task.id), slotsOn, now.date, now.time, readTaskHours(task.hours));
    if (block) return WAIT_REASON_OF_BLOCK[block];
    return blockingEvent(events, { assigneeIds: [...task.assigneeIds], taskId: task.id }, meId, at, now.date) ? 'ASSIGNEE_BUSY' : null;
  };
  return tasks.map((task) => ({ id: task.id, reason: reasonOf(task) }));
}
