import { Button, Group, NumberInput, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useState } from 'react';
import * as fmt from '../../lib/format';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useStockMutations, type StockItem } from './api';

type Kind = 'PURCHASE' | 'CONSUMPTION' | 'LOSS' | 'CORRECTION';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'CONSUMPTION', label: 'Consommé' },
  { value: 'PURCHASE', label: 'Ajouté' },
  { value: 'LOSS', label: 'Perdu' },
];

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
  const lots = item.lots.map((lot) => ({ value: lot.id, label: `${fmt.number(lot.quantity, 3)}${item.unit ? ` ${item.unit}` : ''}${lot.expiresAt ? ` · ${fmt.day(String(lot.expiresAt))}` : ''}` }));
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        En stock : {fmt.number(item.quantity, 3)}
        {item.unit ? ` ${item.unit}` : ''}.
      </Text>
      <SegmentedControl data={KINDS} value={kind} onChange={(value) => setKind(value as Kind)} />
      <NumberInput
        label="Quantité"
        min={0.001}
        decimalScale={3}
        decimalSeparator=","
        value={quantity}
        onChange={(value) => setQuantity(Number(value) || 0)}
        suffix={item.unit ? ` ${item.unit}` : undefined}
        data-autofocus
      />
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
      {adding && item.perishable && !lotId && (
        <DatePickerInput label="Date de péremption" placeholder="Aucune" clearable value={expiresAt} onChange={(value) => setExpiresAt(value ? String(value) : null)} />
      )}
      <TextInput label="Note" value={note} onChange={(event) => setNote(event.currentTarget.value)} />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          disabled={quantity <= 0}
          loading={move.isPending}
          onClick={() =>
            move.mutate(
              { itemId: item.id, kind, quantity, lotId, expiresAt: adding ? expiresAt : null, note: note || null },
              { onSuccess: () => (notifySuccess(adding ? 'Ajouté au stock.' : 'Retiré du stock.'), onDone()), onError: (error) => notifyError(error.message) },
            )
          }
        >
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}
