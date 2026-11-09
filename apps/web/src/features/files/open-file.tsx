import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { ArrowSquareOutIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import type { MouseEvent } from 'react';
import { FilePreview } from './FilePreview';
import { downloadUrl, viewableKind } from './viewable';

/**
 * Opens a file in the app (a PDF or an image, in a viewer with its download and a new tab), or downloads it.
 * @param {{ url: string, name: string, mimeType?: string | null }} file File.
 * @returns {void}
 */
export function openFile(file: { url: string; name: string; mimeType?: string | null }): void {
  const kind = viewableKind(file);
  if (!kind) {
    window.location.href = downloadUrl(file.url);
    return;
  }
  modals.open({
    title: (
      <Group gap="xs" wrap="nowrap">
        <span>{file.name}</span>
        <Tooltip label="Ouvrir dans un nouvel onglet">
          <ActionIcon component="a" href={file.url} target="_blank" rel="noopener" variant="subtle" color="gray" aria-label="Ouvrir dans un nouvel onglet">
            <ArrowSquareOutIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Télécharger">
          <ActionIcon component="a" href={downloadUrl(file.url)} variant="subtle" color="gray" aria-label={`Télécharger ${file.name}`}>
            <DownloadSimpleIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
    ),
    size: kind === 'pdf' ? '64rem' : 'xl',
    children: <FilePreview url={file.url} name={file.name} kind={kind} />,
  });
}

/**
 * Click on a link to a file: shown in the app when it can be (a click with a modifier keeps the browser's way:
 * new tab…).
 * @param {MouseEvent} event Click.
 * @param {{ url: string, name: string, mimeType?: string | null }} file File.
 * @returns {void}
 */
export function handleFileClick(event: MouseEvent, file: { url: string; name: string; mimeType?: string | null }): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!viewableKind(file)) return;
  event.preventDefault();
  event.stopPropagation();
  openFile(file);
}
