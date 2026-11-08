import { Stack } from '@mantine/core';
import type { GeoPoint } from '@ordo/shared';
import { AddressInput, type AddressValue } from './AddressInput';
import { reverseAddress } from './api';
import { PlaceMap } from './PlaceMap';

interface EventLocationProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  error?: React.ReactNode;
}

/**
 * Location of an event: free text (a room, a video call…), or a saved place or an address found as it is typed,
 * then shown on a map where a click moves it (its address looked up again).
 * @param {EventLocationProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function EventLocation({ value, onChange, error }: EventLocationProps) {
  /**
   * Moves the location to a point clicked on the map.
   * @param {GeoPoint} point Point.
   * @returns {Promise<void>}
   */
  const move = async (point: GeoPoint) => {
    onChange({ text: value.text, point });
    const found = await reverseAddress(point).catch(() => null);
    if (found) onChange({ text: found.label, point });
  };
  return (
    <Stack gap={6}>
      <AddressInput label="Lieu" placeholder="Adresse, lieu enregistré, salle, visio…" value={value} error={error} onChange={onChange} />
      {value.point && <PlaceMap height={180} points={[{ id: 'event', label: value.text, ...value.point, active: true }]} onPick={(point) => void move(point)} />}
    </Stack>
  );
}
