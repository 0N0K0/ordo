import { DataTable } from '../../../components/data-table/table/DataTable';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { EditableDate, EditableNumber } from '../../../components/data-table/cells/EditableCells';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import * as fmt from '../../../lib/format';
import { onMutationError } from '../../../lib/notify';
import { useStockMutations, type StockItem, type StockLot } from '../api';

/**
 * Lots of an item of the stock, unfolded under it, in a table like every other: their quantity corrected and their
 * date changed in place, one or several at once (bulk selection).
 * @param {{ item: StockItem, readOnly?: boolean }} props Item, and whether nothing can be changed (an archived item).
 * @returns {JSX.Element} Table.
 */
export function LotsTable({ item, readOnly = false }: { item: StockItem; readOnly?: boolean }) {
  const { move, setLotExpiry } = useStockMutations();
  const columns: DataColumn<StockLot>[] = [
    {
      id: 'quantity',
      label: 'Quantité',
      size: 120,
      numeric: true,
      locked: true,
      bulk: true,
      sortValue: (lot) => lot.quantity,
      text: (lot) => fmt.number(lot.quantity, 3),
      filter: { kind: 'number', value: (lot) => lot.quantity },
    },
    {
      id: 'expiresAt',
      label: 'Péremption',
      size: 150,
      bulk: true,
      sortValue: (lot) => (lot.expiresAt ? String(lot.expiresAt) : null),
      text: (lot) => (lot.expiresAt ? fmt.day(String(lot.expiresAt)) : ''),
      filter: { kind: 'date', value: (lot) => (lot.expiresAt ? String(lot.expiresAt).slice(0, 10) : null) },
    },
    {
      id: 'createdAt',
      label: 'Entré le',
      size: 130,
      sortValue: (lot) => String(lot.createdAt),
      text: (lot) => fmt.day(new Date(lot.createdAt)),
      filter: { kind: 'date', value: (lot) => String(lot.createdAt).slice(0, 10) },
    },
  ];
  const view = useDataView({ tableKey: 'stock-lots', getKey: (lot) => lot.id, columns, rows: item.lots, title: `Lots de ${item.label}` });
  const onError = { onError: onMutationError };
  // A change saves its lot, or every lot of the bulk selection of its column.
  const bulk = bulkSaver<StockLot, { quantity?: number; expiresAt?: string | null }>(view, (lot, change) => {
    // A quantity changed by hand is a correction.
    if (change.quantity !== undefined && change.quantity !== lot.quantity)
      move.mutate({ itemId: item.id, kind: 'CORRECTION', quantity: change.quantity - lot.quantity, lotId: lot.id, expiresAt: null, note: null }, onError);
    if (change.expiresAt !== undefined) setLotExpiry.mutate({ id: lot.id, expiresAt: change.expiresAt }, onError);
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
            label={`Quantité du lot du ${lot.expiresAt ? fmt.day(String(lot.expiresAt)) : fmt.day(new Date(lot.createdAt))}`}
            decimals={3}
            readOnly={readOnly}
            onSave={(quantity) => quantity !== null && bulk('quantity')(lot, { quantity })}
          />
        ),
        expiresAt: (
          <EditableDate
            value={lot.expiresAt ? String(lot.expiresAt).slice(0, 10) : null}
            label="Date de péremption du lot"
            nullable
            readOnly={readOnly}
            onSave={(expiresAt) => bulk('expiresAt')(lot, { expiresAt })}
          />
        ),
      })}
    />
  );
}
