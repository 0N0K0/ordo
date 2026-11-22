import { Group, Popover, Tooltip } from '@mantine/core';
import type { LinkedDocumentIds } from '@ordo/shared';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { handleFileClick } from '../../files/lib/open-file';
import { IconAction } from '../../../components/actions/IconAction';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { FileBadge } from '../../../components/items/FileBadge';
import { documentIdsOfKeys, documentKey, type DocumentGroup } from '../lib/document-keys';
import type { LinkedDocument } from '../api';

interface DocumentsPickerProps {
  /** Documents linked, shown as badges. */
  documents: readonly LinkedDocument[];
  /** Documents offered, grouped by place (those linked are offered too, whatever the groups). */
  options: readonly DocumentGroup[];
  /** Name of the field, for the screen readers. */
  label: string;
  /** Tooltip of the button choosing them. Optional. Default = « Choisir les documents ». */
  action?: string;
  /** Each badge removes its document from its cross (a panel). Optional. Default = false (a cell: removed in the list). */
  removable?: boolean;
  /** Shown only. Optional. Default = false. */
  readOnly?: boolean;
  onSave: (ids: LinkedDocumentIds) => void;
}

/**
 * Documents linked to an item (treasury entry or line, task, routine, event), the same everywhere: their badges, each
 * opened in a click (a file of the app in its viewer, a link in a new tab) and, in a panel, removed from its cross; a
 * pencil choosing them in a list grouped by place (the library, then the projects).
 * @param {DocumentsPickerProps} props Component props.
 * @returns {JSX.Element} Documents.
 */
export function DocumentsPicker({ documents, options, label, action = 'Choisir les documents', removable = false, readOnly = false, onSave }: DocumentsPickerProps) {
  const [opened, setOpened] = useState(false);
  const keys = documents.map(documentKey);
  // The documents linked stay offered (moved, out of the list…).
  const known = new Set(options.flatMap((group) => group.items.map((item) => item.value)));
  const missing = documents.filter((document) => !known.has(documentKey(document)));
  const data = missing.length ? [...options, { group: 'Choisis', items: missing.map((document) => ({ value: documentKey(document), label: document.label })) }] : [...options];
  return (
    <Group gap={4} wrap="nowrap" align="flex-start">
      <StackedValues>
        {documents.map((document) => (
          <Tooltip key={documentKey(document)} label={document.source === 'LIBRARY' ? `Bibliothèque · ${document.place}` : `Projet ${document.place}`}>
            <FileBadge
              filename={document.label}
              href={document.url}
              external
              // A file of the app (PDF, image) opens in its viewer.
              onClick={(event) => document.kind === 'FILE' && handleFileClick(event, { url: document.url, filename: document.label })}
              onRemove={removable && !readOnly ? () => onSave(documentIdsOfKeys(keys.filter((key) => key !== documentKey(document)))) : undefined}
            />
          </Tooltip>
        ))}
      </StackedValues>
      {!readOnly && (
        <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md" width={360} trapFocus>
          <Popover.Target>
            <IconAction label={action} size="sm" aria-label={label} onClick={() => setOpened((value) => !value)}>
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
              value={keys}
              comboboxProps={{ withinPortal: false }}
              onChange={(chosen) => onSave(documentIdsOfKeys(chosen))}
            />
          </Popover.Dropdown>
        </Popover>
      )}
    </Group>
  );
}
