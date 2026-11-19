import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { useLocationSelect } from '../hooks/use-location-select';

import { ClockIcon } from '@phosphor-icons/react';
import { mapById } from '@ordo/shared';
import { Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useState } from 'react';

import { useAsyncAction } from '../../../lib/use-async-action';
import { FormActions } from '../../../components/dialogs/FormActions';
import { useShoppingData, type ShoppingItem } from '../../shopping/api';
import { useStockLocations, useStockMutations } from '../api';
import { QuantityInput } from '../../../components/inputs/QuantityInput';
import { unarchived } from '../../../lib/archive';

/** Item bought; its place is undefined until chosen (its default then). */
type Line = { item: ShoppingItem; quantity: number; locationId?: string | null; expiresAt: string | null };

/**
 * Items bought added to the stock: for each, how much, where (the place of its reference by default; archived, the
 * first place not archived), until when.
 * @param {{ items: ShoppingItem[], onDone: () => void }} props Items bought, and what follows.
 * @returns {JSX.Element} Form.
 */
export function StockPurchaseForm({ items, onDone }: { items: ShoppingItem[]; onDone: () => void }) {
  const { data } = useShoppingData();
  const { data: locations } = useStockLocations();
  const locationSelect = useLocationSelect();
  const { addPurchase } = useStockMutations();
  const products = mapById(data?.shoppingProducts ?? []);
  const [lines, setLines] = useState<Line[]>(() =>
    items.map((item) => ({
      item,
      quantity: item.quantity ?? 1,
      expiresAt: item.expiresAt || null,
    })),
  );
  /**
   * Place of a line: the one chosen, else the place of its reference, or the first place not archived when that one is.
   * @param {Line} line Line.
   * @returns {string | null} Place id, or none.
   */
  const locationOf = (line: Line): string | null => {
    if (line.locationId !== undefined) return line.locationId;
    const preferred = (line.item.productId ? products.get(line.item.productId)?.stockLocationId : null) ?? null;
    const location = preferred ? locations?.find((item) => item.id === preferred) : undefined;
    return location?.archived ? (unarchived(locations ?? [])[0]?.id ?? null) : preferred;
  };
  const { run: add, loading } = useAsyncAction(
    () =>
      Promise.all(
        lines
          .filter((line) => line.quantity > 0)
          .map((line) => addPurchase.mutateAsync({ shoppingItemId: line.item.id, quantity: line.quantity, locationId: locationOf(line), expiresAt: line.expiresAt })),
      ),
    { success: 'Ajouté au stock.', onDone },
  );
  const change = (index: number, patch: Partial<Line>) => setLines((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Ce qui est acheté entre dans le stock ; les dates de péremption créent des lots.
      </Text>
      {lines.map((line, index) => (
        <Paper key={line.item.id} withBorder radius="sm" p="xs">
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              {line.item.label}
            </Text>
            <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
              <QuantityInput
                size="xs"
                label="Quantité"
                min={0.001}
                unit={line.item.unit}
                value={line.quantity}
                onChange={(value) => change(index, { quantity: typeof value === 'number' ? value : 0 })}
              />
              <CreatableSelect
                size="xs"
                label="Emplacement"
                placeholder="Aucun"
                clearable
                searchable
                {...locationSelect(locationOf(line))}
                value={locationOf(line)}
                onChange={(locationId) => change(index, { locationId })}
              />
              <DatePickerInput size="xs" label="Date de péremption" placeholder="Aucune" clearable value={line.expiresAt} onChange={(value) => change(index, { expiresAt: value || null })} />
            </SimpleGrid>
          </Stack>
        </Paper>
      ))}
      <FormActions
        onCancel={onDone}
        cancelLabel="Plus tard"
        cancelIcon={<ClockIcon aria-hidden />}
        submitLabel="Ajouter au stock"
        onSubmit={() => void add()}
        disabled={lines.every((line) => line.quantity <= 0)}
        loading={loading}
      />
    </Stack>
  );
}
