import { addDays, offsetLinkedMovements, type ChartConfig, type ChartDimension, type ChartGroupDimension, type ChartMeasure } from '@ordo/shared';
import type { AccountingDocumentSummary, ImportedDocument } from '../accounting/documents-api';
import { DOCUMENT_TYPE_LABELS } from '../accounting/labels';
import type { TaskContext } from '../tasks/use-task-context';
import type { ProjectionItem, TreasuryAccount, TreasuryCategory, TreasuryEntry, TreasuryProjection } from '../treasury/api';
import { categoryLineage } from '../treasury/categories';
import { aggregate, bucketLabel, bucketOf, localDay, nextBucket, none, periodRange, round, type ChartData, type ChartRecord, type Key } from './aggregate';

const TYPE_ORDER = ['QUOTE', 'DEPOSIT_INVOICE', 'INVOICE', 'CREDIT_NOTE'];
const TYPE_COLORS: Record<string, string> = {
  QUOTE: 'blue.6',
  DEPOSIT_INVOICE: 'teal.6',
  INVOICE: 'green.6',
  CREDIT_NOTE: 'orange.6',
};
const PROJECTION_KINDS: Record<string, string> = {
  FORECAST: 'Prévision',
  INVOICE: 'Factures à encaisser',
  CREDIT_NOTE: 'Avoirs à rembourser',
  IMPORTED: 'Documents importés à régler',
  RECURRING_INVOICE: 'Factures récurrentes à venir',
};

/** A document of the charts: one of Ordo or one imported. */
interface ChartDocument {
  id: string;
  type: string;
  draft: boolean;
  imported: boolean;
  issueDate: string;
  dueDate: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  status: { id: string; name: string; color: string } | null;
  totalNet: number;
  totalGross: number;
  paid: number;
  balance: number;
  overdue: boolean;
}

/**
 * Payment state of a document: invoices paid, partly paid, late or to pay; credit notes refunded or to refund.
 * @param {ChartDocument} document Document.
 * @returns {Key[]} Value.
 */
function paymentKeys(document: ChartDocument): Key[] {
  if (document.draft || document.type === 'QUOTE') return none('Sans objet');
  if (document.type === 'CREDIT_NOTE') {
    return document.balance > 0 ? [{ key: 'refund', label: 'À rembourser', order: 3, color: 'orange.6' }] : [{ key: 'refunded', label: 'Soldé', order: 4, color: 'gray.6' }];
  }
  if (document.balance <= 0) return [{ key: 'paid', label: 'Payé', order: 0, color: 'green.6' }];
  if (document.overdue) return [{ key: 'late', label: 'En retard', order: 2, color: 'red.6' }];
  if (document.paid > 0)
    return [
      {
        key: 'partial',
        label: 'Partiellement payé',
        order: 1,
        color: 'yellow.6',
      },
    ];
  return [{ key: 'due', label: 'À payer', order: 1.5, color: 'blue.6' }];
}

/**
 * Documents of a chart (filters and project scope applied), Ordo's and imported ones.
 * @param {AccountingDocumentSummary[]} documents Documents of Ordo.
 * @param {ImportedDocument[]} imported Imported documents.
 * @param {ChartConfig} config Configuration.
 * @param {Set<string> | null} projects Projects of the dashboard scope, or null.
 * @returns {ChartDocument[]} Documents.
 */
function chartDocuments(documents: AccountingDocumentSummary[], imported: ImportedDocument[], config: ChartConfig, projects: Set<string> | null): ChartDocument[] {
  const filter = config.documents;
  const own: ChartDocument[] = documents.map((document) => ({
    id: document.id,
    type: document.type,
    draft: document.status === 'DRAFT',
    imported: false,
    issueDate: String(document.issueDate),
    dueDate: document.dueDate ? String(document.dueDate) : null,
    sentAt: document.sentAt ? localDay(String(document.sentAt)) : null,
    acceptedAt: document.acceptedAt ? String(document.acceptedAt) : null,
    clientId: document.clientId,
    clientName: document.clientName,
    projectId: document.projectId ?? null,
    status: document.trackingStatus ?? null,
    totalNet: document.totalNet,
    totalGross: document.totalGross,
    paid: document.paid ?? 0,
    balance: document.balance ?? 0,
    overdue: document.overdue ?? false,
  }));
  const before: ChartDocument[] = filter.includeImported
    ? imported.map((document) => ({
        id: document.id,
        type: document.type,
        draft: false,
        imported: true,
        issueDate: String(document.issueDate),
        dueDate: document.dueDate ? String(document.dueDate) : null,
        sentAt: null,
        acceptedAt: null,
        clientId: document.clientId ?? null,
        clientName: document.clientName,
        projectId: document.projectId ?? null,
        status: null,
        totalNet: document.totalNet,
        totalGross: document.totalGross,
        paid: document.paid ?? 0,
        balance: document.balance ?? 0,
        overdue: Boolean(document.dueDate && (document.balance ?? 0) > 0 && String(document.dueDate) < new Date().toISOString().slice(0, 10)),
      }))
    : [];
  return [...own, ...before].filter(
    (document) =>
      (filter.includeDrafts || !document.draft) &&
      (!filter.types.length || filter.types.includes(document.type as (typeof filter.types)[number])) &&
      (!filter.clientIds.length || (document.clientId !== null && filter.clientIds.includes(document.clientId))) &&
      (!filter.statusIds.length || (document.status !== null && filter.statusIds.includes(document.status.id))) &&
      (!projects || (document.projectId !== null && projects.has(document.projectId))),
  );
}

/**
 * Data of a chart of quotes, invoices, deposit invoices and credit notes: amounts excluding or including VAT,
 * paid, still due, or number; credit notes lower the amounts when asked (net revenue).
 * @param {AccountingDocumentSummary[]} documents Documents of Ordo.
 * @param {ImportedDocument[]} imported Imported documents.
 * @param {ChartConfig} config Configuration.
 * @param {TaskContext} context Task context (projects).
 * @param {Set<string> | null} projects Projects of the dashboard scope, or null.
 * @param {string} today User's day.
 * @returns {ChartData} Data.
 */
export function documentChartData(
  documents: AccountingDocumentSummary[],
  imported: ImportedDocument[],
  config: ChartConfig,
  context: TaskContext,
  projects: Set<string> | null,
  today: string,
): ChartData {
  const records: ChartRecord[] = chartDocuments(documents, imported, config, projects).map((document) => {
    const sign = document.type === 'CREDIT_NOTE' && config.documents.creditNotesNegative ? -1 : 1;
    return {
      day: (dimension: ChartDimension) =>
        ({
          issueDate: document.issueDate,
          dueDate: document.dueDate,
          sentAt: document.sentAt,
          acceptedAt: document.acceptedAt,
        })[dimension as 'issueDate'] ?? null,
      keys: (dimension: ChartGroupDimension): Key[] => {
        switch (dimension) {
          case 'documentType':
            return [
              {
                key: document.type,
                label: DOCUMENT_TYPE_LABELS[document.type as keyof typeof DOCUMENT_TYPE_LABELS],
                order: TYPE_ORDER.indexOf(document.type),
                color: TYPE_COLORS[document.type],
              },
            ];
          case 'trackingStatus':
            if (document.draft)
              return [
                {
                  key: 'draft',
                  label: 'Brouillon',
                  order: -1,
                  color: 'gray.4',
                },
              ];
            return document.status
              ? [
                  {
                    key: document.status.id,
                    label: document.status.name,
                    order: document.status.name,
                    color: document.status.color,
                  },
                ]
              : none(document.imported ? 'Importé' : 'Sans statut');
          case 'client':
            return [
              {
                key: document.clientId ?? `name:${document.clientName}`,
                label: document.clientName || 'Sans client',
                order: document.clientName,
              },
            ];
          case 'project':
            return document.projectId
              ? [
                  {
                    key: document.projectId,
                    label: context.projectById.get(document.projectId)?.title ?? '',
                    order: context.projectLabel(document.projectId),
                  },
                ]
              : none('Sans projet');
          case 'payment':
            return paymentKeys(document);
          case 'documentState':
            return document.imported
              ? [
                  {
                    key: 'imported',
                    label: 'Importé',
                    order: 2,
                    color: 'grape.6',
                  },
                ]
              : document.draft
                ? [
                    {
                      key: 'draft',
                      label: 'Brouillon',
                      order: 0,
                      color: 'gray.5',
                    },
                  ]
                : [
                    {
                      key: 'final',
                      label: 'Définitif',
                      order: 1,
                      color: 'green.6',
                    },
                  ];
          case 'origin':
            return document.imported
              ? [
                  {
                    key: 'imported',
                    label: 'Importé',
                    order: 1,
                    color: 'grape.6',
                  },
                ]
              : [{ key: 'ordo', label: 'Ordo', order: 0, color: 'blue.6' }];
          default:
            return none('—');
        }
      },
      value: (measure: ChartMeasure) =>
        measure === 'count'
          ? 1
          : sign *
              (
                {
                  totalNet: document.totalNet,
                  totalGross: document.totalGross,
                  paid: document.paid,
                  balance: document.balance,
                } as Record<string, number>
              )[measure] || 0,
    };
  });
  return aggregate(records, config, today);
}

/** A movement of the charts: actual entry, or expected movement of the forecast. */
interface ChartMovement {
  date: string;
  amount: number;
  category: string | null;
  /** Names of its category and of the parents of it (filters keep sub-categories). */
  lineage: string[];
  accountId: string | null;
  projectId: string | null;
  forecast: boolean;
}

/**
 * Data of a treasury chart: actual movements (and expected ones when asked) measured in net amount, money in,
 * money out or number; or the balance over time. Linked money in and out of a same bucket of the period offset
 * each other (amounts only, not the number of movements).
 * @param {object} input Data.
 * @param {TreasuryEntry[]} input.entries Entries of the period.
 * @param {TreasuryCategory[]} input.categories Treasury categories.
 * @param {TreasuryProjection | null} input.projection Projection (expected movements and balance).
 * @param {TreasuryAccount[]} input.accounts Accounts.
 * @param {ChartConfig} input.config Configuration.
 * @param {TaskContext} input.context Task context (projects).
 * @param {Set<string> | null} input.projects Projects of the dashboard scope, or null.
 * @param {string} input.today User's day.
 * @returns {ChartData} Data.
 */
export function treasuryChartData({
  entries,
  categories,
  projection,
  accounts,
  config,
  context,
  projects,
  today,
}: {
  entries: TreasuryEntry[];
  categories: TreasuryCategory[];
  projection: TreasuryProjection | null;
  accounts: TreasuryAccount[];
  config: ChartConfig;
  context: TaskContext;
  projects: Set<string> | null;
  today: string;
}): ChartData {
  if (config.measure === 'balance') return balanceChartData(projection, config, today);
  const filter = config.treasury;
  const expected: ChartMovement[] =
    filter.includeForecast && projection
      ? projection.items
          // Future actual entries are in the entries already.
          .filter((item: ProjectionItem) => item.kind !== 'ACTUAL')
          .map((item: ProjectionItem) => ({
            date: item.date,
            amount: item.amount,
            category: PROJECTION_KINDS[item.kind] ?? null,
            lineage: PROJECTION_KINDS[item.kind] ? [PROJECTION_KINDS[item.kind]] : [],
            accountId: item.accountId ?? null,
            projectId: null,
            forecast: true,
          }))
      : [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const actual = entries.filter((entry) => entry.status === 'ACTUAL');
  // Linked money in and out of a same bucket (the whole period for a donut) offset each other.
  const remaining =
    config.measure === 'count'
      ? null
      : offsetLinkedMovements(
          actual.map((entry) => ({
            id: entry.id,
            amount: entry.amount,
            linkedIds: entry.linkedEntries.map((linked) => linked.id),
            period: config.type === 'donut' ? 'all' : bucketOf(String(entry.date), config.bucket),
          })),
        );
  const movements: ChartMovement[] = [
    ...actual
      .map((entry) => ({ entry, amount: remaining?.get(entry.id) ?? entry.amount }))
      // Fully offset: left out of the charts.
      .filter(({ amount }) => Math.abs(amount) >= 0.005)
      .map(({ entry, amount }) => ({
        date: String(entry.date),
        amount,
        category: entry.categoryId ? (categoryById.get(entry.categoryId)?.name ?? null) : null,
        lineage: categoryLineage(categoryById, entry.categoryId),
        accountId: entry.accountId,
        projectId: entry.projectId ?? null,
        forecast: false,
      })),
    ...expected,
  ].filter(
    (movement) =>
      (filter.direction === 'all' || (filter.direction === 'in' ? movement.amount > 0 : movement.amount < 0)) &&
      (!filter.accountIds.length || (movement.accountId !== null && filter.accountIds.includes(movement.accountId))) &&
      (!filter.categories.length || movement.lineage.some((name) => filter.categories.includes(name))) &&
      (!projects || (movement.projectId !== null && projects.has(movement.projectId))),
  );
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const records: ChartRecord[] = movements.map((movement) => ({
    day: () => movement.date,
    keys: (dimension: ChartGroupDimension): Key[] => {
      switch (dimension) {
        case 'category':
          return movement.category
            ? [
                {
                  key: movement.category,
                  label: movement.category,
                  order: movement.category,
                },
              ]
            : none('Sans catégorie');
        case 'account': {
          const account = movement.accountId ? accountById.get(movement.accountId) : undefined;
          return account ? [{ key: account.id, label: account.name, order: account.name }] : none('Sans compte');
        }
        case 'direction':
          return movement.amount >= 0 ? [{ key: 'in', label: 'Entrées', order: 0, color: 'green.6' }] : [{ key: 'out', label: 'Sorties', order: 1, color: 'red.6' }];
        case 'project':
          return movement.projectId
            ? [
                {
                  key: movement.projectId,
                  label: context.projectById.get(movement.projectId)?.title ?? '',
                  order: context.projectLabel(movement.projectId),
                },
              ]
            : none('Sans projet');
        case 'entryStatus':
          return movement.forecast ? [{ key: 'forecast', label: 'Prévu', order: 1, color: 'grape.5' }] : [{ key: 'actual', label: 'Réel', order: 0, color: 'blue.6' }];
        default:
          return none('—');
      }
    },
    value: (measure: ChartMeasure) => (measure === 'count' ? 1 : measure === 'income' ? Math.max(0, movement.amount) : measure === 'expense' ? Math.max(0, -movement.amount) : movement.amount),
  }));
  return aggregate(records, config, today);
}

/**
 * Balance of the accounts over time: the balance at the end of each bucket of the period, actual until today
 * and expected after (when the forecast is included).
 * @param {TreasuryProjection | null} projection Projection.
 * @param {ChartConfig} config Configuration.
 * @param {string} today User's day.
 * @returns {ChartData} Data.
 */
function balanceChartData(projection: TreasuryProjection | null, config: ChartConfig, today: string): ChartData {
  const empty: ChartData = {
    rows: [],
    series: [],
    slices: [],
    taskCount: 0,
    empty: true,
  };
  if (!projection || projection.series.length === 0) return empty;
  const points = [...projection.series].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const [from, to] = periodRange(config.period, today);
  const first = from ?? String(points[0].date);
  const end = to ?? addDays(String(points[points.length - 1].date), 1);
  const rows: Record<string, string | number | null>[] = [];
  let index = 0;
  let last: number | null = null;
  for (let start = bucketOf(first, config.bucket); start < end; start = nextBucket(start, config.bucket)) {
    const limit = nextBucket(start, config.bucket);
    while (index < points.length && String(points[index].date) < limit) last = points[index++].balance;
    const forecast = start > today;
    rows.push({
      x: bucketLabel(start, config.bucket),
      Réel: forecast ? null : last === null ? null : round(last),
      Prévu: forecast && last !== null ? round(last) : null,
    });
  }
  // The forecast line starts where the actual one ends.
  const lastActual = rows.findLastIndex((row) => row['Réel'] !== null);
  if (lastActual >= 0 && lastActual + 1 < rows.length) rows[lastActual]['Prévu'] = rows[lastActual]['Réel'];
  const hasForecast = rows.some((row) => row['Prévu'] !== null);
  return {
    rows,
    series: [{ name: 'Réel', color: 'blue.6' }, ...(hasForecast ? [{ name: 'Prévu', color: 'grape.5', strokeDasharray: '5 5' }] : [])],
    slices: [],
    taskCount: points.length,
    empty: rows.every((row) => row['Réel'] === null && row['Prévu'] === null),
  };
}
