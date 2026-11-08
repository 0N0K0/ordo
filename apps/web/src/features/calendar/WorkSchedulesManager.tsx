import { ActionIcon, Badge, Button, Checkbox, ColorInput, ColorSwatch, Divider, Group, NumberInput, Paper, Select, Stack, Switch, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { slotMinutes, workScheduleSchema, type WorkPause, type WorkSlot } from '@ordo/shared';
import { ClockIcon, PencilSimpleIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useActiveWorkspace } from '../workspaces/api';
import { useForeignScheduleKinds, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules, type WorkSchedule } from './api';

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
  typeId: string | null;
}

/**
 * Slots of a day in words.
 * @param {readonly { start: string, end: string, allDay?: boolean }[]} slots Slots of the day.
 * @returns {string} "09:00–12:30, 14:00–18:00" or "toute la journée".
 */
const slotsText = (slots: readonly { start: string; end: string; allDay?: boolean }[]) =>
  slots.some((slot) => slot.allDay) ? 'toute la journée' : slots.map((slot) => `${slot.start}–${slot.end}`).join(', ');

/**
 * Schedule form: name, kind, dates, every n weeks, time slots of each weekday (or the whole day), paused periods.
 * @param {{ schedule?: WorkSchedule, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ScheduleForm({ schedule, onDone }: { schedule?: WorkSchedule; onDone: () => void }) {
  const { create, update } = useWorkScheduleMutations();
  const { data: types } = useScheduleTypes();
  const { perso } = useActiveWorkspace();
  const form = useAppForm<ScheduleValues>({
    initialValues: {
      name: schedule?.name ?? 'Semaine type',
      startDate: schedule ? String(schedule.startDate) : localToday(),
      endDate: schedule?.endDate ? String(schedule.endDate) : null,
      intervalWeeks: schedule?.intervalWeeks ?? 1,
      slots: schedule?.slots.map(({ weekday, start, end, allDay }) => ({ weekday, start, end, allDay })) ?? [
        { weekday: 1, start: '09:00', end: '12:30', allDay: false },
        { weekday: 1, start: '14:00', end: '18:00', allDay: false },
      ],
      pauses: schedule?.pauses.map(({ from, to, label }) => ({ from, to, label })) ?? [],
      typeId: schedule?.typeId ?? null,
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
    form.setFieldValue('slots', [...values.slots, { weekday, start, end, allDay: false }]);
  };

  /**
   * Makes a weekday a whole day (its slots replaced), or back to time slots.
   * @param {number} weekday 1 (Monday) to 7.
   * @param {boolean} allDay Whole day.
   * @returns {void}
   */
  const setWholeDay = (weekday: number, allDay: boolean) => {
    const others = values.slots.filter((slot) => slot.weekday !== weekday);
    form.setFieldValue('slots', [...others, allDay ? { weekday, start: '00:00', end: '23:59', allDay: true } : { weekday, start: '09:00', end: '12:30', allDay: false }]);
  };

  return (
    <form
      noValidate
      onSubmit={form.onSubmit(
        (input) => {
          const callbacks = {
            onSuccess: () => {
              notifySuccess(schedule ? 'Plages modifiées.' : 'Plages créées.');
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
        <Group grow align="flex-start">
          <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
          <Select
            label="Type"
            placeholder={perso ? 'Sans type' : 'Horaires de travail'}
            clearable
            data={(types ?? []).map((type) => ({ value: type.id, label: type.name }))}
            {...form.getInputProps('typeId')}
          />
        </Group>
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
            const wholeDay = slots.some(({ slot }) => slot.allDay);
            return (
              <Group key={weekday} gap="sm" align="flex-start" wrap="nowrap">
                <Text size="sm" w={80} pt={6} fw={slots.length ? 600 : undefined} c={slots.length ? undefined : 'dimmed'}>
                  {label}
                </Text>
                <Stack gap={4} style={{ flex: 1 }}>
                  {wholeDay && (
                    <Text size="sm" pt={4}>
                      Toute la journée
                    </Text>
                  )}
                  {!wholeDay &&
                    slots.map(({ slot, position }) => (
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
                    {!wholeDay && (
                      <Button size="compact-xs" variant="subtle" leftSection={<PlusIcon aria-hidden />} onClick={() => addSlot(weekday)}>
                        Ajouter une plage
                      </Button>
                    )}
                    <Checkbox size="xs" label="Toute la journée" checked={wholeDay} onChange={(event) => setWholeDay(weekday, event.currentTarget.checked)} />
                    {slots.length > 0 && !wholeDay && (
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
          {!perso && (
            <Text size="xs" c="dimmed">
              {hours(slotMinutes(values.slots))} par semaine travaillée (les journées entières ne comptent pas).
            </Text>
          )}
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
 * Kinds of time slots ("Travail", "Garde des enfants"…): name and color (their slots in the calendar).
 * @returns {JSX.Element} Section.
 */
function ScheduleTypes() {
  const { data: types } = useScheduleTypes();
  const { saveType, removeType } = useWorkScheduleMutations();
  const swatches = useColorSwatches();
  const [name, setName] = useState('');
  const [color, setColor] = useState(swatches[0]);
  const onError = (error: Error) => notifyError(error.message);
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600}>Types de plages</Text>
        <Text size="xs" c="dimmed">
          Pour distinguer vos plages (travail, garde des enfants, sport…) : chaque type a sa couleur dans l’agenda.
        </Text>
        {(types ?? []).map((type) => (
          <Group key={type.id} gap="xs" wrap="nowrap">
            <ColorInput
              size="xs"
              w={120}
              format="hex"
              swatches={swatches}
              aria-label={`Couleur de ${type.name}`}
              defaultValue={type.color}
              onChangeEnd={(value) => saveType.mutate({ id: type.id, input: { name: type.name, color: value } }, { onError })}
            />
            <TextInput
              size="xs"
              style={{ flex: 1 }}
              aria-label="Nom du type"
              defaultValue={type.name}
              onBlur={(event) =>
                event.currentTarget.value.trim() &&
                event.currentTarget.value !== type.name &&
                saveType.mutate({ id: type.id, input: { name: event.currentTarget.value, color: type.color } }, { onError })
              }
            />
            <Tooltip label="Supprimer (ses plages restent, sans type)">
              <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${type.name}`} onClick={() => removeType.mutate(type.id, { onSuccess: () => notifySuccess('Type supprimé.'), onError })}>
                <TrashIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            saveType.mutate({ id: null, input: { name: name.trim(), color } }, { onSuccess: () => setName(''), onError });
          }}
        >
          <Group gap="xs" wrap="nowrap">
            <ColorInput size="xs" w={120} format="hex" swatches={swatches} aria-label="Couleur du nouveau type" value={color} onChange={setColor} />
            <TextInput size="xs" style={{ flex: 1 }} aria-label="Nom du nouveau type" placeholder="Nouveau type…" value={name} onChange={(event) => setName(event.currentTarget.value)} />
            <Button type="submit" size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} disabled={!name.trim()} loading={saveType.isPending}>
              Ajouter
            </Button>
          </Group>
        </form>
      </Stack>
    </Paper>
  );
}

/**
 * Kinds of schedules of the other workspaces (and their working hours, schedules without kind), by workspace:
 * subscribing to one shows all its schedules, those added later too, read only in this calendar.
 * @returns {JSX.Element | null} Section, nothing without other workspaces with schedules.
 */
function ForeignSchedules() {
  const { data: kinds } = useForeignScheduleKinds();
  const { subscribe, unsubscribe } = useWorkScheduleMutations();
  if (!kinds?.length) return null;
  const byWorkspace = new Map<string, typeof kinds>();
  for (const kind of kinds) byWorkspace.set(kind.workspaceId, [...(byWorkspace.get(kind.workspaceId) ?? []), kind]);
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600}>Plages des autres espaces</Text>
        <Text size="xs" c="dimmed">
          Abonné à un type de plage, cet espace affiche toutes ses plages (même celles ajoutées ensuite) dans son agenda, en lecture seule.
        </Text>
        {[...byWorkspace.values()].map((items) => (
          <Stack key={items[0].workspaceId} gap={4}>
            <Text size="sm" fw={600}>
              {items[0].workspaceName}
            </Text>
            {items.map((kind) => (
              <Group key={kind.typeId ?? 'untyped'} gap="sm" wrap="nowrap" pl="md">
                <ColorSwatch size={12} color={kind.color ?? 'var(--mantine-color-green-4)'} />
                <Text size="sm" style={{ flex: 1 }}>
                  {kind.name}
                  <Text span size="xs" c="dimmed">
                    {' '}
                    · {kind.scheduleCount} plage{kind.scheduleCount > 1 ? 's' : ''}
                  </Text>
                </Text>
                <Switch
                  label="Abonné"
                  aria-label={`Abonnement à ${kind.name} (${kind.workspaceName})`}
                  checked={kind.subscribed}
                  onChange={(event) =>
                    (event.currentTarget.checked ? subscribe : unsubscribe).mutate({ workspaceId: kind.workspaceId, typeId: kind.typeId ?? null }, { onError: (error) => notifyError(error.message) })
                  }
                />
              </Group>
            ))}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

/**
 * Planned time slots: the schedules with their kind, slots (or whole days) and pauses; create, edit, delete; the
 * kinds; the subscriptions to kinds of schedules of other workspaces. They show in the calendar; in a professional
 * workspace, they are the working hours (compared with the timers, events outside them told).
 * @returns {JSX.Element} Manager.
 */
export function WorkSchedulesManager() {
  const { data: schedules } = useWorkSchedules();
  const { data: types } = useScheduleTypes();
  const { remove } = useWorkScheduleMutations();
  const { perso } = useActiveWorkspace();
  const [editing, setEditing] = useState<WorkSchedule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<WorkSchedule | null>(null);
  const typeById = new Map((types ?? []).map((type) => [type.id, type]));

  if (editing) return <ScheduleForm schedule={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />;
  if (deleting) {
    return (
      <Stack gap="md">
        <Title order={3} size="h5">
          Supprimer « {deleting.name} »
        </Title>
        <Text size="sm">
          Ces plages et leurs pauses seront supprimées définitivement{perso ? '' : ' : elles ne compteront plus dans le temps prévu'}. Les autres espaces abonnés ne les verront plus. Les évènements ne
          sont pas touchés.
        </Text>
        <DestructiveActions
          loading={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                notifySuccess('Plages supprimées.');
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
          {perso
            ? 'Vos plages prévues, par type : affichées dans l’agenda.'
            : 'Vos horaires de travail prévus : affichés dans l’agenda, comparés au temps chronométré, et signalés quand un évènement tombe en dehors.'}
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
              Aucune plage.
            </Text>
          </Stack>
        </Paper>
      ) : (
        schedules.map((schedule) => {
          const type = schedule.typeId ? typeById.get(schedule.typeId) : undefined;
          return (
            <Paper key={schedule.id} withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={600}>{schedule.name}</Text>
                    {type && (
                      <Badge size="sm" variant="light" color={type.color} leftSection={<ColorSwatch size={8} color={type.color} />}>
                        {type.name}
                      </Badge>
                    )}
                    <Badge size="sm" variant="light" color="gray">
                      {schedule.intervalWeeks > 1 ? `Toutes les ${schedule.intervalWeeks} semaines` : 'Chaque semaine'}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {schedule.endDate ? `Du ${printed(String(schedule.startDate))} au ${printed(String(schedule.endDate))}` : `À partir du ${printed(String(schedule.startDate))}`}
                    {perso ? '' : ` · ${hours(slotMinutes(schedule.slots))} par semaine travaillée`}
                  </Text>
                  {WEEKDAYS.map((label, index) => {
                    const slots = schedule.slots.filter((slot) => slot.weekday === index + 1);
                    return slots.length ? (
                      <Text key={label} size="sm">
                        {label} : {slotsText(slots)}
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
          );
        })
      )}
      <ScheduleTypes />
      <ForeignSchedules />
    </Stack>
  );
}
