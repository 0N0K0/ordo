import { Badge, type MantineSize } from '@mantine/core';
import { ArchiveIcon } from '@phosphor-icons/react';

/**
 * « Archivé » badge of an archived thing (a task, a project, a list, an account), the same everywhere.
 * @param {{ feminine?: boolean, size?: MantineSize }} props Agreement with a feminine noun (« Archivée »), size.
 * @returns {JSX.Element} Badge.
 */
export function ArchivedBadge({ feminine = false, size }: { feminine?: boolean; size?: MantineSize }) {
  return (
    <Badge color="gray" variant="light" size={size} leftSection={<ArchiveIcon aria-hidden />}>
      {feminine ? 'Archivée' : 'Archivé'}
    </Badge>
  );
}
