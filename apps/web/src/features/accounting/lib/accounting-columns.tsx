import { formatDuration, recurrenceSchema, UNIT_LABELS } from '@ordo/shared';
import { DURATION_COLUMN, STACKED_COLUMN, type DataColumn } from '../../../components/data-table/table/data-table';
import { stateColumn, type ColumnState } from '../../../components/data-table/table/state-column';
import { FEEDBACK_COLORS } from '../../../components/feedback/feedback-colors';
import { describeRecurrence } from '../../../components/recurrence/describe-recurrence';
import { parisDay } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { commentColumn } from '../../comments/lib/comment-column';
import type { CatalogItem } from '../api/catalog';
import type { RecurringInvoice } from '../api/documents';
import type { OverdueInvoice } from '../api/tracking';
import { DOCUMENT_TYPE_LABELS } from './labels';
import type { BillableTime } from './time-lines';

/** States of a recurring invoice, changed in place: active green, paused gray. */
export const RECURRING_STATES: ColumnState<'active' | 'paused'>[] = [
  { id: 'active', label: 'Active', color: FEEDBACK_COLORS.success },
  { id: 'paused', label: 'En pause', color: 'gray' },
];

/** Natures of an item of the catalogue, changed in place: a service blue, a disbursement grape (as its badge by its name). */
export const CATALOG_KINDS: ColumnState<'ITEM' | 'DISBURSEMENT'>[] = [
  { id: 'ITEM', label: 'Prestation', color: 'blue' },
  { id: 'DISBURSEMENT', label: 'Débours', color: 'grape' },
];

/** Columns of the overdue invoices. */
export const OVERDUE_COLUMNS: DataColumn<OverdueInvoice>[] = [
  {
    id: 'invoice',
    required: true,
    label: 'Facture',
    size: 220,
    locked: true,
    sortValue: (invoice) => invoice.number ?? null,
    text: (invoice) => `${invoice.type === 'DEPOSIT_INVOICE' ? `${DOCUMENT_TYPE_LABELS.DEPOSIT_INVOICE} ` : ''}${invoice.number ?? ''}`,
  },
  { id: 'client', label: 'Client', size: 200, hiddenByDefault: true, sortValue: (invoice) => invoice.clientName ?? null, text: (invoice) => invoice.clientName ?? '', groupable: true },
  {
    id: 'sent',
    // Invoices to remind were all sent.
    required: true,
    label: 'Envoi',
    size: 230,
    ...STACKED_COLUMN,
    sortValue: (invoice) => invoice.sentAt ?? null,
    text: (invoice) => (invoice.sentAt ? fmt.day(parisDay(invoice.sentAt)) : ''),
    filter: { kind: 'date', value: (invoice) => (invoice.sentAt ? parisDay(invoice.sentAt) : null) },
  },
  {
    id: 'balance',
    required: true,
    label: 'Reste dû',
    size: 130,
    numeric: true,
    sortValue: (invoice) => invoice.balance ?? 0,
    text: (invoice) => fmt.money(invoice.balance ?? 0, invoice.currency),
  },
  {
    id: 'reminder',
    label: 'Dernière relance',
    size: 200,
    ...STACKED_COLUMN,
    sortValue: (invoice) => invoice.lastReminderAt ?? null,
    text: (invoice) => (invoice.lastReminderAt ? fmt.day(invoice.lastReminderAt) : 'Jamais'),
    filter: { kind: 'date', value: (invoice) => (invoice.lastReminderAt ? parisDay(invoice.lastReminderAt) : null) },
  },
  { id: 'email', label: 'Destinataire', size: 240, sortValue: (invoice) => invoice.billingEmail ?? null, text: (invoice) => invoice.billingEmail ?? '' },
];

/** Columns of the catalog. */
const CATALOG_COLUMNS: DataColumn<CatalogItem>[] = [
  { id: 'label', required: true, label: 'Article', size: 320, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
  stateColumn({ id: 'kind', required: true, bulk: true, label: 'Nature', size: 120, hiddenByDefault: true, states: CATALOG_KINDS, value: (item) => (item.kind === 'DISBURSEMENT' ? 'DISBURSEMENT' : 'ITEM'), groupable: true }),
  { id: 'unit', required: true, label: 'Unité', size: 120, bulk: true, sortValue: (item) => UNIT_LABELS[item.unit].label, text: (item) => UNIT_LABELS[item.unit].label, groupable: true },
  { id: 'price', required: true, label: 'Prix HT', size: 120, bulk: true, numeric: true, sortValue: (item) => item.unitPrice, text: (item) => fmt.money(item.unitPrice) },
  {
    id: 'vat',
    bulk: true,
    label: 'TVA',
    size: 90,
    numeric: true,
    sortValue: (item) => (item.kind === 'DISBURSEMENT' ? null : item.vatRate),
    text: (item) => (item.kind === 'DISBURSEMENT' ? '' : `${fmt.percent(item.vatRate)}`),
    groupable: true,
  },
];

/**
 * Columns of the catalogue, with the comments of its items.
 * @param {Map<string, number>} comments Comments of each item.
 * @returns {DataColumn<CatalogItem>[]} Columns.
 */
export const catalogColumns = (comments: Map<string, number>): DataColumn<CatalogItem>[] => [...CATALOG_COLUMNS, commentColumn<CatalogItem>(comments, (item) => item.id)];

/**
 * What a time was spent on: its tasks, then its description.
 * @param {BillableTime} entry Time.
 * @returns {string} Text.
 */
export const workOf = (entry: BillableTime) => [entry.tasks.join(', '), entry.description].filter(Boolean).join(' — ');

/** Columns of the time to bill. */
export const BILLING_COLUMNS: DataColumn<BillableTime>[] = [
  { id: 'day', required: true, label: 'Jour', size: 110, sortValue: (entry) => entry.day, text: (entry) => fmt.dayShort(entry.day), filter: { kind: 'date', value: (entry) => entry.day } },
  { id: 'work', label: 'Temps', size: 320, locked: true, sortValue: workOf, text: workOf },
  {
    id: 'duration',
    required: true,
    label: 'Durée',
    size: 100,
    ...DURATION_COLUMN,
    sortValue: (entry) => entry.seconds,
    text: (entry) => formatDuration(entry.seconds),
    formatTotal: (seconds) => formatDuration(Math.round(seconds)),
  },
];

/**
 * Repetition of a recurring invoice, as a sentence.
 * @param {RecurringInvoice} item Recurring invoice.
 * @returns {string} Text.
 */
export function repetitionText(item: RecurringInvoice): string {
  const rule = recurrenceSchema.safeParse(item.recurrence);
  return rule.success ? describeRecurrence(rule.data, item.startDate) : '';
}

/** Columns of the recurring invoices. */
export const RECURRING_COLUMNS: DataColumn<RecurringInvoice>[] = [
  { id: 'label', required: true, label: 'Libellé', size: 280, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
  { id: 'client', label: 'Client', size: 200, sortValue: (item) => item.template.clientName ?? null, text: (item) => item.template.clientName ?? '', groupable: true },
  { id: 'repetition', label: 'Répétition', size: 240, text: repetitionText, groupable: true },
  {
    id: 'next',
    label: 'Prochaine',
    size: 130,
    sortValue: (item) => item.nextDate || null,
    text: (item) => (item.nextDate ? fmt.day(item.nextDate) : 'Terminée'),
    filter: { kind: 'date', value: (item) => item.nextDate || null },
  },
  stateColumn({ id: 'state', required: true, label: 'État', size: 120, bulk: true, hiddenByDefault: true, states: RECURRING_STATES, value: (item) => (item.active ? 'active' : 'paused'), groupable: true }),
  {
    id: 'issued',
    required: true,
    label: 'Émises',
    size: 90,
    numeric: true,
    hiddenByDefault: true,
    sortValue: (item) => item.issuedCount,
    text: (item) => fmt.count(item.issuedCount),
    filter: { kind: 'number', value: (item) => item.issuedCount },
  },
  {
    id: 'amount',
    required: true,
    label: 'Montant',
    size: 130,
    numeric: true,
    sortValue: (item) => item.template.totalGross,
    text: (item) => fmt.money(item.template.totalGross, item.template.currency),
  },
];
