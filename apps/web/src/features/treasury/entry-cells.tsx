import { ActionIcon, Badge, Button, Group, Popover, Select, Stack, Text, Tooltip } from '@mantine/core';
import type { Recurrence } from '@ordo/shared';
import { CaretDownIcon, CaretRightIcon, LinkIcon, PaperclipIcon, PencilSimpleIcon, ReceiptIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EditableMultiSelect, EditableSelect } from '../../components/data-table/EditableCells';
import { RecurrenceField } from '../../components/recurrence/RecurrenceField';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import * as fmt from '../../lib/format';
import { handleFileClick } from '../files/open-file';
import { useTreasuryEntrySearch } from './api';
import { documentKey, payerKey, type AnyEntry, type EntryDocument, type EntryEnv, type EntrySave } from './entry-env';
import { describeLink, type LineLink } from './lines';

/**
 * Payer or payee of an entry, chosen in place among the clients and counterparties.
 * @param {{ entry: AnyEntry, env: EntryEnv, save: EntrySave }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function PayerCell({ entry, env, save }: { entry: AnyEntry; env: EntryEnv; save: EntrySave }) {
  return (
    <EditableSelect
      value={payerKey(entry)}
      label={`${entry.amount < 0 ? 'Destinataire' : 'Émetteur'} de ${entry.label}`}
      nullable
      data={env.payers}
      onSave={(key) => save(entry, { clientId: key?.startsWith('client:') ? key.slice(7) : null, counterpartyId: key?.startsWith('tiers:') ? key.slice(6) : null })}
    />
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
  if (missing.length) data.push({ group: 'Choisis', items: missing.map((document) => ({ value: documentKey(document), label: document.title })) });
  return (
    <Group gap={4} wrap="wrap">
      {documents.map((document) => (
        <Tooltip key={documentKey(document)} label={document.source === 'LIBRARY' ? `Bibliothèque · ${document.place}` : `Projet ${document.place}`}>
          <Badge
            size="sm"
            variant="light"
            color="gray"
            leftSection={<PaperclipIcon aria-hidden />}
            component="a"
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            // A file of the app (PDF, image) opens in its viewer.
            onClick={(event: React.MouseEvent) => document.kind === 'FILE' && handleFileClick(event, { url: document.url, name: document.title })}
            style={{ cursor: 'pointer' }}
            tt="none"
          >
            {document.title.length > 24 ? `${document.title.slice(0, 23)}…` : document.title}
          </Badge>
        </Tooltip>
      ))}
      <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md" width={360} trapFocus>
        <Popover.Target>
          <Tooltip label="Choisir les pièces justificatives">
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label={label} onClick={() => setOpened((value) => !value)}>
              <PencilSimpleIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown>
          <EditableMultiSelect
            value={documents.map(documentKey)}
            label={label}
            data={data}
            onSave={(keys) =>
              onSave({
                libraryDocumentIds: keys.filter((key) => key.startsWith('lib:')).map((key) => key.slice(4)),
                projectResourceIds: keys.filter((key) => key.startsWith('res:')).map((key) => key.slice(4)),
              })
            }
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
  const [search, setSearch] = useState('');
  const { data: found } = useTreasuryEntrySearch(opened ? search : '');
  const linked = new Set(links.map((link) => `${link.kind}:${link.id}`));
  const candidates: LineLink[] = (found ?? [])
    .filter((item) => item.id !== entryId)
    .flatMap((item): LineLink[] => {
      const base = { entryLabel: item.label, date: String(item.date) };
      if (!item.lines.length) return [{ ...base, kind: 'entry', id: item.id, label: null, amount: item.amount }];
      // A split entry is linked through its lines (from a line only).
      return lines
        ? item.lines.map((other) => ({ ...base, kind: 'line', id: other.id, label: other.label ?? null, amount: other.mode === 'PERCENT' ? Math.round(item.amount * other.value) / 100 : other.value }))
        : [];
    })
    .filter((link) => !linked.has(`${link.kind}:${link.id}`));
  return (
    <Group gap={4} wrap="wrap">
      {links.map((link) => (
        <Tooltip key={`${link.kind}:${link.id}`} label={describeLink(link)}>
          <Badge
            size="sm"
            variant="outline"
            color={link.amount < 0 ? 'red' : 'green'}
            leftSection={<LinkIcon aria-hidden />}
            rightSection={
              <ActionIcon size="xs" variant="transparent" color="gray" aria-label={`Délier ${describeLink(link)}`} onClick={() => onSave(links.filter((other) => other !== link))}>
                <XIcon aria-hidden />
              </ActionIcon>
            }
            tt="none"
          >
            {link.entryLabel.length > 20 ? `${link.entryLabel.slice(0, 19)}…` : link.entryLabel} · {fmt.money(link.amount)}
          </Badge>
        </Tooltip>
      ))}
      <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md" width={380} trapFocus>
        <Popover.Target>
          <Tooltip label="Lier un mouvement">
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label={label} onClick={() => setOpened((value) => !value)}>
              <LinkIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap={4}>
            <Select
              aria-label={label}
              placeholder="Rechercher un mouvement par son libellé…"
              searchable
              leftSection={<LinkIcon aria-hidden />}
              searchValue={search}
              onSearchChange={setSearch}
              // Filtered by the server.
              filter={({ options }) => options}
              nothingFoundMessage={search.trim().length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun mouvement'}
              data={candidates.map((link) => ({ value: `${link.kind}:${link.id}`, label: describeLink(link) }))}
              value={null}
              onChange={(key) => {
                const link = candidates.find((item) => `${item.kind}:${item.id}` === key);
                if (!link) return;
                onSave([...links, link]);
                setSearch('');
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
 * @returns {JSX.Element} Badges.
 */
export function SettledCell({ entry }: { entry: AnyEntry }) {
  return (
    <Group gap={4}>
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
    </Group>
  );
}

/**
 * Repetition of a forecast, changed in its modal.
 * @param {{ entry: AnyEntry, save: EntrySave }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RecurrenceCell({ entry, save }: { entry: AnyEntry; save: EntrySave }) {
  return <RecurrenceField label="" value={(entry.recurrence as Recurrence | null) ?? null} start={String(entry.date)} onChange={(recurrence) => save(entry, { recurrence })} />;
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
