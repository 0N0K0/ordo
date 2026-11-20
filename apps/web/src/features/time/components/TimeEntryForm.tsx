import { SimpleGrid, Stack, TextInput } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { parseDuration, timeEntryFormSchema, type TimeEntryFormValues, twoDigits } from '@ordo/shared';
import { localInstant, localParts, localToday } from '../../../lib/dates';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';

import { ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeMutations, type TimeEntry, type TimeEntryValues } from '../api';
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
  onDone: () => void;
}

/**
 * Input of the API from the values of the form (local day and time).
 * @param {TimeEntryFormValues} values Values.
 * @returns {TimeEntryValues} Input.
 */
const entryInput = (values: TimeEntryFormValues): TimeEntryValues => ({
  projectId: values.projectId || null,
  routineIds: values.routineIds,
  taskIds: values.taskIds,
  description: values.description,
  startedAt: localInstant(values.date, values.start).toISOString(),
  duration: parseDuration(values.duration)!,
  events: parseEventKeys(values.events),
});

/** Fields of a time saved on leaving them, in its panel (decision D22). */
const ON_BLUR = ['duration', 'description'] as const;

/**
 * Time added by hand, or edited: project, day, start time, duration, routines, tasks, the calendar events it was spent
 * on (several of each, decision D18) and description; at least a project, a task, a routine or an event (decision D17).
 * A new time is a form with « Ajouter »; an existing one, its panel, saves each field as soon as it changes (the
 * duration and the description on leaving them, decision D22, `useFieldSave`).
 * @param {TimeEntryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function TimeEntryForm({ context, entry, defaultProjectId, onDone }: TimeEntryFormProps) {
  const { create, update } = useTimeMutations();
  const parts = entry ? localParts(entry.startedAt) : null;
  const initial = parts ? { date: parts.date, start: parts.time } : { date: localToday(), start: '09:00' };
  const minutes = entry?.duration ? Math.round(entry.duration / 60) : 60;
  const base = useAppForm<TimeEntryFormValues>({
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
  const { form, saving, commit } = useFieldSave(base, {
    save: entry ? (_changes, values) => update.mutateAsync({ id: entry.id, input: entryInput(values) }) : null,
    schema: timeEntryFormSchema,
    onBlur: ON_BLUR,
  });

  // A new time only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((values) => create.mutate(entryInput(values), formCallbacks(form, 'Temps ajouté.', onDone)));

  return (
    <Stack gap="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          {entry && <SaveStatus saving={saving} />}
          <ProjectSelect
            context={context}
            label="Projet"
            description="Facultatif avec une tâche, une routine ou un évènement."
            clearable
            data-autofocus={entry ? undefined : true}
            {...form.getInputProps('projectId')}
            // Tasks and routines go with the project tree (the API's rule): emptied with it, saved together.
            onChange={(projectId) => form.setValues({ projectId: projectId ?? '', taskIds: [], routineIds: [] })}
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
            onBlur={() => commit(['description'])}
            suggestions={context.suggestionsFor(form.values.projectId || null)}
            minRows={3}
          />
          {!entry && <FormActions onCancel={onDone} submitLabel="Ajouter" loading={create.isPending} />}
        </Stack>
      </form>
      {entry && <Comments target="TIME_ENTRY" id={entry!.id} projectId={entry!.projectId ?? null} />}
    </Stack>
  );
}
