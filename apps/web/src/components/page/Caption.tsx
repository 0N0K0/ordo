import { Text, type TextProps } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Caption in small dimmed capitals, weight 600, the same everywhere (a section title, a group of a list, a key figure).
 * @param {TextProps & { children: ReactNode }} props Component props: Text props (truncate…) and the caption.
 * @returns {JSX.Element} Caption.
 */
export function Caption({ children, ...props }: TextProps & { children: ReactNode }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- Caption is the one caption in capitals.
    <Text size="xs" fw={600} c="dimmed" tt="uppercase" {...props}>
      {children}
    </Text>
  );
}
