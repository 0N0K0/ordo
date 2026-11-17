import { TimeField } from '../../components/TimeField';
import { NumberInput, SegmentedControl, SimpleGrid, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { alarmInputSchema, alarmRule, type AlarmType, type Recurrence } from '@ordo/shared';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { ProjectSelect, TaskSelect } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import { timeTasks } from '../time/time-tasks';
import { legacyFields } from './alarm-labels';
import * as fmt from '../../lib/format';
import { describeRecurrence } from '../../components/recurrence/describe-recurrence';
import { RepetitionEditor } from '../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../components/recurrence/RepetitionField';
import { useAlarmMutations, type Alarm, type AlarmInput } from './api';
import { FormActions } from '../../components/dialogs/FormActions';

const TYPES: { value: AlarmType; label: string }[] = [
  { value: 'REMINDER', label: 'Rappel' },
  { value: 'NOT_TRACKING', label: 'Si pas de chrono' },
  { value: 'TRACKING_DURATION', label: 'Pendant le chrono' },
];

const TYPE_HELP: Record<AlarmType, string> = {
  REMINDER: 'Sonne aux dates et heures prévues.',
  NOT_TRACKING: 'Sonne aux dates et heures prévues, seulement si aucun chrono ne tourne (ex. « Lance ton chrono » à 9 h).',
  TRACKING_DURATION: 'Sonne après chaque durée de chrono (ex. une pause toutes les 50 minutes).',
};

/** Date, time and repetition of an alarm. */
interface AlarmTiming {
  startDate: string | null;
  time: string | null;
  recurrence: Recurrence | null;
}

/**
 * Date, time and repetition of an alarm as text: "Le 3 novembre 2026 à 09:00", "Tous les jours à 07:30".
 * @param {AlarmTiming} timing Timing.
 * @returns {string} Text.
 */
function describeTiming(timing: AlarmTiming): string {
  const at = timing.time ? ` à ${timing.time}` : '';
  if (!timing.recurrence || !timing.startDate) return `Le ${timing.startDate ? fmt.day(timing.startDate) : '—'}${at}`;
  return `${fmt.capitalize(describeRecurrence(timing.recurrence, timing.startDate))}${at}`;
}

interface AlarmFormValues extends Record<string, unknown> {
  title: string;
  note: string;
  type: AlarmType;
  startDate: string | null;
  time: string | null;
  recurrence: Recurrence | null;
  minutes: number | null;
  projectId: string | null;
  taskId: string | null;
  enabled: boolean;
}

/** Values a new alarm starts with (e.g. the task it is created from). */
export interface AlarmDefaults {
  title?: string;
  projectId?: string | null;
  taskId?: string | null;
}

interface AlarmFormProps {
  context: TaskContext;
  alarm?: Alarm;
  /** The alarm is copied into a new one. */
  copy?: boolean;
  /** Values of a new alarm. */
  defaults?: AlarmDefaults;
  onDone: () => void;
}

/**
 * Alarm creation / edition: title, type, schedule (date, time, repetition, weekdays, end) or tracking
 * duration, optional project or task, note.
 * @param {AlarmFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function AlarmForm({ context, alarm, copy = false, defaults, onDone }: AlarmFormProps) {
  const { create, update } = useAlarmMutations();
  const form = useAppForm<AlarmFormValues>({
    initialValues: {
      title: alarm ? (copy ? `${alarm.title} (copie)` : alarm.title) : (defaults?.title ?? ''),
      note: alarm?.note ?? '',
      type: alarm?.type ?? 'REMINDER',
      startDate: alarm?.startDate ?? localToday(),
      time: alarm?.time ?? '09:00',
      recurrence: alarm ? alarmRule(alarm) : null,
      minutes: alarm?.minutes ?? 50,
      projectId: alarm ? alarm.projectId : (defaults?.projectId ?? null),
      taskId: alarm ? alarm.taskId : (defaults?.taskId ?? null),
      enabled: alarm?.enabled ?? true,
    },
    schema: alarmInputSchema,
  });
  const { type } = form.values;
  const tracking = type === 'TRACKING_DURATION';

  const handleSubmit = form.onSubmit((values) => {
    const input: AlarmInput = { ...values, ...legacyFields(values.recurrence), note: values.note || null, minutes: tracking ? values.minutes : null };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(copy ? 'Alarme dupliquée.' : alarm ? 'Alarme modifiée.' : 'Alarme créée.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (alarm && !copy) update.mutate({ id: alarm.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Titre" required data-autofocus placeholder="Appeler le client, faire une pause…" {...form.getInputProps('title')} />
        <Stack gap={4}>
          <SegmentedControl
            fullWidth
            data={TYPES}
            value={type}
            onChange={(value) => form.setFieldValue('type', value as AlarmType)}
            aria-label="Type d’alarme"
          />
          <Text size="xs" c="dimmed">
            {TYPE_HELP[type]}
          </Text>
        </Stack>

        {tracking ? (
          <NumberInput
            label="Toutes les"
            suffix=" min de chrono"
            min={1}
            max={24 * 60}
            required
            {...form.getInputProps('minutes')}
            onChange={(value) => form.setFieldValue('minutes', typeof value === 'number' ? value : null)}
          />
        ) : (
          <RepetitionField<AlarmTiming>
            label="Date, heure et répétition"
            required
            error={(form.errors.startDate ?? form.errors.time ?? form.errors.recurrence) as string | undefined}
            value={{ startDate: form.values.startDate, time: form.values.time, recurrence: form.values.recurrence }}
            onChange={(timing) => form.setValues({ ...timing })}
            valid={(draft) => Boolean(draft.startDate && draft.time)}
            describe={(timing) => (timing.startDate ? [describeTiming(timing)] : [])}
            editor={(draft, setDraft) => (
              <RepetitionEditor<null>
                mode="RULE"
                onModeChange={() => undefined}
                cases={[{ since: null, until: null, anchor: null, rule: draft.recurrence, times: null }]}
                onChange={(cases) => setDraft({ ...draft, recurrence: cases[0]?.rule ?? null })}
                start={draft.startDate ?? localToday()}
                footer={
                  <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
                    <DatePickerInput label={draft.recurrence ? 'À partir du' : 'Date'} required value={draft.startDate} onChange={(startDate) => startDate && setDraft({ ...draft, startDate })} />
                    <TimeField label="Heure" required value={draft.time ?? ''} onChange={(time) => setDraft({ ...draft, time: time || null })} />
                  </SimpleGrid>
                }
              />
            )}
          />
        )}

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <ProjectSelect
            context={context}
            label="Projet"
            clearable
            placeholder="Aucun"
            {...form.getInputProps('projectId')}
            onChange={(projectId) => {
              form.setFieldValue('projectId', projectId);
              form.setFieldValue('taskId', null);
            }}
          />
          <TaskSelect
            context={context}
            labelOf={(task) => context.taskLabel(task, form.values.projectId)}
            label="Tâche"
            placeholder={form.values.projectId ? 'Aucune' : 'Choisissez d’abord un projet'}
            disabled={!form.values.projectId}
            tasks={timeTasks(context, form.values.projectId, form.values.taskId ? [form.values.taskId] : [])}
            {...form.getInputProps('taskId')}
          />
        </SimpleGrid>
        <Textarea label="Note" autosize minRows={2} maxRows={8} {...form.getInputProps('note')} />
        <Switch label="Active" {...form.getInputProps('enabled', { type: 'checkbox' })} />
        <FormActions onCancel={onDone} submitLabel={alarm && !copy ? 'Enregistrer' : 'Créer l’alarme'} loading={create.isPending || update.isPending} />
      </Stack>
    </form>
  );
}
