import { Group } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Row of actions without a title (under a list, above an empty one): always on the right, as every « Nouveau… ».
 * @param {{ children: ReactNode }} props Component props: actions (ActionButton).
 * @returns {JSX.Element} Row.
 */
export function ActionsRow({ children }: { children: ReactNode }) {
  return (
    <Group justify="flex-end" gap="xs" wrap="wrap">
      {children}
    </Group>
  );
}
