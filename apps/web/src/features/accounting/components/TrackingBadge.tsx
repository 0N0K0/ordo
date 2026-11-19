import { Badge, Group, UnstyledButton } from '@mantine/core';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { ItemBadge } from '../../../components/items/ItemBadge';
import type { AccountingDocumentType } from '@ordo/shared';

import { unarchived } from '../../../lib/archive';
import type { AccountingDocumentSummary } from '../api/documents';
import { chooseTrackingStatus } from '../lib/sent-dialog';
import { useDocumentStatuses, useTrackingMutations } from '../api/tracking';
import { MenuCaret } from '../../../components/actions/MenuCaret';

type TrackedDocument = Pick<AccountingDocumentSummary, 'id' | 'archived' | 'status' | 'type' | 'number' | 'trackingStatus' | 'overdue' | 'sentAt' | 'sentVia'>;

interface StatusMenuProps {
  type: AccountingDocumentType;
  current: { id: string; label: string; color: string } | null | undefined;
  /** Shown only, not changed (an archived document). Optional. */
  readOnly?: boolean;
  /** A status chosen (its category tells a "sent" one). */
  onSelect: (status: { id: string; category: string }) => void;
  pending?: boolean;
}

/**
 * Tracking status of a document, changed from a list: a menu of the statuses of its scope (quotes, or invoices
 * with deposit invoices and credit notes), the archived ones left out but the current one. The click stays in the
 * menu (rows open their document).
 * @param {StatusMenuProps} props Component props.
 * @returns {JSX.Element} Badge and its menu.
 */
export function StatusMenu({ type, current, onSelect, pending, readOnly = false }: StatusMenuProps) {
  const { data: statuses } = useDocumentStatuses();
  const scoped = unarchived(
    (statuses ?? []).filter((status) => status.scope === (type === 'QUOTE' ? 'QUOTE' : 'INVOICE')),
    current?.id,
  );
  // Nothing to choose (no status yet): the badge alone.
  if (readOnly || scoped.length === 0) return <ItemBadge item={current ?? { label: 'Sans statut' }} size="sm" />;
  return (
    <ActionsMenu
      about="du statut"
      inRow
      position="bottom-start"
      target={
        <UnstyledButton aria-label={`Statut : ${current?.label ?? 'aucun'} (changer)`} onClick={(event) => event.stopPropagation()}>
          <ItemBadge item={current ?? { label: 'Sans statut' }} size="sm" rightSection={<MenuCaret size={10} />} style={{ cursor: 'pointer' }} />
        </UnstyledButton>
      }
      items={[
        { section: 'Statut' },
        ...scoped.map((status) => ({
          label: status.label,
          icon: <ItemAvatar name={status.label} iconUrl={status.iconUrl} color={status.color} />,
          checked: status.id === current?.id,
          disabled: pending,
          onClick: () => status.id !== current?.id && onSelect(status),
        })),
      ]}
    />
  );
}

/**
 * Status menu of a final document of Ordo.
 * @param {{ document: TrackedDocument, onSelect?: (status: { id: string, category: string }) => void }} props Document, and what a chosen status does (default: set on it).
 * @returns {JSX.Element} Menu.
 */
function DocumentStatusMenu({ document, onSelect }: { document: TrackedDocument; onSelect?: (status: { id: string; category: string }) => void }) {
  const { setStatus, markSent } = useTrackingMutations();
  return (
    <StatusMenu
      type={document.type}
      current={document.trackingStatus}
      pending={setStatus.isPending}
      onSelect={(status) => (onSelect ? onSelect(status) : chooseTrackingStatus(document, status, { setStatus, markSent }))}
    />
  );
}

/**
 * Tracking of a document: its status (draft, or configurable status of a final document, changed from its menu
 * when `editable` and not archived), and "overdue" for an invoice still due after its due date or a quote waiting
 * after its validity.
 * @param {{ document: TrackedDocument, editable?: boolean, onSelect?: (status: { id: string, category: string }) => void }} props Document, editable, and what a chosen status does (default: set on it). Optional.
 * @returns {JSX.Element} Badges.
 */
export function TrackingBadge({ document, editable = false, onSelect }: { document: TrackedDocument; editable?: boolean; onSelect?: (status: { id: string; category: string }) => void }) {
  if (document.status !== 'FINAL') {
    return (
      <Badge size="sm" variant="light" color="gray">
        Brouillon
      </Badge>
    );
  }
  return (
    <Group gap={4} wrap="nowrap">
      {editable && !document.archived ? (
        <DocumentStatusMenu document={document} onSelect={onSelect} />
      ) : (
        document.trackingStatus && (
          <Badge size="sm" variant="light" color={document.trackingStatus.color}>
            {document.trackingStatus.label}
          </Badge>
        )
      )}
      {document.overdue && (
        <Badge size="sm" variant="filled" color="red">
          {document.type === 'QUOTE' ? 'Expiré' : 'En retard'}
        </Badge>
      )}
    </Group>
  );
}
