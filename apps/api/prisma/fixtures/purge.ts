import { prisma } from '../../src/db';

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
  for (const model of [
    prisma.scheduledMail,
    prisma.mailMark,
    prisma.mailSearch,
    prisma.mailLabel,
    prisma.routine,
    prisma.routineCategory,
    prisma.shoppingList,
    prisma.shoppingBaseList,
    prisma.shoppingCategory,
    prisma.shoppingStore,
    prisma.shoppingStorage,
    prisma.place,
    prisma.libraryDocument,
    prisma.documentFolder,
    prisma.importedDocument,
    prisma.documentSequence,
    prisma.catalogItem,
    prisma.treasuryBudget,
    prisma.treasuryRelation,
    prisma.treasuryContextPeriod,
    prisma.treasuryContext,
    prisma.treasuryAccount,
    prisma.treasuryCategory,
    prisma.treasuryPaymentMethod,
    prisma.treasuryCounterparty,
    prisma.calendarEvent,
    prisma.calendarSubscription,
    prisma.calendar,
    prisma.calendarCategory,
    prisma.workScheduleSubscription,
    prisma.workSchedule,
    prisma.scheduleType,
    prisma.timeEntry,
    prisma.task,
    prisma.taskView,
    prisma.dashboard,
    prisma.project,
    prisma.client,
    prisma.projectCategory,
    prisma.projectStatus,
    prisma.taskStatus,
    prisma.taskPriority,
    prisma.taskType,
    prisma.taskTag,
    prisma.attachment,
  ] as unknown as { deleteMany: () => Promise<unknown> }[]) {
    await model.deleteMany();
  }
  await prisma.contributor.deleteMany({ where: { userId: null } });
  await prisma.contributor.updateMany({ data: { teamMember: false } });
  await prisma.icon.deleteMany({ where: { contributors: { none: {} } } });
}
