import { locationSelectProps } from '../hooks/use-location-select';
import { formCallbacks } from '../../../lib/form';
import { isUnderOrSelf } from '@ordo/shared';
import { categoryPaths } from '../../../components/tree/category-tree';
import { Select, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { DataTable } from '../../../components/data-table/table/DataTable';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { useDataView } from '../../../components/data-table/views/use-data-view';

import * as fmt from '../../../lib/format';
import { useStockItems, useStockLocations, useStockMutations, type StockItem } from '../api';
import { countOf } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';
import { QuantityInput } from '../../../components/inputs/QuantityInput';
import { unarchived } from '../../../lib/archive';

/**
 * Inventory: the items of a place (and of its sub-places), or of everything, counted one by one; only those counted
 * are saved (the difference noted as counted).
 * @param {{ onDone: () => void }} props What follows.
 * @returns {JSX.Element} Form.
 */
export function StockCountForm({ onDone }: { onDone: () => void }) {
  const { data: items } = useStockItems();
  const { data: locations } = useStockLocations();
  const { recordCount } = useStockMutations();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [note, setNote] = useState('');
  const places = categoryPaths(locations ?? []);
  const parentOf = new Map((locations ?? []).map((place) => [place.id, place.parentId]));
  /**
   * Whether a place is the one chosen or under it (a place takes its sub-places).
   * @param {string | null | undefined} id Place of an item.
   * @returns {boolean} Kept.
   */
  const within = (id: string | null | undefined) => !locationId || (!!id && isUnderOrSelf(parentOf, id, locationId));
  // The archived items are not counted.
  const rows = unarchived(items ?? []).filter((item) => within(item.locationId));
  const columns: DataColumn<StockItem>[] = [
    { id: 'label', required: true, label: 'Article', size: 220, locked: true, sortValue: (item) => item.label, text: (item) => item.label },
    { id: 'location', label: 'Emplacement', size: 170, sortValue: (item) => places.get(item.locationId ?? '') ?? null, text: (item) => places.get(item.locationId ?? '') ?? '', groupable: true },
    { id: 'expected', required: true, label: 'Attendu', size: 100, numeric: true, sortValue: (item) => item.quantity, text: (item) => fmt.quantity(item) },
    {
      id: 'counted',
      label: 'Compté',
      size: 130,
      numeric: true,
      locked: true,
      sortValue: (item) => counts.get(item.id) ?? null,
      text: (item) => fmt.quantity({ quantity: counts.get(item.id) }),
    },
  ];
  const view = useDataView({ tableKey: 'stock-count', getKey: (item) => item.id, columns, rows, title: 'Inventaire' });
  return (
    <Stack gap="md">
      <Select label="Emplacement" placeholder="Tout le stock" clearable searchable {...locationSelectProps(locations ?? [], locationId)} value={locationId} onChange={setLocationId} />
      <Text size="xs" c="dimmed">
        Saisissez ce que vous comptez : seuls les articles comptés sont enregistrés, l’écart avec l’attendu est noté dans l’historique.
      </Text>
      <DataTable
        view={view}
        verticalSpacing={4}
        getKey={(item) => item.id}
        cells={(item) => ({
          counted: (
            <QuantityInput
              size="xs"
              aria-label={`Quantité comptée de « ${item.label} »`}
              min={0}
              allowNegative={false}
              hideControls
              placeholder={fmt.quantity({ quantity: item.quantity })}
              value={counts.get(item.id) ?? ''}
              onChange={(value) =>
                setCounts((current) => {
                  const next = new Map(current);
                  if (typeof value === 'number') next.set(item.id, value);
                  else next.delete(item.id);
                  return next;
                })
              }
            />
          ),
        })}
      />
      <Textarea label="Description" autosize minRows={1} value={note} onChange={(event) => setNote(event.currentTarget.value)} />
      <FormActions
        onCancel={onDone}
        submitLabel="Enregistrer l’inventaire"
        disabled={counts.size === 0}
        loading={recordCount.isPending}
        onSubmit={() =>
          recordCount.mutate(
            { locationId, note: note || null, lines: [...counts].map(([itemId, counted]) => ({ itemId, counted })) },
            formCallbacks(null, `Inventaire enregistré (${countOf(counts.size, 'article')}).`, onDone),
          )
        }
      />
    </Stack>
  );
}
