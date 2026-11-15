import { DataTable } from '../../components/data-table/DataTable';
import type { DataColumn } from '../../components/data-table/data-table';
import { EditableDate, EditableNumber } from '../../components/data-table/EditableCells';
import { useDataView } from '../../components/data-table/use-data-view';
import * as fmt from '../../lib/format';
import { notifyError } from '../../lib/notify';
import { useStockMutations, type StockItem, type StockLot } from './api';

/**
 * Lots of an item of the stock, unfolded under it, in a table like every other: their quantity corrected and their
 * date changed in place.
 * @param {{ item: StockItem }} props Item.
 * @returns {JSX.Element} Table.
 */
export function LotsTable({ item }: { item: StockItem }) {
  const { move, setLotExpiry } = useStockMutations();
  const columns: DataColumn<StockLot>[] = [
    {
      id: 'quantity',
      label: 'Quantité',
      size: 120,
      numeric: true,
      locked: true,
      sortValue: (lot) => lot.quantity,
      text: (lot) => fmt.number(lot.quantity, 3),
      filter: { kind: 'number', value: (lot) => lot.quantity },
    },
    {
      id: 'expiresAt',
      label: 'Péremption',
      size: 150,
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
  const onError = { onError: (error: Error) => notifyError(error.message) };
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
            // A quantity changed by hand is a correction.
            onSave={(quantity) =>
              quantity !== null &&
              quantity !== lot.quantity &&
              move.mutate({ itemId: item.id, kind: 'CORRECTION', quantity: quantity - lot.quantity, lotId: lot.id, expiresAt: null, note: null }, onError)
            }
          />
        ),
        expiresAt: (
          <EditableDate
            value={lot.expiresAt ? String(lot.expiresAt).slice(0, 10) : null}
            label="Date de péremption du lot"
            nullable
            onSave={(expiresAt) => setLotExpiry.mutate({ id: lot.id, expiresAt }, onError)}
          />
        ),
      })}
    />
  );
}
