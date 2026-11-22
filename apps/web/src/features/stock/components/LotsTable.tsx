import { DataTable } from '../../../components/data-table/table/DataTable';
import { EditableDate, EditableNumber } from '../../../components/data-table/cells/EditableCells';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import * as fmt from '../../../lib/format';
import { ON_ERROR } from '../../../lib/notify';
import { useStockMutations, type StockItem, type StockLot } from '../api';
import { LOT_COLUMNS } from '../hooks/use-stock-columns';

/**
 * Lots of an item of the stock, unfolded under it, in a table like every other: their quantity corrected and their
 * date changed in place, one or several at once (bulk selection).
 * @param {{ item: StockItem, readOnly?: boolean }} props Item, and whether nothing can be changed (an archived item).
 * @returns {JSX.Element} Table.
 */
export function LotsTable({ item, readOnly = false }: { item: StockItem; readOnly?: boolean }) {
  const { move, setLotExpiry } = useStockMutations();
  const view = useDataView({ tableKey: 'stock-lots', getKey: (lot) => lot.id, columns: LOT_COLUMNS, rows: item.lots, title: `Lots de ${item.label}` });
  // A change saves its lot, or every lot of the bulk selection of its column.
  const cellLabelOf = bulkCellLabels(view, (lot: StockLot) => `lot du ${fmt.day(lot.expiresAt ?? lot.createdAt)}`);
  const bulk = bulkSaver<StockLot, { quantity?: number; expiresAt?: string | null }>(view, (lot, change) => {
    // A quantity changed by hand is a correction.
    if (change.quantity !== undefined && change.quantity !== lot.quantity)
      move.mutate({ itemId: item.id, kind: 'CORRECTION', quantity: change.quantity - lot.quantity, lotId: lot.id, expiresAt: null, note: null }, ON_ERROR);
    if (change.expiresAt !== undefined) setLotExpiry.mutate({ id: lot.id, expiresAt: change.expiresAt }, ON_ERROR);
  });
  return (
    <DataTable
      view={view}
      verticalSpacing={4}
      getKey={(lot) => lot.id}
      cells={(lot) => ({
        quantity: (
          <EditableNumber
            value={lot.quantity}
            label={cellLabelOf('quantity', lot, 'Quantité')}
            decimals={3}
            readOnly={readOnly}
            onSave={(quantity) => quantity !== null && bulk('quantity')(lot, { quantity })}
          />
        ),
        expiresAt: (
          <EditableDate
            value={lot.expiresAt || null}
            label={cellLabelOf('expiresAt', lot, 'Date de péremption')}
            nullable
            readOnly={readOnly}
            onSave={(expiresAt) => bulk('expiresAt')(lot, { expiresAt })}
          />
        ),
      })}
    />
  );
}
