import type { DataColumn } from '../../../components/data-table/table/data-table';
import { monthColumn } from '../../../components/data-table/table/month-column';
import type { TreeOption } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useProjectTree } from '../../projects/api';
import { projectFullPath, projectOptions } from '../../projects/lib/tree';
import type { AccountingDocumentSummary, ImportedDocument } from '../api/documents';
import { DOCUMENT_TYPE_LABELS, documentName, DRAFT_NAME } from '../lib/labels';

/** Row of a table of accounting documents: one of Ordo, or one issued before Ordo (imported). */
export type DocumentRow = { kind: 'ordo'; document: AccountingDocumentSummary } | { kind: 'imported'; document: ImportedDocument };
type Row = DocumentRow;

/**
 * Tracking status of a document, as a text.
 * @param {Row} row Row.
 * @returns {string} Text.
 */
export const trackingText = (row: Row) => (row.kind === 'ordo' && row.document.status !== 'FINAL' ? DRAFT_NAME : (row.document.trackingStatus?.label ?? ''));

/**
 * Columns of the documents (type and client only where they vary).
 * @param {{ rows: readonly Row[], projectLabels: Map<string, string>, projects: TreeOption[] }} env Rows (their clients and statuses offered by the filters), labels of the projects, projects as their tree.
 * @returns {DataColumn<Row>[]} Columns.
 */
function documentColumns({ rows, projectLabels, projects }: { rows: readonly Row[]; projectLabels: Map<string, string>; projects: TreeOption[] }): DataColumn<Row>[] {
  const clients = new Map(rows.flatMap((row) => (row.document.clientId ? [[row.document.clientId, row.document.clientName ?? ''] as const] : [])));
  const statuses = new Map(rows.map((row) => [trackingText(row), trackingText(row)] as const).filter(([name]) => name));
  const projectOf = (row: Row) => (row.document.projectId ? (projectLabels.get(row.document.projectId) ?? '') : '');
  const money = (amount: number) => fmt.money(amount);
  return [
    { id: 'number', required: true, label: 'Numéro', size: 150, locked: true, sortValue: (row) => row.document.number ?? null, text: (row) => documentName(row.document.number) },
    {
      id: 'type',
      required: true,
      label: 'Type',
      size: 130,
      sortValue: (row) => DOCUMENT_TYPE_LABELS[row.document.type],
      text: (row) => DOCUMENT_TYPE_LABELS[row.document.type],
      filter: { kind: 'choice', value: (row) => row.document.type, options: Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
      groupable: true,
    },
    {
      id: 'date',
      required: true,
      label: 'Date',
      size: 120,
      sortValue: (row) => row.document.issueDate,
      text: (row) => fmt.day(row.document.issueDate),
      filter: { kind: 'date', value: (row) => row.document.issueDate },
    },
    monthColumn('month', 'Mois', (row) => row.document.issueDate, 140),
    {
      id: 'dueDate',
      label: 'Échéance',
      size: 120,
      hiddenByDefault: true,
      sortValue: (row) => row.document.dueDate ?? null,
      text: (row) => (row.document.dueDate ? fmt.day(row.document.dueDate) : ''),
      filter: { kind: 'date', value: (row) => row.document.dueDate ?? null },
    },
    monthColumn('dueMonth', 'Mois d’échéance', (row) => row.document.dueDate),
    {
      id: 'client',
      label: 'Client',
      size: 180,
      sortValue: (row) => row.document.clientName ?? null,
      text: (row) => row.document.clientName ?? '',
      filter: { kind: 'choice', value: (row) => row.document.clientId ?? null, options: [...clients].map(([value, label]) => ({ value, label })) },
      groupable: true,
    },
    {
      id: 'project',
      bulk: true,
      label: 'Projet',
      size: 200,
      sortValue: (row) => projectOf(row) || null,
      text: projectOf,
      filter: { kind: 'choice', value: (row) => row.document.projectId ?? null, options: projects },
      groupable: true,
    },
    { id: 'label', label: 'Objet', size: 300, sortValue: (row) => row.document.label ?? null, text: (row) => row.document.label ?? '' },
    {
      id: 'tracking',
      bulk: true,
      label: 'Statut',
      size: 200,
      sortValue: trackingText,
      text: trackingText,
      filter: { kind: 'choice', value: (row) => trackingText(row) || null, options: [...statuses].map(([value, label]) => ({ value, label })) },
      groupable: true,
    },
    {
      id: 'origin',
      required: true,
      label: 'Origine',
      size: 110,
      hiddenByDefault: true,
      sortValue: (row) => row.kind,
      text: (row) => (row.kind === 'imported' ? 'Importé' : 'Ordo'),
      filter: {
        kind: 'choice',
        value: (row) => row.kind,
        options: [
          { value: 'ordo', label: 'Ordo' },
          { value: 'imported', label: 'Importé' },
        ],
      },
      groupable: true,
    },
    {
      id: 'net',
      required: true,
      label: 'Total HT',
      size: 120,
      numeric: true,
      sortValue: (row) => row.document.totalNet,
      formatTotal: money,
      text: (row) => fmt.money(row.document.totalNet, row.document.currency),
      filter: { kind: 'number', value: (row) => row.document.totalNet },
    },
    {
      id: 'gross',
      required: true,
      label: 'Total TTC',
      size: 140,
      numeric: true,
      sortValue: (row) => row.document.totalGross,
      formatTotal: money,
      text: (row) => fmt.money(row.document.totalGross, row.document.currency),
      filter: { kind: 'number', value: (row) => row.document.totalGross },
    },
    {
      id: 'balance',
      required: true,
      label: 'Reste dû',
      size: 120,
      numeric: true,
      hiddenByDefault: true,
      sortValue: (row) => row.document.balance ?? 0,
      formatTotal: money,
      text: (row) => (row.document.balance == null ? '' : fmt.money(row.document.balance, row.document.currency)),
      filter: { kind: 'number', value: (row) => row.document.balance ?? 0 },
    },
    {
      id: 'attachments',
      bulk: true,
      label: 'Pièces jointes',
      size: 220,
      hiddenByDefault: true,
      text: (row) => (row.kind === 'ordo' ? row.document.attachments.map((attachment) => attachment.filename).join(', ') : (row.document.filename ?? '')),
      filter: { kind: 'boolean', value: (row) => (row.kind === 'ordo' ? row.document.attachments.length > 0 : Boolean(row.document.fileUrl)) },
    },
  ];
}

/**
 * Columns of a table of accounting documents (type and client only where they vary), with their comments: in the
 * table, and in the settings (no row).
 * @param {readonly Row[]} rows Rows (their clients and statuses offered by the filters, their comments counted).
 * @param {{ showType?: boolean, showClient?: boolean }} shown Whether the type and the client columns are there.
 * @returns {DataColumn<Row>[]} Columns.
 */
export function useDocumentColumns(rows: readonly Row[], { showType, showClient = true }: { showType?: boolean; showClient?: boolean }): DataColumn<Row>[] {
  const documents = rows.flatMap((row) => (row.kind === 'ordo' ? [row.document] : []));
  const imported = rows.flatMap((row) => (row.kind === 'imported' ? [row.document] : []));
  const ordoComments = useCommentCounts(
    'DOCUMENT',
    documents.map((document) => document.id),
  );
  const importedComments = useCommentCounts(
    'IMPORTED_DOCUMENT',
    imported.map((document) => document.id),
  );
  const { data: workspace } = useProjectTree();
  const projectLabels = new Map((workspace?.projects ?? []).map((project) => [project.id, projectFullPath(workspace!, project)]));
  return [
    ...documentColumns({ rows, projectLabels, projects: projectOptions(workspace, workspace?.projects ?? []) }).filter(
      (column) => (column.id !== 'type' || showType) && (column.id !== 'client' || showClient),
    ),
    commentColumn<Row>(
      new Map([...ordoComments, ...importedComments]),
      (row) => row.document.id,
      (row) => (row.kind === 'imported' ? row.document.note : null),
    ),
  ];
}
