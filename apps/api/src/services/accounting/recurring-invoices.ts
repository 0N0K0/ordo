import { addDays, daysBetween, formatDay, formatOptionalDay, occurrenceDates, parseDay, parseOptionalDay, type Recurrence, recurrenceSchema, requiredText, startDaySchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { parisToday } from '../../today';
import type { RecurringInvoice } from '../../generated/prisma/client';
import { clientError, orNotFound, parseInput } from '../../graphql/errors';
import { createDocument, editableFields, finalizeDocument, findDocument } from './accounting-documents';
import { storedRecurrence } from '../calendar/calendar-events';
import { schedulePerWorkspace } from '../workspace/workspaces';
import { requirePro } from '../workspace/workspaces';
import { assertNotArchived } from '../core/archive';
import { assertExists } from '../core/lookup';

const settingsSchema = z.object({
  name: requiredText(200),
  recurrence: recurrenceSchema,
  startDate: startDaySchema,
  autoFinalize: z.boolean(),
  active: z.boolean(),
});
export type RecurringSettings = z.input<typeof settingsSchema>;

/**
 * First issue date of a schedule on or after a date.
 * @param {Recurrence} rule Rule.
 * @param {string} start First date of the schedule.
 * @param {string} from Date.
 * @returns {string | null} Date, null when the schedule is over.
 */
function nextIssueDate(rule: Recurrence, start: string, from: string): string | null {
  // Looks a little over two years ahead (yearly schedules included).
  return occurrenceDates(rule, start, from < start ? start : from, addDays(from < start ? start : from, 800))[0] ?? null;
}

/**
 * Makes an invoice recurring: it is copied as the model of the schedule (the invoice itself is unchanged).
 * @param {string} documentId Invoice used as the model.
 * @param {RecurringSettings} input Schedule.
 * @returns {Promise<RecurringInvoice>} Recurring invoice.
 */
export async function createRecurringInvoice(documentId: string, input: RecurringSettings): Promise<RecurringInvoice> {
  requirePro('facturation');
  const settings = parseInput(settingsSchema, input);
  const source = await findDocument(documentId);
  if (source.type !== 'INVOICE') throw clientError('BAD_USER_INPUT', 'Seule une facture peut être rendue récurrente.');
  await assertNotArchived('ACCOUNTING_DOCUMENT', documentId);
  const template = await createDocument('INVOICE', await editableFields(source), { status: 'TEMPLATE' });
  return prisma.recurringInvoice.create({
    data: {
      name: settings.name,
      templateId: template.id,
      recurrence: settings.recurrence,
      startDate: parseDay(settings.startDate),
      nextDate: (() => {
        const next = nextIssueDate(settings.recurrence, settings.startDate, settings.startDate);
        return parseOptionalDay(next);
      })(),
      autoFinalize: settings.autoFinalize,
      active: settings.active,
    },
  });
}

/**
 * Changes the schedule of a recurring invoice (its model is edited like a draft).
 * @param {string} id Recurring invoice.
 * @param {RecurringSettings} input Schedule.
 * @param {string} today Today.
 * @returns {Promise<RecurringInvoice>} Recurring invoice.
 */
export async function updateRecurringInvoice(id: string, input: RecurringSettings, today: string): Promise<RecurringInvoice> {
  await assertExists(prisma.recurringInvoice, id, 'Facture récurrente');
  await assertNotArchived('RECURRING_INVOICE', id);
  const settings = parseInput(settingsSchema, input);
  const next = nextIssueDate(settings.recurrence, settings.startDate, today > settings.startDate ? today : settings.startDate);
  return prisma.recurringInvoice.update({
    where: { id },
    data: { ...settings, startDate: parseDay(settings.startDate), nextDate: parseOptionalDay(next) },
  });
}

/**
 * Deletes a recurring invoice and its model (the invoices it issued are kept).
 * @param {string} id Recurring invoice.
 * @returns {Promise<void>}
 */
export async function deleteRecurringInvoice(id: string): Promise<void> {
  const recurring = await orNotFound(prisma.recurringInvoice.findUnique({ where: { id } }), 'Facture récurrente');
  await prisma.accountingDocument.delete({ where: { id: recurring.templateId } });
}

/**
 * Moves the schedules of the archived recurring invoices past today without issuing anything: restored, they go on
 * from their next date to come rather than catching up the dates missed while archived.
 * @param {string} today Today.
 * @returns {Promise<void>}
 */
async function skipArchivedDates(today: string): Promise<void> {
  const archived = await prisma.recurringInvoice.findMany({ where: { archivedAt: { not: null }, nextDate: { lte: parseDay(today) } } });
  for (const recurring of archived) {
    const rule = storedRecurrence(recurring.recurrence);
    if (!rule) continue;
    const next = nextIssueDate(rule, formatDay(recurring.startDate), addDays(today, 1));
    await prisma.recurringInvoice.update({ where: { id: recurring.id }, data: { nextDate: parseOptionalDay(next) } });
  }
}

/**
 * Issues the invoices that are due: one per past issue date not issued yet (catching up after a stop), as
 * drafts or final invoices. Dates of the invoice follow the issue date. An archived recurring invoice issues none.
 * @param {string} today Today.
 * @returns {Promise<number>} Invoices issued.
 */
export async function issueDueInvoices(today: string): Promise<number> {
  await skipArchivedDates(today);
  const due = await prisma.recurringInvoice.findMany({ where: { active: true, archivedAt: null, nextDate: { lte: parseDay(today) } } });
  let issued = 0;
  for (const recurring of due) {
    const rule = storedRecurrence(recurring.recurrence);
    if (!rule) continue;
    let next: string | null = formatOptionalDay(recurring.nextDate);
    // A long stop does not flood the drafts: at most 24 invoices per schedule and run.
    for (let count = 0; next && next <= today && count < 24; count += 1) {
      const template = await findDocument(recurring.templateId);
      const fields = await editableFields(template);
      const shift = daysBetween(fields.issueDate, next);
      const invoice = await createDocument(
        'INVOICE',
        { ...fields, issueDate: next, dueDate: fields.dueDate ? addDays(fields.dueDate, shift) : null },
        { recurringId: recurring.id },
      );
      if (recurring.autoFinalize) await finalizeDocument(invoice.id).catch((error: unknown) => console.warn('Facture récurrente non validée.', error));
      issued += 1;
      next = nextIssueDate(rule, formatDay(recurring.startDate), addDays(next, 1));
      await prisma.recurringInvoice.update({ where: { id: recurring.id }, data: { nextDate: parseOptionalDay(next) } });
    }
  }
  return issued;
}

/**
 * Issues the due recurring invoices now, then every hour.
 * @returns {void}
 */
export function scheduleRecurringInvoices(): void {
  schedulePerWorkspace('Factures récurrentes', () => issueDueInvoices(parisToday()), { delay: 20_000, interval: 3_600_000, kind: 'PRO' });
}
