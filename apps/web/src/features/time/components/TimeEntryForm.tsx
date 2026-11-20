import { SimpleGrid, Stack, TextInput } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { parseDuration, timeEntryFormSchema, type TimeEntryFormValues, twoDigits } from '@ordo/shared';
import { localInstant, localParts, localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks } from '../../../lib/form';

import { ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeMutations, type TimeEntry } from '../api';
import { TimeSubjectsFields } from './TimeSubjectsFields';
import { entryEventKeys, parseEventKeys } from '../lib/time-events';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { Comments } from '../../comments/components/Comments';
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
 * Time added by hand, or edited: project, day, start time, duration, routines, tasks, the calendar events it was spent
 * on (several of each, decision D18) and description; at least a project, a task, a routine or an event (decision D17).
 * @param {TimeEntryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function TimeEntryForm({ context, entry, defaultProjectId, copy = false, onDone }: TimeEntryFormProps) {
  const { create, update } = useTimeMutations();
  const parts = entry ? localParts(entry.startedAt) : null;
  const initial = parts ? { date: parts.date, start: parts.time } : { date: localToday(), start: '09:00' };
  const minutes = entry?.duration ? Math.round(entry.duration / 60) : 60;
  const form = useAppForm<TimeEntryFormValues>({
    initialValues: {
      projectId: entry?.projectId ?? defaultProjectId ?? '',
      routineIds: entry?.routines.map((routine) => routine.id) ?? [],
      taskIds: entry?.taskIds ?? [],
      events: entry ? entryEventKeys(entry) : [],
      description: entry?.description ?? '',
      date: initial.date,
      start: initial.start,
      duration: `${Math.floor(minutes / 60)}:${twoDigits(minutes % 60)}`,
    },
    schema: timeEntryFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    const input = {
      projectId: values.projectId || null,
      routineIds: values.routineIds,
      taskIds: values.taskIds,
      description: values.description,
      // Local day and time.
      startedAt: localInstant(values.date, values.start).toISOString(),
      duration: parseDuration(values.duration)!,
      events: parseEventKeys(values.events),
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
              // Tasks and routines go with the project tree (the API's rule).
              form.setValues({ taskIds: [], routineIds: [] });
            }}
          />
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
            <DatePickerInput label="Jour" required {...form.getInputProps('date')} />
            <TimePicker label="Début" required {...form.getInputProps('start')} />
            <TextInput label="Durée" required placeholder="1:30" description="1:30, 1h30, 90 ou 1,5h" {...form.getInputProps('duration')} />
          </SimpleGrid>
          <TimeSubjectsFields
            context={context}
            projectId={form.values.projectId || null}
            day={form.values.date || localToday()}
            entry={entry}
            value={{ routineIds: form.values.routineIds, taskIds: form.values.taskIds, events: form.values.events }}
            onChange={(change) => form.setValues(change)}
            errors={{ routineIds: form.errors.routineIds, taskIds: form.errors.taskIds, events: form.errors.events }}
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
