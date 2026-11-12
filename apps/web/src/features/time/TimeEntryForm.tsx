import { TimeField } from '../../components/TimeField';
import { Button, Group, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { parseDuration, timeEntryFormSchema, type TimeEntryFormValues } from '@ordo/shared';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { ProjectSelect } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import { useCalendarEvents } from '../calendar/api';
import { useTimeMutations, type TimeEntry } from './api';
import { TimeTasksSelect } from './TimeTasksSelect';

/**
 * Local "YYYY-MM-DD" and "HH:MM" of an instant.
 * @param {Date} date Instant.
 * @returns {{ date: string, start: string }} Local day and time.
 */
function localParts(date: Date): { date: string; start: string } {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
  return { date: local.slice(0, 10), start: local.slice(11, 16) };
}

interface TimeEntryFormProps {
  context: TaskContext;
  /** Entry to edit (finished entries only). */
  entry?: TimeEntry;
  /** Project of a new entry. */
  defaultProjectId?: string;
  /** The entry is copied into a new one (not billed). */
  copy?: boolean;
  onDone: () => void;
}

/**
 * Time added by hand, or edited: project, tasks, day, start time, duration, the calendar event it was spent
 * on and description.
 * @param {TimeEntryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function TimeEntryForm({ context, entry, defaultProjectId, copy = false, onDone }: TimeEntryFormProps) {
  const { create, update } = useTimeMutations();
  const initial = entry ? localParts(new Date(entry.startedAt)) : { date: localToday(), start: '09:00' };
  const minutes = entry?.duration ? Math.round(entry.duration / 60) : 60;
  const form = useAppForm<TimeEntryFormValues>({
    initialValues: {
      projectId: entry?.projectId ?? defaultProjectId ?? '',
      routineId: entry?.routineId ?? null,
      taskIds: entry?.taskIds ?? [],
      description: entry?.description ?? '',
      date: initial.date,
      start: initial.start,
      duration: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`,
    },
    schema: timeEntryFormSchema,
  });

  // The event the time was spent on: one of the events of its day.
  const [eventKey, setEventKey] = useState<string | null>(entry?.calendarEventId ? `${entry.calendarEventId}|${entry.calendarOccurrenceDate ? String(entry.calendarOccurrenceDate) : ''}` : null);
  const { data: dayEvents } = useCalendarEvents(form.values.date ? { from: form.values.date, to: form.values.date } : null);
  const eventOptions = (dayEvents ?? [])
    .filter((occurrence) => !occurrence.allDay || occurrence.startDate <= form.values.date)
    .map((occurrence) => ({
      value: `${occurrence.eventId}|${occurrence.occurrenceDate ?? ''}`,
      label: `${occurrence.allDay ? 'Journée' : `${occurrence.startTime}–${occurrence.endTime}`} · ${occurrence.title}${occurrence.calledOff ? ' (annulé)' : ''}`,
    }));
  // The event of the entry stays listed while its day is shown, even when it moved.
  if (eventKey && !eventOptions.some((option) => option.value === eventKey) && entry?.calendarEventTitle) eventOptions.push({ value: eventKey, label: entry.calendarEventTitle });

  const handleSubmit = form.onSubmit((values) => {
    const input = {
      projectId: values.projectId || null,
      routineId: values.routineId,
      taskIds: values.taskIds,
      description: values.description,
      // Local day and time.
      startedAt: new Date(`${values.date}T${values.start}`).toISOString(),
      duration: parseDuration(values.duration)!,
      event: eventKey ? { eventId: eventKey.split('|')[0], occurrenceDate: eventKey.split('|')[1] || null } : null,
    };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(copy ? 'Temps dupliqué.' : entry ? 'Temps modifié.' : 'Temps ajouté.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (entry && !copy) update.mutate({ id: entry.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <ProjectSelect
          context={context}
          label="Projet"
          required={!form.values.routineId}
          description={entry?.routineTitle ? `Temps de la routine « ${entry.routineTitle} » : le projet est facultatif.` : undefined}
          clearable={Boolean(form.values.routineId)}
          data-autofocus
          {...form.getInputProps('projectId')}
          onChange={(projectId) => {
            form.setFieldValue('projectId', projectId ?? '');
            form.setFieldValue('taskIds', []);
          }}
        />
        <TimeTasksSelect
          context={context}
          projectId={form.values.projectId || null}
          value={form.values.taskIds}
          onChange={(taskIds) => form.setFieldValue('taskIds', taskIds)}
          error={form.errors.taskIds}
        />
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
          <DatePickerInput label="Jour" required valueFormat="D MMM YYYY" {...form.getInputProps('date')} />
          <TimeField label="Début" required {...form.getInputProps('start')} />
          <TextInput label="Durée" required placeholder="1:30" description="1:30, 1h30, 90 ou 1,5h" {...form.getInputProps('duration')} />
        </SimpleGrid>
        <Select
          label="Évènement"
          description="Le temps passé sur un évènement de l’agenda : seule la part hors de l’évènement y apparaît."
          placeholder={eventOptions.length ? 'Aucun' : 'Aucun évènement ce jour-là'}
          clearable
          searchable
          data={eventOptions}
          value={eventKey}
          onChange={setEventKey}
          error={form.errors.calendarEventId}
        />
        <Textarea label="Description" placeholder="Ce que vous avez fait…" autosize minRows={3} maxRows={12} {...form.getInputProps('description')} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {entry && !copy ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
