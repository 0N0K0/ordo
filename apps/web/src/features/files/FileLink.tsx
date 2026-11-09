import { Anchor, type AnchorProps } from '@mantine/core';
import type { ReactNode } from 'react';
import { handleFileClick } from './open-file';
import { downloadUrl, viewableKind } from './viewable';

interface FileLinkProps extends AnchorProps {
  url: string;
  name: string;
  mimeType?: string | null;
  children: ReactNode;
}

/**
 * Link to a file: a PDF or an image opens in the app's viewer, another file downloads.
 * @param {FileLinkProps} props Component props.
 * @returns {JSX.Element} Link.
 */
export function FileLink({ url, name, mimeType, children, ...props }: FileLinkProps) {
  const kind = viewableKind({ url, name, mimeType });
  return (
    <Anchor {...props} href={kind ? url : downloadUrl(url)} target={kind ? '_blank' : undefined} rel="noopener" onClick={(event) => handleFileClick(event, { url, name, mimeType })}>
      {children}
    </Anchor>
  );
}
