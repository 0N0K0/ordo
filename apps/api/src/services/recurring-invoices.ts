import { addDays, daysBetween, formatDay, occurrenceDates, parseDay, recurrenceSchema, type Recurrence } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { RecurringInvoice } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { createDocument, editableFields, finalizeDocument, findDocument } from './accounting-documents';
import { storedRecurrence } from './calendar-events';

const settingsSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(200, '200 caractères maximum.'),
  recurrence: recurrenceSchema,
  startDate: z.iso.date({ error: 'La date de début est requise.' }),
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
  const settings = parseInput(settingsSchema, input);
  const source = await findDocument(documentId);
  if (source.type !== 'INVOICE') throw clientError('BAD_USER_INPUT', 'Seule une facture peut être rendue récurrente.');
  const template = await createDocument('INVOICE', await editableFields(source), { status: 'TEMPLATE' });
  return prisma.recurringInvoice.create({
    data: {
      name: settings.name,
      templateId: template.id,
      recurrence: settings.recurrence,
      startDate: parseDay(settings.startDate),
      nextDate: (() => {
        const next = nextIssueDate(settings.recurrence, settings.startDate, settings.startDate);
        return next ? parseDay(next) : null;
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
  if (!(await prisma.recurringInvoice.findUnique({ where: { id } }))) throw notFound('Facture récurrente');
  const settings = parseInput(settingsSchema, input);
  const next = nextIssueDate(settings.recurrence, settings.startDate, today > settings.startDate ? today : settings.startDate);
  return prisma.recurringInvoice.update({
    where: { id },
    data: { ...settings, startDate: parseDay(settings.startDate), nextDate: next ? parseDay(next) : null },
  });
}

/**
 * Deletes a recurring invoice and its model (the invoices it issued are kept).
 * @param {string} id Recurring invoice.
 * @returns {Promise<void>}
 */
export async function deleteRecurringInvoice(id: string): Promise<void> {
  const recurring = await prisma.recurringInvoice.findUnique({ where: { id } });
  if (!recurring) throw notFound('Facture récurrente');
  await prisma.accountingDocument.delete({ where: { id: recurring.templateId } });
}

/**
 * Issues the invoices that are due: one per past issue date not issued yet (catching up after a stop), as
 * drafts or final invoices. Dates of the invoice follow the issue date.
 * @param {string} today Today.
 * @returns {Promise<number>} Invoices issued.
 */
export async function issueDueInvoices(today: string): Promise<number> {
  const due = await prisma.recurringInvoice.findMany({ where: { active: true, nextDate: { lte: parseDay(today) } } });
  let issued = 0;
  for (const recurring of due) {
    const rule = storedRecurrence(recurring.recurrence);
    if (!rule) continue;
    let next: string | null = recurring.nextDate ? formatDay(recurring.nextDate) : null;
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
      await prisma.recurringInvoice.update({ where: { id: recurring.id }, data: { nextDate: next ? parseDay(next) : null } });
    }
  }
  return issued;
}

/**
 * Issues the due recurring invoices now, then every hour.
 * @returns {void}
 */
export function scheduleRecurringInvoices(): void {
  const run = () =>
    void issueDueInvoices(new Intl.DateTimeFormat('en-CA').format(new Date())).catch((error: unknown) =>
      console.warn('Factures récurrentes en échec.', error),
    );
  setTimeout(run, 20_000);
  setInterval(run, 3_600_000);
}
