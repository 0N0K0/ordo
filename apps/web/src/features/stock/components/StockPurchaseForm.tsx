import { categoryOptions } from '../../../components/tree/category-tree';
import { mapById } from '@ordo/shared';
import { Paper, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useState } from 'react';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { useAsyncAction } from '../../../lib/use-async-action';
import { FormActions } from '../../../components/dialogs/FormActions';
import { useShoppingData, type ShoppingItem } from '../../shopping/api';
import { useStockLocations, useStockMutations } from '../api';
import { QuantityInput } from '../../../components/inputs/QuantityInput';

type Line = { item: ShoppingItem; quantity: number; locationId: string | null; expiresAt: string | null };

/**
 * Items bought added to the stock: for each, how much, where (the place of its reference by default), until when.
 * @param {{ items: ShoppingItem[], onDone: () => void }} props Items bought, and what follows.
 * @returns {JSX.Element} Form.
 */
export function StockPurchaseForm({ items, onDone }: { items: ShoppingItem[]; onDone: () => void }) {
  const { data } = useShoppingData();
  const { data: locations } = useStockLocations();
  const { addPurchase } = useStockMutations();
  const products = mapById(data?.shoppingProducts ?? []);
  const [lines, setLines] = useState<Line[]>(() =>
    items.map((item) => ({
      item,
      quantity: item.quantity ?? 1,
      locationId: (item.productId ? products.get(item.productId)?.stockLocationId : null) ?? null,
      expiresAt: item.expiresAt ? String(item.expiresAt).slice(0, 10) : null,
    })),
  );
  const { run: add, loading } = useAsyncAction(
    () =>
      Promise.all(
        lines
          .filter((line) => line.quantity > 0)
          .map((line) => addPurchase.mutateAsync({ shoppingItemId: line.item.id, quantity: line.quantity, locationId: line.locationId, expiresAt: line.expiresAt })),
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
              {line.item.name}
            </Text>
            <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
              <QuantityInput size="xs" label="Quantité" min={0.001} unit={line.item.unit} value={line.quantity} onChange={(value) => change(index, { quantity: Number(value) || 0 })} />
              <Select
                size="xs"
                label="Emplacement"
                placeholder="Aucun"
                clearable
                searchable
                {...treeSelectProps(categoryOptions(locations ?? []))}
                value={line.locationId}
                onChange={(locationId) => change(index, { locationId })}
              />
              <DatePickerInput size="xs" label="Péremption" placeholder="Aucune" clearable value={line.expiresAt} onChange={(value) => change(index, { expiresAt: value ? String(value) : null })} />
            </SimpleGrid>
          </Stack>
        </Paper>
      ))}
      <FormActions onCancel={onDone} cancelLabel="Plus tard" submitLabel="Ajouter au stock" onSubmit={() => void add()} disabled={lines.every((line) => line.quantity <= 0)} loading={loading} />
    </Stack>
  );
}
