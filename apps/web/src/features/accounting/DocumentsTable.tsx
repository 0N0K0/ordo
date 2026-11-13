import { Badge, Group, Paper, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import { formatMoney, type TableFilterGroup } from '@ordo/shared';
import { ArrowsClockwiseIcon, CoinsIcon, CopyIcon, DownloadSimpleIcon, FilePdfIcon, HandCoinsIcon, PencilSimpleIcon, ReceiptIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { DataTable } from '../../components/data-table/DataTable';
import type { DataColumn } from '../../components/data-table/data-table';
import { RowActions } from '../../components/data-table/RowActions';
import { useDataView, type FirstTableView } from '../../components/data-table/use-data-view';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useDocumentMutations, useImportedDocumentMutations, type AccountingDocumentSummary, type ImportedDocument } from './documents-api';
import { openImportForm } from './imported-form';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { openDepositForm } from './new-document';
import { openFile } from '../files/open-file';
import { downloadUrl } from '../files/viewable';
import { pdfUrl } from './document-pdf';
import { openPaymentDialog } from './payment-dialog';
import { StatusMenu, TrackingBadge } from './TrackingBadge';
import { openSentDialog } from './sent-dialog';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

type Row = { kind: 'ordo'; document: AccountingDocumentSummary } | { kind: 'imported'; document: ImportedDocument };

/**
 * Tracking status of a document, as a text.
 * @param {Row} row Row.
 * @returns {string} Text.
 */
const trackingText = (row: Row) => (row.kind === 'ordo' && row.document.status !== 'FINAL' ? 'Brouillon' : (row.document.trackingStatus?.name ?? ''));

/**
 * Money of a document.
 * @param {number} amount Amount.
 * @param {string} currency Currency.
 * @returns {string} Text.
 */
const money = (amount: number, currency: string) => formatMoney(Math.round(amount * 100), currency);

/** Columns of the documents (type and client only where they vary). */
const DOCUMENT_COLUMNS: DataColumn<Row>[] = [
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
    text: (row) => dateFormat.format(new Date(`${row.document.issueDate}T00:00:00Z`)),
    filter: { kind: 'date', value: (row) => row.document.issueDate },
  },
  { id: 'client', label: 'Client', size: 180, sortValue: (row) => row.document.clientName ?? null, text: (row) => row.document.clientName ?? '', groupable: true },
  { id: 'title', label: 'Objet', size: 300, sortValue: (row) => row.document.title ?? null, text: (row) => row.document.title ?? '' },
  { id: 'tracking', label: 'Suivi', size: 200, sortValue: trackingText, text: trackingText, groupable: true },
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
  { id: 'net', label: 'Total HT', size: 120, numeric: true, sortValue: (row) => row.document.totalNet, text: (row) => money(row.document.totalNet, row.document.currency) },
  { id: 'gross', label: 'Total', size: 140, numeric: true, sortValue: (row) => row.document.totalGross, text: (row) => money(row.document.totalGross, row.document.currency) },
  {
    id: 'balance',
    label: 'Reste dû',
    size: 120,
    numeric: true,
    hiddenByDefault: true,
    sortValue: (row) => row.document.balance ?? 0,
    text: (row) => (row.document.balance ? money(row.document.balance, row.document.currency) : ''),
  },
];

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

/**
 * Tracking status of an imported document, chosen in place (a sent one asks when and how).
 * @param {{ document: ImportedDocument }} props Component props.
 * @returns {JSX.Element} Cell.
 */
function ImportedTracking({ document }: { document: ImportedDocument }) {
  const { setStatus, markSent } = useImportedDocumentMutations();
  return (
    <Group gap={4} wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      <StatusMenu
        type={document.type}
        current={document.trackingStatus}
        pending={setStatus.isPending}
        onSelect={(status) =>
          status.category === 'SENT'
            ? openSentDialog({
                title: `Envoi de ${document.number}`,
                sentAt: document.sentAt,
                sentVia: document.sentVia,
                onSubmit: ({ date, via }) => markSent.mutateAsync({ id: document.id, date, via, statusId: status.id }),
              })
            : setStatus.mutate({ id: document.id, statusId: status.id }, { onError: (error) => notifyError(error.message) })
        }
      />
      {document.type !== 'QUOTE' && (
        <Badge size="sm" variant="light" color={document.balance ? 'orange' : 'green'}>
          {document.balance ? `Reste ${money(document.balance, document.currency)}` : 'Réglée'}
        </Badge>
      )}
    </Group>
  );
}

/**
 * Actions of a document made in Ordo: a payment (refund) while still due, a draft copy (then opened), its PDF.
 * @param {{ document: AccountingDocumentSummary, onDuplicated: (id: string) => void }} props Component props.
 * @returns {JSX.Element} Actions.
 */
function OrdoActions({ document, onDuplicated }: { document: AccountingDocumentSummary; onDuplicated: (id: string) => void }) {
  const { duplicate } = useDocumentMutations();
  return (
    <RowActions
      name={document.number ?? 'le brouillon'}
      // An invoice still due takes a payment, a credit note still to refund a refund.
      primary={
        document.status === 'FINAL' &&
        document.type !== 'QUOTE' &&
        (document.balance ?? 0) > 0 && {
          label: document.type === 'CREDIT_NOTE' ? 'Enregistrer un remboursement' : 'Enregistrer un paiement',
          icon: <CoinsIcon aria-hidden />,
          onClick: () => openPaymentDialog(document),
        }
      }
      items={[
        {
          label: 'Dupliquer en brouillon',
          icon: <CopyIcon aria-hidden />,
          disabled: duplicate.isPending,
          onClick: () =>
            duplicate.mutate(
              { id: document.id, issueDate: localToday() },
              {
                onSuccess: (id) => {
                  notifySuccess('Document dupliqué en brouillon.');
                  onDuplicated(id);
                },
                onError: (error) => notifyError(error.message),
              },
            ),
        },
        // A final document downloads its PDF; drafts have none yet.
        document.status === 'FINAL' && { label: 'Télécharger le PDF', icon: <DownloadSimpleIcon aria-hidden />, href: pdfUrl(document.id, true), download: true },
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
  const { remove } = useImportedDocumentMutations();
  const columns = DOCUMENT_COLUMNS.filter((column) => (column.id !== 'type' || showType) && (column.id !== 'client' || showClient));
  // Latest first, before any sort.
  const rows = [...documents.map((document) => ({ kind: 'ordo' as const, document })), ...imported.map((document) => ({ kind: 'imported' as const, document }))].sort((a, b) =>
    b.document.issueDate.localeCompare(a.document.issueDate),
  ) as Row[];
  const view = useDataView({ tableKey, projectId, columns, rows, title, first });

  /**
   * Asks for confirmation before deleting an imported document.
   * @param {ImportedDocument} document Document.
   * @returns {void}
   */
  const confirmDelete = (document: ImportedDocument) => {
    const modalId = `delete-imported-${document.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le document importé',
      children: (
        <Stack gap="md">
          <Text size="sm">Le document importé {document.number} et son fichier seront supprimés définitivement d’Ordo. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(document.id, {
                onSuccess: () => notifySuccess('Document importé supprimé.'),
                onError: (error) => notifyError(error.message),
              });
            }}
          />
        </Stack>
      ),
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
        <TrackingBadge document={document} editable />
      </div>
    ),
    gross: (
      <>
        <Text span size="sm" ff="monospace" fw={600}>
          {money(document.totalGross, document.currency)}
        </Text>
        {document.balance != null && document.balance > 0 && document.balance < document.totalGross && (
          <Text size="xs" c="dimmed" fw={400}>
            {document.type === 'CREDIT_NOTE' ? 'À rembourser' : 'Reste'} {money(document.balance, document.currency)}
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
      </Group>
    ),
    title: (
      <Text size="sm" truncate>
        {document.title ?? '—'}
      </Text>
    ),
    tracking: <ImportedTracking document={document} />,
    gross: (
      <Text span size="sm" ff="monospace" fw={600}>
        {money(document.totalGross, document.currency)}
      </Text>
    ),
  });

  return (
    <DataTable
      view={view}
      framed
      bar={{ searchLabel: 'Rechercher (numéro, client, objet)' }}
      empty={
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <ReceiptIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {empty}
            </Text>
          </Stack>
        </Paper>
      }
      highlightOnHover
      verticalSpacing="xs"
      getKey={(row) => `${row.kind}:${row.document.id}`}
      rowProps={(row) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(pathOf(row)) })}
      cells={(row) => ({
        type: DOCUMENT_TYPE_LABELS[row.document.type],
        date: dateFormat.format(new Date(`${row.document.issueDate}T00:00:00Z`)),
        client: row.document.clientName,
        origin: row.kind === 'imported' ? 'Importé' : 'Ordo',
        net: money(row.document.totalNet, row.document.currency),
        balance: row.document.balance ? money(row.document.balance, row.document.currency) : null,
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
                row.document.type === 'QUOTE' && {
                  label: 'Facture d’acompte',
                  icon: <HandCoinsIcon aria-hidden />,
                  disabled: !row.document.clientId,
                  hint: row.document.clientId ? undefined : 'Rattachez le devis à un client pour facturer un acompte',
                  onClick: () => openDepositForm({ importedQuoteId: row.document.id }),
                },
                { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openImportForm(row.document as ImportedDocument) },
                { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(row.document as ImportedDocument) },
              ]}
            />
          )}
        </div>
      )}
    />
  );
}
