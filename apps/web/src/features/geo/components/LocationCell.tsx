import { EditablePopoverCell } from '../../../components/data-table/cells/EditableCells';
import { AddressInput } from './AddressInput';
import { useLocationDraft } from '../hooks/use-location-draft';
import type { ItemLocation } from '../lib/location';

interface LocationCellProps {
  /** Routine or task. */
  item: ItemLocation;
  /** Hidden label of the field (with the item, and the count of a selection). */
  label: string;
  /** Archived or being created. Optional. Default = false. */
  readOnly?: boolean;
  /** Rows the change applies to (a cell selection): with several, the location is applied even if the row clicked has it already. Optional. Default = 1. */
  count?: number;
  /** Saves the location (null: none, its point too). */
  onSave: (change: ItemLocation) => void;
}

/**
 * Location cell of a table (routines, tasks): an address chosen in place (with its point on the map), a free text
 * (saved on leaving the cell), or none; as the task panel (`useLocationDraft`). On a selection, the location chosen
 * goes to every row selected, even when the row clicked has it already.
 * @param {LocationCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function LocationCell({ item, label, readOnly = false, count = 1, onSave }: LocationCellProps) {
  const location = useLocationDraft(item, onSave, count > 1);
  return (
    <EditablePopoverCell width={360} empty={!item.location} truncate readOnly={readOnly} onClose={location.leave} target={item.location || '—'}>
      <AddressInput aria-label={label} placeholder="Adresse ou lieu enregistré" withinPortal={false} value={location.value} onChange={location.onChange} />
    </EditablePopoverCell>
  );
}
