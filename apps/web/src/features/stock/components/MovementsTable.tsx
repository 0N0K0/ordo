import { Anchor, Badge } from '@mantine/core';
import { STOCK_MOVEMENT_LABELS, type StockMovementKind } from '@ordo/shared';
import { Link } from 'react-router';
import { DataTable } from '../../../components/data-table/table/DataTable';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { EmptyState } from '../../../components/feedback/EmptyState';
import * as fmt from '../../../lib/format';
import { useStockMovements, type StockMovement } from '../api';
import { SignedAmount } from '../../../components/money/SignedAmount';
import { localDay } from '../../../lib/dates';
import { monthColumn } from '../../../components/data-table/table/month-column';
import { sheetPath, shoppingListPath } from '../../../app/pages';

const KIND_COLORS: Record<StockMovementKind, string> = { PURCHASE: 'green', CONSUMPTION: 'blue', COUNT: 'grape', LOSS: 'red', CORRECTION: 'gray' };

/**
 * Movements of the stock (all, or those of an item), latest first, in a table like every other.
 * @param {{ itemId?: string | null }} props Item (none: every movement). Optional.
 * @returns {JSX.Element} Table.
 */
export function MovementsTable({ itemId = null }: { itemId?: string | null }) {
  const { data: movements } = useStockMovements(itemId);
  const columns: DataColumn<StockMovement>[] = [
    {
      id: 'date',
      label: 'Date',
      size: 150,
      required: true,
      sortValue: (movement) => movement.date,
      text: (movement) => fmt.dateTime(movement.date),
      filter: { kind: 'date', value: (movement) => localDay(movement.date) },
    },
    monthColumn('month', 'Mois', (movement) => movement.date, 130),
    { id: 'item', label: 'Article', size: 200, locked: true, required: true, sortValue: (movement) => movement.itemLabel, text: (movement) => movement.itemLabel, groupable: true },
    {
      id: 'kind',
      required: true,
      label: 'Mouvement',
      size: 130,
      sortValue: (movement) => STOCK_MOVEMENT_LABELS[movement.kind as StockMovementKind],
      text: (movement) => STOCK_MOVEMENT_LABELS[movement.kind as StockMovementKind],
      filter: { kind: 'choice', value: (movement) => movement.kind, options: Object.entries(STOCK_MOVEMENT_LABELS).map(([value, label]) => ({ value, label })) },
      groupable: true,
    },
    {
      id: 'quantity',
      required: true,
      label: 'Quantité',
      size: 110,
      numeric: true,
      sortValue: (movement) => movement.quantity,
      text: (movement) => `${movement.quantity > 0 ? '+' : ''}${fmt.quantity({ quantity: movement.quantity })}`,
      filter: { kind: 'number', value: (movement) => movement.quantity },
    },
    { id: 'source', label: 'Origine', size: 200, sortValue: (movement) => movement.source ?? null, text: (movement) => movement.source ?? '', groupable: true },
    { id: 'note', label: 'Note', size: 200, sortValue: (movement) => movement.note ?? null, text: (movement) => movement.note ?? '' },
  ];
  const view = useDataView({ tableKey: itemId ? 'stock-item-movements' : 'stock-movements', getKey: (movement) => movement.id, columns, rows: movements ?? [], title: 'Mouvements du stock' });
  return (
    <DataTable
      framed
      view={view}
      verticalSpacing="xs"
      empty={<EmptyState compact message="Aucun mouvement." />}
      getKey={(movement) => movement.id}
      cells={(movement) => ({
        kind: (
          <Badge size="sm" variant="light" color={KIND_COLORS[movement.kind as StockMovementKind]}>
            {STOCK_MOVEMENT_LABELS[movement.kind as StockMovementKind]}
          </Badge>
        ),
        quantity: <SignedAmount value={movement.quantity} format={(quantity) => fmt.quantity({ quantity: quantity })} />,
        source:
          movement.shoppingListId || movement.sheetId ? (
            <Anchor component={Link} to={movement.shoppingListId ? shoppingListPath(movement.shoppingListId) : sheetPath(movement.sheetId ?? '')} size="sm">
              {movement.source}
            </Anchor>
          ) : (
            movement.source
          ),
      })}
    />
  );
}
