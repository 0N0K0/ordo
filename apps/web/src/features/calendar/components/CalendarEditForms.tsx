import { PICKER_FORMATS } from '../../../lib/format';
import { ArrowCounterClockwiseIcon, ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react';
import { DeleteButton } from '../../../components/dialogs/DestructiveActions';
import { Fieldset, Group, Stack, Text, Switch } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { changedScheduleSlot, routineSlotSchema, scheduleSlotTimeSchema, type ScheduleSlotTime, type WorkScheduleRule } from '@ordo/shared';
import { useEffect, useRef } from 'react';
import { openRoutineForm } from '../../routines/lib/open-routine-form';
import type { RoutineOccurrenceRef } from '../hooks/calendar-edits';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { useAppForm, useFieldSave } from '../../../lib/form';
import { routinesKey, useRoutineMutations, useRoutinesData, type RoutineOccurrence } from '../../routines/api';
import { useCachedItem } from '../../../lib/mutation';
import { ruleScheduleInput, useWorkScheduleMutations, type CalendarEventScope } from '../api';
import { rangeProps } from '../../../components/inputs/date-range';
import { ActionButton } from '../../../components/actions/ActionButton';

/**
 * Panel of a slot of a schedule from the calendar: its day and hours (or the whole day), each saved as soon as it
 * changes (decision D22) for the days chosen when the panel opened (`scope`: this day, an exception; it and the
 * following ones; all; null: none chosen, read only); occurrences of routines a change makes disappear confirmed first
 * (declined: put back); or deleting it (its own question).
 * @param {{ label: string, schedule: WorkScheduleRule, slot: ScheduleSlotTime, scope: CalendarEventScope | null, onDelete: (schedule: WorkScheduleRule, slot: ScheduleSlotTime) => void, onClose: () => void }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function SlotEditForm({
  label,
  schedule,
  slot,
  scope,
  onDelete,
  onClose,
}: {
  label: string;
  schedule: WorkScheduleRule;
  slot: ScheduleSlotTime;
  scope: CalendarEventScope | null;
  /** Deletes the slot as it is now, in its schedule as it is now. */
  onDelete: (schedule: WorkScheduleRule, slot: ScheduleSlotTime) => void;
  onClose: () => void;
}) {
  const { update } = useWorkScheduleMutations();
  // The schedule and the slot as saved: a save changes the slot where the previous one put it.
  const saved = useRef({ schedule, slot });
  const base = useAppForm<ScheduleSlotTime & Record<string, unknown>>({ initialValues: { ...slot }, schema: scheduleSlotTimeSchema });
  const reading = scope === null;
  const { form, saving } = useFieldSave(base, {
    save:
      scope === null
        ? null
        : async (_changes, values) => {
            const change = { date: values.date, start: values.start, end: values.end, allDay: values.allDay };
            const next = changedScheduleSlot(saved.current.schedule, saved.current.slot, change, scope);
            const current = saved.current.schedule;
            await update.mutateAsync({ id: current.id, input: ruleScheduleInput(current, next) });
            saved.current = { schedule: { ...current, ...next }, slot: change };
          },
    schema: scheduleSlotTimeSchema,
  });
  const values = form.values;
  const hours = rangeProps({ value: [values.start, values.end], onChange: ([start, end]) => form.setValues({ start, end }), errors: [undefined, form.errors.end] }, true);
  return (
    <Stack gap="md">
      {!reading && <SaveStatus saving={saving} />}
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" c="dimmed">
        {scope === null ? SLOT_READING_NOTE : SLOT_SCOPE_NOTES[scope]}
      </Text>
      <Fieldset variant="unstyled" disabled={reading} p={0} m={0}>
        <Stack gap="md">
          <DatePickerInput label="Jour" required valueFormat={PICKER_FORMATS.weekday} {...form.getInputProps('date')} onChange={(date) => date && form.setFieldValue('date', date)} data-autofocus />
          <Switch
            label="Journée entière"
            checked={values.allDay}
            onChange={(event) => form.setValues(event.currentTarget.checked ? { allDay: true, start: '00:00', end: '24:00' } : { allDay: false, start: '09:00', end: '17:00' })}
          />
          {!values.allDay && (
            <Group gap="sm" grow>
              <TimePicker label="Début" required {...hours.start} />
              <TimePicker label="Fin" required {...hours.end} />
            </Group>
          )}
        </Stack>
      </Fieldset>
      {reading ? (
        <Group justify="flex-end">
          <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onClose}>
            Fermer
          </ActionButton>
        </Group>
      ) : (
        <Group gap={4}>
          <DeleteButton onClick={() => onDelete(saved.current.schedule, saved.current.slot)} />
        </Group>
      )}
    </Stack>
  );
}

/** Panel of a slot opened without choosing which days its changes apply to: read only. */
const SLOT_READING_NOTE = 'Lecture seule : aucune portée n’a été choisie à l’ouverture. Fermez le panneau et rouvrez-le pour modifier le créneau.';

/** What the changes of the panel of a slot apply to, by the scope chosen when it opened. */
const SLOT_SCOPE_NOTES: Record<CalendarEventScope, string> = {
  THIS: 'Ce jour seulement : c’est une exception, les autres jours du créneau ne changent pas.',
  FOLLOWING: 'Ce jour et les suivants.',
  ALL: 'Tous les jours de ces horaires.',
};

/** Day and times of one time of the day of a routine occurrence, as its panel edits them. */
interface OccurrenceValues extends Record<string, unknown> {
  date: string;
  fromTime: string | null;
  dueTime: string | null;
  optional: boolean;
}

/**
 * Panel of an occurrence of a routine from the calendar: its day and the times of one of its times of the day, each
 * saved as soon as it changes (decision D22) for the occurrences chosen when the panel opened (`scope`: this one, an
 * exception; it and the following ones; all; null: none chosen, read only); or cancelling it; or opening the routine.
 * The occurrence of the cache is followed (moved or changed elsewhere). A cancelled occurrence is only given back
 * (« Rétablir »); one of an archived routine is read only, also when the routine is archived elsewhere while the panel
 * is open.
 * @param {{ occurrence: RoutineOccurrenceRef, movedFrom: string | null, scope: CalendarEventScope | null, onDelete: () => void, onRestore: () => void, onClose: () => void }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function RoutineOccurrenceForm({
  occurrence,
  movedFrom,
  scope,
  onDelete,
  onRestore,
  onClose,
}: {
  occurrence: RoutineOccurrenceRef;
  /** Day of the rule it was moved from, if any (finds it in the cache once moved). */
  movedFrom: string | null;
  scope: CalendarEventScope | null;
  onDelete: () => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const { changeOccurrence } = useRoutineMutations();
  // Its day now: a save that moves it moves the occurrence the next one changes.
  const day = useRef(occurrence.date);
  // Its day in the rule: the occurrence of the cache is the one of that day, wherever it is now.
  const ruleDay = movedFrom ?? occurrence.date;
  const current = useCachedItem(
    [...routinesKey, 'occurrences'],
    (items: RoutineOccurrence[]) => items,
    (item: RoutineOccurrence) => item.routineId === occurrence.routine.id && (item.movedFrom || item.date) === ruleDay,
  );
  const currentSlot = current?.slots.find((slot) => slot.index === occurrence.slot.index);
  // Its routine as the cache holds it: archived elsewhere while open, it turns read only (a coming occurrence leaves the
  // cache of the occurrences then, the opened copy would stay editable).
  const { data: routines } = useRoutinesData();
  const archived = occurrence.archived || Boolean(routines?.routines.find((routine) => routine.id === occurrence.routine.id)?.archived);
  const base = useAppForm<OccurrenceValues>({
    initialValues: { date: occurrence.date, fromTime: occurrence.slot.fromTime, dueTime: occurrence.slot.dueTime, optional: false },
    schema: routineSlotSchema,
  });
  const reading = scope === null;
  const { form, saving } = useFieldSave(base, {
    save:
      occurrence.cancelled || archived || scope === null
        ? null
        : async (_changes, values) => {
            await changeOccurrence.mutateAsync({
              id: occurrence.routine.id,
              date: day.current,
              scope,
              to: values.date,
              slot: occurrence.slot.index,
              fromTime: values.fromTime,
              dueTime: values.dueTime,
            });
            day.current = values.date;
          },
    schema: routineSlotSchema,
    saved: current && currentSlot ? { date: current.date, fromTime: currentSlot.fromTime, dueTime: currentSlot.dueTime, optional: false } : undefined,
  });
  // Moved elsewhere (another tab, the calendar): the next saves change it where it is now.
  useEffect(() => {
    if (current && !saving) day.current = current.date;
  }, [current, saving]);
  const hours = rangeProps(
    {
      value: [form.values.fromTime ?? '', form.values.dueTime ?? ''],
      onChange: ([from, due]) => form.setValues({ fromTime: from || null, dueTime: due || null }),
    },
    true,
  );
  const openRoutine = (
    <ActionButton
      priority="tertiary"
      icon={<ArrowSquareOutIcon aria-hidden />}
      onClick={() => {
        onClose();
        openRoutineForm({ routine: occurrence.routine, occurrenceDate: day.current });
      }}
    >
      Ouvrir la routine
    </ActionButton>
  );
  if (occurrence.cancelled || archived) {
    return (
      <Stack gap="md">
        <Text size="sm">
          {archived
            ? 'La routine est archivée : cette occurrence est en lecture seule. Restaurez la routine pour la modifier.'
            : 'Cette occurrence est annulée : elle reste affichée, barrée, avec ses commentaires.'}
        </Text>
        <Group justify="space-between" gap="sm">
          {openRoutine}
          <Group gap="sm">
            <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onClose}>
              Fermer
            </ActionButton>
            {!archived && (
              <ActionButton icon={<ArrowCounterClockwiseIcon aria-hidden />} onClick={onRestore}>
                Rétablir
              </ActionButton>
            )}
          </Group>
        </Group>
      </Stack>
    );
  }
  return (
    <Stack gap="md">
      {!reading && <SaveStatus saving={saving} />}
      <Text size="sm" c="dimmed">
        {scope === null ? READING_NOTE : SCOPE_NOTES[scope]}
      </Text>
      <Fieldset variant="unstyled" disabled={reading} p={0} m={0}>
        <Stack gap="md">
          <DatePickerInput
            label="Jour"
            required
            valueFormat={PICKER_FORMATS.weekday}
            minDate={occurrence.routine.startDate}
            {...form.getInputProps('date')}
            onChange={(value) => value && form.setFieldValue('date', value)}
          />
          <Group gap="sm" grow>
            <TimePicker label="À partir de" {...hours.start} />
            <TimePicker label="Avant" {...hours.end} error={form.errors.dueTime ?? hours.end.error} />
          </Group>
        </Stack>
      </Fieldset>
      {reading ? (
        <Group justify="space-between" gap="sm">
          {openRoutine}
          <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onClose}>
            Fermer
          </ActionButton>
        </Group>
      ) : (
        <Group gap={4}>
          <DeleteButton onClick={onDelete} />
          {openRoutine}
        </Group>
      )}
    </Stack>
  );
}

/** Panel of a routine occurrence opened without choosing which occurrences its changes apply to: read only. */
const READING_NOTE = 'Lecture seule : aucune portée n’a été choisie à l’ouverture. Fermez le panneau et rouvrez-le pour modifier l’occurrence.';

/** What the changes of the panel of a routine occurrence apply to, by the scope chosen when it opened. */
const SCOPE_NOTES: Record<CalendarEventScope, string> = {
  THIS: 'Cette occurrence seulement : c’est une exception, la règle ne change pas.',
  FOLLOWING: 'Cette occurrence et les suivantes.',
  ALL: 'Toutes les occurrences.',
};
