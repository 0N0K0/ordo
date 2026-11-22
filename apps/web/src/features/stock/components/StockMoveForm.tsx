import { formCallbacks } from '../../../lib/form';
import { SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { STOCK_MOVEMENT_LABELS, type StockMovementKind } from '@ordo/shared';
import { DateField } from '../../../components/inputs/DateField';
import { useState } from 'react';
import * as fmt from '../../../lib/format';
import { useStockMutations, type StockItem } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { QuantityInput } from '../../../components/inputs/QuantityInput';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { NO_SUGGESTIONS } from '../../../components/markdown/remark-references';

type Kind = Exclude<StockMovementKind, 'COUNT'>;

/** Kinds offered by hand, with the names of the movements (a correction is made from a lot). */
const KINDS = (['CONSUMPTION', 'PURCHASE', 'LOSS'] as const).map((value) => ({ value, label: STOCK_MOVEMENT_LABELS[value] }));

/**
 * Quantity in or out of an item of the stock: used up or lost (from a lot, or those that expire first), added (to a
 * new lot of its date, or to a lot).
 * @param {{ item: StockItem, kind?: Kind, onDone: () => void }} props Item, kind proposed, and what follows.
 * @returns {JSX.Element} Form.
 */
export function StockMoveForm({ item, kind: initial = 'CONSUMPTION', onDone }: { item: StockItem; kind?: Kind; onDone: () => void }) {
  const { move } = useStockMutations();
  const [kind, setKind] = useState<Kind>(initial);
  const [quantity, setQuantity] = useState<number>(1);
  const [lotId, setLotId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const adding = kind === 'PURCHASE';
  const lots = item.lots.map((lot) => ({ value: lot.id, label: `${fmt.quantity({ quantity: lot.quantity, unit: item.unit })}${lot.expiresAt ? ` · ${fmt.day(lot.expiresAt)}` : ''}` }));
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        En stock : {fmt.quantity(item)}.
      </Text>
      <SegmentedControl data={KINDS} value={kind} onChange={(value) => setKind(value as Kind)} />
      <QuantityInput label="Quantité" min={0.001} value={quantity} onChange={(value) => setQuantity(typeof value === 'number' ? value : 0)} unit={item.unit} data-autofocus />
      {(lots.length > 1 || (adding && lots.length > 0)) && (
        <Select
          label="Lot"
          placeholder={adding ? (item.perishable ? 'Un nouveau lot' : 'Le lot de l’article') : 'Ceux qui périment le plus tôt'}
          clearable
          data={lots}
          value={lotId}
          onChange={setLotId}
        />
      )}
      {adding && item.perishable && !lotId && <DateField label="Date de péremption" placeholder="Aucune" clearable value={expiresAt} onChange={(value) => setExpiresAt(value || null)} />}
      <MarkdownEditor label="Note" value={note} onChange={setNote} suggestions={NO_SUGGESTIONS} minRows={2} />
      <FormActions
        onCancel={onDone}
        disabled={quantity <= 0}
        loading={move.isPending}
        onSubmit={() =>
          move.mutate(
            { itemId: item.id, kind, quantity, lotId, expiresAt: adding ? expiresAt : null, note: note.trim() ? note : null },
            formCallbacks(null, adding ? 'Ajouté au stock.' : 'Retiré du stock.', onDone),
          )
        }
      />
    </Stack>
  );
}
