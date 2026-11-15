import { Button, Group, NumberInput, Select, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { DataTable } from '../../components/data-table/DataTable';
import type { DataColumn } from '../../components/data-table/data-table';
import { useDataView } from '../../components/data-table/use-data-view';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import * as fmt from '../../lib/format';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useStockItems, useStockLocations, useStockMutations, type StockItem } from './api';
import { locationOptions, locationPaths } from './stock-format';

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
  const places = locationPaths(locations ?? []);
  // A place takes its sub-places.
  const within = (id: string | null | undefined) => {
    if (!locationId) return true;
    for (let current = id; current; current = (locations ?? []).find((place) => place.id === current)?.parentId) if (current === locationId) return true;
    return false;
  };
  const rows = (items ?? []).filter((item) => within(item.locationId));
  const columns: DataColumn<StockItem>[] = [
    { id: 'label', label: 'Article', size: 220, locked: true, sortValue: (item) => item.label, text: (item) => item.label },
    { id: 'location', label: 'Emplacement', size: 170, sortValue: (item) => places.get(item.locationId ?? '') ?? null, text: (item) => places.get(item.locationId ?? '') ?? '', groupable: true },
    { id: 'expected', label: 'Attendu', size: 100, numeric: true, sortValue: (item) => item.quantity, text: (item) => `${fmt.number(item.quantity, 3)}${item.unit ? ` ${item.unit}` : ''}` },
    {
      id: 'counted',
      label: 'Compté',
      size: 130,
      numeric: true,
      locked: true,
      sortValue: (item) => counts.get(item.id) ?? null,
      text: (item) => (counts.has(item.id) ? fmt.number(counts.get(item.id)!, 3) : ''),
    },
  ];
  const view = useDataView({ tableKey: 'stock-count', getKey: (item) => item.id, columns, rows, title: 'Inventaire' });
  return (
    <Stack gap="md">
      <Select label="Emplacement" placeholder="Tout le stock" clearable searchable {...treeSelectProps(locationOptions(locations ?? []))} value={locationId} onChange={setLocationId} />
      <Text size="xs" c="dimmed">
        Saisissez ce que vous comptez : seuls les articles comptés sont enregistrés, l’écart avec l’attendu est noté dans l’historique.
      </Text>
      <DataTable
        view={view}
        verticalSpacing={4}
        getKey={(item) => item.id}
        cells={(item) => ({
          counted: (
            <NumberInput
              size="xs"
              aria-label={`Quantité comptée de ${item.label}`}
              min={0}
              decimalScale={3}
              decimalSeparator=","
              allowNegative={false}
              hideControls
              placeholder={fmt.number(item.quantity, 3)}
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
      <Textarea label="Note" autosize minRows={1} value={note} onChange={(event) => setNote(event.currentTarget.value)} />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          disabled={counts.size === 0}
          loading={recordCount.isPending}
          onClick={() =>
            recordCount.mutate(
              { locationId, note: note || null, lines: [...counts].map(([itemId, counted]) => ({ itemId, counted })) },
              { onSuccess: () => (notifySuccess(`Inventaire enregistré (${counts.size} article${counts.size > 1 ? 's' : ''}).`), onDone()), onError: (error) => notifyError(error.message) },
            )
          }
        >
          Enregistrer l’inventaire
        </Button>
      </Group>
    </Stack>
  );
}
