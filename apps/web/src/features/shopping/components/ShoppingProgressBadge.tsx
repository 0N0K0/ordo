import { Badge } from '@mantine/core';
import { shoppingProgress } from '../lib/shopping-format';

/**
 * Progress of a shopping list in a badge, the same in its table and on its task: « 3 / 5 », green once all its required
 * items are bought.
 * @param {{ items: readonly { purchasedAt?: unknown, optional?: boolean | null }[] }} props Component props: items of the list.
 * @returns {JSX.Element} Badge.
 */
export function ShoppingProgressBadge({ items }: { items: readonly { purchasedAt?: unknown; optional?: boolean | null }[] }) {
  const { bought, total } = shoppingProgress(items);
  return (
    <Badge size="sm" variant="light" color={total && bought === total ? 'green' : 'gray'}>
      {/* eslint-disable-next-line no-restricted-syntax -- ShoppingProgressBadge itself. */}
      {bought} / {total}
    </Badge>
  );
}
