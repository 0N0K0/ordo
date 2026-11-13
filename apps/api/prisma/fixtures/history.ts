import { fakerFR as faker } from '@faker-js/faker';
import { prisma } from '../../src/db';

/**
 * History of the statuses of the tasks of the current workspace: created to do a few weeks before they started or
 * closed, started, then closed. The fixtures create every task at once, closed ones included: their creation goes back
 * (the trigger only watches the status and the closing) and their history is rebuilt.
 * @param {string} todoId "To do" status.
 * @param {string} doingId "In progress" status.
 * @returns {Promise<void>}
 */
export async function rebuildStatusHistory(todoId: string, doingId: string): Promise<void> {
  const now = new Date();
  const tasks = await prisma.task.findMany({ select: { id: true, statusId: true, closedAt: true, startDate: true, status: { select: { category: true } } } });
  const hour = 3_600_000;
  const history: { taskId: string; statusId: string | null; closed: boolean; at: Date }[] = [];
  for (const task of tasks) {
    const category = task.status?.category ?? 'TODO';
    const end = task.closedAt ?? now;
    const createdAt = new Date(Math.min(end.getTime() - faker.number.int({ min: 1, max: 30 }) * 24 * hour, task.startDate?.getTime() ?? Infinity));
    await prisma.task.update({ where: { id: task.id }, data: { createdAt } });
    const started = new Date((createdAt.getTime() + end.getTime()) / 2);
    history.push({ taskId: task.id, statusId: category === 'TODO' ? task.statusId : todoId, closed: false, at: createdAt });
    if (category !== 'TODO' && category !== 'CANCELLED') history.push({ taskId: task.id, statusId: doingId, closed: false, at: started });
    if (category !== 'TODO' && task.statusId !== doingId)
      history.push({ taskId: task.id, statusId: task.statusId, closed: Boolean(task.closedAt), at: new Date(Math.max(end.getTime(), started.getTime() + hour)) });
  }
  await prisma.taskStatusChange.deleteMany();
  await prisma.taskStatusChange.createMany({ data: history });
}
