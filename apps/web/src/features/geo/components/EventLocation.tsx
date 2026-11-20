import { Stack } from '@mantine/core';
import type { GeoPoint } from '@ordo/shared';
import { AddressInput, type AddressValue } from './AddressInput';
import { pickedAddress } from '../api';
import { LazyPlaceMap } from './LazyPlaceMap';

interface EventLocationProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  error?: React.ReactNode;
  /** Leaving the text field (a detail panel saves a free text then). Optional. */
  onBlur?: () => void;
}

/**
 * Location of an item (event, routine, task): free text (a room, a video call…), or a saved place or an address found as it is typed,
 * then shown on a map where a click moves it (its address looked up again).
 * @param {EventLocationProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function EventLocation({ value, onChange, error, onBlur }: EventLocationProps) {
  /**
   * Moves the location to a point clicked on the map (its address, else its coordinates).
   * @param {GeoPoint} point Point.
   * @returns {Promise<void>}
   */
  const move = async (point: GeoPoint) => {
    onChange({ text: value.text, point });
    onChange({ text: (await pickedAddress(point)).address, point });
  };
  return (
    <Stack gap={6}>
      <AddressInput label="Lieu" placeholder="Adresse, lieu enregistré, salle, visio…" value={value} error={error} onChange={onChange} onBlur={onBlur} />
      {value.point && <LazyPlaceMap height={180} points={[{ id: 'event', label: value.text, ...value.point, active: true }]} onPick={(point) => void move(point)} />}
    </Stack>
  );
}
