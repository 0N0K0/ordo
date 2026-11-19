import { useState } from 'react';
import { EditablePopoverCell } from '../../../components/data-table/cells/EditableCells';
import { AddressInput, type AddressValue } from './AddressInput';
import { addressOf, locationOf, type ItemLocation } from '../lib/location';

interface LocationCellProps {
  /** Routine or task. */
  item: ItemLocation;
  /** Hidden label of the field (with the item, and the count of a selection). */
  label: string;
  /** Archived or being created. Optional. Default = false. */
  readOnly?: boolean;
  /** Saves the location (null: none, its point too). */
  onSave: (change: ItemLocation) => void;
}

/**
 * Location cell of a table (routines, tasks): an address chosen in place (with its point on the map), or none.
 * @param {LocationCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function LocationCell({ item, label, readOnly = false, onSave }: LocationCellProps) {
  const [draft, setDraft] = useState<AddressValue | null>(null);
  return (
    <EditablePopoverCell width={360} empty={!item.location} truncate readOnly={readOnly} onClose={() => setDraft(null)} target={item.location || '—'}>
      <AddressInput
        aria-label={label}
        placeholder="Adresse ou lieu enregistré"
        withinPortal={false}
        value={draft ?? addressOf(item)}
        onChange={(value) => {
          setDraft(value);
          // Saved once a proposed address is chosen, or when the text is cleared.
          if (value.point || !value.text.trim()) onSave({ ...locationOf(value), location: value.text.trim() || null });
        }}
      />
    </EditablePopoverCell>
  );
}
