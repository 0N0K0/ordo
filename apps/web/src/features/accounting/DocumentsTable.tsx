import { ActionIcon, Badge, Group, Paper, Stack, Table, Text, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import { formatMoney } from '@ordo/shared';
import { ArrowsClockwiseIcon, CoinsIcon, CopyIcon, DownloadSimpleIcon, FilePdfIcon, HandCoinsIcon, PencilSimpleIcon, ReceiptIcon, TrashIcon } from '@phosphor-icons/react';
import { useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ColumnsMenu } from '../../components/data-table/ColumnsMenu';
import { shownColumns, sortRows, tableWidth, type DataColumn, type ShownColumn } from '../../components/data-table/data-table';
import { DataTableHeader } from '../../components/data-table/DataTableHeader';
import tableClasses from '../../components/data-table/DataTable.module.css';
import { useTableLayout } from '../../components/data-table/use-table-layout';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useDocumentMutations, useImportedDocumentMutations, type AccountingDocumentSummary, type ImportedDocument } from './documents-api';
import { openImportForm } from './imported-form';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { openDepositForm } from './new-document';
import { handleFileClick } from '../files/open-file';
import { downloadUrl } from '../files/viewable';
import { pdfUrl } from './document-pdf';
import { openPaymentDialog } from './payment-dialog';
import { StatusMenu, TrackingBadge } from './TrackingBadge';
import { openSentDialog } from './sent-dialog';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

interface DocumentsTableProps {
  documents: AccountingDocumentSummary[];
  /** Documents issued before Ordo, listed with the others by date. */
  imported?: ImportedDocument[];
  showType?: boolean;
  showClient?: boolean;
  empty: string;
}

type Row = { kind: 'ordo'; document: AccountingDocumentSummary } | { kind: 'imported'; document: ImportedDocument };

/** Width of the actions column. */
const ACTIONS_WIDTH = 150;

/** Columns of the documents (type and client only where they vary). */
const DOCUMENT_COLUMNS: DataColumn<Row>[] = [
  { id: 'number', label: 'Numéro', size: 150, locked: true, sortValue: (row) => row.document.number ?? null },
  { id: 'type', label: 'Type', size: 130, sortValue: (row) => DOCUMENT_TYPE_LABELS[row.document.type] },
  { id: 'date', label: 'Date', size: 120, sortValue: (row) => row.document.issueDate },
  { id: 'client', label: 'Client', size: 180, sortValue: (row) => row.document.clientName ?? null },
  { id: 'title', label: 'Objet', size: 300, sortValue: (row) => row.document.title ?? null },
  { id: 'tracking', label: 'Suivi', size: 200 },
  { id: 'net', label: 'Total HT', size: 120, numeric: true, sortValue: (row) => row.document.totalNet },
  { id: 'gross', label: 'Total', size: 140, numeric: true, sortValue: (row) => row.document.totalGross },
];

/**
 * Table of accounting documents, Ordo's and imported ones together, latest first: an Ordo document opens on
 * click; an imported one shows its file, and can be edited or deleted.
 * @param {DocumentsTableProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function DocumentsTable({ documents, imported = [], showType, showClient = true, empty }: DocumentsTableProps) {
  const navigate = useNavigate();
  const { remove } = useImportedDocumentMutations();
  const { layout, setLayout, sorting, setSorting } = useTableLayout('accounting-documents');
  const tableRef = useRef<HTMLTableElement>(null);
  const columns = DOCUMENT_COLUMNS.filter((column) => (column.id !== 'type' || showType) && (column.id !== 'client' || showClient));
  const shown = shownColumns(columns, layout);
  const rows = sortRows(
    [...documents.map((document) => ({ kind: 'ordo' as const, document })), ...imported.map((document) => ({ kind: 'imported' as const, document }))].sort((a, b) =>
      b.document.issueDate.localeCompare(a.document.issueDate),
    ) as Row[],
    sorting,
    columns,
  );

  if (rows.length === 0) {
    return (
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
    );
  }

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

  return (
    <Paper withBorder radius="md">
      <div style={{ overflowX: 'auto' }}>
        <Table ref={tableRef} highlightOnHover verticalSpacing="xs" className={tableClasses.table} style={{ width: tableWidth(shown, ACTIONS_WIDTH), minWidth: '100%' }}>
          <DataTableHeader
            columns={columns}
            shown={shown}
            layout={layout}
            onLayoutChange={setLayout}
            sorting={sorting}
            onSortingChange={setSorting}
            tableRef={tableRef}
            trailing={
              <Table.Th w={ACTIONS_WIDTH}>
                <ColumnsMenu columns={columns} layout={layout} onLayoutChange={setLayout} />
              </Table.Th>
            }
          />
          <Table.Tbody>
            {rows.map((row) =>
              row.kind === 'ordo' ? (
                <OrdoRow
                  key={row.document.id}
                  document={row.document}
                  shown={shown}
                  onOpen={() => void navigate(`/accounting/${row.document.id}`)}
                  onDuplicated={(id) => void navigate(`/accounting/${id}`)}
                />
              ) : (
                <ImportedRow key={row.document.id} shown={shown} document={row.document} onDelete={() => confirmDelete(row.document)} />
              ),
            )}
          </Table.Tbody>
        </Table>
      </div>
    </Paper>
  );
}

interface OrdoRowProps {
  /** Columns shown. */
  shown: ShownColumn<Row>[];
  document: AccountingDocumentSummary;
  onOpen: () => void;
  /** The draft copy made: opened. */
  onDuplicated: (id: string) => void;
}

/**
 * Row of a document made in Ordo; it opens the document, and is duplicated as a draft (then opened); a final one
 * records a payment (refund) while still due and downloads its PDF.
 * @param {OrdoRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function OrdoRow({ shown, document, onOpen, onDuplicated }: OrdoRowProps) {
  const { duplicate } = useDocumentMutations();
  const cells: Record<string, ReactNode> = {
    number: (
      <UnstyledButton onClick={onOpen} aria-label={`Ouvrir ${document.number ?? 'le brouillon'}`}>
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
    type: DOCUMENT_TYPE_LABELS[document.type],
    date: dateFormat.format(new Date(`${document.issueDate}T00:00:00Z`)),
    client: document.clientName,
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
    tracking: <TrackingBadge document={document} editable />,
    net: formatMoney(Math.round(document.totalNet * 100), document.currency),
    gross: (
      <>
        <Text span size="sm" ff="monospace" fw={600}>
          {formatMoney(Math.round(document.totalGross * 100), document.currency)}
        </Text>
        {document.balance != null && document.balance > 0 && document.balance < document.totalGross && (
          <Text size="xs" c="dimmed" fw={400}>
            {document.type === 'CREDIT_NOTE' ? 'À rembourser' : 'Reste'} {formatMoney(Math.round(document.balance * 100), document.currency)}
          </Text>
        )}
      </>
    ),
  };
  return (
    <Table.Tr style={{ cursor: 'pointer' }} onClick={onOpen}>
      {shown.map((column) => (
        <Table.Td key={column.id} className={tableClasses.cell} data-numeric={column.numeric || undefined} ff={column.numeric ? 'monospace' : undefined}>
          {cells[column.id]}
        </Table.Td>
      ))}
      <Table.Td>
        <Group gap={2} justify="flex-end" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
          {/* An invoice still due takes a payment, a credit note still to refund a refund. */}
          {document.status === 'FINAL' && document.type !== 'QUOTE' && (document.balance ?? 0) > 0 && (
            <Tooltip label={document.type === 'CREDIT_NOTE' ? 'Enregistrer un remboursement' : 'Enregistrer un paiement'}>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`${document.type === 'CREDIT_NOTE' ? 'Remboursement' : 'Paiement'} de ${document.number}`}
                onClick={() => openPaymentDialog(document)}
              >
                <CoinsIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Dupliquer en brouillon">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Dupliquer ${document.number ?? 'le brouillon'}`}
              loading={duplicate.isPending && duplicate.variables?.id === document.id}
              onClick={() =>
                duplicate.mutate(
                  { id: document.id, issueDate: localToday() },
                  {
                    onSuccess: (id) => {
                      notifySuccess('Document dupliqué en brouillon.');
                      onDuplicated(id);
                    },
                    onError: (error) => notifyError(error.message),
                  },
                )
              }
            >
              <CopyIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          {/* A final document downloads its PDF; drafts have none yet. */}
          {document.status === 'FINAL' && (
            <Tooltip label="Télécharger le PDF">
              <ActionIcon component="a" href={pdfUrl(document.id, true)} download variant="subtle" color="gray" aria-label={`Télécharger ${document.number}`}>
                <DownloadSimpleIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

interface ImportedRowProps {
  /** Columns shown. */
  shown: ShownColumn<Row>[];
  document: ImportedDocument;
  onDelete: () => void;
}

/**
 * Row of a document issued before Ordo: its tracking status (set by hand), its settlement, its file, a deposit
 * invoice from it (quotes), edit and delete.
 * @param {ImportedRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function ImportedRow({ shown, document, onDelete }: ImportedRowProps) {
  const { setStatus, markSent } = useImportedDocumentMutations();
  const navigate = useNavigate();
  const open = () => navigate(`/accounting/imported/${document.id}`);
  const cells: Record<string, ReactNode> = {
    number: (
      <Group gap={6} wrap="nowrap">
        <UnstyledButton onClick={open} aria-label={`Ouvrir ${document.number}`}>
          <Text size="sm" ff="monospace" fw={600}>
            {document.number}
          </Text>
        </UnstyledButton>
        <Badge size="xs" variant="light" color="cyan">
          Importé
        </Badge>
      </Group>
    ),
    type: DOCUMENT_TYPE_LABELS[document.type],
    date: dateFormat.format(new Date(`${document.issueDate}T00:00:00Z`)),
    client: document.clientName,
    title: (
      <Text size="sm" truncate>
        {document.title ?? '—'}
      </Text>
    ),
    tracking: (
      <Group gap={4} wrap="nowrap">
        <StatusMenu
          type={document.type}
          current={document.trackingStatus}
          pending={setStatus.isPending}
          onSelect={(status) =>
            // A "sent" status asks when and how it was sent.
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
            {document.balance ? `Reste ${formatMoney(Math.round(document.balance * 100), document.currency)}` : 'Réglée'}
          </Badge>
        )}
      </Group>
    ),
    net: formatMoney(Math.round(document.totalNet * 100), document.currency),
    gross: (
      <Text span size="sm" ff="monospace" fw={600}>
        {formatMoney(Math.round(document.totalGross * 100), document.currency)}
      </Text>
    ),
  };
  return (
    <Table.Tr style={{ cursor: 'pointer' }} onClick={open}>
      {shown.map((column) => (
        <Table.Td key={column.id} className={tableClasses.cell} data-numeric={column.numeric || undefined} ff={column.numeric ? 'monospace' : undefined}>
          {cells[column.id]}
        </Table.Td>
      ))}
      <Table.Td>
        {/* Actions of the row, apart from opening it. */}
        <Group gap={2} justify="flex-end" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
          {document.fileUrl && (
            <Tooltip label={document.fileName ?? 'Document'}>
              <ActionIcon
                component="a"
                href={document.fileUrl}
                target="_blank"
                rel="noopener"
                variant="subtle"
                color="gray"
                aria-label={`Ouvrir ${document.fileName ?? 'le document'}`}
                onClick={(event: React.MouseEvent) => {
                  event.stopPropagation();
                  handleFileClick(event, {
                    url: document.fileUrl!,
                    name: document.fileName ?? document.number,
                    mimeType: document.fileMimeType,
                  });
                }}
              >
                <FilePdfIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
          {document.fileUrl && (
            <Tooltip label="Télécharger le fichier">
              <ActionIcon component="a" href={downloadUrl(document.fileUrl)} variant="subtle" color="gray" aria-label={`Télécharger ${document.fileName ?? document.number}`}>
                <DownloadSimpleIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
          {document.type === 'QUOTE' && (
            <Tooltip label={document.clientId ? 'Facture d’acompte' : 'Rattachez le devis à un client pour facturer un acompte'}>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Facture d’acompte sur ${document.number}`}
                disabled={!document.clientId}
                onClick={() => openDepositForm({ importedQuoteId: document.id })}
              >
                <HandCoinsIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Modifier">
            <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${document.number}`} onClick={() => openImportForm(document)}>
              <PencilSimpleIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Supprimer">
            <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${document.number}`} onClick={onDelete}>
              <TrashIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
