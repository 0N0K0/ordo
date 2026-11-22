import { Anchor, Badge } from '@mantine/core';
import { STOCK_MOVEMENT_LABELS, type StockMovementKind } from '@ordo/shared';
import { Link } from 'react-router';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { EmptyState } from '../../../components/feedback/EmptyState';
import * as fmt from '../../../lib/format';
import { useStockMovements } from '../api';
import { MOVEMENT_COLUMNS } from '../hooks/use-stock-columns';
import { SignedAmount } from '../../../components/money/SignedAmount';
import { sheetPath, shoppingListPath } from '../../../app/pages';

const KIND_COLORS: Record<StockMovementKind, string> = { PURCHASE: 'green', CONSUMPTION: 'blue', COUNT: 'grape', LOSS: 'red', CORRECTION: 'gray' };

/**
 * Movements of the stock (all, or those of an item), latest first, in a table like every other.
 * @param {{ itemId?: string | null }} props Item (none: every movement). Optional.
 * @returns {JSX.Element} Table.
 */
export function MovementsTable({ itemId = null }: { itemId?: string | null }) {
  const { data: movements } = useStockMovements(itemId);
  const view = useDataView({ tableKey: itemId ? 'stock-item-movements' : 'stock-movements', getKey: (movement) => movement.id, columns: MOVEMENT_COLUMNS, rows: movements ?? [], title: 'Mouvements du stock' });
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
