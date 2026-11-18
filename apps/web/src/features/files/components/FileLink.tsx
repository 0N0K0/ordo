import { Anchor, type AnchorProps } from '@mantine/core';
import type { ReactNode } from 'react';
import { handleFileClick } from '../lib/open-file';
import { downloadUrl, viewableKind } from '../lib/viewable';

interface FileLinkProps extends AnchorProps {
  url: string;
  /** Name of the file (its extension tells how it opens). */
  filename: string;
  mimeType?: string | null;
  children: ReactNode;
}

/**
 * Link to a file: a PDF or an image opens in the app's viewer, another file downloads.
 * @param {FileLinkProps} props Component props.
 * @returns {JSX.Element} Link.
 */
export function FileLink({ url, filename, mimeType, children, ...props }: FileLinkProps) {
  const kind = viewableKind({ url, filename, mimeType });
  return (
    <Anchor {...props} href={kind ? url : downloadUrl(url)} target={kind ? '_blank' : undefined} rel="noopener" onClick={(event) => handleFileClick(event, { url, filename, mimeType })}>
      {children}
    </Anchor>
  );
}
