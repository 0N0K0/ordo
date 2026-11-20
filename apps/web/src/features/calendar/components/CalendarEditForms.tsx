import { PICKER_FORMATS } from '../../../lib/format';
import { ArrowCounterClockwiseIcon, ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react';
import { DeleteButton } from '../../../components/dialogs/DestructiveActions';
import { Fieldset, Group, Stack, Text, Switch } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { routineSlotSchema, type ScheduleSlotTime } from '@ordo/shared';
import { useEffect, useRef, useState } from 'react';
import { openRoutineForm } from '../../routines/lib/open-routine-form';
import type { RoutineOccurrenceRef } from '../hooks/calendar-edits';
import { FormActions } from '../../../components/dialogs/FormActions';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { useAppForm, useFieldSave } from '../../../lib/form';
import { routinesKey, useRoutineMutations, type RoutineOccurrence } from '../../routines/api';
import { useCachedItem } from '../../../lib/mutation';
import type { CalendarEventScope } from '../api';
import { rangeProps } from '../../../components/inputs/date-range';
import { ActionButton } from '../../../components/actions/ActionButton';

/**
 * Form changing a slot of a schedule from the calendar: its day and hours (or the whole day); or deleting it.
 * @param {{ label: string, slot: ScheduleSlotTime, onSave: (change: ScheduleSlotTime) => void, onDelete: () => void, onClose: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function SlotEditForm({
  label,
  slot,
  onSave,
  onDelete,
  onClose,
}: {
  label: string;
  slot: ScheduleSlotTime;
  onSave: (change: ScheduleSlotTime) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(slot);
  const invalid = !value.allDay && (!value.start || !value.end || value.end <= value.start);
  const hours = rangeProps({ value: [value.start, value.end], onChange: ([start, end]) => setValue({ ...value, start, end }) }, true);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) onSave(value);
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <DatePickerInput label="Jour" required valueFormat={PICKER_FORMATS.weekday} value={value.date} onChange={(date) => date && setValue({ ...value, date: date })} data-autofocus />
        <Switch
          label="Journée entière"
          checked={value.allDay}
          onChange={(event) => setValue(event.currentTarget.checked ? { ...value, allDay: true, start: '00:00', end: '24:00' } : { ...value, allDay: false, start: '09:00', end: '17:00' })}
        />
        {!value.allDay && (
          <Group gap="sm" grow>
            <TimePicker label="Début" required {...hours.start} />
            <TimePicker label="Fin" required {...hours.end} />
          </Group>
        )}
        <FormActions onCancel={onClose} submitLabel="Enregistrer…" disabled={invalid} danger={<DeleteButton onClick={onDelete} />} />
      </Stack>
    </form>
  );
}

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
 * (« Rétablir »); one of an archived routine is read only.
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
  const base = useAppForm<OccurrenceValues>({
    initialValues: { date: occurrence.date, fromTime: occurrence.slot.fromTime, dueTime: occurrence.slot.dueTime, optional: false },
    schema: routineSlotSchema,
  });
  const reading = scope === null;
  const { form, saving } = useFieldSave(base, {
    save:
      occurrence.cancelled || occurrence.archived || scope === null
        ? null
        : async (_changes, values) => {
            await changeOccurrence.mutateAsync({ id: occurrence.routine.id, date: day.current, scope, to: values.date, slot: occurrence.slot.index, fromTime: values.fromTime, dueTime: values.dueTime });
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
  if (occurrence.cancelled || occurrence.archived) {
    return (
      <Stack gap="md">
        <Text size="sm">
          {occurrence.archived
            ? 'La routine est archivée : cette occurrence passée est en lecture seule. Restaurez la routine pour la modifier.'
            : 'Cette occurrence est annulée : elle reste affichée, barrée, avec ses commentaires.'}
        </Text>
        <Group justify="space-between" gap="sm">
          {openRoutine}
          <Group gap="sm">
            <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onClose}>
              Fermer
            </ActionButton>
            {!occurrence.archived && (
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
          <DatePickerInput label="Jour" required valueFormat={PICKER_FORMATS.weekday} minDate={occurrence.routine.startDate} {...form.getInputProps('date')} onChange={(value) => value && form.setFieldValue('date', value)} />
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
