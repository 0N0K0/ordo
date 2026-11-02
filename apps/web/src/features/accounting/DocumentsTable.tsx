import { Badge, Group, Paper, Stack, Table, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { formatMoney } from '@ordo/shared';
import { ArrowsClockwiseIcon, ReceiptIcon } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import type { AccountingDocumentSummary } from './documents-api';
import { DOCUMENT_TYPE_LABELS } from './labels';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

/**
 * Table of accounting documents; a row opens its document.
 * @param {{ documents: AccountingDocumentSummary[], showType?: boolean, showClient?: boolean, empty: string }} props Component props.
 * @returns {JSX.Element} Table.
 */
export function DocumentsTable({ documents, showType, showClient = true, empty }: { documents: AccountingDocumentSummary[]; showType?: boolean; showClient?: boolean; empty: string }) {
  const navigate = useNavigate();
  if (documents.length === 0) {
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
            <Table.Th ta="right">Total HT</Table.Th>
            <Table.Th ta="right">Total</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {documents.map((document) => (
            <Table.Tr key={document.id} style={{ cursor: 'pointer' }} onClick={() => void navigate(`/accounting/${document.id}`)}>
              <Table.Td>
                <UnstyledButton onClick={() => void navigate(`/accounting/${document.id}`)} aria-label={`Ouvrir ${document.number ?? 'le brouillon'}`}>
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
              <Table.Td ta="right" ff="monospace">
                {formatMoney(Math.round(document.totalNet * 100), document.currency)}
              </Table.Td>
              <Table.Td ta="right" ff="monospace" fw={600}>
                {formatMoney(Math.round(document.totalGross * 100), document.currency)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
