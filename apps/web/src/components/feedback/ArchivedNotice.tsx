import { Alert } from '@mantine/core';
import { ArchiveIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

/**
 * Banner of an archived element shown read only (a form, an editor, a board): grey, with the archive icon, telling how
 * to restore it.
 * @param {{ title?: ReactNode, children: ReactNode }} props Component props: a title (optional), what to know.
 * @returns {JSX.Element} Banner.
 */
export function ArchivedNotice({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <Alert color="gray" icon={<ArchiveIcon aria-hidden />} title={title}>
      {children}
    </Alert>
  );
}
