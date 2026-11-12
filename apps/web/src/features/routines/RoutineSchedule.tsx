import { NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { ROUTINE_ANCHOR_LABELS, ROUTINE_ANCHORS, routineSchedule, type RoutineAnchor } from '@ordo/shared';
import { CarIcon, ClockIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useWorkSchedules } from '../calendar/api';
import { EventLocation } from '../geo/EventLocation';
import { TravelCalculator } from '../geo/TravelCalculator';

/** Time and place fields of a routine. */
export interface RoutineScheduleValues {
  scheduleId: string | null;
  scheduleAnchor: RoutineAnchor | null;
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
 * Time and place of a routine (dropping the children at school…): its own time window, or a calendar schedule it
 * follows (before its start, during it or after its end), where, and the travel times there and back (computed from the
 * place), with when to leave and when back (own times only: a schedule's change from day to day).
 * @param {RoutineScheduleProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function RoutineSchedule({ values, errors, onChange }: RoutineScheduleProps) {
  const { data: schedules } = useWorkSchedules();
  const [mode, setMode] = useState<'times' | 'schedule'>(values.scheduleId ? 'schedule' : 'times');
  const { leaveAt, backAt } = routineSchedule(values);
  const point = values.locationLat !== null && values.locationLon !== null ? { lat: values.locationLat, lon: values.locationLon } : null;
  return (
    <Stack gap="sm">
      <SegmentedControl
        size="xs"
        aria-label="Horaire"
        value={values.scheduleId !== null || mode === 'schedule' ? 'schedule' : 'times'}
        onChange={(value) => {
          setMode(value as 'times' | 'schedule');
          if (value === 'times') onChange({ scheduleId: null, scheduleAnchor: null });
          else onChange({ fromTime: null, dueTime: null, scheduleAnchor: values.scheduleAnchor ?? 'START' });
        }}
        data={[
          { value: 'times', label: 'Heures' },
          { value: 'schedule', label: 'Plage de l’agenda' },
        ]}
      />
      {values.scheduleId !== null || mode === 'schedule' ? (
        <Stack gap={4}>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <Select
              label="Plage"
              placeholder="Choisir une plage"
              searchable
              data={(schedules ?? []).map((schedule) => ({ value: schedule.id, label: schedule.name }))}
              nothingFoundMessage="Aucune plage (créez-en dans l’agenda)"
              value={values.scheduleId}
              onChange={(scheduleId) => onChange({ scheduleId, scheduleAnchor: values.scheduleAnchor ?? 'START' })}
              error={errors.scheduleId}
            />
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Moment
              </Text>
              <SegmentedControl
                size="xs"
                value={values.scheduleAnchor ?? 'START'}
                onChange={(anchor) => onChange({ scheduleAnchor: anchor as RoutineAnchor })}
                data={ROUTINE_ANCHORS.map((anchor) => ({ value: anchor, label: ROUTINE_ANCHOR_LABELS[anchor] }))}
              />
            </Stack>
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            La routine a lieu les jours de la plage (ses pauses et exceptions comprises), avant son début (déposer les enfants à l’école), pendant (le ménage du samedi matin) ou après sa fin (les
            récupérer).
          </Text>
        </Stack>
      ) : (
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
      )}
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
