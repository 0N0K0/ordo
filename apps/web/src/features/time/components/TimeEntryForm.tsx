import { SimpleGrid, Stack, TextInput } from '@mantine/core';
import { DateTimeField } from '../../../components/inputs/DateTimeField';
import { formDateTime } from '../../../components/inputs/date-fields';
import { durationText, parseDuration, timeEntryFormSchema, type TimeEntryFormValues } from '@ordo/shared';
import { parisInstant, parisParts, parisToday } from '../../../lib/dates';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';

import { ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { timeQueryKey, useTimeMutations, type TimeEntry, type TimeEntryValues } from '../api';
import { useCachedItem } from '../../../lib/mutation';
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
 * Input of the API from the values of the form (day and time in Paris).
 * @param {TimeEntryFormValues} values Values.
 * @returns {TimeEntryValues} Input.
 */
const entryInput = (values: TimeEntryFormValues): TimeEntryValues => ({
  projectId: values.projectId || null,
  routineIds: values.routineIds,
  taskIds: values.taskIds,
  description: values.description,
  startedAt: parisInstant(values.date, values.start).toISOString(),
  duration: parseDuration(values.duration)!,
  events: parseEventKeys(values.events),
});

/**
 * Input of the API for the fields of the form that changed only: the duration and the start of a time stay exact
 * (to the second) while they are not touched.
 * @param {Partial<TimeEntryFormValues>} changes Fields changed.
 * @param {TimeEntryFormValues} values All the values.
 * @returns {Partial<TimeEntryValues>} Input.
 */
const changedInput = (changes: Partial<TimeEntryFormValues>, values: TimeEntryFormValues): Partial<TimeEntryValues> => {
  // The duration is read only when it changed (an untouched one may be out of what can be typed).
  const all = entryInput(values);
  const fields: (keyof TimeEntryValues)[] = [
    ...('projectId' in changes ? (['projectId'] as const) : []),
    ...('routineIds' in changes ? (['routineIds'] as const) : []),
    ...('taskIds' in changes ? (['taskIds'] as const) : []),
    ...('description' in changes ? (['description'] as const) : []),
    ...('events' in changes ? (['events'] as const) : []),
    ...('date' in changes || 'start' in changes ? (['startedAt'] as const) : []),
    ...('duration' in changes ? (['duration'] as const) : []),
  ];
  return Object.fromEntries(fields.map((field) => [field, all[field]]));
};

/**
 * Day of a time from the day typed (a Paris day, as the API reads it: the events of that day are offered); today while
 * the day is not typed.
 * @param {string} date Day typed (YYYY-MM-DD).
 * @returns {string} Day in Paris.
 */
const entryDay = (date: string): string => date || parisToday();

/**
 * Values of the form of an existing time (its day and start time in Paris, its duration as « h:mm »).
 * @param {TimeEntry} entry Time.
 * @returns {TimeEntryFormValues} Values.
 */
const timeEntryFormValues = (entry: TimeEntry): TimeEntryFormValues => {
  const { date, time } = parisParts(entry.startedAt);
  // A chrono of a few seconds (or none) shows « 0:00 ».
  const minutes = Math.round((entry.duration ?? 0) / 60);
  return {
    projectId: entry.projectId ?? '',
    routineIds: entry.routines.map((routine) => routine.id),
    taskIds: entry.taskIds,
    events: entryEventKeys(entry),
    description: entry.description ?? '',
    date,
    start: time,
    duration: durationText(minutes),
  };
};

/** Fields of a time saved on leaving them, in its panel. */
const ON_BLUR = ['duration', 'description'] as const;

/**
 * Time added by hand, or edited: project, day, start time, duration, routines, tasks, the calendar events it was spent
 * on (several of each) and description; at least a project, a task, a routine or an event.
 * A new time is a form with « Ajouter »; an existing one, its panel, saves each field as soon as it changes (the
 * duration and the description on leaving them, `useFieldSave`).
 * @param {TimeEntryFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function TimeEntryForm({ context, entry, defaultProjectId, onDone }: TimeEntryFormProps) {
  const { create, update } = useTimeMutations();
  const base = useAppForm<TimeEntryFormValues>({
    initialValues: entry
      ? timeEntryFormValues(entry)
      : { projectId: defaultProjectId ?? '', routineIds: [], taskIds: [], events: [], description: '', date: parisToday(), start: '09:00', duration: '1:00' },
    schema: timeEntryFormSchema,
  });
  // The time of the cache followed (changed in a cell, another tab), whatever list holds it.
  const current = useCachedItem(
    timeQueryKey,
    (entries: TimeEntry[] | TimeEntry | null) => (Array.isArray(entries) ? entries : []),
    (item: TimeEntry) => item.id === entry?.id,
  );
  const { form, saving, fieldProps } = useFieldSave(base, {
    save: entry ? (changes, values) => update.mutateAsync({ id: entry.id, input: changedInput(changes, values) }) : null,
    schema: timeEntryFormSchema,
    saved: entry && timeEntryFormValues(current ?? entry),
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
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
            <DateTimeField label="Début" required maxDate={parisToday()} {...formDateTime(form, 'date', 'start')} />
            <TextInput label="Durée" required placeholder="1:30" description="1:30, 1h30, 90 ou 1,5h" {...form.getInputProps('duration')} />
          </SimpleGrid>
          <TimeSubjectsFields
            context={context}
            projectId={form.values.projectId || null}
            day={entryDay(form.values.date)}
            entry={entry}
            value={{ routineIds: form.values.routineIds, taskIds: form.values.taskIds, events: form.values.events }}
            onChange={(change) => form.setValues(change)}
            errors={{ routineIds: form.errors.routineIds, taskIds: form.errors.taskIds, events: form.errors.events }}
          />
          <MarkdownEditor label="Description" placeholder="Ce que vous avez fait…" {...fieldProps('description')} suggestions={context.suggestionsFor(form.values.projectId || null)} minRows={3} />
          {!entry && <FormActions onCancel={onDone} submitLabel="Ajouter" loading={create.isPending} />}
        </Stack>
      </form>
      {entry && <Comments target="TIME_ENTRY" id={entry!.id} projectId={entry!.projectId ?? null} />}
    </Stack>
  );
}
