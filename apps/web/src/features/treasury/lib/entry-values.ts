import { localToday } from '../../../lib/dates';
import { ON_ERROR } from '../../../lib/notify';
import type { Recurrence, TreasuryAllocationInput } from '@ordo/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { DuplicateOptions } from '../../../components/data-table/selection/selection-actions';
import { cachedItem } from '../../../lib/mutation';
import { copyName } from '../../../lib/text';
import { treasuryKey, useTreasuryMutations, type ForecastEntry, type TreasuryEntry } from '../api';
import { newSplitLine, type LineLink, type LineValues } from './lines';
import { directionOf } from '@ordo/shared';

/** Values of the entry form (and of an entry changed in a cell of a table). */
export interface EntryValues extends Record<string, unknown> {
  accountId: string;
  status: 'ACTUAL' | 'FORECAST';
  /** Execution date. */
  date: string;
  valueDate: string | null;
  label: string;
  /** Money in or out. */
  direction: 'IN' | 'OUT';
  /** Positive; signed by the direction when saved. */
  amount: number;
  categoryId: string | null;
  methodId: string | null;
  /** Payer or payee: a client or a counterparty (fields of the schema, so that they are validated). */
  clientId: string | null;
  counterpartyId: string | null;
  projectId: string | null;
  note: string;
  /** Page about it on the internet (an online order…). */
  url: string;
  recurrence: Recurrence | null;
  allocations: TreasuryAllocationInput[];
  linkedEntryIds: string[];
  libraryDocumentIds: string[];
  projectResourceIds: string[];
  /** Split of the amount: values relative to the direction (signed when saved). */
  lines: LineValues[];
}

/**
 * Values of an entry, as the form edits them (an amount relative to its direction, lines included); blank ones for a
 * new entry.
 * @param {TreasuryEntry | ForecastEntry | undefined} entry Entry, if any.
 * @param {{ status: 'ACTUAL' | 'FORECAST', copy: boolean, accountId: string }} defaults Status and account of a new entry, copy (no settlement).
 * @returns {EntryValues} Values.
 */
export function entryValues(entry: TreasuryEntry | ForecastEntry | undefined, defaults: { status: 'ACTUAL' | 'FORECAST'; copy: boolean; accountId: string }): EntryValues {
  return {
    accountId: entry?.accountId ?? defaults.accountId,
    status: entry?.status ?? defaults.status,
    date: entry ? entry.date : localToday(),
    valueDate: entry ? entry.valueDate : localToday(),
    label: entry?.label ?? '',
    direction: entry ? directionOf(entry.amount) : 'IN',
    amount: Math.abs(entry?.amount ?? 0),
    categoryId: entry?.categoryId ?? null,
    methodId: entry?.methodId ?? null,
    clientId: entry?.clientId ?? null,
    counterpartyId: entry?.counterpartyId ?? null,
    projectId: entry?.projectId ?? null,
    note: entry?.note ?? '',
    url: entry?.url ?? '',
    recurrence: (entry?.recurrence as Recurrence | null) ?? null,
    // A copy settles no document: the original already does.
    allocations: (defaults.copy ? [] : (entry?.allocations ?? [])).map((allocation) => ({
      documentId: allocation.documentId ?? null,
      importedDocumentId: allocation.importedDocumentId ?? null,
      amount: allocation.amount,
    })),
    linkedEntryIds: (entry?.linkedEntries ?? []).map((item) => item.id),
    libraryDocumentIds: (entry?.documents ?? []).filter((document) => document.source === 'LIBRARY').map((document) => document.id),
    projectResourceIds: (entry?.documents ?? []).filter((document) => document.source === 'PROJECT').map((document) => document.id),
    // A stored amount is signed; edited, it is relative to the direction of the entry.
    lines: (entry?.lines ?? []).map((line) =>
      newSplitLine({
        id: defaults.copy ? null : line.id,
        label: line.label ?? null,
        mode: line.mode,
        value: line.mode === 'AMOUNT' && (entry?.amount ?? 0) < 0 ? -line.value : line.value,
        memberId: line.memberId ?? null,
        relationId: line.relationId ?? null,
        loan: line.loan,
        date: line.date || null,
        categoryId: line.categoryId ?? null,
        contextId: line.contextId ?? null,
        projectId: line.projectId ?? null,
        libraryDocumentIds: line.documents.filter((document) => document.source === 'LIBRARY').map((document) => document.id),
        projectResourceIds: line.documents.filter((document) => document.source === 'PROJECT').map((document) => document.id),
        linkedLineIds: line.linkedLines.map((linked) => linked.id),
        linkedEntryIds: line.linkedEntries.map((linked) => linked.id),
        links: [
          ...line.linkedLines.map((linked) => ({
            kind: 'line' as const,
            id: linked.id,
            entryLabel: linked.entryLabel,
            date: linked.date,
            label: linked.label ?? null,
            amount: linked.amount,
          })),
          ...line.linkedEntries.map((linked) => ({ kind: 'entry' as const, id: linked.id, entryLabel: linked.label, date: linked.date, label: null, amount: linked.amount })),
        ],
      }),
    ),
  };
}

/**
 * Change of an entry whose lines are replaced. Getting its first lines, it is split: its category and project go to
 * them, its supporting documents and links to the first (a split entry holds them on its lines, not on itself).
 * @param {EntryValues} values Values of the entry.
 * @param {LineValues[]} lines New lines.
 * @param {LineLink[]} linked Entries linked to the entry, as links of a line.
 * @returns {Partial<EntryValues>} Change.
 */
export function linesChange(values: EntryValues, lines: LineValues[], linked: LineLink[]): Partial<EntryValues> {
  if (values.lines.length > 0 || lines.length === 0) return { lines };
  return {
    lines: lines.map((line, index) => ({
      ...line,
      categoryId: line.categoryId ?? values.categoryId,
      projectId: line.projectId ?? values.projectId,
      ...(index === 0 ? { libraryDocumentIds: values.libraryDocumentIds, projectResourceIds: values.projectResourceIds, linkedEntryIds: values.linkedEntryIds, links: linked } : {}),
    })),
    categoryId: null,
    projectId: null,
    libraryDocumentIds: [],
    projectResourceIds: [],
    linkedEntryIds: [],
  };
}

/**
 * Input of an entry saved from its values: the amount signed by its direction, no repetition for an actual entry, no
 * settlement for a forecast.
 * @param {EntryValues} input Values.
 * @returns {object} Input of the save.
 */
export function entryPayload(input: EntryValues) {
  const { direction, ...fields } = input;
  return {
    ...fields,
    amount: direction === 'IN' ? input.amount : -input.amount,
    recurrence: input.status === 'FORECAST' ? input.recurrence : null,
    allocations: input.status === 'ACTUAL' ? input.allocations : [],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    lines: input.lines.map(({ links: _links, ...line }) => ({ ...line, value: line.mode === 'AMOUNT' && direction === 'OUT' ? -line.value : line.value })),
  };
}

/**
 * Saving of fields of an entry changed in the cells of a table: the rest of the entry kept as it is.
 * @returns {(entry: TreasuryEntry | ForecastEntry, change: Partial<EntryValues>) => void} Save.
 */
export function useEntryCellSave() {
  const { updateEntry } = useTreasuryMutations();
  return (entry: TreasuryEntry | ForecastEntry, change: Partial<EntryValues>) =>
    updateEntry.mutate({ id: entry.id, input: entryPayload({ ...entryValues(entry, { status: entry.status, copy: false, accountId: entry.accountId }), ...change }) as never }, ON_ERROR);
}

/**
 * « Dupliquer » of an entry or a forecast (decision D20): its copy saved at once, « … (copie) », settling no document
 * (the original already does) and with lines of its own, then its form opens.
 * @param {(entry: TreasuryEntry | ForecastEntry) => void} open Opens the form of the copy.
 * @returns {DuplicateOptions<TreasuryEntry | ForecastEntry, string>} « Dupliquer ».
 */
export function useEntryDuplicate(open: (entry: TreasuryEntry | ForecastEntry) => void): DuplicateOptions<TreasuryEntry | ForecastEntry, string> {
  const { createEntry } = useTreasuryMutations();
  const queryClient = useQueryClient();
  return {
    duplicate: (entry) =>
      createEntry.mutateAsync(entryPayload({ ...entryValues(entry, { status: entry.status, copy: true, accountId: entry.accountId }), label: copyName(entry.label) }) as never),
    done: 'Mouvement dupliqué.',
    open: (id) => {
      const copy = cachedItem(queryClient, treasuryKey, id, (data: unknown) => (Array.isArray(data) ? (data as (TreasuryEntry | ForecastEntry)[]) : undefined));
      if (copy) open(copy);
    },
  };
}
