import { IconAction } from '../../../components/actions/IconAction';
import { Badge, Group, Popover, Stack, Text } from '@mantine/core';
import type { LinkedDocumentIds, Recurrence } from '@ordo/shared';
import { LinkIcon, ReceiptIcon } from '@phosphor-icons/react';
import { ellipsis } from '../../../lib/text';
import { useState } from 'react';
import { Link } from 'react-router';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { RuleField } from '../../../components/recurrence/RuleField';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { EntryLinkSelect, LinkBadge } from './entry-links';
import { linkKey, type LineLink } from '../lib/lines';
import { payerKey, payerOfKey, type AnyEntry, type EntryDocument, type EntryEnv, type EntrySave } from '../lib/entry-env';
import { DocumentsPicker } from '../../documents/components/DocumentsPicker';
import { FoldHeading } from '../../../components/actions/FoldHeading';
import { documentPath } from '../../../app/pages';

/**
 * Payer or payee of an entry, chosen in place among the clients and counterparties.
 * @param {{ entry: AnyEntry, env: EntryEnv, label: string, save: EntrySave }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function PayerCell({ entry, env, label, save }: { entry: AnyEntry; env: EntryEnv; label: string; save: EntrySave }) {
  return <EditableSelect value={payerKey(entry)} label={label} nullable data={env.payers} onSave={(key) => save(entry, payerOfKey(key))} />;
}

/**
 * Project of an entry or a line, chosen in place.
 * @param {{ value: string | null, env: EntryEnv, label: string, onSave: (projectId: string | null) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ProjectCell({ value, env, label, onSave }: { value: string | null; env: EntryEnv; label: string; onSave: (projectId: string | null) => void }) {
  return <EditableSelect value={value} label={label} nullable {...treeSelectProps(env.projects)} onSave={onSave} />;
}

/**
 * Supporting documents of an entry or a line: the shared documents picker, among the documents of the app.
 * @param {{ documents: EntryDocument[], env: EntryEnv, label: string, onSave: (ids: LinkedDocumentIds) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function DocumentsCell({ documents, env, label, onSave }: { documents: EntryDocument[]; env: EntryEnv; label: string; onSave: (ids: LinkedDocumentIds) => void }) {
  return <DocumentsPicker documents={documents} options={env.documents} label={label} action="Choisir les pièces justificatives" onSave={onSave} />;
}

/**
 * Links of an entry (whole entries without lines) or of a line (lines of other entries too): their badges, unlinked
 * from their cross, and a search linking another one. Linked money in and out offset each other in the charts.
 * @param {{ links: LineLink[], entryId: string, lines: boolean, label: string, onSave: (links: LineLink[]) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function LinksCell({ links, entryId, lines, label, onSave }: { links: LineLink[]; entryId: string; lines: boolean; label: string; onSave: (links: LineLink[]) => void }) {
  const [opened, setOpened] = useState(false);
  return (
    <Group gap={4} wrap="nowrap" align="flex-start">
      <StackedValues>
        {links.map((link) => (
          <LinkBadge key={linkKey(link)} link={link} size="sm" variant="outline" withTooltip onUnlink={() => onSave(links.filter((other) => other !== link))}>
            {ellipsis(link.entryLabel, 20)} · {fmt.money(link.amount)}
          </LinkBadge>
        ))}
      </StackedValues>
      <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md" width={380} trapFocus>
        <Popover.Target>
          <IconAction label="Lier un mouvement" size="sm" aria-label={label} onClick={() => setOpened((value) => !value)}>
            <LinkIcon aria-hidden />
          </IconAction>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap={4}>
            <EntryLinkSelect
              aria-label={label}
              entryId={entryId}
              links={links}
              lines={lines}
              onLink={(link) => {
                onSave([...links, link]);
                setOpened(false);
              }}
              comboboxProps={{ withinPortal: false }}
            />
            <Text size="xs" c="dimmed">
              Liées sur une même période, une entrée et une sortie se compensent dans les graphiques.
            </Text>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}

/**
 * Invoices an actual entry settles (credit notes it refunds), each opening its document.
 * @param {{ entry: TreasuryEntry }} props Component props.
 * @returns {JSX.Element | null} Badges.
 */
export function SettledCell({ entry }: { entry: AnyEntry }) {
  return (
    <StackedValues>
      {entry.allocations.map((allocation) =>
        allocation.documentId ? (
          <Badge key={allocation.id} size="sm" variant="light" leftSection={<ReceiptIcon aria-hidden />} component={Link} to={documentPath(allocation.documentId)} style={{ cursor: 'pointer' }}>
            {allocation.documentLabel} · {fmt.money(allocation.amount)}
          </Badge>
        ) : (
          <Badge key={allocation.id} size="sm" variant="light" color="cyan" leftSection={<ReceiptIcon aria-hidden />}>
            {allocation.documentLabel} · {fmt.money(allocation.amount)}
          </Badge>
        ),
      )}
    </StackedValues>
  );
}

/**
 * Repetition of a forecast, changed in its modal.
 * @param {{ entry: AnyEntry, save: EntrySave }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RecurrenceCell({ entry, save }: { entry: AnyEntry; save: EntrySave }) {
  return <RuleField label="" weekly={false} value={(entry.recurrence as Recurrence | null) ?? null} start={entry.date} onChange={(recurrence) => save(entry, { recurrence })} />;
}

/**
 * Discreet « détails » button unfolding the splits of an entry under it.
 * @param {{ opened: boolean, count: number, label: string, onToggle: () => void }} props Component props.
 * @returns {JSX.Element} Button.
 */
export function DetailsToggle({ opened, count, label, onToggle }: { opened: boolean; count: number; label: string; onToggle: () => void }) {
  return (
    <FoldHeading inline expanded={opened} onToggle={onToggle} count={count} about={`la répartition de « ${label} »`}>
      détails
    </FoldHeading>
  );
}
