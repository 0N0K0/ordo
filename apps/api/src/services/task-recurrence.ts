import { addDays, daysBetween, formatDay, occurrenceDates, parseDay, recurrenceSchema, type Recurrence } from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type Task } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { storedRecurrence } from './calendar-events';

/**
 * Date a task repeats from: its start, or else its end.
 * @param {Pick<Task, 'startDate' | 'endDate'>} task Task.
 * @returns {string | null} Calendar date.
 */
function anchorOf(task: Pick<Task, 'startDate' | 'endDate'>): string | null {
  const date = task.startDate ?? task.endDate;
  return date ? formatDay(date) : null;
}

/**
 * Makes a task recurring (it becomes the first occurrence of its series), changes its repetition, or
 * stops it (null; the occurrences already created stay, as plain tasks).
 * @param {string} id Task id (an occurrence: its series is changed).
 * @param {unknown} recurrence Rule, or null.
 * @returns {Promise<Task>} First task of the series.
 */
export async function setTaskRecurrence(id: string, recurrence: unknown): Promise<Task> {
  const found = await prisma.task.findUnique({ where: { id } });
  if (!found) throw notFound('Tâche');
  const task = found.seriesId ? ((await prisma.task.findUnique({ where: { id: found.seriesId } })) ?? found) : found;

  if (recurrence === null) {
    return prisma.$transaction(async (tx) => {
      await tx.task.updateMany({ where: { seriesId: task.id }, data: { seriesId: null } });
      return tx.task.update({ where: { id: task.id }, data: { recurrence: Prisma.DbNull, occurrenceDate: null } });
    });
  }
  const rule = parseInput(recurrenceSchema, recurrence);
  const anchor = anchorOf(task);
  if (!anchor) throw clientError('BAD_USER_INPUT', 'Donnez d’abord une date de début ou de fin à la tâche : elle se répète à partir de cette date.');
  if (rule.until && rule.until < anchor) throw clientError('BAD_USER_INPUT', 'La fin de la répétition doit suivre la date de la tâche.');
  return prisma.task.update({ where: { id: task.id }, data: { recurrence: rule, occurrenceDate: parseDay(anchor), seriesId: null } });
}

/**
 * Creates the occurrences of the recurring tasks falling in a period (the one displayed by the calendar),
 * and only them: a series without end never creates more than what is looked at. An occurrence copies its
 * series' first task (title, description, project, priority, type, assignees, tags, effort, parent), opens with
 * the first "to do" status, and its dates move with its occurrence date.
 * @param {string} from First date.
 * @param {string} to Last date.
 * @returns {Promise<number>} Number of tasks created.
 */
export async function materializeTaskOccurrences(from: string, to: string): Promise<number> {
  if (daysBetween(from, to) > 62) throw clientError('BAD_USER_INPUT', 'Période trop longue (62 jours maximum).');
  const series = await prisma.task.findMany({
    where: { recurrence: { not: Prisma.DbNull }, archivedAt: null, seriesId: null },
    include: { assignees: { select: { id: true } }, tags: { select: { id: true } }, occurrences: { select: { occurrenceDate: true } } },
  });
  if (series.length === 0) return 0;
  const status = await prisma.taskStatus.findFirst({ where: { category: 'TODO' }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  let position = ((await prisma.task.aggregate({ _max: { position: true } }))._max.position ?? -1) + 1;
  let created = 0;

  for (const task of series) {
    const rule: Recurrence | null = storedRecurrence(task.recurrence);
    const anchor = anchorOf(task);
    if (!rule || !anchor) continue;
    const existing = new Set([anchor, ...task.occurrences.flatMap((item) => (item.occurrenceDate ? [formatDay(item.occurrenceDate)] : []))]);
    for (const date of occurrenceDates(rule, anchor, from, to)) {
      if (existing.has(date)) continue;
      const shift = daysBetween(anchor, date);
      const moved = (value: Date | null) => (value ? parseDay(addDays(formatDay(value), shift)) : null);
      // The unique (series, date) pair is not enforced by the schema: concurrent calls are serialized by the check above.
      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          projectId: task.projectId,
          statusId: status?.id ?? null,
          priorityId: task.priorityId,
          typeId: task.typeId,
          effort: task.effort,
          parentId: task.parentId,
          startDate: moved(task.startDate),
          endDate: moved(task.endDate),
          seriesId: task.id,
          occurrenceDate: parseDay(date),
          position: position++,
          assignees: { connect: task.assignees },
          tags: { connect: task.tags },
        },
      });
      existing.add(date);
      created += 1;
    }
  }
  return created;
}

/**
 * Remembers the occurrence dates of tasks about to be deleted, so they are not created again.
 * @param {string[]} ids Deleted tasks.
 * @returns {Promise<void>}
 */
export async function forgetDeletedOccurrences(ids: string[]): Promise<void> {
  const occurrences = await prisma.task.findMany({
    where: { id: { in: ids }, seriesId: { not: null }, occurrenceDate: { not: null } },
    select: { seriesId: true, occurrenceDate: true },
  });
  const bySeries = new Map<string, string[]>();
  for (const item of occurrences) bySeries.set(item.seriesId!, [...(bySeries.get(item.seriesId!) ?? []), formatDay(item.occurrenceDate!)]);
  for (const [seriesId, dates] of bySeries) {
    const series = await prisma.task.findUnique({ where: { id: seriesId }, select: { recurrence: true } });
    const rule = series ? storedRecurrence(series.recurrence) : null;
    if (!rule) continue;
    await prisma.task.update({
      where: { id: seriesId },
      data: { recurrence: { ...rule, exceptions: [...new Set([...rule.exceptions, ...dates])].sort() } },
    });
  }
}
