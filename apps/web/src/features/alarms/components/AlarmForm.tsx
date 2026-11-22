import { NumberInput, SegmentedControl, SimpleGrid, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core';
import { DateTimeField } from '../../../components/inputs/DateTimeField';
import { alarmInputSchema, alarmRule, type AlarmType, type Recurrence } from '@ordo/shared';
import { z } from 'zod';
import { localToday } from '../../../lib/dates';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';

import { ProjectSelect, TaskSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { timeTasks } from '../../time/lib/time-tasks';
import { describeAlarmTiming, legacyFields, type AlarmTiming } from '../lib/alarm-labels';
import { RuleEditor } from '../../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../../components/recurrence/RepetitionField';
import { useAlarmMutations, useAlarms, type Alarm, type AlarmInput } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { optionalNumberProps } from '../../../components/inputs/number-format';

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

interface AlarmFormValues extends Record<string, unknown> {
  label: string;
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
  label?: string;
  projectId?: string | null;
  taskId?: string | null;
}

interface AlarmFormProps {
  context: TaskContext;
  alarm?: Alarm;
  /** Values of a new alarm. */
  defaults?: AlarmDefaults;
  onDone: () => void;
}

/**
 * Values of the form of an existing alarm (also those its panel follows in the cache).
 * @param {Alarm} alarm Alarm.
 * @returns {AlarmFormValues} Values.
 */
function alarmFormValues(alarm: Alarm): AlarmFormValues {
  return {
    label: alarm.label,
    note: alarm.note ?? '',
    type: alarm.type,
    startDate: alarm.startDate ?? localToday(),
    time: alarm.time ?? '09:00',
    recurrence: alarmRule(alarm),
    minutes: alarm.minutes ?? 50,
    projectId: alarm.projectId,
    taskId: alarm.taskId,
    enabled: alarm.enabled,
  };
}

/**
 * Input of the API from the values of the form: the minutes of a tracking alarm only.
 * @param {AlarmFormValues} values Values.
 * @returns {AlarmInput} Input.
 */
const alarmInputOf = (values: AlarmFormValues): AlarmInput => ({
  ...values,
  ...legacyFields(values.recurrence),
  note: values.note || null,
  minutes: values.type === 'TRACKING_DURATION' ? values.minutes : null,
});

/**
 * Schema of the form: the input of the alarm checked as it is sent (`alarmInputOf`). The API schema alone wants the
 * former repetition fields (frequency, interval, weekdays, end) the form does not hold, computed only when sent: it
 * failed on them unseen, and « Créer l'alarme » did nothing.
 */
const alarmFormSchema = z.preprocess((values) => alarmInputOf(values as AlarmFormValues), alarmInputSchema);

/** Fields of an alarm saved on leaving them, in its panel. */
const ON_BLUR = ['label', 'note', 'minutes'] as const;

/**
 * Alarm creation / edition: label, type, schedule (date, time, repetition, weekdays, end) or tracking
 * duration, optional project or task, note. A new alarm is a form with « Créer l’alarme »; an existing one, its panel,
 * saves each field as soon as it changes (texts and the minutes on leaving them, `useFieldSave`).
 * @param {AlarmFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function AlarmForm({ context, alarm, defaults, onDone }: AlarmFormProps) {
  const { create, update } = useAlarmMutations();
  const { data: alarms } = useAlarms();
  const base = useAppForm<AlarmFormValues>({
    initialValues: alarm
      ? alarmFormValues(alarm)
      : {
          label: defaults?.label ?? '',
          note: '',
          type: 'REMINDER',
          startDate: localToday(),
          time: '09:00',
          recurrence: null,
          minutes: 50,
          projectId: defaults?.projectId ?? null,
          taskId: defaults?.taskId ?? null,
          enabled: true,
        },
    schema: alarmFormSchema,
  });
  const current = alarm && (alarms?.find((item) => item.id === alarm.id) ?? alarm);
  const { form, saving } = useFieldSave(base, {
    save: alarm ? (_changes, values) => update.mutateAsync({ id: alarm.id, input: alarmInputOf(values) }) : null,
    schema: alarmFormSchema,
    saved: current && alarmFormValues(current),
    onBlur: ON_BLUR,
  });
  const { type } = form.values;
  const tracking = type === 'TRACKING_DURATION';

  // A new alarm only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((values) => create.mutate(alarmInputOf(values), formCallbacks(form, 'Alarme créée.', onDone)));

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        {alarm && <SaveStatus saving={saving} />}
        <TextInput label="Libellé" required data-autofocus={alarm ? undefined : true} placeholder="Appeler le client, faire une pause…" {...form.getInputProps('label')} />
        <Stack gap={4}>
          <SegmentedControl fullWidth data={TYPES} value={type} onChange={(value) => form.setFieldValue('type', value as AlarmType)} aria-label="Type d’alarme" />
          <Text size="xs" c="dimmed">
            {TYPE_HELP[type]}
          </Text>
        </Stack>

        {tracking ? (
          <NumberInput label="Toutes les" suffix=" min de chrono" min={1} max={24 * 60} required {...optionalNumberProps(form, 'minutes')} />
        ) : (
          <RepetitionField<AlarmTiming>
            label="Date, heure et répétition"
            required
            error={(form.errors.startDate ?? form.errors.time ?? form.errors.recurrence) as string | undefined}
            value={{ startDate: form.values.startDate, time: form.values.time, recurrence: form.values.recurrence }}
            onChange={(timing) => form.setValues({ ...timing })}
            valid={(draft) => Boolean(draft.startDate && draft.time)}
            describe={(timing) => (timing.startDate ? [describeAlarmTiming(timing)] : [])}
            editor={(draft, setDraft) => (
              <RuleEditor
                rule={draft.recurrence}
                onChange={(recurrence) => setDraft({ ...draft, recurrence })}
                start={draft.startDate ?? localToday()}
                footer={
                  <DateTimeField
                    label={draft.recurrence ? 'À partir du' : 'Date et heure'}
                    required
                    day={draft.startDate}
                    time={draft.time}
                    onChange={(startDate, time) => startDate && setDraft({ ...draft, startDate, time })}
                  />
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
            // Its task goes with it (saved together).
            onChange={(projectId) => form.setValues({ projectId, taskId: null })}
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
        <Textarea label="Description" autosize minRows={2} maxRows={8} {...form.getInputProps('note')} />
        <Switch label="Active" {...form.getInputProps('enabled', { type: 'checkbox' })} />
        {!alarm && <FormActions onCancel={onDone} submitLabel="Créer l’alarme" loading={create.isPending} />}
      </Stack>
    </form>
  );
}
