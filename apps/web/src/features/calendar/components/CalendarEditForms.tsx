import { PICKER_FORMATS } from '../../../lib/format';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { DeleteButton } from '../../../components/dialogs/DestructiveActions';
import { Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import type { ScheduleSlotTime } from '@ordo/shared';
import { useState } from 'react';
import { openRoutineForm } from '../../routines/lib/open-routine-form';
import type { RoutineOccurrenceRef } from '../hooks/calendar-edits';
import { FormActions } from '../../../components/dialogs/FormActions';
import { rangeError, rangeProps } from '../../../components/inputs/date-range';

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
          {name}
        </Text>
        <DatePickerInput label="Jour" required valueFormat={PICKER_FORMATS.weekday} value={value.date} onChange={(date) => date && setValue({ ...value, date: date })} data-autofocus />
        <Checkbox
          label="Toute la journée"
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
  const invalid = Boolean(rangeError(fromTime, dueTime, true));
  const hours = rangeProps(
    {
      value: [fromTime ?? '', dueTime ?? ''],
      onChange: ([from, due]) => {
        setFromTime(from || null);
        setDueTime(due || null);
      },
    },
    true,
  );
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
        <DatePickerInput label="Jour" required valueFormat={PICKER_FORMATS.weekday} minDate={occurrence.routine.startDate} value={date} onChange={(value) => value && setDate(value)} data-autofocus />
        <Group gap="sm" grow>
          <TimePicker label="À partir de" {...hours.start} />
          <TimePicker label="Avant" {...hours.end} />
        </Group>
        <FormActions
          onCancel={onClose}
          submitLabel="Enregistrer…"
          disabled={invalid || unchanged}
          danger={
            <>
              <DeleteButton onClick={onDelete} />
              <Button
                variant="subtle"
                leftSection={<ArrowSquareOutIcon aria-hidden />}
                onClick={() => {
                  onClose();
                  openRoutineForm({ routine: occurrence.routine });
                }}
              >
                Ouvrir la routine
              </Button>
            </>
          }
        />
      </Stack>
    </form>
  );
}
