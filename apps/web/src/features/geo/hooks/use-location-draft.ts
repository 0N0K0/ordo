import { useState } from 'react';
import type { AddressValue } from '../components/AddressInput';
import { addressOf, locationOf, type ItemLocation } from '../lib/location';

/**
 * Location of an existing item typed in place (task panel, « Lieu » cell of a table), the same everywhere: saved once a
 * proposed address is chosen or the map clicked (with its point), when the text is cleared, or on leaving the field
 * for a free text typed alone; nothing saved when the location is unchanged, but on a selection of several rows (the
 * other rows take the location of the one clicked).
 * @param {ItemLocation} item Task or routine (its saved location).
 * @param {(change: ItemLocation) => void} save Saves a change of the location (null: none, its point too).
 * @param {boolean} [several] The change applies to several rows (a cell selection). Optional. Default = false.
 * @returns {{ value: AddressValue, onChange: (value: AddressValue) => void, leave: () => void }} Value of the field, its
 *   change handler, and what to call on leaving the field (saves the free text, then drops the draft).
 */
export function useLocationDraft(item: ItemLocation, save: (change: ItemLocation) => void, several = false) {
  const [draft, setDraft] = useState<AddressValue | null>(null);

  /**
   * Saves an address, when it changes the location of the item.
   * @param {AddressValue} value Address.
   * @returns {void}
   */
  const commit = (value: AddressValue) => {
    const change = { ...locationOf(value), location: value.text.trim() || null };
    if (several || change.location !== item.location || change.locationLat !== item.locationLat || change.locationLon !== item.locationLon) save(change);
  };

  return {
    value: draft ?? addressOf(item),
    /**
     * Keeps the typed address, saved at once when chosen or cleared.
     * @param {AddressValue} value Address.
     * @returns {void}
     */
    onChange: (value: AddressValue) => {
      setDraft(value);
      // eslint-disable-next-line no-restricted-syntax -- useLocationDraft itself.
      if (value.point || !value.text.trim()) commit(value);
    },
    /**
     * Leaves the field: saves a free text typed alone, then drops the draft.
     * @returns {void}
     */
    leave: () => {
      if (draft) commit(draft);
      setDraft(null);
    },
  };
}

/** Fields of the place of an item, saved together. */
export const PLACE_FIELDS = ['location', 'locationLat', 'locationLon'] as const;

/** Place fields as a form holds them (its text never null). */
type FormLocation = { location: string; locationLat: number | null; locationLon: number | null };

/**
 * Location field of the form of an item (event, routine): `useLocationDraft` on its values, the place put in the form
 * when chosen, cleared or left, then saved now in a panel saved field by field (`commit` of `useFieldSave`).
 * @param {Partial<ItemLocation>} values Values of the form (its place).
 * @param {(change: FormLocation) => void} set Puts the place in the form.
 * @param {(fields: (typeof PLACE_FIELDS)[number][]) => void} [commit] Saves the place fields now. Optional.
 * @returns {{ value: AddressValue, onChange: (value: AddressValue) => void, leave: () => void }} As `useLocationDraft`.
 */
export function useFormLocation(values: Partial<ItemLocation>, set: (change: FormLocation) => void, commit?: (fields: (typeof PLACE_FIELDS)[number][]) => void) {
  return useLocationDraft({ location: values.location || null, locationLat: values.locationLat ?? null, locationLon: values.locationLon ?? null }, (change) => {
    set({ ...change, location: change.location ?? '' });
    commit?.([...PLACE_FIELDS]);
  });
}
