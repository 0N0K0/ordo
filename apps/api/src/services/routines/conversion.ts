import { conversionLoss, DAILY_RECURRENCE, daysBetween, formatOptionalDay, parseDay, parseOptionalDay, readDeadTimes, readReminders, readSlotCondition, sumOf, type ConversionLoss, type RoutineOpens } from '@ordo/shared';
import { prisma } from '../../db';
import { Prisma } from '../../generated/prisma/client';
import { clientError } from '../../graphql/errors';
import { findActive } from '../core/archive';
import { toJson } from '../core/json';
import { readLinks } from '../core/links';
import { BY_POSITION, nextPositionIn } from '../core/ordering';
import { forgetGithubItems } from '../github/links';
import { DUE_DATES_SELECT, storedDueDates } from '../tasks/due-dates';
import { parisToday } from '../../today';
import { firstOccurrence, loadScheduleContext, occurrenceSpansBetween, occurrencesOf, placeLegacyRoutineComments, ROUTINE_LINKS, slotsOf, storedCondition, type RoutineTiming } from './routines';

/** Largest « Ouverture » of a routine before its due day, in days (`routineOpensSchema`, mode BEFORE). */
const MAX_OPENS_BEFORE = 366;

/**
 * Refuses a conversion until its losses are confirmed (lot 15): CONFIRMATION_REQUIRED, extension `lost` (what is
 * lost, by kind), even when nothing is (the item itself is replaced by another one: texts linking to it lose it).
 * @param {ConversionLoss} lost What the conversion loses.
 * @param {boolean} confirm Confirmed.
 * @param {string} message Message of the question.
 * @returns {void}
 */
function assertConversionConfirmed(lost: ConversionLoss, confirm: boolean, message: string): void {
  if (!confirm) throw clientError('CONFIRMATION_REQUIRED', message, { lost });
}

/**
 * Turns a task into a routine (lot 15), in one transaction: a new routine, the task deleted. It keeps the label,
 * description, project, assignees, beneficiaries, links, place, slot condition and reminders « À HH:MM »; its times,
 * sheets and checklist move to the routine; its comments go to the first occurrence; its one-off events become events
 * of that day of the routine. Its « Échéance » (its own, else its single sprint's) is the due day of the first
 * occurrence (none: its « Ouverture », else today), its « Ouverture » the routine's « Ouverture » when it differs. It
 * repeats every day (chosen afterwards in its panel). A closed task (« Fermée », cancelled included) ticks that first
 * occurrence, each of its times of the day, when it closed (not when it is still to come: not late either). Refused for an archived task or one with sub-tasks. What it loses
 * (number, status, priority, type, tags, milestone, sprints, GitHub item, effort, dates, links with tasks, shopping
 * lists, alarms' link, recurring events, parent) is asked first (`confirm`).
 * @param {string} id Task id.
 * @param {boolean} confirm Losses confirmed (false: CONFIRMATION_REQUIRED with them, nothing changed).
 * @returns {Promise<string>} Id of the routine.
 */
export async function convertTaskToRoutine(id: string, confirm: boolean): Promise<string> {
  await findActive(prisma.task, id, 'Tâche');
  if (await prisma.task.count({ where: { parentId: id } })) {
    throw clientError('BAD_USER_INPUT', 'Une tâche qui a des sous-tâches ne devient pas une routine : déplacez ou supprimez d’abord ses sous-tâches.');
  }
  const task = await prisma.task.findUniqueOrThrow({
    where: { id },
    include: {
      sprints: DUE_DATES_SELECT.sprints,
      assignees: { select: { id: true } },
      beneficiaries: { select: { id: true } },
      beneficiaryRelations: { select: { id: true } },
      tags: { select: { id: true } },
      blocking: { select: { blockedId: true } },
      blockedBy: { select: { blockerId: true } },
      relationsA: { select: { taskBId: true } },
      relationsB: { select: { taskAId: true } },
      comments: { select: { body: true, createdAt: true, updatedAt: true } },
      checklists: { select: { id: true }, orderBy: { createdAt: 'asc' } },
      timeEntries: { select: { id: true } },
      calendarEvents: { select: { id: true, startDate: true, recurrence: true } },
      alarms: { select: { id: true } },
      shoppingLists: { select: { id: true } },
    },
  });
  const oneOff = task.calendarEvents.filter((event) => event.recurrence === null);
  const flag = (value: unknown) => (value === null || value === undefined ? 0 : 1);
  const lost = conversionLoss({
    number: flag(task.number),
    status: flag(task.statusId),
    priority: flag(task.priorityId),
    type: flag(task.typeId),
    tags: task.tags.length,
    milestone: flag(task.milestoneId),
    sprints: task.sprints.length,
    github: flag(task.githubItemId),
    effort: flag(task.effort),
    dates: task.startDate || task.endDate ? 1 : 0,
    taskLinks: sumOf([task.blocking, task.blockedBy, task.relationsA, task.relationsB], (links) => links.length),
    shoppingLists: task.shoppingLists.length,
    alarms: task.alarms.length,
    events: task.calendarEvents.length - oneOff.length,
    // A task has a single checklist: any other one goes.
    checklists: Math.max(0, task.checklists.length - 1),
    parent: flag(task.parentId),
  });
  assertConversionConfirmed(lost, confirm, 'Transformer la tâche en routine lui fait perdre ce qu’une routine n’a pas : confirmez pour continuer.');

  // « Échéance » = due day of the first occurrence; « Ouverture » = its days before, when it differs.
  const { minDate, deadline } = storedDueDates(task);
  const due = deadline ?? minDate ?? parisToday();
  const opens: RoutineOpens | null = minDate && deadline && minDate < deadline ? { mode: 'BEFORE', days: Math.min(MAX_OPENS_BEFORE, daysBetween(minDate, deadline)) } : null;
  const timing: RoutineTiming = {
    startDate: parseDay(due),
    recurrence: DAILY_RECURRENCE as unknown as Prisma.JsonValue,
    cases: [],
    moves: [],
    fromTime: null,
    dueTime: null,
    scheduleIds: [],
    excludedScheduleIds: [],
    moments: [],
    slotCondition: task.slotCondition,
    opensOn: opens,
  };
  // Its condition may leave the first days without any moment: the first occurrence scheduled.
  const schedules = await loadScheduleContext();
  const first = firstOccurrence(timing, schedules) ?? due;
  const firstDate = parseDay(first);
  // Closed: its first occurrence done (each of its times of the day), not to show late; one to come is not ticked.
  const ticked = task.closedAt && first <= parisToday() ? Math.max(1, slotsOf(timing, first, schedules).length) : 0;
  // Off the GitHub board, as a deleted task.
  await forgetGithubItems([id]);
  const position = await nextPositionIn('routine');

  return prisma.$transaction(async (tx) => {
    const routine = await tx.routine.create({
      data: {
        label: task.label,
        description: task.description,
        startDate: timing.startDate,
        recurrence: toJson(DAILY_RECURRENCE),
        slotCondition: readSlotCondition(task.slotCondition) ? toJson(task.slotCondition) : Prisma.DbNull,
        reminders: toJson(readReminders(task.reminders)),
        deadTimes: toJson(readDeadTimes(task.deadTimes)),
        opensOn: opens ? toJson(opens) : Prisma.DbNull,
        location: task.location,
        locationLat: task.locationLat,
        locationLon: task.locationLon,
        links: toJson(readLinks(task.links)),
        projectId: task.projectId,
        position,
        // Already on the task: kept, as a value already there (even archived, or no longer of the project).
        assignees: { connect: task.assignees },
        beneficiaries: { connect: task.beneficiaries },
        beneficiaryRelations: { connect: task.beneficiaryRelations },
        timeEntries: { connect: task.timeEntries },
      },
    });
    if (ticked) await tx.routineCheck.createMany({ data: Array.from({ length: ticked }, (_, slot) => ({ routineId: routine.id, date: firstDate, slot, doneAt: task.closedAt ?? undefined })) });
    if (task.comments.length) await tx.comment.createMany({ data: task.comments.map((comment) => ({ ...comment, routineId: routine.id, occurrenceDate: firstDate })) });
    await tx.sheetLink.updateMany({ where: { taskId: id }, data: { taskId: null, routineId: routine.id } });
    const [checklist] = task.checklists;
    if (checklist) await tx.checklist.update({ where: { id: checklist.id }, data: { taskId: null, routineId: routine.id, occurrenceDate: firstDate } });
    // A one-off event: the routine of that day done during it.
    if (oneOff.length) await tx.calendarEventRoutine.createMany({ data: oneOff.map((event) => ({ eventId: event.id, routineId: routine.id, date: event.startDate })), skipDuplicates: true });
    // Alarms stay, without their task (as they stay without their project).
    await tx.alarm.updateMany({ where: { taskId: id }, data: { taskId: null } });
    await tx.task.delete({ where: { id } });
    return routine.id;
  });
}

/**
 * Turns a routine into a task (lot 15), in one transaction: a new task, the routine deleted. It keeps the label,
 * description, project, assignees, beneficiaries, links, place, slot condition and reminders « À HH:MM »; its times and
 * sheets move to the task; the comments, checklist and events of its current occurrence (else the next, else the
 * first) go to the task, its « Échéance » that occurrence's due day and its « Ouverture » its first day when it
 * differs; it gets the first status « À faire » (not archived; none without any). Refused for an archived routine or
 * one with sub-routines. What it loses (repetition, ticks, reminders « avant », links with routines, categories, time
 * to spend, travel, the comments, checklists and events of the other occurrences, parent) is asked first (`confirm`).
 * @param {string} id Routine id.
 * @param {boolean} confirm Losses confirmed (false: CONFIRMATION_REQUIRED with them, nothing changed).
 * @returns {Promise<string>} Id of the task.
 */
export async function convertRoutineToTask(id: string, confirm: boolean): Promise<string> {
  await findActive(prisma.routine, id, 'Routine');
  if (await prisma.routine.count({ where: { parentId: id } })) {
    throw clientError('BAD_USER_INPUT', 'Une routine qui a des sous-routines ne devient pas une tâche : déplacez ou supprimez d’abord ses sous-routines.');
  }
  // Comments written before they were on occurrences: placed first, to follow theirs.
  await placeLegacyRoutineComments([id]);
  const routine = await prisma.routine.findUniqueOrThrow({
    where: { id },
    include: {
      ...ROUTINE_LINKS,
      requiredBy: { select: { routineId: true } },
      comments: { select: { body: true, createdAt: true, updatedAt: true, occurrenceDate: true } },
      checklists: { select: { id: true, occurrenceDate: true } },
      eventLinks: { select: { eventId: true, date: true } },
      timeEntries: { select: { id: true } },
      _count: { select: { checks: true } },
    },
  });
  // Its occurrence of now, as its panel shows it.
  const schedules = await loadScheduleContext();
  const { current, next } = occurrencesOf(routine, undefined, schedules);
  const occurrence = current ?? next ?? firstOccurrence(routine, schedules);
  const span = occurrence ? occurrenceSpansBetween(routine, occurrence, occurrence, schedules).find((item) => item.end === occurrence) : undefined;
  const opening = span && span.start < span.end ? span.start : null;
  const onOccurrence = (date: Date | null) => occurrence !== null && formatOptionalDay(date) === occurrence;
  const comments = routine.comments.filter((comment) => onOccurrence(comment.occurrenceDate));
  const checklist = routine.checklists.find((item) => onOccurrence(item.occurrenceDate));
  const eventIds = [...new Set(routine.eventLinks.filter((link) => onOccurrence(link.date)).map((link) => link.eventId))];
  const reminders = readReminders(routine.reminders);
  const lost = conversionLoss({
    repetition: 1,
    checks: routine._count.checks,
    beforeReminders: reminders.filter((reminder) => reminder.at === null).length,
    routineLinks: sumOf([routine.requires, routine.requiredBy, routine.relationsA, routine.relationsB], (links) => links.length),
    categories: routine.categories.length,
    estimate: routine.estimate === null ? 0 : 1,
    travel: routine.travelBefore || routine.travelAfter ? 1 : 0,
    comments: routine.comments.length - comments.length,
    checklists: routine.checklists.length - (checklist ? 1 : 0),
    events: routine.eventLinks.filter((link) => !onOccurrence(link.date)).length,
    parent: routine.parentId === null ? 0 : 1,
  });
  assertConversionConfirmed(lost, confirm, 'Transformer la routine en tâche lui fait perdre ce qu’une tâche n’a pas : confirmez pour continuer.');

  const condition = storedCondition(routine);
  const todo = await prisma.taskStatus.findFirst({ where: { category: 'TODO', archivedAt: null }, orderBy: BY_POSITION, select: { id: true } });
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        label: routine.label,
        description: routine.description,
        projectId: routine.projectId,
        statusId: todo?.id ?? null,
        slotCondition: condition ? toJson(condition) : Prisma.DbNull,
        // A task counts them from its due day: those from the end of the routine (its due day) lose their anchor.
        reminders: toJson(reminders.flatMap(({ anchor: _anchor, ...reminder }) => (reminder.at !== null ? [reminder] : []))),
        deadTimes: toJson(readDeadTimes(routine.deadTimes)),
        minDate: parseOptionalDay(opening),
        deadline: parseOptionalDay(occurrence),
        location: routine.location,
        locationLat: routine.locationLat,
        locationLon: routine.locationLon,
        links: toJson(readLinks(routine.links)),
        position: await nextPositionIn('task', {}, tx),
        // Already on the routine: kept, as a value already there (even archived, or no longer of the project).
        assignees: { connect: routine.assignees },
        beneficiaries: { connect: routine.beneficiaries },
        beneficiaryRelations: { connect: routine.beneficiaryRelations },
        timeEntries: { connect: routine.timeEntries },
        calendarEvents: { connect: eventIds.map((eventId) => ({ id: eventId })) },
      },
    });
    if (comments.length) await tx.taskComment.createMany({ data: comments.map((comment) => ({ body: comment.body, createdAt: comment.createdAt, updatedAt: comment.updatedAt, taskId: task.id })) });
    await tx.sheetLink.updateMany({ where: { routineId: id }, data: { routineId: null, taskId: task.id } });
    if (checklist) await tx.checklist.update({ where: { id: checklist.id }, data: { routineId: null, occurrenceDate: null, taskId: task.id } });
    await tx.routine.delete({ where: { id } });
    return task.id;
  });
}
