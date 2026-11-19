import { Indicator } from '@mantine/core';
import type { ReactNode } from 'react';

/** What a view with unsaved changes says, in its tab menu and in the options of its table. */
export const UNSAVED_CHANGES = 'Modifications non enregistrées';

/**
 * Orange dot of a view with unsaved changes, the same on its tab and on the options of its table.
 * @param {{ dirty: boolean, offset: number, children: ReactNode }} props Component props: unsaved changes, offset of the dot from the corner, what it marks.
 * @returns {JSX.Element} Indicator.
 */
export function UnsavedIndicator({ dirty, offset, children }: { dirty: boolean; offset: number; children: ReactNode }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- UnsavedIndicator itself.
    <Indicator disabled={!dirty} size={8} offset={offset} position="top-end" color="orange">
      {children}
    </Indicator>
  );
}
