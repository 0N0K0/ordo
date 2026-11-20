import { prisma } from '../../src/db';
import type { Prisma } from '../../src/generated/prisma/client';
import { modelDelegate } from '../../src/services/core/delegate';

/**
 * Empties the current workspace before its fixtures: every business row goes, the "Moi" contributors (and their
 * icons), the mail accounts (their credentials), the company profile and the tracking statuses stay.
 * @returns {Promise<void>}
 */
export async function purgeWorkspace(): Promise<void> {
  // Rows other rows forbid to delete go first.
  await prisma.alarm.deleteMany();
  await prisma.treasuryAllocation.deleteMany();
  await prisma.treasuryEntry.deleteMany();
  await prisma.accountingDocument.updateMany({ data: { sourceId: null } });
  await prisma.accountingDocument.deleteMany();
  const emptied: Uncapitalize<Prisma.ModelName>[] = [
    'scheduledMail',
    'mailMark',
    'mailSearch',
    'mailLabel',
    'routine',
    'routineCategory',
    'shoppingList',
    'shoppingBaseList',
    'shoppingCategory',
    'shoppingStore',
    'shoppingStorage',
    'place',
    'libraryDocument',
    'documentFolder',
    'importedDocument',
    'documentSequence',
    'catalogItem',
    'treasuryBudget',
    'treasuryRelation',
    'treasuryContext',
    'treasuryAccount',
    'treasuryCategory',
    'treasuryPaymentMethod',
    'treasuryCounterparty',
    'calendarEvent',
    'calendarSubscription',
    'calendar',
    'calendarCategory',
    'workScheduleSubscription',
    'workSchedule',
    'scheduleType',
    'timeEntry',
    'task',
    'taskView',
    'dashboard',
    'project',
    'client',
    'projectCategory',
    'projectStatus',
    'taskStatus',
    'taskPriority',
    'taskType',
    'taskTag',
    'attachment',
  ];
  for (const model of emptied) await modelDelegate<{ deleteMany: () => Promise<unknown> }>(model).deleteMany();
  await prisma.contributor.deleteMany({ where: { userId: null } });
  await prisma.contributor.updateMany({ data: { teamMember: false } });
  await prisma.icon.deleteMany({ where: { contributors: { none: {} } } });
}
