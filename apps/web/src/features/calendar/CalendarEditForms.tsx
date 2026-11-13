import { DestructiveButton } from '../../components/dialogs/DestructiveActions';
import { Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import type { ScheduleSlotTime } from '@ordo/shared';
import { useState } from 'react';
import { TimeField } from '../../components/TimeField';
import { openRoutineForm } from '../routines/open-routine-form';
import type { RoutineOccurrenceRef } from './calendar-edits';

/**
 * Form changing a slot of a schedule from the calendar: its day and hours (or the whole day); or deleting it.
 * @param {{ name: string, slot: ScheduleSlotTime, onSave: (change: ScheduleSlotTime) => void, onDelete: () => void, onClose: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function SlotEditForm({
  name,
  slot,
  onSave,
  onDelete,
  onClose,
}: {
  name: string;
  slot: ScheduleSlotTime;
  onSave: (change: ScheduleSlotTime) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(slot);
  const invalid = !value.allDay && (!value.start || !value.end || value.end <= value.start);
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
          {name}
        </Text>
        <DatePickerInput label="Jour" required valueFormat="dddd D MMMM YYYY" value={value.date} onChange={(date) => date && setValue({ ...value, date: String(date) })} data-autofocus />
        <Checkbox
          label="Toute la journée"
          checked={value.allDay}
          onChange={(event) => setValue(event.currentTarget.checked ? { ...value, allDay: true, start: '00:00', end: '24:00' } : { ...value, allDay: false, start: '09:00', end: '17:00' })}
        />
        {!value.allDay && (
          <Group gap="sm" grow>
            <TimeField label="Début" required value={value.start} onChange={(start) => setValue({ ...value, start })} />
            <TimeField
              label="Fin"
              required
              value={value.end}
              onChange={(end) => setValue({ ...value, end })}
              error={value.start && value.end && value.end <= value.start ? 'La fin doit suivre le début.' : undefined}
            />
          </Group>
        )}
        <Group justify="space-between" gap="sm">
          <DestructiveButton onClick={onDelete}>Supprimer…</DestructiveButton>
          <Group gap="sm">
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={invalid}>
              Enregistrer…
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Form changing an occurrence of a routine from the calendar: its day and the times of one of its times of the day; or
 * deleting it; or opening the routine.
 * @param {{ occurrence: RoutineOccurrenceRef, onSave: (to: string, times: { fromTime: string | null, dueTime: string | null }) => void, onDelete: () => void, onClose: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RoutineOccurrenceForm({
  occurrence,
  onSave,
  onDelete,
  onClose,
}: {
  occurrence: RoutineOccurrenceRef;
  onSave: (to: string, times: { fromTime: string | null; dueTime: string | null }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(occurrence.date);
  const [fromTime, setFromTime] = useState(occurrence.slot.fromTime);
  const [dueTime, setDueTime] = useState(occurrence.slot.dueTime);
  const invalid = Boolean(fromTime && dueTime && dueTime <= fromTime);
  const unchanged = date === occurrence.date && fromTime === occurrence.slot.fromTime && dueTime === occurrence.slot.dueTime;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid && !unchanged) onSave(date, { fromTime, dueTime });
      }}
    >
      <Stack gap="md">
        <DatePickerInput
          label="Jour"
          required
          valueFormat="dddd D MMMM YYYY"
          minDate={String(occurrence.routine.startDate)}
          value={date}
          onChange={(value) => value && setDate(String(value))}
          data-autofocus
        />
        <Group gap="sm" grow>
          <TimeField label="À partir de" value={fromTime ?? ''} onChange={(value) => setFromTime(value || null)} />
          <TimeField label="Avant" value={dueTime ?? ''} onChange={(value) => setDueTime(value || null)} error={invalid ? 'L’heure maximale doit suivre l’heure de début.' : undefined} />
        </Group>
        <Group justify="space-between" gap="sm">
          <Group gap="xs">
            <DestructiveButton onClick={onDelete}>Supprimer…</DestructiveButton>
            <Button
              variant="subtle"
              onClick={() => {
                onClose();
                openRoutineForm({ routine: occurrence.routine });
              }}
            >
              Ouvrir la routine
            </Button>
          </Group>
          <Group gap="sm">
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={invalid || unchanged}>
              Enregistrer…
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
