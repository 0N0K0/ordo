import { ActionIcon, Badge, Button, Divider, Group, NumberInput, Paper, Stack, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { slotMinutes, workScheduleSchema, type WorkPause, type WorkSlot } from '@ordo/shared';
import { ClockIcon, PencilSimpleIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useWorkScheduleMutations, useWorkSchedules, type WorkSchedule } from './api';

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

/**
 * Printed calendar date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Date.
 */
const printed = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

/**
 * Duration in hours and minutes.
 * @param {number} minutes Minutes.
 * @returns {string} "7 h 30".
 */
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`;

interface ScheduleValues extends Record<string, unknown> {
  name: string;
  startDate: string;
  endDate: string | null;
  intervalWeeks: number;
  slots: WorkSlot[];
  pauses: WorkPause[];
}

/**
 * Working hours form: name, dates, every n weeks, time slots of each weekday, paused periods.
 * @param {{ schedule?: WorkSchedule, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ScheduleForm({ schedule, onDone }: { schedule?: WorkSchedule; onDone: () => void }) {
  const { create, update } = useWorkScheduleMutations();
  const form = useAppForm<ScheduleValues>({
    initialValues: {
      name: schedule?.name ?? 'Semaine type',
      startDate: schedule ? String(schedule.startDate) : localToday(),
      endDate: schedule?.endDate ? String(schedule.endDate) : null,
      intervalWeeks: schedule?.intervalWeeks ?? 1,
      slots: schedule?.slots.map(({ weekday, start, end }) => ({ weekday, start, end })) ?? [
        { weekday: 1, start: '09:00', end: '12:30' },
        { weekday: 1, start: '14:00', end: '18:00' },
      ],
      pauses: schedule?.pauses.map(({ from, to, label }) => ({ from, to, label })) ?? [],
    },
    schema: workScheduleSchema,
  });
  const values = form.values;

  /**
   * Adds a slot to a weekday, after its last one.
   * @param {number} weekday 1 (Monday) to 7.
   * @returns {void}
   */
  const addSlot = (weekday: number) => {
    const last = values.slots
      .filter((slot) => slot.weekday === weekday)
      .sort((a, b) => a.start.localeCompare(b.start))
      .at(-1);
    const start = last ? (last.end < '13:00' ? '14:00' : last.end) : '09:00';
    const end = last ? (start < '18:00' ? '18:00' : '23:59') : '12:30';
    form.setFieldValue('slots', [...values.slots, { weekday, start, end }]);
  };

  return (
    <form
      noValidate
      onSubmit={form.onSubmit(
        (input) => {
          const callbacks = {
            onSuccess: () => {
              notifySuccess(schedule ? 'Plages de travail modifiées.' : 'Plages de travail créées.');
              onDone();
            },
            onError: (error: Error) => showFormError(form, error),
          };
          if (schedule) update.mutate({ id: schedule.id, input }, callbacks);
          else create.mutate(input, callbacks);
        },
        // An error on a field without input (a slot list…) is told.
        (errors) => {
          const message = Object.values(errors).find(Boolean);
          if (message) notifyError(String(message));
        },
      )}
    >
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <Group grow align="flex-start">
          <DatePickerInput label="À partir du" required valueFormat="D MMM YYYY" {...form.getInputProps('startDate')} />
          <DatePickerInput label="Jusqu’au" clearable placeholder="Sans fin" valueFormat="D MMM YYYY" minDate={values.startDate} {...form.getInputProps('endDate')} />
          <NumberInput label="Toutes les" suffix={values.intervalWeeks > 1 ? ' semaines' : ' semaine'} min={1} max={52} {...form.getInputProps('intervalWeeks')} />
        </Group>

        <Divider label="Plages horaires" labelPosition="left" />
        <Stack gap={6}>
          {WEEKDAYS.map((label, index) => {
            const weekday = index + 1;
            const slots = values.slots.map((slot, position) => ({ slot, position })).filter(({ slot }) => slot.weekday === weekday);
            return (
              <Group key={weekday} gap="sm" align="flex-start" wrap="nowrap">
                <Text size="sm" w={80} pt={6} fw={slots.length ? 600 : undefined} c={slots.length ? undefined : 'dimmed'}>
                  {label}
                </Text>
                <Stack gap={4} style={{ flex: 1 }}>
                  {slots.map(({ slot, position }) => (
                    <Group key={position} gap={6} wrap="nowrap" align="flex-start">
                      <TimeInput aria-label={`${label} : début de la plage`} size="xs" {...form.getInputProps(`slots.${position}.start`)} />
                      <Text size="sm" pt={4}>
                        à
                      </Text>
                      <TimeInput aria-label={`${label} : fin de la plage`} size="xs" {...form.getInputProps(`slots.${position}.end`)} />
                      <Tooltip label="Retirer la plage">
                        <ActionIcon variant="subtle" color="gray" aria-label={`Retirer la plage de ${slot.start} du ${label.toLowerCase()}`} onClick={() => form.removeListItem('slots', position)}>
                          <XIcon aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  ))}
                  <Group gap="xs">
                    <Button size="compact-xs" variant="subtle" leftSection={<PlusIcon aria-hidden />} onClick={() => addSlot(weekday)}>
                      Ajouter une plage
                    </Button>
                    {slots.length > 0 && (
                      <Text size="xs" c="dimmed">
                        {hours(slotMinutes(slots.map(({ slot }) => slot)))}
                      </Text>
                    )}
                  </Group>
                </Stack>
              </Group>
            );
          })}
          {typeof form.errors.slots === 'string' && (
            <Text size="xs" c="red">
              {form.errors.slots}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {hours(slotMinutes(values.slots))} par semaine travaillée.
          </Text>
        </Stack>

        <Divider label="Pauses (congés…)" labelPosition="left" />
        <Stack gap={6}>
          {values.pauses.map((_, index) => (
            <Group key={index} gap={6} wrap="nowrap" align="flex-start">
              <DatePickerInput aria-label={`Début de la pause ${index + 1}`} size="xs" valueFormat="D MMM YYYY" w={130} {...form.getInputProps(`pauses.${index}.from`)} />
              <Text size="sm" pt={4}>
                au
              </Text>
              <DatePickerInput
                aria-label={`Fin de la pause ${index + 1}`}
                size="xs"
                valueFormat="D MMM YYYY"
                w={130}
                minDate={values.pauses[index].from}
                {...form.getInputProps(`pauses.${index}.to`)}
              />
              <TextInput aria-label={`Motif de la pause ${index + 1}`} size="xs" placeholder="Congés, formation…" style={{ flex: 1 }} {...form.getInputProps(`pauses.${index}.label`)} />
              <Tooltip label="Retirer la pause">
                <ActionIcon variant="subtle" color="gray" aria-label={`Retirer la pause ${index + 1}`} onClick={() => form.removeListItem('pauses', index)}>
                  <XIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
          <div>
            <Button size="compact-xs" variant="subtle" leftSection={<PlusIcon aria-hidden />} onClick={() => form.insertListItem('pauses', { from: localToday(), to: localToday(), label: 'Congés' })}>
              Ajouter une pause
            </Button>
          </div>
        </Stack>

        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Planned working hours: the schedules with their slots and pauses; create, edit, delete. They show in the
 * calendar, warn about events outside them and give the planned time of the timers page.
 * @returns {JSX.Element} Manager.
 */
export function WorkSchedulesManager() {
  const { data: schedules } = useWorkSchedules();
  const { remove } = useWorkScheduleMutations();
  const [editing, setEditing] = useState<WorkSchedule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<WorkSchedule | null>(null);

  if (editing) return <ScheduleForm schedule={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />;
  if (deleting) {
    return (
      <Stack gap="md">
        <Title order={3} size="h5">
          Supprimer « {deleting.name} »
        </Title>
        <Text size="sm">Ces plages de travail et leurs pauses seront supprimées définitivement : elles ne compteront plus dans le temps prévu. Les évènements ne sont pas touchés.</Text>
        <DestructiveActions
          loading={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                notifySuccess('Plages de travail supprimées.');
                setDeleting(null);
              },
              onError: (error) => notifyError(error.message),
            })
          }
        />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Vos horaires de travail prévus : affichés dans l’agenda, comparés au temps chronométré, et signalés quand un évènement tombe en dehors.
        </Text>
        <Button leftSection={<PlusIcon aria-hidden />} onClick={() => setEditing('new')}>
          Plages
        </Button>
      </Group>
      {!schedules?.length ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <ClockIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucune plage de travail.
            </Text>
          </Stack>
        </Paper>
      ) : (
        schedules.map((schedule) => (
          <Paper key={schedule.id} withBorder radius="md" p="md">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={4}>
                <Group gap="xs">
                  <Text fw={600}>{schedule.name}</Text>
                  <Badge size="sm" variant="light">
                    {schedule.intervalWeeks > 1 ? `Toutes les ${schedule.intervalWeeks} semaines` : 'Chaque semaine'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {schedule.endDate ? `Du ${printed(String(schedule.startDate))} au ${printed(String(schedule.endDate))}` : `À partir du ${printed(String(schedule.startDate))}`} ·{' '}
                  {hours(slotMinutes(schedule.slots))} par semaine travaillée
                </Text>
                {WEEKDAYS.map((label, index) => {
                  const slots = schedule.slots.filter((slot) => slot.weekday === index + 1);
                  return slots.length ? (
                    <Text key={label} size="sm">
                      {label} : {slots.map((slot) => `${slot.start}–${slot.end}`).join(', ')}
                    </Text>
                  ) : null;
                })}
                {schedule.pauses.length > 0 && (
                  <Text size="xs" c="dimmed">
                    Pauses : {schedule.pauses.map((pause) => `${pause.label || 'Pause'} du ${printed(pause.from)} au ${printed(pause.to)}`).join(' · ')}
                  </Text>
                )}
              </Stack>
              <Group gap={2} wrap="nowrap">
                <Tooltip label="Modifier">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${schedule.name}`} onClick={() => setEditing(schedule)}>
                    <PencilSimpleIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Supprimer">
                  <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${schedule.name}`} onClick={() => setDeleting(schedule)}>
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Paper>
        ))
      )}
    </Stack>
  );
}
