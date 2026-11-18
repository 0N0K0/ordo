import { formCallbacks } from '../../../lib/form';
import { plural, countOf } from '../../../lib/text';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Badge, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { type TableFilterGroup } from '@ordo/shared';
import { ArrowsClockwiseIcon, CoinsIcon, CopyIcon, DownloadSimpleIcon, FilePdfIcon, HandCoinsIcon, PencilSimpleIcon, ReceiptIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { useTrackingMutations } from '../api/tracking';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView, type FirstTableView } from '../../../components/data-table/views/use-data-view';
import { localToday } from '../../../lib/dates';
import { ON_ERROR, toastCallbacks } from '../../../lib/notify';
import { useDocumentMutations, useImportedDocumentMutations, type AccountingDocumentSummary, type ImportedDocument } from '../api/documents';
import { openImportForm } from '../lib/imported-form';
import { DOCUMENT_TYPE_LABELS } from '../lib/labels';
import { openDepositForm } from '../lib/new-document';
import { openFile } from '../../files/lib/open-file';
import { downloadUrl } from '../../files/lib/viewable';
import { pdfUrl } from '../lib/document-pdf';
import { openPaymentDialog } from '../lib/payment-dialog';
import { StatusMenu, TrackingBadge } from './TrackingBadge';
import { openSentDialog } from '../lib/sent-dialog';
import * as fmt from '../../../lib/format';
import { useWorkspace } from '../../workspace/api';
import { projectFullPath, projectOptions } from '../../workspace/lib/tree';
import { DocumentAttachmentsCell, DocumentProjectCell } from './document-cells';
import { useCommentCounts } from '../../comments/api';
import { archiveRowsAction, deleteRowsAction, duplicateRowsAction } from '../../../components/data-table/selection/selection-actions';
import { ArchivedBadge } from '../../../components/items/ItemBadge';
import { archiveEntry, useSetArchived } from '../../../lib/archive';
import { accountingQueryKey } from '../api';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { commentColumn } from '../../comments/lib/comment-column';
import type { TreeOption } from '../../../components/tree/tree-select';

type Row = { kind: 'ordo'; document: AccountingDocumentSummary } | { kind: 'imported'; document: ImportedDocument };

/**
 * Key of a row.
 * @param {Row} row Row.
 * @returns {string} Key.
 */
const rowKey = (row: Row) => `${row.kind}:${row.document.id}`;

/**
 * Tracking status of a document, as a text.
 * @param {Row} row Row.
 * @returns {string} Text.
 */
const trackingText = (row: Row) => (row.kind === 'ordo' && row.document.status !== 'FINAL' ? 'Brouillon' : (row.document.trackingStatus?.name ?? ''));

/**
 * Month of a date, in words.
 * @param {string | null | undefined} date YYYY-MM-DD.
 * @returns {string} "Août 2026", empty without date.
 */
const monthText = (date: string | null | undefined) => (date ? fmt.capitalize(fmt.month(date.slice(0, 7))) : '');

/**
 * Columns of the documents (type and client only where they vary).
 * @param {{ rows: Row[], projectNames: Map<string, string>, projects: TreeOption[] }} env Rows (their clients and statuses offered by the filters), names of the projects, projects as their tree.
 * @returns {DataColumn<Row>[]} Columns.
 */
function documentColumns({ rows, projectNames, projects }: { rows: Row[]; projectNames: Map<string, string>; projects: TreeOption[] }): DataColumn<Row>[] {
  const clients = new Map(rows.flatMap((row) => (row.document.clientId ? [[row.document.clientId, row.document.clientName ?? ''] as const] : [])));
  const statuses = new Map(rows.map((row) => [trackingText(row), trackingText(row)] as const).filter(([name]) => name));
  const projectOf = (row: Row) => (row.document.projectId ? (projectNames.get(row.document.projectId) ?? '') : '');
  const money = (amount: number) => fmt.money(amount);
  return [
    { id: 'number', label: 'Numéro', size: 150, locked: true, sortValue: (row) => row.document.number ?? null, text: (row) => row.document.number ?? 'Brouillon' },
    {
      id: 'type',
      label: 'Type',
      size: 130,
      sortValue: (row) => DOCUMENT_TYPE_LABELS[row.document.type],
      text: (row) => DOCUMENT_TYPE_LABELS[row.document.type],
      filter: { kind: 'choice', value: (row) => row.document.type, options: Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
      groupable: true,
    },
    {
      id: 'date',
      label: 'Date',
      size: 120,
      sortValue: (row) => row.document.issueDate,
      text: (row) => fmt.day(row.document.issueDate),
      filter: { kind: 'date', value: (row) => row.document.issueDate },
    },
    {
      id: 'month',
      label: 'Mois',
      size: 140,
      hiddenByDefault: true,
      sortValue: (row) => row.document.issueDate.slice(0, 7),
      text: (row) => monthText(row.document.issueDate),
      filter: false,
      groupable: true,
    },
    {
      id: 'dueDate',
      label: 'Échéance',
      size: 120,
      hiddenByDefault: true,
      sortValue: (row) => row.document.dueDate ?? null,
      text: (row) => (row.document.dueDate ? fmt.day(row.document.dueDate) : ''),
      filter: { kind: 'date', value: (row) => row.document.dueDate ?? null },
    },
    {
      id: 'dueMonth',
      label: 'Mois d’échéance',
      size: 150,
      hiddenByDefault: true,
      sortValue: (row) => row.document.dueDate?.slice(0, 7) ?? null,
      text: (row) => monthText(row.document.dueDate),
      filter: false,
      groupable: true,
    },
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
    { id: 'title', label: 'Objet', size: 300, sortValue: (row) => row.document.title ?? null, text: (row) => row.document.title ?? '' },
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
      label: 'Reste dû',
      size: 120,
      numeric: true,
      hiddenByDefault: true,
      sortValue: (row) => row.document.balance ?? 0,
      formatTotal: money,
      text: (row) => (row.document.balance ? fmt.money(row.document.balance, row.document.currency) : ''),
      filter: { kind: 'number', value: (row) => row.document.balance ?? 0 },
    },
    {
      id: 'attachments',
      bulk: true,
      label: 'Pièces jointes',
      size: 220,
      hiddenByDefault: true,
      text: (row) => (row.kind === 'ordo' ? row.document.attachments.map((attachment) => attachment.name).join(', ') : (row.document.fileName ?? '')),
      filter: { kind: 'boolean', value: (row) => (row.kind === 'ordo' ? row.document.attachments.length > 0 : Boolean(row.document.fileUrl)) },
    },
  ];
}

/**
 * Filter of the documents issued within a period.
 * @param {string} period Period token.
 * @returns {TableFilterGroup} Filter.
 */
const issuedWithin = (period: string): TableFilterGroup => ({
  type: 'group',
  id: 'root',
  combinator: 'and',
  children: [{ type: 'condition', id: 'date', field: 'date', operator: 'within', value: period }],
});

/** Views made the first time a table of documents is shown: this year (opened first), last year, all, latest first. */
const DOCUMENT_VIEWS: FirstTableView[] = [
  { name: 'Cette année', config: { filter: issuedWithin('thisYear') } },
  { name: 'L’année dernière', config: { filter: issuedWithin('lastYear') } },
  { name: 'Tous' },
];

/** Status chosen in a cell, with the scope of its statuses (quotes, or invoices). */
interface StatusChoice {
  status: { id: string; category: string };
  scope: 'QUOTE' | 'INVOICE';
}

/**
 * Scope of the statuses of a type of document.
 * @param {string} type Type.
 * @returns {'QUOTE' | 'INVOICE'} Scope.
 */
const scopeOf = (type: string): StatusChoice['scope'] => (type === 'QUOTE' ? 'QUOTE' : 'INVOICE');

/**
 * Tracking status of an imported document, chosen in place.
 * @param {{ document: ImportedDocument, onSelect: (status: { id: string, category: string }) => void }} props Document, and what a chosen status does.
 * @returns {JSX.Element} Cell.
 */
function ImportedTracking({ document, onSelect }: { document: ImportedDocument; onSelect: (status: { id: string; category: string }) => void }) {
  return (
    <Group gap={4} wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      <StatusMenu type={document.type} current={document.trackingStatus} onSelect={onSelect} readOnly={document.archived} />
      {document.type !== 'QUOTE' && (
        <Badge size="sm" variant="light" color={document.balance ? 'orange' : 'green'}>
          {document.balance ? `Reste ${fmt.money(document.balance, document.currency)}` : 'Réglée'}
        </Badge>
      )}
    </Group>
  );
}

/**
 * Actions of a document made in Ordo: a payment (refund) while still due, a draft copy (then opened), its PDF,
 * archive / restore (an archived one keeps its PDF only).
 * @param {{ document: AccountingDocumentSummary, onDuplicated: (id: string) => void }} props Component props.
 * @returns {JSX.Element} Actions.
 */
function OrdoActions({ document, onDuplicated }: { document: AccountingDocumentSummary; onDuplicated: (id: string) => void }) {
  const { duplicate } = useDocumentMutations();
  const setArchived = useSetArchived('ACCOUNTING_DOCUMENT', [accountingQueryKey]);
  return (
    <RowActions
      name={document.number ?? 'le brouillon'}
      // An invoice still due takes a payment, a credit note still to refund a refund.
      primary={
        !document.archived &&
        document.status === 'FINAL' &&
        document.type !== 'QUOTE' &&
        (document.balance ?? 0) > 0 && {
          label: document.type === 'CREDIT_NOTE' ? 'Enregistrer un remboursement' : 'Enregistrer un paiement',
          icon: <CoinsIcon aria-hidden />,
          onClick: () => openPaymentDialog(document),
        }
      }
      items={[
        !document.archived && {
          label: 'Dupliquer en brouillon',
          icon: <CopyIcon aria-hidden />,
          disabled: duplicate.isPending,
          onClick: () =>
            duplicate.mutate(
              { id: document.id, issueDate: localToday() },
              formCallbacks(null, 'Document dupliqué en brouillon.', (id) => onDuplicated(id)),
            ),
        },
        // A final document downloads its PDF; drafts have none yet.
        document.status === 'FINAL' && { label: 'Télécharger le PDF', icon: <DownloadSimpleIcon aria-hidden />, href: pdfUrl(document.id, true), download: true },
        archiveEntry({ archived: document.archived, label: `« ${document.number ?? document.title ?? 'Brouillon'} »` }, setArchived, document.id),
      ]}
    />
  );
}

interface DocumentsTableProps {
  /** Name of the table (its saved views). */
  tableKey: string;
  /** Project of the views (a project's tab), null for the accounting page. Optional. */
  projectId?: string | null;
  /** Title of the exports. */
  title: string;
  documents: AccountingDocumentSummary[];
  /** Documents issued before Ordo, listed with the others. */
  imported?: ImportedDocument[];
  showType?: boolean;
  showClient?: boolean;
  empty: string;
  /** Views made the first time the table is shown. Optional. Default = this year, last year, all. */
  first?: FirstTableView[];
}

/**
 * Table of accounting documents, Ordo's and imported ones together, in saved views (this year, last year, all by
 * default) filtered, sorted, grouped and exported as every table: an Ordo document opens on click; an imported one
 * shows its file, and can be edited or deleted.
 * @param {DocumentsTableProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function DocumentsTable({ tableKey, projectId = null, title, documents, imported = [], showType, showClient = true, empty, first = DOCUMENT_VIEWS }: DocumentsTableProps) {
  const navigate = useNavigate();
  const importedMutations = useImportedDocumentMutations();
  const { remove } = importedMutations;
  const documentMutations = useDocumentMutations();
  const tracking = useTrackingMutations();
  const archiveOrdo = useSetArchived('ACCOUNTING_DOCUMENT', [accountingQueryKey]);
  const archiveImported = useSetArchived('IMPORTED_DOCUMENT', [accountingQueryKey]);
  const ordoComments = useCommentCounts(
    'DOCUMENT',
    documents.map((document) => document.id),
  );
  const importedComments = useCommentCounts(
    'IMPORTED_DOCUMENT',
    imported.map((document) => document.id),
  );
  const { data: workspace } = useWorkspace();
  const projectNames = new Map((workspace?.projects ?? []).map((project) => [project.id, projectFullPath(workspace!, project)]));
  const projects = projectOptions(
    workspace,
    (workspace?.projects ?? []).filter((project) => !project.archived),
  );
  // Latest first, before any sort.
  const rows = [...documents.map((document) => ({ kind: 'ordo' as const, document })), ...imported.map((document) => ({ kind: 'imported' as const, document }))].sort((a, b) =>
    b.document.issueDate.localeCompare(a.document.issueDate),
  ) as Row[];
  const columns = [
    ...documentColumns({ rows, projectNames, projects: projectOptions(workspace, workspace?.projects ?? []) }).filter(
      (column) => (column.id !== 'type' || showType) && (column.id !== 'client' || showClient),
    ),
    commentColumn<Row>(
      new Map([...ordoComments, ...importedComments]),
      (row) => row.document.id,
      (row) => (row.kind === 'imported' ? row.document.note : null),
    ),
  ];
  // Archived documents are hidden unless the view includes them (« Inclure les archivées »).
  const view = useDataView({ tableKey, getKey: rowKey, projectId, columns, rows, title, first, archived: (row) => row.document.archived });

  /**
   * Sets a status on documents of its scope (final ones of Ordo, imported ones); a "sent" one asks once when and how.
   * @param {Row[]} targets Documents.
   * @param {StatusChoice} choice Status.
   * @returns {void}
   */
  const setTracking = (targets: Row[], { status, scope }: StatusChoice) => {
    const kept = targets.filter((row) => !row.document.archived && scopeOf(row.document.type) === scope && (row.kind === 'imported' || row.document.status === 'FINAL'));
    if (!kept.length) return;
    if (status.category !== 'SENT') {
      for (const row of kept) (row.kind === 'ordo' ? tracking.setStatus : importedMutations.setStatus).mutate({ id: row.document.id, statusId: status.id }, ON_ERROR);
      return;
    }
    const [first] = kept;
    openSentDialog({
      title: kept.length > 1 ? `Envoi de ${kept.length} documents` : `Envoi de ${first.document.number ?? 'ce document'}`,
      sentAt: kept.length === 1 ? first.document.sentAt : null,
      sentVia: kept.length === 1 ? first.document.sentVia : null,
      onSubmit: ({ date, via }) =>
        Promise.all(
          kept.map((row) =>
            row.kind === 'ordo'
              ? tracking.markSent.mutateAsync({ id: row.document.id, date, via, statusId: status.id })
              : importedMutations.markSent.mutateAsync({ id: row.document.id, date, via, statusId: status.id }),
          ),
        ),
    });
  };
  const bulkTracking = bulkSaver<Row, StatusChoice>(
    view,
    (row, choice) => setTracking([row], choice),
    (targets, choiceFor) => setTracking(targets, choiceFor(targets[0])),
  )('tracking');
  // An archived document is read only: left out of the changes of several rows.
  const bulkProject = bulkSaver<Row, string | null>(view, (row, projectId) => {
    if (!row.document.archived) (row.kind === 'ordo' ? documentMutations.setProject : importedMutations.setProject).mutate({ id: row.document.id, projectId }, ON_ERROR);
  })('project');
  // Files join the documents of Ordo (an imported one has its single file).
  const bulkFiles = bulkSaver<Row, File[]>(view, (row, files) => {
    if (row.kind === 'ordo' && !row.document.archived) documentMutations.addAttachments.mutate({ id: row.document.id, files }, ON_ERROR);
  })('attachments');

  /**
   * Asks for confirmation before deleting an imported document.
   * @param {ImportedDocument} document Document.
   * @returns {void}
   */
  const confirmDelete = (document: ImportedDocument) => {
    confirmDestructive({
      title: 'Supprimer le document importé',
      risks: <>Le document importé {document.number} et son fichier seront supprimés définitivement d’Ordo. Cette action est irréversible.</>,
      onConfirm: () => {
        remove.mutate(document.id, toastCallbacks('Document importé supprimé.'));
      },
    });
  };

  /**
   * Page of a document.
   * @param {Row} row Row.
   * @returns {string} Path.
   */
  const pathOf = (row: Row) => (row.kind === 'ordo' ? `/accounting/${row.document.id}` : `/accounting/imported/${row.document.id}`);

  /**
   * Cells of a document made in Ordo.
   * @param {AccountingDocumentSummary} document Document.
   * @returns {Record<string, ReactNode>} Cells.
   */
  const ordoCells = (document: AccountingDocumentSummary): Record<string, ReactNode> => ({
    number: (
      <UnstyledButton onClick={() => navigate(`/accounting/${document.id}`)} aria-label={`Ouvrir ${document.number ?? 'le brouillon'}`}>
        <Group gap={6} wrap="nowrap">
          {document.number ? (
            <Text size="sm" ff="monospace" fw={600}>
              {document.number}
            </Text>
          ) : (
            <Badge size="sm" variant="light" color="gray">
              Brouillon
            </Badge>
          )}
          {document.recurringId && <ArrowsClockwiseIcon aria-label="Issue d’une facture récurrente" />}
          {document.archived && <ArchivedBadge size="xs" />}
        </Group>
      </UnstyledButton>
    ),
    title: (
      <Stack gap={0}>
        <Text size="sm" truncate>
          {document.title ?? '—'}
        </Text>
        {document.type === 'QUOTE' && document.invoicedNet != null && document.totalNet > 0 && (
          <Text size="xs" c="dimmed">
            Facturé à {Math.round((document.invoicedNet / document.totalNet) * 100)} %
          </Text>
        )}
        {document.sourceNumber && (
          <Text size="xs" c="dimmed">
            Depuis {document.sourceNumber}
          </Text>
        )}
      </Stack>
    ),
    tracking: (
      <div onClick={(event) => event.stopPropagation()}>
        <TrackingBadge document={document} editable onSelect={(status) => bulkTracking({ kind: 'ordo', document }, { status, scope: scopeOf(document.type) })} />
      </div>
    ),
    gross: (
      <>
        <Text span size="sm" ff="monospace" fw={600}>
          {fmt.money(document.totalGross, document.currency)}
        </Text>
        {document.balance != null && document.balance > 0 && document.balance < document.totalGross && (
          <Text size="xs" c="dimmed" fw={400}>
            {document.type === 'CREDIT_NOTE' ? 'À rembourser' : 'Reste'} {fmt.money(document.balance, document.currency)}
          </Text>
        )}
      </>
    ),
  });

  /**
   * Cells of a document issued before Ordo.
   * @param {ImportedDocument} document Document.
   * @returns {Record<string, ReactNode>} Cells.
   */
  const importedCells = (document: ImportedDocument): Record<string, ReactNode> => ({
    number: (
      <Group gap={6} wrap="nowrap">
        <UnstyledButton onClick={() => navigate(`/accounting/imported/${document.id}`)} aria-label={`Ouvrir ${document.number}`}>
          <Text size="sm" ff="monospace" fw={600}>
            {document.number}
          </Text>
        </UnstyledButton>
        <Badge size="xs" variant="light" color="cyan">
          Importé
        </Badge>
        {document.archived && <ArchivedBadge size="xs" />}
      </Group>
    ),
    title: (
      <Text size="sm" truncate>
        {document.title ?? '—'}
      </Text>
    ),
    tracking: <ImportedTracking document={document} onSelect={(status) => bulkTracking({ kind: 'imported', document }, { status, scope: scopeOf(document.type) })} />,
    gross: (
      <Text span size="sm" ff="monospace" fw={600}>
        {fmt.money(document.totalGross, document.currency)}
      </Text>
    ),
  });

  return (
    <DataTable
      view={view}
      framed
      bar={{ searchLabel: 'Rechercher (numéro, client, objet)' }}
      selectionLabel={(count) => selectedLabel(count, ['document', 'documents'], false)}
      selectionActions={(rows, clear) => {
        const ordo = rows.flatMap((row) => (row.kind === 'ordo' ? [row.document] : []));
        const importedRows = rows.flatMap((row) => (row.kind === 'ordo' ? [] : [row.document]));
        // An archived document is not copied.
        const copied = ordo.filter((document) => !document.archived);
        const ids = (documents: { id: string }[]) => documents.map((document) => document.id);
        return [
          archiveRowsAction({
            archived: rows.every((row) => row.document.archived),
            apply: (archived) =>
              Promise.all([ordo.length && archiveOrdo.mutateAsync({ ids: ids(ordo), archived }), importedRows.length && archiveImported.mutateAsync({ ids: ids(importedRows), archived })]),
            label: countOf(rows.length, 'document'),
            count: rows.length,
            clear,
          }),
          {
            ...duplicateRowsAction(copied, {
              label: 'Dupliquer en brouillon',
              duplicate: (document) => documentMutations.duplicate.mutateAsync({ id: document.id, issueDate: localToday() }),
              done: `${countOf(copied.length, 'document')} ${plural(copied.length, 'dupliqué')} en brouillon.`,
            }),
            disabled: copied.length === 0,
          },
          {
            ...deleteRowsAction(importedRows, {
              title: 'Supprimer les documents importés',
              risks: `${countOf(importedRows.length, 'document')} ${plural(importedRows.length, 'importé')} et leur fichier seront supprimés définitivement d’Ordo (les documents d’Ordo sélectionnés ne le sont pas). Cette action est irréversible.`,
              remove: (document) => remove.mutateAsync(document.id),
              done: `${countOf(importedRows.length, 'document')} ${plural(importedRows.length, 'importé')} ${plural(importedRows.length, 'supprimé')}.`,
              clear,
            }),
            disabled: importedRows.length === 0,
          },
        ];
      }}
      empty={<EmptyState icon={<ReceiptIcon aria-hidden />} message={empty} />}
      highlightOnHover
      verticalSpacing="xs"
      getKey={rowKey}
      rowProps={(row) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(pathOf(row)) })}
      cells={(row) => ({
        type: DOCUMENT_TYPE_LABELS[row.document.type],
        date: fmt.day(row.document.issueDate),
        dueDate: row.document.dueDate ? fmt.day(row.document.dueDate) : null,
        project: <DocumentProjectCell document={row.document} projects={projects} onSave={(projectId) => bulkProject(row, projectId)} />,
        attachments:
          row.kind === 'ordo' ? (
            <DocumentAttachmentsCell kind="ordo" document={row.document} onAdd={(files) => bulkFiles(row, files)} />
          ) : (
            <DocumentAttachmentsCell kind="imported" document={row.document} onAdd={(files) => bulkFiles(row, files)} />
          ),
        client: row.document.clientName,
        origin: row.kind === 'imported' ? 'Importé' : 'Ordo',
        net: fmt.money(row.document.totalNet, row.document.currency),
        balance: row.document.balance ? fmt.money(row.document.balance, row.document.currency) : null,
        ...(row.kind === 'ordo' ? ordoCells(row.document) : importedCells(row.document)),
      })}
      actions={(row) => (
        // Not opening the row: the menu is rendered in a portal, its clicks still reach the row.
        <div onClick={(event) => event.stopPropagation()}>
          {row.kind === 'ordo' ? (
            <OrdoActions document={row.document} onDuplicated={(id) => void navigate(`/accounting/${id}`)} />
          ) : (
            <RowActions
              name={row.document.number}
              primary={
                row.document.fileUrl && {
                  label: 'Voir le fichier',
                  icon: <FilePdfIcon aria-hidden />,
                  onClick: () => openFile({ url: row.document.fileUrl!, name: row.document.fileName ?? row.document.number, mimeType: row.document.fileMimeType }),
                }
              }
              items={[
                row.document.fileUrl && { label: 'Télécharger le fichier', icon: <DownloadSimpleIcon aria-hidden />, href: downloadUrl(row.document.fileUrl), download: true },
                !row.document.archived &&
                  row.document.type === 'QUOTE' && {
                    label: 'Facture d’acompte',
                    icon: <HandCoinsIcon aria-hidden />,
                    disabled: !row.document.clientId,
                    hint: row.document.clientId ? undefined : 'Rattachez le devis à un client pour facturer un acompte',
                    onClick: () => openDepositForm({ importedQuoteId: row.document.id }),
                  },
                !row.document.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openImportForm(row.document as ImportedDocument) },
                archiveEntry({ archived: row.document.archived, label: `« ${row.document.number} »` }, archiveImported, row.document.id),
                { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(row.document as ImportedDocument) },
              ]}
            />
          )}
        </div>
      )}
    />
  );
}
