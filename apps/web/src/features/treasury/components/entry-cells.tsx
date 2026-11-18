import { IconAction } from '../../../components/actions/IconAction';
import { Badge, Button, Group, Popover, Stack, Text, Tooltip } from '@mantine/core';
import type { Recurrence } from '@ordo/shared';
import { CaretDownIcon, CaretRightIcon, LinkIcon, PencilSimpleIcon, ReceiptIcon } from '@phosphor-icons/react';
import { FileBadge } from '../../../components/items/FileBadge';
import { ellipsis } from '../../../lib/text';
import { useState } from 'react';
import { Link } from 'react-router';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { RuleField } from '../../../components/recurrence/RuleField';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { handleFileClick } from '../../files/lib/open-file';
import { EntryLinkSelect, LinkBadge } from './entry-links';
import { linkKey, type LineLink } from '../lib/lines';
import { documentKey, payerKey, payerOfKey, supportingOfKeys, type AnyEntry, type EntryDocument, type EntryEnv, type EntrySave } from '../lib/entry-env';

/**
 * Payer or payee of an entry, chosen in place among the clients and counterparties.
 * @param {{ entry: AnyEntry, env: EntryEnv, save: EntrySave }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function PayerCell({ entry, env, save }: { entry: AnyEntry; env: EntryEnv; save: EntrySave }) {
  return (
    <EditableSelect value={payerKey(entry)} label={`${entry.amount < 0 ? 'Destinataire' : 'Émetteur'} de ${entry.label}`} nullable data={env.payers} onSave={(key) => save(entry, payerOfKey(key))} />
  );
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
 * Supporting documents of an entry or a line: their badges (opened in a click) and a button choosing them.
 * @param {{ documents: EntryDocument[], env: EntryEnv, label: string, onSave: (ids: { libraryDocumentIds: string[], projectResourceIds: string[] }) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function DocumentsCell({
  documents,
  env,
  label,
  onSave,
}: {
  documents: EntryDocument[];
  env: EntryEnv;
  label: string;
  onSave: (ids: { libraryDocumentIds: string[]; projectResourceIds: string[] }) => void;
}) {
  const [opened, setOpened] = useState(false);
  // The documents chosen stay offered (archived, moved…).
  const data = [...env.documents];
  const known = new Set(data.flatMap((group) => group.items.map((item) => item.value)));
  const missing = documents.filter((document) => !known.has(documentKey(document)));
  if (missing.length) data.push({ group: 'Choisis', items: missing.map((document) => ({ value: documentKey(document), label: document.label })) });
  return (
    <Group gap={4} wrap="nowrap" align="flex-start">
      <StackedValues>
        {documents.map((document) => (
          <Tooltip key={documentKey(document)} label={document.source === 'LIBRARY' ? `Bibliothèque · ${document.place}` : `Projet ${document.place}`}>
            <FileBadge
              name={document.label}
              href={document.url}
              target="_blank"
              // A file of the app (PDF, image) opens in its viewer.
              onClick={(event) => document.kind === 'FILE' && handleFileClick(event, { url: document.url, name: document.label })}
            />
          </Tooltip>
        ))}
      </StackedValues>
      <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md" width={360} trapFocus>
        <Popover.Target>
          <IconAction label="Choisir les pièces justificatives" size="sm" aria-label={label} onClick={() => setOpened((value) => !value)}>
            <PencilSimpleIcon aria-hidden />
          </IconAction>
        </Popover.Target>
        <Popover.Dropdown>
          <BatchMultiSelect
            aria-label={label}
            searchable
            clearable
            nothingFoundMessage="Aucun document"
            data={data}
            value={documents.map(documentKey)}
            comboboxProps={{ withinPortal: false }}
            onChange={(keys) => onSave(supportingOfKeys(keys))}
          />
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
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
          <Badge key={allocation.id} size="sm" variant="light" leftSection={<ReceiptIcon aria-hidden />} component={Link} to={`/accounting/${allocation.documentId}`} style={{ cursor: 'pointer' }}>
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
    <Button
      variant="subtle"
      color="gray"
      size="compact-xs"
      leftSection={opened ? <CaretDownIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
      aria-expanded={opened}
      aria-label={`${opened ? 'Replier' : 'Déplier'} la répartition de ${label}`}
      onClick={onToggle}
    >
      détails ({count})
    </Button>
  );
}
