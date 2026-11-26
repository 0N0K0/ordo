import { ProgressBadge } from '../../../components/feedback/ProgressBadge';
import { countOf } from '../../../lib/text';
import { shoppingProgress } from '../lib/shopping-format';

/**
 * Progress of a shopping list in a badge (`ProgressBadge`), the same in its table and on its task: « 3/5 », grey until
 * all its required items are bought, then green.
 * @param {{ items: readonly { purchasedAt?: unknown, optional?: boolean | null }[] }} props Component props: items of the list.
 * @returns {JSX.Element | null} Badge.
 */
export function ShoppingProgressBadge({ items }: { items: readonly { purchasedAt?: unknown; optional?: boolean | null }[] }) {
  const { bought, total } = shoppingProgress(items);
  return <ProgressBadge done={bought} total={total} color="gray" withEmpty label={`${countOf(bought, 'achetée', 'achetées')} sur ${countOf(total, 'requise')}`} />;
}
