import { Button, Divider, Popover, SegmentedControl, Select, Stack, Switch, Text, Tooltip } from '@mantine/core';
import { TRAVEL_MODE_LABELS, TRAVEL_MODES, formatDuration, travelMinutes, type GeoPoint, type TravelMode } from '@ordo/shared';
import { NavigationArrowIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError } from '../../lib/notify';
import { AddressInput, type AddressValue } from './AddressInput';
import { travelTime, usePlaces } from './api';
import * as fmt from '../../lib/format';

/** Start or end chosen: a saved place, another address, or (for the way back) the start. */
const OTHER = 'other';
const SAME = 'same';

interface TravelCalculatorProps {
  /** Point of the event; none: nothing to compute. */
  eventPoint: GeoPoint | null;
  /** Travel times found, in minutes rounded up to 5: only those of the ways computed. */
  onResult: (minutes: { before?: number; after?: number }) => void;
}

/**
 * Computes the travel times of an event, each way on its own and optional: from a saved place (or another address) to
 * the event, and from the event back to the start, a saved place or another address, each by car, bike or foot
 * (OpenStreetMap roads).
 * @param {TravelCalculatorProps} props Component props.
 * @returns {JSX.Element} Button and its panel.
 */
export function TravelCalculator({ eventPoint, onResult }: TravelCalculatorProps) {
  const { data: places } = usePlaces();
  const [opened, setOpened] = useState(false);
  const [going, setGoing] = useState(true);
  const [back, setBack] = useState(true);
  const [from, setFrom] = useState<string | null>(null);
  const [fromOther, setFromOther] = useState<AddressValue>({ text: '', point: null });
  const [to, setTo] = useState<string>(SAME);
  const [toOther, setToOther] = useState<AddressValue>({ text: '', point: null });
  const [goingMode, setGoingMode] = useState<TravelMode>('CAR');
  const [backMode, setBackMode] = useState<TravelMode>('CAR');
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
  const fromChoice = from ?? places?.[0]?.id ?? OTHER;
  const start = pointOf(fromChoice, fromOther);
  // Back to the start: the start of the way there (asked for even when it is not computed).
  const end = to === SAME ? start : pointOf(to, toOther);
  const ready = (going || back) && (!going || start !== null) && (!back || end !== null);
  const modes = TRAVEL_MODES.map((value) => ({ value, label: TRAVEL_MODE_LABELS[value] }));

  /**
   * Computes the ways chosen and gives them to the event (the others are left as they are).
   * @returns {Promise<void>}
   */
  const compute = async () => {
    if (!eventPoint || !ready) return;
    setLoading(true);
    try {
      const [there, home] = await Promise.all([going && start ? travelTime(start, eventPoint, goingMode) : null, back && end ? travelTime(eventPoint, end, backMode) : null]);
      onResult({ ...(there && { before: travelMinutes(there.seconds) }), ...(home && { after: travelMinutes(home.seconds) }) });
      const told = (label: string, mode: TravelMode, way: { seconds: number; meters: number }) =>
        `${label} ${TRAVEL_MODE_LABELS[mode].toLowerCase()} ${formatDuration(way.seconds)} (${fmt.number(way.meters / 1000, 1)} km)`;
      setSummary(`${[there && told('Aller', goingMode, there), home && told('retour', backMode, home)].filter(Boolean).join(', ')}. Arrondis aux 5 minutes.`);
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const button = (
    <Button variant="default" size="xs" leftSection={<NavigationArrowIcon aria-hidden />} disabled={!eventPoint} onClick={() => setOpened((value) => !value)}>
      Calculer les trajets
    </Button>
  );
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" width={380} shadow="md" withinPortal trapFocus>
      <Popover.Target>{eventPoint ? button : <Tooltip label="Choisissez d’abord une adresse proposée pour le lieu">{button}</Tooltip>}</Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Stack gap="xs">
            <Switch size="sm" label="Aller" checked={going} onChange={(event) => setGoing(event.currentTarget.checked)} />
            {(going || (back && to === SAME)) && (
              <>
                <Select
                  size="xs"
                  label="Départ"
                  data={[...placeOptions, { value: OTHER, label: 'Autre adresse…' }]}
                  value={fromChoice}
                  allowDeselect={false}
                  onChange={setFrom}
                  comboboxProps={{ withinPortal: false }}
                />
                {fromChoice === OTHER && <AddressInput size="xs" aria-label="Adresse de départ" placeholder="Adresse de départ" withinPortal={false} value={fromOther} onChange={setFromOther} />}
              </>
            )}
            {going && <SegmentedControl size="xs" fullWidth aria-label="Mode de transport de l’aller" data={modes} value={goingMode} onChange={(value) => setGoingMode(value as TravelMode)} />}
          </Stack>
          <Divider />
          <Stack gap="xs">
            <Switch size="sm" label="Retour" checked={back} onChange={(event) => setBack(event.currentTarget.checked)} />
            {back && (
              <>
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
                <SegmentedControl size="xs" fullWidth aria-label="Mode de transport du retour" data={modes} value={backMode} onChange={(value) => setBackMode(value as TravelMode)} />
              </>
            )}
          </Stack>
          <Button size="xs" onClick={() => void compute()} loading={loading} disabled={!ready}>
            Calculer
          </Button>
          {summary && (
            <Text size="xs" c="dimmed">
              {summary}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            Itinéraires OpenStreetMap, sans trafic ni transports en commun. Un trajet décoché garde sa durée.
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
