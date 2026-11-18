import { IconAction } from '../../../components/actions/IconAction';
import { Group } from '@mantine/core';
import { openModal } from '../../../components/panels/open-modal';

import { ArrowSquareOutIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import type { MouseEvent } from 'react';
import { FilePreview } from '../components/FilePreview';
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
  openModal(
    <Group gap="xs" wrap="nowrap">
      <span>{file.name}</span>
      <IconAction label="Ouvrir dans un nouvel onglet" component="a" href={file.url} target="_blank" rel="noopener">
        <ArrowSquareOutIcon aria-hidden />
      </IconAction>
      <IconAction label="Télécharger" component="a" href={downloadUrl(file.url)} aria-label={`Télécharger ${file.name}`}>
        <DownloadSimpleIcon aria-hidden />
      </IconAction>
    </Group>,
    () => <FilePreview url={file.url} name={file.name} kind={kind} />,
    { size: kind === 'pdf' ? '64rem' : 'xl' },
  );
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
