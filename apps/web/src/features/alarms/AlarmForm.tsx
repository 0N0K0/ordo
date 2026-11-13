import { TimeField } from '../../components/TimeField';
import { Button, Chip, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { alarmInputSchema, type AlarmFrequency, type AlarmType } from '@ordo/shared';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { ProjectSelect, TaskSelect } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import { timeTasks } from '../time/time-tasks';
import { WEEKDAY_LABELS } from './alarm-labels';
import { useAlarmMutations, type Alarm, type AlarmInput } from './api';

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

const FREQUENCIES: { value: AlarmFrequency; label: string }[] = [
  { value: 'ONCE', label: 'Une seule fois' },
  { value: 'DAILY', label: 'Tous les jours' },
  { value: 'WEEKLY', label: 'Chaque semaine' },
  { value: 'MONTHLY', label: 'Chaque mois' },
];

const UNITS: Record<AlarmFrequency, string> = { ONCE: '', DAILY: 'jour(s)', WEEKLY: 'semaine(s)', MONTHLY: 'mois' };

interface AlarmFormValues extends Record<string, unknown> {
  title: string;
  note: string;
  type: AlarmType;
  startDate: string | null;
  time: string | null;
  frequency: AlarmFrequency;
  interval: number;
  weekdays: number[];
  endDate: string | null;
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
      frequency: alarm?.frequency ?? 'ONCE',
      interval: alarm?.interval ?? 1,
      weekdays: alarm?.weekdays ?? [],
      endDate: alarm?.endDate ?? null,
      minutes: alarm?.minutes ?? 50,
      projectId: alarm ? alarm.projectId : (defaults?.projectId ?? null),
      taskId: alarm ? alarm.taskId : (defaults?.taskId ?? null),
      enabled: alarm?.enabled ?? true,
    },
    schema: alarmInputSchema,
  });
  const { type, frequency } = form.values;
  const tracking = type === 'TRACKING_DURATION';

  const handleSubmit = form.onSubmit((values) => {
    const input: AlarmInput = { ...values, note: values.note || null, minutes: tracking ? values.minutes : null };
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
          <>
            <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
              <DatePickerInput
                label={frequency === 'ONCE' ? 'Date' : 'À partir du'}
                required
                valueFormat="D MMM YYYY"
                {...form.getInputProps('startDate')}
              />
              <TimeField label="Heure" required {...form.getInputProps('time')} />
              <Select
                label="Répétition"
                data={FREQUENCIES}
                allowDeselect={false}
                {...form.getInputProps('frequency')}
              />
            </SimpleGrid>
            {frequency !== 'ONCE' && (
              <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
                <NumberInput
                  label="Tous les"
                  suffix={` ${UNITS[frequency]}`}
                  min={1}
                  max={365}
                  {...form.getInputProps('interval')}
                  onChange={(value) => form.setFieldValue('interval', typeof value === 'number' ? value : 1)}
                />
                <DatePickerInput label="Jusqu’au" clearable placeholder="Sans fin" valueFormat="D MMM YYYY" {...form.getInputProps('endDate')} />
              </SimpleGrid>
            )}
            {frequency === 'WEEKLY' && (
              <Stack gap={4}>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    Jours
                  </Text>
                  <Button variant="subtle" size="compact-xs" onClick={() => form.setFieldValue('weekdays', [1, 2, 3, 4, 5])}>
                    Jours ouvrés
                  </Button>
                </Group>
                <Chip.Group
                  multiple
                  value={form.values.weekdays.map(String)}
                  onChange={(values) => form.setFieldValue('weekdays', values.map(Number).sort())}
                >
                  <Group gap={6}>
                    {WEEKDAY_LABELS.map((label, index) => (
                      <Chip key={label} value={String(index + 1)} size="xs">
                        {label.slice(0, 3)}.
                      </Chip>
                    ))}
                  </Group>
                </Chip.Group>
                <Text size="xs" c="dimmed">
                  Aucun jour choisi : le jour de la date de début.
                </Text>
              </Stack>
            )}
          </>
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
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {alarm && !copy ? 'Enregistrer' : 'Créer l’alarme'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
