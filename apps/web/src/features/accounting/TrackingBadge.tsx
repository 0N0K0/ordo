import { Badge, Group } from '@mantine/core';
import type { AccountingDocumentSummary } from './documents-api';

/**
 * Tracking of a document: its status (draft, or configurable status of a final document), and "overdue"
 * for an invoice still due after its due date or a quote waiting after its validity.
 * @param {{ document: Pick<AccountingDocumentSummary, 'status' | 'type' | 'trackingStatus' | 'overdue'> }} props Component props.
 * @returns {JSX.Element} Badges.
 */
export function TrackingBadge({ document }: { document: Pick<AccountingDocumentSummary, 'status' | 'type' | 'trackingStatus' | 'overdue'> }) {
  if (document.status !== 'FINAL') {
    return (
      <Badge size="sm" variant="light" color="gray">
        Brouillon
      </Badge>
    );
  }
  return (
    <Group gap={4} wrap="nowrap">
      {document.trackingStatus && (
        <Badge size="sm" variant="light" color={document.trackingStatus.color}>
          {document.trackingStatus.name}
        </Badge>
      )}
      {document.overdue && (
        <Badge size="sm" variant="filled" color="red">
          {document.type === 'QUOTE' ? 'Expiré' : 'En retard'}
        </Badge>
      )}
    </Group>
  );
}
