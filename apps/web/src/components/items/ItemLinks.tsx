import { Anchor, Stack } from '@mantine/core';
import type { ItemLink } from '@ordo/shared';
import { EXTERNAL_LINK } from '../actions/link-props';

/**
 * Links of an item (event, task, routine), the same everywhere: its label (else its address), opened in a new tab.
 * @param {{ links: readonly ItemLink[] }} props Links (none: nothing shown).
 * @returns {JSX.Element | null} Links.
 */
export function ItemLinks({ links }: { links: readonly ItemLink[] }) {
  if (!links.length) return null;
  return (
    <Stack gap={2}>
      {links.map((link, index) => (
        <Anchor key={`${index}-${link.url}`} href={link.url} {...EXTERNAL_LINK} size="sm" truncate>
          {link.label || link.url}
        </Anchor>
      ))}
    </Stack>
  );
}
