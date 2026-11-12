import { NumberInput, SimpleGrid, Stack, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { routineSchedule } from '@ordo/shared';
import { CarIcon, ClockIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { EventLocation } from '../geo/EventLocation';
import { TravelCalculator } from '../geo/TravelCalculator';

/** Time and place fields of a routine. */
export interface RoutineScheduleValues {
  fromTime: string | null;
  dueTime: string | null;
  estimate: number | null;
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  travelBefore: number;
  travelAfter: number;
}

interface RoutineScheduleProps {
  values: RoutineScheduleValues;
  errors: Record<string, ReactNode>;
  onChange: (changes: Partial<RoutineScheduleValues>) => void;
}

/**
 * Time and place of a routine (dropping the children at school…): the latest time to do it by, where, and the travel
 * times there and back (computed from the place), with when to leave and when back.
 * @param {RoutineScheduleProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function RoutineSchedule({ values, errors, onChange }: RoutineScheduleProps) {
  const { leaveAt, backAt } = routineSchedule(values);
  const point = values.locationLat !== null && values.locationLon !== null ? { lat: values.locationLat, lon: values.locationLon } : null;
  return (
    <Stack gap="sm">
      <Stack gap={4}>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <TimeInput
            label="À partir de"
            leftSection={<ClockIcon aria-hidden />}
            value={values.fromTime ?? ''}
            onChange={(event) => onChange({ fromTime: event.currentTarget.value || null })}
            error={errors.fromTime}
          />
          <TimeInput
            label="Avant"
            leftSection={<ClockIcon aria-hidden />}
            value={values.dueTime ?? ''}
            onChange={(event) => onChange({ dueTime: event.currentTarget.value || null })}
            error={errors.dueTime}
          />
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          Plage horaire où la faire (déposer les enfants à l’école entre 8 h 20 et 8 h 30…) ; chaque heure est facultative, vide : n’importe quand dans la journée.
        </Text>
      </Stack>
      <EventLocation
        value={{ text: values.location, point }}
        error={errors.location}
        onChange={(value) => onChange({ location: value.text, locationLat: value.point?.lat ?? null, locationLon: value.point?.lon ?? null })}
      />
      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
        <NumberInput
          label="Trajet aller"
          description="Pour y aller"
          leftSection={<CarIcon aria-hidden />}
          suffix=" min"
          min={0}
          max={24 * 60}
          step={5}
          allowDecimal={false}
          value={values.travelBefore}
          onChange={(value) => onChange({ travelBefore: Number(value) || 0 })}
          error={errors.travelBefore}
        />
        <NumberInput
          label="Trajet retour"
          description="Pour en revenir"
          leftSection={<CarIcon aria-hidden />}
          suffix=" min"
          min={0}
          max={24 * 60}
          step={5}
          allowDecimal={false}
          value={values.travelAfter}
          onChange={(value) => onChange({ travelAfter: Number(value) || 0 })}
          error={errors.travelAfter}
        />
        <Stack justify="flex-end">
          <TravelCalculator eventPoint={point} onResult={({ before, after }) => onChange({ travelBefore: before, travelAfter: after })} />
        </Stack>
      </SimpleGrid>
      {(leaveAt || backAt) && (
        <Text size="sm" c="dimmed">
          {leaveAt && `Partir à ${leaveAt.replace(':', ' h ')}${values.estimate && values.dueTime ? ` (trajet et ${values.estimate} min sur place)` : ''}`}
          {leaveAt && backAt && ' · '}
          {backAt && `retour vers ${backAt.replace(':', ' h ')}`}
        </Text>
      )}
    </Stack>
  );
}
