import { ActionIcon, Button, Checkbox, Group, NumberInput, Paper, SegmentedControl, Select, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { ROUTINE_ANCHOR_LABELS, ROUTINE_ANCHORS, routineSchedule, type Recurrence, type RoutineAnchor, type RoutineCase, type RoutineSlot } from '@ordo/shared';
import { BellIcon, CarIcon, ClockIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { localToday } from '../../lib/dates';
import { useWorkSchedules } from '../calendar/api';
import { DAILY, describeRoutineCase, newRoutineCase } from './routine-format';
import { EventLocation } from '../geo/EventLocation';
import { TravelCalculator } from '../geo/TravelCalculator';

/** How a routine repeats: a rule and a window, cases (days and times of the day), or a calendar schedule. */
type RepetitionMode = 'rule' | 'cases' | 'schedule';

/**
 * Times of the day of a routine case: from when and by when (each optional), optional or not.
 * @param {{ item: RoutineCase, onChange: (changes: Partial<RoutineCase>) => void, index: number }} props Component props.
 * @returns {JSX.Element} Times.
 */
function SlotsEditor({ item, onChange, index }: { item: RoutineCase; onChange: (changes: Partial<RoutineCase>) => void; index: number }) {
  /**
   * Changes a time of the day.
   * @param {number} position Its index.
   * @param {Partial<RoutineSlot>} changes Changes.
   * @returns {void}
   */
  const update = (position: number, changes: Partial<RoutineSlot>) => onChange({ slots: item.slots.map((slot, other) => (other === position ? { ...slot, ...changes } : slot)) });
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        Moments de la journée
      </Text>
      {item.slots.map((slot, position) => (
        <Group key={position} gap={6} wrap="nowrap">
          <TimeInput
            size="xs"
            aria-label={`À partir de, moment ${position + 1}, cas ${index + 1}`}
            leftSection={<Text size="xs">dès</Text>}
            value={slot.fromTime ?? ''}
            onChange={(event) => update(position, { fromTime: event.currentTarget.value || null })}
          />
          <TimeInput
            size="xs"
            aria-label={`Avant, moment ${position + 1}, cas ${index + 1}`}
            leftSection={<Text size="xs">avant</Text>}
            value={slot.dueTime ?? ''}
            onChange={(event) => update(position, { dueTime: event.currentTarget.value || null })}
          />
          <Checkbox size="xs" label="Facultatif" checked={slot.optional} onChange={(event) => update(position, { optional: event.currentTarget.checked })} />
          {item.slots.length > 1 && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={`Retirer le moment ${position + 1}`}
              onClick={() => onChange({ slots: item.slots.filter((_, other) => other !== position) })}
            >
              <XIcon aria-hidden />
            </ActionIcon>
          )}
        </Group>
      ))}
      <div>
        <Button size="compact-xs" variant="subtle" leftSection={<PlusIcon aria-hidden />} onClick={() => onChange({ slots: [...item.slots, { fromTime: null, dueTime: null, optional: false }] })}>
          Ajouter un moment
        </Button>
      </div>
    </Stack>
  );
}

/**
 * Cases of a routine: each with its repetition (as the events': yearly on the first Saturday of April, even weeks,
 * pauses…) and its times of the day.
 * @param {{ cases: RoutineCase[], start: string, onChange: (cases: RoutineCase[]) => void }} props Component props.
 * @returns {JSX.Element} Editor.
 */
function RoutineCasesEditor({ cases, start, onChange }: { cases: RoutineCase[]; start: string; onChange: (cases: RoutineCase[]) => void }) {
  /**
   * Changes a case.
   * @param {number} index Its index.
   * @param {Partial<RoutineCase>} changes Changes.
   * @returns {void}
   */
  const update = (index: number, changes: Partial<RoutineCase>) => onChange(cases.map((item, other) => (other === index ? { ...item, ...changes } : item)));
  return (
    <Stack gap="xs">
      {cases.map((item, index) => (
        <Paper key={index} withBorder radius="sm" p="sm">
          <Stack gap="xs">
            <Group justify="space-between" wrap="nowrap">
              <Text size="xs" c="dimmed">
                Cas {index + 1} · {describeRoutineCase(item, start)}
              </Text>
              {cases.length > 1 && (
                <Tooltip label="Retirer le cas">
                  <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Retirer le cas ${index + 1}`} onClick={() => onChange(cases.filter((_, other) => other !== index))}>
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            <RecurrenceEditor value={item.recurrence} onChange={(rule) => update(index, { recurrence: rule ?? DAILY })} start={start} />
            <SlotsEditor item={item} index={index} onChange={(changes) => update(index, changes)} />
          </Stack>
        </Paper>
      ))}
      <div>
        <Button size="compact-xs" variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => onChange([...cases, newRoutineCase(null, null)])}>
          Ajouter un cas
        </Button>
      </div>
    </Stack>
  );
}

/** Alert presets, in minutes before the moment of the routine. */
const ROUTINE_REMINDERS: { value: number; label: string }[] = [
  { value: 0, label: 'À l’heure' },
  { value: 5, label: '5 min avant' },
  { value: 10, label: '10 min avant' },
  { value: 15, label: '15 min avant' },
  { value: 30, label: '30 min avant' },
  { value: 60, label: '1 h avant' },
  { value: 120, label: '2 h avant' },
];

/** Time and place fields of a routine. */
export interface RoutineScheduleValues {
  startDate: string;
  recurrence: Recurrence;
  cases: RoutineCase[];
  scheduleId: string | null;
  scheduleAnchor: RoutineAnchor | null;
  reminders: number[];
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
  const [mode, setMode] = useState<RepetitionMode>(values.cases.length ? 'cases' : values.scheduleId ? 'schedule' : 'rule');
  const { leaveAt, backAt } = routineSchedule(values);
  const point = values.locationLat !== null && values.locationLon !== null ? { lat: values.locationLat, lon: values.locationLon } : null;
  return (
    <Stack gap="sm">
      <SegmentedControl
        aria-label="Répétition"
        value={mode}
        onChange={(value) => {
          setMode(value as RepetitionMode);
          if (value === 'rule') onChange({ cases: [], scheduleId: null, scheduleAnchor: null });
          if (value === 'cases')
            onChange({ cases: values.cases.length ? values.cases : [newRoutineCase(values.fromTime, values.dueTime)], scheduleId: null, scheduleAnchor: null, fromTime: null, dueTime: null });
          if (value === 'schedule') onChange({ cases: [], fromTime: null, dueTime: null, scheduleAnchor: values.scheduleAnchor ?? 'START' });
        }}
        data={[
          { value: 'rule', label: 'Une règle' },
          { value: 'cases', label: 'Plusieurs cas' },
          { value: 'schedule', label: 'Plage de l’agenda' },
        ]}
      />
      {mode === 'rule' && (
        <>
          <RecurrenceEditor value={values.recurrence} onChange={(rule) => onChange({ recurrence: rule ?? DAILY })} start={values.startDate || localToday()} />
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
        </>
      )}
      {mode === 'cases' && (
        <Stack gap={4}>
          <RoutineCasesEditor cases={values.cases} start={values.startDate || localToday()} onChange={(cases) => onChange({ cases })} />
          <Text size="xs" c="dimmed">
            Chaque cas a ses jours et ses moments de la journée (se brosser les dents le matin, le midi et le soir), cochés chacun ; un moment facultatif n’est pas nécessaire pour que la journée soit
            faite (2 à 3 fois par jour). Un jour pris par plusieurs cas suit le premier.
          </Text>
          {typeof errors.cases === 'string' || errors.cases ? (
            <Text size="xs" c="red">
              {errors.cases}
            </Text>
          ) : null}
        </Stack>
      )}
      {mode === 'schedule' && (
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
      <BatchMultiSelect
        label="Alertes"
        description={
          values.scheduleId || values.fromTime || values.dueTime
            ? 'Avant l’heure de départ (sinon le début, sinon l’heure maximale), les jours où elle est à faire, tant qu’elle n’est pas cochée.'
            : 'Donnez-lui un horaire ou une plage pour pouvoir l’alerter.'
        }
        leftSection={<BellIcon aria-hidden />}
        placeholder={values.reminders.length ? undefined : 'Aucune'}
        disabled={!values.scheduleId && !values.fromTime && !values.dueTime}
        data={ROUTINE_REMINDERS.map((preset) => ({ value: String(preset.value), label: preset.label }))}
        value={values.reminders.map(String)}
        onChange={(reminders) => onChange({ reminders: reminders.map(Number).sort((a, b) => a - b) })}
        clearable
        error={errors.reminders}
      />
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
