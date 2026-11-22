import { EVERYDAY_CONTEXT } from '@ordo/shared';
import { booleanColumn } from '../../../components/data-table/table/boolean-column';
import { LATE_GROUP_LABELS, WARNING_YES_ICONS, type DataColumn } from '../../../components/data-table/table/data-table';
import { monthColumn } from '../../../components/data-table/table/month-column';
import { itemChoices } from '../../../components/items/item-look';
import { signedText } from '../../../components/money/signed-text';
import { memberOrRelationKey, personKey, ME_KEY } from '../../../components/people/people-keys';
import { meName, personName, type RelationWords } from '../../../components/people/people-options';
import * as fmt from '../../../lib/format';
import { taggedKey } from '../../../lib/tagged-key';
import { commentColumn } from '../../comments/lib/comment-column';
import type { ForecastEntry, ProjectionItem, TreasuryEntry } from '../api';
import { categoryChoices } from './categories';
import { entryFieldColumns } from './entry-columns';
import type { AnyEntry, EntryEnv } from './entry-env';
import type { LineValues } from './lines';

/** Origin of a row of the forecast: its name and color. */
export const FORECAST_KINDS: Record<string, { label: string; color: string }> = {
  FORECAST: { label: 'Prévision', color: 'grape' },
  ACTUAL: { label: 'À venir', color: 'gray' },
  INVOICE: { label: 'Facture', color: 'blue' },
  CREDIT_NOTE: { label: 'Avoir', color: 'orange' },
  IMPORTED: { label: 'Importé', color: 'cyan' },
  RECURRING_INVOICE: { label: 'Récurrente', color: 'teal' },
};

/** Row of the forecast: an expected movement, at its place. */
export type ForecastRow = { item: ProjectionItem; index: number };

/**
 * Columns of the forecast: date, label, origin, overdue, amount, then the columns every table of entries shares (those
 * of an entry: none for an invoice due or a recurring invoice).
 * @param {(row: ForecastRow) => ForecastEntry | undefined} entryOf Entry of a row.
 * @param {EntryEnv} env Names.
 * @returns {DataColumn<ForecastRow>[]} Columns.
 */
export function forecastColumns(entryOf: (row: ForecastRow) => ForecastEntry | undefined, env: EntryEnv): DataColumn<ForecastRow>[] {
  return [
    monthColumn('month', 'Mois', ({ item }) => item.date),
    {
      id: 'date',
      label: 'Date d’exécution',
      size: 140,
      required: true,
      bulk: true,
      sortValue: ({ item }) => item.date,
      text: ({ item }) => fmt.day(item.date),
      filter: { kind: 'date', value: ({ item }) => item.date },
    },
    { id: 'label', label: 'Libellé', size: 320, locked: true, required: true, bulk: true, sortValue: ({ item }) => item.label, text: ({ item }) => item.label },
    {
      id: 'origin',
      label: 'Origine',
      size: 130,
      required: true,
      sortValue: ({ item }) => (FORECAST_KINDS[item.kind] ?? FORECAST_KINDS.FORECAST).label,
      text: ({ item }) => (FORECAST_KINDS[item.kind] ?? FORECAST_KINDS.FORECAST).label,
      filter: {
        kind: 'choice',
        value: ({ item }) => (item.kind in FORECAST_KINDS ? item.kind : 'FORECAST'),
        options: Object.entries(FORECAST_KINDS).map(([value, kind]) => ({ value, label: kind.label })),
      },
      groupable: true,
    },
    booleanColumn<ForecastRow>({ id: 'overdue', label: 'En retard', size: 110, hiddenByDefault: true, groupable: true, groupLabels: LATE_GROUP_LABELS, icons: WARNING_YES_ICONS, value: ({ item }) => Boolean(item.overdue) }),
    ...entryFieldColumns<ForecastRow>(entryOf, env, { payerName: ({ item }) => item.payerName ?? '', recurrence: true }),
    {
      id: 'amount',
      bulk: true,
      required: true,
      label: 'Montant',
      size: 130,
      numeric: true,
      sortValue: ({ item }) => item.amount,
      formatTotal: fmt.money,
      text: ({ item }) => signedText(item.amount),
      filter: { kind: 'number', value: ({ item }) => item.amount },
    },
  ];
}

/**
 * Columns of the entries: month (to group), execution date, label, amount, documents settled, then the columns every
 * table of entries shares.
 * @param {EntryEnv} env Names.
 * @returns {DataColumn<TreasuryEntry>[]} Columns.
 */
export function entryColumns(env: EntryEnv): DataColumn<TreasuryEntry>[] {
  return [
    monthColumn('month', 'Mois', (entry) => entry.date),
    {
      id: 'date',
      bulk: true,
      required: true,
      label: 'Date d’exécution',
      size: 130,
      sortValue: (entry) => entry.date,
      text: (entry) => fmt.day(entry.date),
      filter: { kind: 'date', value: (entry) => entry.date },
    },
    { id: 'label', label: 'Libellé', size: 300, locked: true, required: true, bulk: true, sortValue: (entry) => entry.label, text: (entry) => entry.label },
    ...entryFieldColumns<TreasuryEntry>((entry) => entry, env, { payerName: (entry) => entry.payerName ?? '', allEntries: true }),
    {
      id: 'settled',
      label: 'Documents réglés',
      size: 200,
      hiddenByDefault: true,
      text: (entry) => entry.allocations.map((allocation) => allocation.documentLabel).join(', '),
      filter: { kind: 'boolean', value: (entry) => entry.allocations.length > 0 },
    },
    {
      id: 'amount',
      bulk: true,
      required: true,
      label: 'Montant',
      size: 130,
      numeric: true,
      sortValue: (entry) => entry.amount,
      formatTotal: fmt.money,
      text: (entry) => signedText(entry.amount),
      filter: { kind: 'number', value: (entry) => entry.amount },
    },
  ];
}

/**
 * Columns of the table of the entries, with their comments.
 * @param {EntryEnv} env Names.
 * @param {Map<string, number>} comments Comments of each entry.
 * @returns {DataColumn<TreasuryEntry>[]} Columns.
 */
export const entryTableColumns = (env: EntryEnv, comments: Map<string, number>): DataColumn<TreasuryEntry>[] => [
  ...entryColumns(env),
  commentColumn<TreasuryEntry>(
    comments,
    (entry) => entry.id,
    (entry) => entry.note,
  ),
];

/** Row of the split of an entry: a line, its amount, its supporting documents. */
export interface LineRow {
  index: number;
  line: LineValues;
  /** Signed amount (€). */
  amount: number;
  /** Supporting documents, as stored. */
  documents: AnyEntry['lines'][number]['documents'];
}

/**
 * Key of a line in the table.
 * @param {LineRow} row Line.
 * @returns {string} Key.
 */
/** Key of the line of "me" (no member nor relation). */
const ME = ME_KEY;

/**
 * Key of the person a line is for.
 * @param {LineValues} line Line.
 * @returns {string} "m:<id>", "r:<id>", or ME.
 */
export const whomKey = (line: LineValues) => memberOrRelationKey(line) ?? ME;

/**
 * Columns of the lines of an entry.
 * @param {EntryEnv} env Names.
 * @returns {DataColumn<LineRow>[]} Columns.
 */
export function lineColumns(env: EntryEnv): DataColumn<LineRow>[] {
  const me = env.settings?.treasuryMembers.find((member) => member.isMe);
  const whomName = (row: LineRow) => (whomKey(row.line) === ME ? meName(me) : (env.names.get(whomKey(row.line)) ?? ''));
  const contextName = (row: LineRow) => (row.line.contextId ? (env.names.get(taggedKey('context', row.line.contextId)) ?? '') : EVERYDAY_CONTEXT);
  const categoryLabel = (row: LineRow) => (row.line.categoryId ? (env.paths.get(row.line.categoryId) ?? '') : '');
  const projectLabelOf = (row: LineRow) => (row.line.projectId ? (env.projectLabels.get(row.line.projectId) ?? '') : '');
  const whomChoices = [
    ...(env.settings?.treasuryMembers ?? []).map((member) => ({ value: member.isMe ? ME : personKey('member', member.id), label: personName(member) })),
    ...(env.settings?.treasuryRelations ?? []).map((relation) => ({ value: personKey('relation', relation.id), label: relation.name, archived: relation.archived })),
  ];
  return [
    { id: 'label', bulk: true, label: 'Libellé', size: 200, locked: true, sortValue: (row) => row.line.label ?? null, text: (row) => row.line.label ?? '' },
    {
      id: 'whom',
      bulk: true,
      // « Moi » without member nor relation, the everyday context without context: never empty.
      required: true,
      label: 'Bénéficiaire',
      size: 170,
      sortValue: whomName,
      text: whomName,
      filter: { kind: 'choice', value: (row) => whomKey(row.line), options: whomChoices },
      groupable: true,
    },
    {
      id: 'category',
      bulk: true,
      label: 'Catégorie',
      size: 180,
      sortValue: (row) => categoryLabel(row) || null,
      text: categoryLabel,
      filter: {
        kind: 'choice',
        value: (row) => row.line.categoryId,
        options: categoryChoices(env.settings?.treasuryCategories ?? []),
      },
      groupable: true,
    },
    {
      id: 'context',
      bulk: true,
      required: true,
      label: 'Contexte',
      size: 160,
      sortValue: contextName,
      text: contextName,
      filter: {
        kind: 'choice',
        value: (row) => row.line.contextId ?? ME,
        options: [{ value: ME, label: EVERYDAY_CONTEXT }, ...itemChoices(env.settings?.treasuryContexts ?? [])],
      },
      groupable: true,
    },
    { id: 'mode', bulk: true, label: 'Unité', size: 80, sortValue: (row) => row.line.mode, text: (row) => (row.line.mode === 'PERCENT' ? '%' : '€'), filter: false },
    { id: 'value', bulk: true, label: 'Valeur', size: 110, numeric: true, sortValue: (row) => row.line.value, text: (row) => fmt.number(row.line.value, 4), filter: false },
    {
      id: 'amount',
      label: 'Montant',
      size: 120,
      required: true,
      numeric: true,
      sortValue: (row) => row.amount,
      formatTotal: fmt.money,
      text: (row) => signedText(row.amount),
      filter: { kind: 'number', value: (row) => row.amount },
    },
    booleanColumn<LineRow>({ id: 'loan', bulk: true, label: 'Prêt', size: 80, groupLabels: { yes: 'Avancé', no: 'Définitif' }, icons: WARNING_YES_ICONS, value: (row) => row.line.loan }),
    {
      id: 'date',
      bulk: true,
      label: 'Date',
      size: 130,
      sortValue: (row) => row.line.date,
      text: (row) => (row.line.date ? fmt.day(row.line.date) : ''),
      filter: { kind: 'date', value: (row) => row.line.date },
    },
    {
      id: 'project',
      bulk: true,
      label: 'Projet',
      size: 180,
      sortValue: (row) => projectLabelOf(row) || null,
      text: projectLabelOf,
      filter: { kind: 'choice', value: (row) => row.line.projectId, options: env.projects },
      groupable: true,
    },
    {
      id: 'documents',
      bulk: true,
      label: 'Pièces justificatives',
      size: 220,
      text: (row) => row.documents.map((document) => document.label).join(', '),
      filter: { kind: 'boolean', value: (row) => row.documents.length > 0 },
    },
    {
      id: 'links',
      bulk: true,
      label: 'Relative à un autre mouvement',
      size: 240,
      text: (row) => row.line.links.map((link) => link.entryLabel).join(', '),
      filter: { kind: 'boolean', value: (row) => row.line.links.length > 0 },
    },
  ];
}

/** Row of the loans: a relation (what it owes or is owed), or one of its loan lines under it. */
export type LoanRow =
  | { kind: 'relation'; key: string; relationId: string; name: string; balance: number; out: number; in: number }
  | { kind: 'line'; key: string; relationId: string; name: string; date: string; label: string; amount: number };

/**
 * Columns of the loans, the relation told with the word of the workspace (« Relation » or « Proche »).
 * @param {RelationWords} words Words of the relations.
 * @returns {DataColumn<LoanRow>[]} Columns.
 */
export const loanColumns = (words: RelationWords): DataColumn<LoanRow>[] => [
  {
    id: 'name',
    label: `${words.noun} / ligne`,
    size: 260,
    locked: true,
    required: true,
    sortValue: (row) => (row.kind === 'relation' ? row.name : row.label),
    text: (row) => (row.kind === 'relation' ? row.name : row.label),
  },
  {
    id: 'balance',
    label: 'Solde',
    size: 170,
    numeric: true,
    sortValue: (row) => (row.kind === 'relation' ? row.balance : null),
    text: (row) => (row.kind === 'relation' ? fmt.money(row.balance) : ''),
    filter: { kind: 'number', value: (row) => (row.kind === 'relation' ? row.balance : null) },
    formatTotal: fmt.money,
  },
  {
    id: 'out',
    label: 'Sorti vers elle',
    size: 140,
    numeric: true,
    sortValue: (row) => (row.kind === 'relation' ? row.out : null),
    text: (row) => (row.kind === 'relation' ? fmt.money(row.out) : ''),
    formatTotal: fmt.money,
  },
  {
    id: 'in',
    label: 'Reçu d’elle',
    size: 140,
    numeric: true,
    sortValue: (row) => (row.kind === 'relation' ? row.in : null),
    text: (row) => (row.kind === 'relation' ? fmt.money(row.in) : ''),
    formatTotal: fmt.money,
  },
  {
    id: 'date',
    label: 'Date',
    size: 120,
    sortValue: (row) => (row.kind === 'line' ? row.date : null),
    text: (row) => (row.kind === 'line' ? fmt.day(row.date) : ''),
    filter: { kind: 'date', value: (row) => (row.kind === 'line' ? row.date : null) },
  },
  {
    id: 'amount',
    label: 'Montant',
    size: 130,
    numeric: true,
    sortValue: (row) => (row.kind === 'line' ? row.amount : null),
    text: (row) => (row.kind === 'line' ? fmt.money(row.amount) : ''),
    filter: { kind: 'number', value: (row) => (row.kind === 'line' ? row.amount : null) },
    formatTotal: fmt.money,
  },
];

