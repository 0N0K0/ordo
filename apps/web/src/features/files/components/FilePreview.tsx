import { Box, Image } from '@mantine/core';
import type { ViewableKind } from '../lib/viewable';

/** Height of a file shown in a page (not in a modal): most of the window, never too small. */
// eslint-disable-next-line no-restricted-syntax -- PAGE_PREVIEW_HEIGHT itself.
export const PAGE_PREVIEW_HEIGHT = 'max(36rem, calc(100dvh - 16rem))';

interface FilePreviewProps {
  url: string;
  /** Name of the file (its title, its alternative text). */
  filename: string;
  kind: ViewableKind;
  /** Height of the view (a PDF fills it, an image fits in it). */
  height?: string;
}

/**
 * A PDF or an image shown in place: the PDF in the viewer of the browser, fitted to the width.
 * @param {FilePreviewProps} props Component props.
 * @returns {JSX.Element} View.
 */
export function FilePreview({ url, filename, kind, height = '80vh' }: FilePreviewProps) {
  return kind === 'pdf' ? (
    <Box component="iframe" src={`${url}#view=FitH`} title={filename} w="100%" h={height} style={{ border: 0, display: 'block' }} />
  ) : (
    <Image src={url} alt={filename} fit="contain" mah={height} />
  );
}
