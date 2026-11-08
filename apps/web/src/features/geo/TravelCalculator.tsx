import { Button, Popover, SegmentedControl, Select, Stack, Text, Tooltip } from '@mantine/core';
import { TRAVEL_MODE_LABELS, TRAVEL_MODES, formatDuration, travelMinutes, type GeoPoint, type TravelMode } from '@ordo/shared';
import { NavigationArrowIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError } from '../../lib/notify';
import { AddressInput, type AddressValue } from './AddressInput';
import { travelTime, usePlaces } from './api';

/** Start or end chosen: a saved place, another address, or (for the way back) the start. */
const OTHER = 'other';
const SAME = 'same';

const distance = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

interface TravelCalculatorProps {
  /** Point of the event; none: nothing to compute. */
  eventPoint: GeoPoint | null;
  /** Travel times found, in minutes rounded up to 5. */
  onResult: (minutes: { before: number; after: number }) => void;
}

/**
 * Computes the travel times of an event: from a saved place (or another address) to the event, and from the event
 * back to the same place or another one, by car, bike or foot (OpenStreetMap roads).
 * @param {TravelCalculatorProps} props Component props.
 * @returns {JSX.Element} Button and its panel.
 */
export function TravelCalculator({ eventPoint, onResult }: TravelCalculatorProps) {
  const { data: places } = usePlaces();
  const [opened, setOpened] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [fromOther, setFromOther] = useState<AddressValue>({ text: '', point: null });
  const [to, setTo] = useState<string>(SAME);
  const [toOther, setToOther] = useState<AddressValue>({ text: '', point: null });
  const [mode, setMode] = useState<TravelMode>('CAR');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const placeOptions = (places ?? []).map((place) => ({ value: place.id, label: place.name }));
  /**
   * Point of a choice.
   * @param {string | null} choice Place id, OTHER or SAME.
   * @param {AddressValue} other Other address.
   * @returns {GeoPoint | null} Point.
   */
  const pointOf = (choice: string | null, other: AddressValue): GeoPoint | null => {
    if (choice === OTHER) return other.point;
    const place = places?.find((item) => item.id === choice);
    return place ? { lat: place.lat, lon: place.lon } : null;
  };
  const start = pointOf(from ?? places?.[0]?.id ?? OTHER, fromOther);
  const end = to === SAME ? start : pointOf(to, toOther);

  /**
   * Computes both ways and gives them to the event.
   * @returns {Promise<void>}
   */
  const compute = async () => {
    if (!eventPoint || !start || !end) return;
    setLoading(true);
    try {
      const [going, back] = await Promise.all([travelTime(start, eventPoint, mode), travelTime(eventPoint, end, mode)]);
      onResult({ before: travelMinutes(going.seconds), after: travelMinutes(back.seconds) });
      setSummary(
        `${TRAVEL_MODE_LABELS[mode]} : aller ${formatDuration(going.seconds)} (${distance.format(going.meters / 1000)} km), retour ${formatDuration(back.seconds)} (${distance.format(back.meters / 1000)} km). Arrondis aux 5 minutes.`,
      );
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const button = (
    <Button variant="light" size="xs" leftSection={<NavigationArrowIcon aria-hidden />} disabled={!eventPoint} onClick={() => setOpened((value) => !value)}>
      Calculer les trajets
    </Button>
  );
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" width={380} shadow="md" withinPortal trapFocus>
      <Popover.Target>{eventPoint ? button : <Tooltip label="Choisissez d’abord une adresse proposée pour le lieu">{button}</Tooltip>}</Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Select
            size="xs"
            label="Départ"
            data={[...placeOptions, { value: OTHER, label: 'Autre adresse…' }]}
            value={from ?? places?.[0]?.id ?? OTHER}
            allowDeselect={false}
            onChange={setFrom}
            comboboxProps={{ withinPortal: false }}
          />
          {(from ?? places?.[0]?.id ?? OTHER) === OTHER && (
            <AddressInput size="xs" aria-label="Adresse de départ" placeholder="Adresse de départ" withinPortal={false} value={fromOther} onChange={setFromOther} />
          )}
          <Select
            size="xs"
            label="Retour vers"
            data={[{ value: SAME, label: 'Le lieu de départ' }, ...placeOptions, { value: OTHER, label: 'Autre adresse…' }]}
            value={to}
            allowDeselect={false}
            onChange={(value) => value && setTo(value)}
            comboboxProps={{ withinPortal: false }}
          />
          {to === OTHER && <AddressInput size="xs" aria-label="Adresse de retour" placeholder="Adresse de retour" withinPortal={false} value={toOther} onChange={setToOther} />}
          <SegmentedControl size="xs" fullWidth data={TRAVEL_MODES.map((value) => ({ value, label: TRAVEL_MODE_LABELS[value] }))} value={mode} onChange={(value) => setMode(value as TravelMode)} />
          <Button size="xs" onClick={() => void compute()} loading={loading} disabled={!start || !end}>
            Calculer
          </Button>
          {summary && (
            <Text size="xs" c="dimmed">
              {summary}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            Itinéraires OpenStreetMap, sans trafic ni transports en commun.
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
