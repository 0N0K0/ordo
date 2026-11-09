import { ActionIcon, Badge, Group, Paper, Stack, Table, Text, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import { formatMoney } from '@ordo/shared';
import { ArrowsClockwiseIcon, FilePdfIcon, HandCoinsIcon, PencilSimpleIcon, ReceiptIcon, TrashIcon } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useImportedDocumentMutations, type AccountingDocumentSummary, type ImportedDocument } from './documents-api';
import { openImportForm } from './imported-form';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { openDepositForm } from './new-document';
import { handleFileClick } from '../files/open-file';
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

/**
 * Table of accounting documents, Ordo's and imported ones together, latest first: an Ordo document opens on
 * click; an imported one shows its file, and can be edited or deleted.
 * @param {DocumentsTableProps} props Component props.
 * @returns {JSX.Element} Table.
 */
export function DocumentsTable({ documents, imported = [], showType, showClient = true, empty }: DocumentsTableProps) {
  const navigate = useNavigate();
  const { remove } = useImportedDocumentMutations();
  const rows: Row[] = [...documents.map((document) => ({ kind: 'ordo' as const, document })), ...imported.map((document) => ({ kind: 'imported' as const, document }))].sort((a, b) =>
    b.document.issueDate.localeCompare(a.document.issueDate),
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
      <Table highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Numéro</Table.Th>
            {showType && <Table.Th>Type</Table.Th>}
            <Table.Th>Date</Table.Th>
            {showClient && <Table.Th>Client</Table.Th>}
            <Table.Th>Objet</Table.Th>
            <Table.Th>Suivi</Table.Th>
            <Table.Th ta="right">Total HT</Table.Th>
            <Table.Th ta="right">Total</Table.Th>
            {imported.length > 0 && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) =>
            row.kind === 'ordo' ? (
              <OrdoRow
                key={row.document.id}
                document={row.document}
                showType={showType}
                showClient={showClient}
                actions={imported.length > 0}
                onOpen={() => void navigate(`/accounting/${row.document.id}`)}
              />
            ) : (
              <ImportedRow key={row.document.id} document={row.document} showType={showType} showClient={showClient} onDelete={() => confirmDelete(row.document)} />
            ),
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

interface OrdoRowProps {
  document: AccountingDocumentSummary;
  showType?: boolean;
  showClient: boolean;
  /** Empty actions cell (the table has imported documents). */
  actions: boolean;
  onOpen: () => void;
}

/**
 * Row of a document made in Ordo; it opens the document.
 * @param {OrdoRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function OrdoRow({ document, showType, showClient, actions, onOpen }: OrdoRowProps) {
  return (
    <Table.Tr style={{ cursor: 'pointer' }} onClick={onOpen}>
      <Table.Td>
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
      </Table.Td>
      {showType && <Table.Td>{DOCUMENT_TYPE_LABELS[document.type]}</Table.Td>}
      <Table.Td>{dateFormat.format(new Date(`${document.issueDate}T00:00:00Z`))}</Table.Td>
      {showClient && <Table.Td>{document.clientName}</Table.Td>}
      <Table.Td>
        <Stack gap={0}>
          <Text size="sm" truncate maw={320}>
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
      </Table.Td>
      <Table.Td>
        <TrackingBadge document={document} editable />
      </Table.Td>
      <Table.Td ta="right" ff="monospace">
        {formatMoney(Math.round(document.totalNet * 100), document.currency)}
      </Table.Td>
      <Table.Td ta="right" ff="monospace" fw={600}>
        {formatMoney(Math.round(document.totalGross * 100), document.currency)}
        {document.balance != null && document.balance > 0 && document.balance < document.totalGross && (
          <Text size="xs" c="dimmed" fw={400}>
            {document.type === 'CREDIT_NOTE' ? 'À rembourser' : 'Reste'} {formatMoney(Math.round(document.balance * 100), document.currency)}
          </Text>
        )}
      </Table.Td>
      {actions && <Table.Td />}
    </Table.Tr>
  );
}

interface ImportedRowProps {
  document: ImportedDocument;
  showType?: boolean;
  showClient: boolean;
  onDelete: () => void;
}

/**
 * Row of a document issued before Ordo: its tracking status (set by hand), its settlement, its file, a deposit
 * invoice from it (quotes), edit and delete.
 * @param {ImportedRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function ImportedRow({ document, showType, showClient, onDelete }: ImportedRowProps) {
  const { setStatus, markSent } = useImportedDocumentMutations();
  const navigate = useNavigate();
  const open = () => navigate(`/accounting/imported/${document.id}`);
  return (
    <Table.Tr style={{ cursor: 'pointer' }} onClick={open}>
      <Table.Td>
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
      </Table.Td>
      {showType && <Table.Td>{DOCUMENT_TYPE_LABELS[document.type]}</Table.Td>}
      <Table.Td>{dateFormat.format(new Date(`${document.issueDate}T00:00:00Z`))}</Table.Td>
      {showClient && <Table.Td>{document.clientName}</Table.Td>}
      <Table.Td>
        <Text size="sm" truncate maw={320}>
          {document.title ?? '—'}
        </Text>
      </Table.Td>
      <Table.Td>
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
                    onSubmit: ({ date, via }) =>
                      markSent.mutateAsync({
                        id: document.id,
                        date,
                        via,
                        statusId: status.id,
                      }),
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
      </Table.Td>
      <Table.Td ta="right" ff="monospace">
        {formatMoney(Math.round(document.totalNet * 100), document.currency)}
      </Table.Td>
      <Table.Td ta="right" ff="monospace" fw={600}>
        {formatMoney(Math.round(document.totalGross * 100), document.currency)}
      </Table.Td>
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
