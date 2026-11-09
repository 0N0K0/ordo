import { Box, Image } from '@mantine/core';
import type { ViewableKind } from './viewable';

interface FilePreviewProps {
  url: string;
  name: string;
  kind: ViewableKind;
  /** Height of the view (a PDF fills it, an image fits in it). */
  height?: string;
}

/**
 * A PDF or an image shown in place: the PDF in the viewer of the browser, fitted to the width.
 * @param {FilePreviewProps} props Component props.
 * @returns {JSX.Element} View.
 */
export function FilePreview({ url, name, kind, height = '80vh' }: FilePreviewProps) {
  return kind === 'pdf' ? (
    <Box component="iframe" src={`${url}#view=FitH`} title={name} w="100%" h={height} style={{ border: 0, display: 'block' }} />
  ) : (
    <Image src={url} alt={name} fit="contain" mah={height} />
  );
}
