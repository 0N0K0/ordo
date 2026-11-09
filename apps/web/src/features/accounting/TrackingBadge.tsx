import { Badge, ColorSwatch, Group, Menu, UnstyledButton } from '@mantine/core';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { notifyError } from '../../lib/notify';
import type { AccountingDocumentSummary } from './documents-api';
import { useDocumentStatuses, useTrackingMutations } from './tracking-api';

type TrackedDocument = Pick<AccountingDocumentSummary, 'id' | 'status' | 'type' | 'trackingStatus' | 'overdue'>;

/**
 * Tracking status of a final document, changed from a list: a menu of the statuses of its scope.
 * @param {{ document: TrackedDocument }} props Component props.
 * @returns {JSX.Element} Badge and its menu.
 */
function StatusMenu({ document }: { document: TrackedDocument }) {
  const { data: statuses } = useDocumentStatuses();
  const { setStatus } = useTrackingMutations();
  const scoped = (statuses ?? []).filter((status) => status.scope === (document.type === 'QUOTE' ? 'QUOTE' : 'INVOICE'));
  const current = document.trackingStatus;
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        {/* In a row that opens the document: the click stays here. */}
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
            disabled={setStatus.isPending}
            onClick={() => status.id !== current?.id && setStatus.mutate({ id: document.id, statusId: status.id }, { onError: (error) => notifyError(error.message) })}
          >
            {status.name}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
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
        <StatusMenu document={document} />
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
