import { Select, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { parseDuration, timeEntryFormSchema, type TimeEntryFormValues, twoDigits } from '@ordo/shared';
import { localInstant, localParts, localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks } from '../../../lib/form';

import { ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useCalendarEvents } from '../../calendar/api';
import { useTimeMutations, type TimeEntry } from '../api';
import { TimeTasksSelect } from './TimeTasksSelect';
import { dayEventOptions, entryEventKey, parseEventKey } from '../lib/time-events';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { Comments } from '../../comments/components/Comments';
import { useRoutinesData } from '../../routines/api';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { routineTreeOptions } from '../../routines/lib/routine-format';
import { FormActions } from '../../../components/dialogs/FormActions';

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
 * Time added by hand, or edited: project, routine, tasks, day, start time, duration, the calendar event it was spent
 * on and description; at least a project, a task, a routine or an event (decision D17).
 * @param {TimeEntryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function TimeEntryForm({ context, entry, defaultProjectId, copy = false, onDone }: TimeEntryFormProps) {
  const { create, update } = useTimeMutations();
  const { data: routinesData } = useRoutinesData();
  const parts = entry ? localParts(entry.startedAt) : null;
  const initial = parts ? { date: parts.date, start: parts.time } : { date: localToday(), start: '09:00' };
  const minutes = entry?.duration ? Math.round(entry.duration / 60) : 60;
  const form = useAppForm<TimeEntryFormValues>({
    initialValues: {
      projectId: entry?.projectId ?? defaultProjectId ?? '',
      routineId: entry?.routineId ?? null,
      taskIds: entry?.taskIds ?? [],
      eventKey: entry ? entryEventKey(entry) : null,
      description: entry?.description ?? '',
      date: initial.date,
      start: initial.start,
      duration: `${Math.floor(minutes / 60)}:${twoDigits(minutes % 60)}`,
    },
    schema: timeEntryFormSchema,
  });

  // The event the time was spent on: one of the events of its day.
  const eventKey = form.values.eventKey;
  const { data: dayEvents } = useCalendarEvents(form.values.date ? { from: form.values.date, to: form.values.date } : null);
  const eventOptions = dayEventOptions(dayEvents ?? [], form.values.date);
  // The event of the entry stays listed while its day is shown, even when it moved.
  if (eventKey && !eventOptions.some((option) => option.value === eventKey) && entry?.calendarEventLabel) eventOptions.push({ value: eventKey, label: entry.calendarEventLabel });

  const handleSubmit = form.onSubmit((values) => {
    const input = {
      projectId: values.projectId || null,
      routineId: values.routineId,
      taskIds: values.taskIds,
      description: values.description,
      // Local day and time.
      startedAt: localInstant(values.date, values.start).toISOString(),
      duration: parseDuration(values.duration)!,
      event: parseEventKey(values.eventKey),
    };
    const callbacks = formCallbacks(form, copy ? 'Temps dupliqué.' : entry ? 'Temps modifié.' : 'Temps ajouté.', onDone);
    if (entry && !copy) update.mutate({ id: entry.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  return (
    <Stack gap="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          <ProjectSelect
            context={context}
            label="Projet"
            description="Facultatif avec une tâche, une routine ou un évènement."
            clearable
            data-autofocus
            {...form.getInputProps('projectId')}
            onChange={(projectId) => {
              form.setFieldValue('projectId', projectId ?? '');
              form.setFieldValue('taskIds', []);
            }}
          />
          <Select
            label="Routine"
            placeholder="Aucune"
            clearable
            searchable
            {...treeSelectProps(routineTreeOptions(routinesData?.routines ?? [], (routine) => !routine.archived || routine.id === form.values.routineId))}
            {...form.getInputProps('routineId')}
          />
          <TimeTasksSelect
            context={context}
            projectId={form.values.projectId || null}
            value={form.values.taskIds}
            onChange={(taskIds) => form.setFieldValue('taskIds', taskIds)}
            error={form.errors.taskIds}
          />
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
            <DatePickerInput label="Jour" required {...form.getInputProps('date')} />
            <TimePicker label="Début" required {...form.getInputProps('start')} />
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
            onChange={(key) => form.setFieldValue('eventKey', key)}
            error={form.errors.calendarEventId}
          />
          <MarkdownEditor
            label="Description"
            placeholder="Ce que vous avez fait…"
            value={form.values.description}
            onChange={(description) => form.setFieldValue('description', description)}
            suggestions={context.suggestionsFor(form.values.projectId || null)}
            minRows={3}
          />
          <FormActions onCancel={onDone} submitLabel={entry && !copy ? 'Enregistrer' : 'Ajouter'} loading={create.isPending || update.isPending} />
        </Stack>
      </form>
      {entry && !copy && <Comments target="TIME_ENTRY" id={entry!.id} projectId={entry!.projectId ?? null} />}
    </Stack>
  );
}
