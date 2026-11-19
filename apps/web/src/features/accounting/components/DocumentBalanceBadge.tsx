import { Badge, type MantineSize } from '@mantine/core';
import * as fmt from '../../../lib/format';

/**
 * What is still due on a document: « Reste 120,00 € » in orange, or « Réglé » in green, the same in the table and on
 * the page of the document.
 * @param {{ balance: number | null | undefined, currency: string, size?: MantineSize }} props Component props: amount still due, its currency, size of the badge (optional, default = Mantine's).
 * @returns {JSX.Element} Badge.
 */
export function DocumentBalanceBadge({ balance, currency, size }: { balance: number | null | undefined; currency: string; size?: MantineSize }) {
  return (
    <Badge size={size} variant="light" color={balance ? 'orange' : 'green'}>
      {/* eslint-disable-next-line no-restricted-syntax -- DocumentBalanceBadge itself. */}
      {balance ? `Reste ${fmt.money(balance, currency)}` : 'Réglé'}
    </Badge>
  );
}
