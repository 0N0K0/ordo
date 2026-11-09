import { Badge, ColorSwatch, Group, Menu, UnstyledButton } from '@mantine/core';
import type { AccountingDocumentType } from '@ordo/shared';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { notifyError } from '../../lib/notify';
import type { AccountingDocumentSummary } from './documents-api';
import { useDocumentStatuses, useTrackingMutations } from './tracking-api';

type TrackedDocument = Pick<AccountingDocumentSummary, 'id' | 'status' | 'type' | 'trackingStatus' | 'overdue'>;

interface StatusMenuProps {
  type: AccountingDocumentType;
  current: { id: string; name: string; color: string } | null | undefined;
  onSelect: (statusId: string) => void;
  pending?: boolean;
}

/**
 * Tracking status of a document, changed from a list: a menu of the statuses of its scope (quotes, or invoices
 * with deposit invoices and credit notes). The click stays in the menu (rows open their document).
 * @param {StatusMenuProps} props Component props.
 * @returns {JSX.Element} Badge and its menu.
 */
export function StatusMenu({ type, current, onSelect, pending }: StatusMenuProps) {
  const { data: statuses } = useDocumentStatuses();
  const scoped = (statuses ?? []).filter((status) => status.scope === (type === 'QUOTE' ? 'QUOTE' : 'INVOICE'));
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <UnstyledButton aria-label={`Statut : ${current?.name ?? 'aucun'} (changer)`} onClick={(event) => event.stopPropagation()}>
          <Badge size="sm" variant="light" color={current?.color ?? 'gray'} rightSection={<CaretDownIcon aria-hidden size={10} />} style={{ cursor: 'pointer' }}>
            {current?.name ?? 'Sans statut'}
          </Badge>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
        <Menu.Label>Statut</Menu.Label>
        {scoped.map((status) => (
          <Menu.Item
            key={status.id}
            leftSection={<ColorSwatch color={status.color} size={12} />}
            rightSection={status.id === current?.id ? <CheckIcon aria-hidden /> : undefined}
            disabled={pending}
            onClick={() => status.id !== current?.id && onSelect(status.id)}
          >
            {status.name}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * Status menu of a final document of Ordo.
 * @param {{ document: TrackedDocument }} props Component props.
 * @returns {JSX.Element} Menu.
 */
function DocumentStatusMenu({ document }: { document: TrackedDocument }) {
  const { setStatus } = useTrackingMutations();
  return (
    <StatusMenu
      type={document.type}
      current={document.trackingStatus}
      pending={setStatus.isPending}
      onSelect={(statusId) => setStatus.mutate({ id: document.id, statusId }, { onError: (error) => notifyError(error.message) })}
    />
  );
}

/**
 * Tracking of a document: its status (draft, or configurable status of a final document, changed from its menu
 * when `editable`), and "overdue" for an invoice still due after its due date or a quote waiting after its validity.
 * @param {{ document: TrackedDocument, editable?: boolean }} props Component props.
 * @returns {JSX.Element} Badges.
 */
export function TrackingBadge({ document, editable = false }: { document: TrackedDocument; editable?: boolean }) {
  if (document.status !== 'FINAL') {
    return (
      <Badge size="sm" variant="light" color="gray">
        Brouillon
      </Badge>
    );
  }
  return (
    <Group gap={4} wrap="nowrap">
      {editable ? (
        <DocumentStatusMenu document={document} />
      ) : (
        document.trackingStatus && (
          <Badge size="sm" variant="light" color={document.trackingStatus.color}>
            {document.trackingStatus.name}
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
