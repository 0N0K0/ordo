import { PICKER_FORMATS } from '../../../lib/format';
import { ArrowCounterClockwiseIcon, ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react';
import { DeleteButton } from '../../../components/dialogs/DestructiveActions';
import { Group, Stack, Text, Switch } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import type { ScheduleSlotTime } from '@ordo/shared';
import { useState } from 'react';
import { openRoutineForm } from '../../routines/lib/open-routine-form';
import type { RoutineOccurrenceRef } from '../hooks/calendar-edits';
import { FormActions } from '../../../components/dialogs/FormActions';
import { rangeError, rangeProps } from '../../../components/inputs/date-range';
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

/**
 * Form changing an occurrence of a routine from the calendar: its day and the times of one of its times of the day; or
 * cancelling it; or opening the routine. A cancelled occurrence is only given back (« Rétablir »); one of an archived
 * routine is read only.
 * @param {{ occurrence: RoutineOccurrenceRef, onSave: (to: string, times: { fromTime: string | null, dueTime: string | null }) => void, onDelete: () => void, onRestore: () => void, onClose: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RoutineOccurrenceForm({
  occurrence,
  onSave,
  onDelete,
  onRestore,
  onClose,
}: {
  occurrence: RoutineOccurrenceRef;
  onSave: (to: string, times: { fromTime: string | null; dueTime: string | null }) => void;
  onDelete: () => void;
  onRestore: () => void;
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
  const openRoutine = (
    <ActionButton
      priority="tertiary"
      icon={<ArrowSquareOutIcon aria-hidden />}
      onClick={() => {
        onClose();
        openRoutineForm({ routine: occurrence.routine, occurrenceDate: occurrence.date });
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
              {openRoutine}
            </>
          }
        />
      </Stack>
    </form>
  );
}
