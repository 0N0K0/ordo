import { ActionIcon, Badge, Button, Checkbox, Collapse, ColorInput, ColorSwatch, Divider, Group, Paper, Select, Stack, Switch, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DEFAULT_SCHEDULE_DISPLAY, periodRhythm, readScheduleCases, readScheduleDisplay, readScheduleExceptions, workScheduleSchema, type ScheduleCase, type ScheduleException } from '@ordo/shared';
import { ArrowCounterClockwiseIcon, ClockIcon, PencilSimpleIcon, PlusIcon, SlidersHorizontalIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useActiveWorkspace } from '../workspaces/api';
import { useForeignScheduleKinds, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules, type WorkSchedule } from './api';
import { ScheduleCasesEditor } from './ScheduleCasesEditor';
import { ScheduleLookEditor } from './ScheduleLookEditor';
import { describeCase, fitCases, newCase, printedDate } from './schedule-text';

interface ScheduleValues extends Record<string, unknown> {
  name: string;
  startDate: string;
  endDate: string | null;
  cases: ScheduleCase[];
  exceptions: ScheduleException[];
  typeId: string | null;
}

/**
 * Period of an exception in words.
 * @param {ScheduleException} exception Exception.
 * @returns {string} "le 12 nov. 2026" or "du 1 août 2026 au 15 août 2026".
 */
const exceptionPeriod = (exception: ScheduleException) => (exception.from === exception.to ? `le ${printedDate(exception.from)}` : `du ${printedDate(exception.from)} au ${printedDate(exception.to)}`);

/**
 * Schedule form: name, kind, period, its cases (days and hours), and exceptions (a period with cases of its own,
 * edited the same way, or none: a pause). Rhythms ("every n weeks"…) are offered only when the period is long enough.
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
      cases: schedule ? readScheduleCases(schedule.cases) : [newCase(false)],
      exceptions: schedule ? readScheduleExceptions(schedule.exceptions) : [],
      typeId: schedule?.typeId ?? null,
    },
    schema: workScheduleSchema,
  });
  const values = form.values;
  const rhythm = periodRhythm(values.startDate, values.endDate);

  /**
   * Changes the period of the schedule, its cases fitted to the rhythms it allows.
   * @param {Partial<{ startDate: string, endDate: string | null }>} period New dates.
   * @returns {void}
   */
  const setPeriod = (period: Partial<{ startDate: string; endDate: string | null }>) => {
    const next = { startDate: values.startDate, endDate: values.endDate, ...period };
    form.setValues({ ...next, cases: fitCases(values.cases, periodRhythm(next.startDate, next.endDate)) });
  };

  /**
   * Changes an exception; new dates fit its cases to the rhythms its period allows.
   * @param {number} index Exception.
   * @param {Partial<ScheduleException>} changes Changes.
   * @returns {void}
   */
  const setException = (index: number, changes: Partial<ScheduleException>) => {
    const next = { ...values.exceptions[index], ...changes };
    if (next.to < next.from) next.to = next.from;
    next.cases = fitCases(next.cases, periodRhythm(next.from, next.to));
    form.setFieldValue(
      'exceptions',
      values.exceptions.map((other, otherIndex) => (otherIndex === index ? next : other)),
    );
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
        // An error on a field without input (a case, an exception…) is told.
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
          <DatePickerInput
            label="À partir du"
            required
            valueFormat="D MMM YYYY"
            value={values.startDate}
            error={form.errors.startDate}
            onChange={(date) => date && setPeriod({ startDate: String(date) })}
          />
          <DatePickerInput
            label="Jusqu’au"
            clearable
            placeholder="Sans fin"
            valueFormat="D MMM YYYY"
            minDate={values.startDate}
            value={values.endDate}
            error={form.errors.endDate}
            onChange={(date) => setPeriod({ endDate: date ? String(date) : null })}
          />
        </Group>

        <Divider label="Cas" labelPosition="left" />
        <ScheduleCasesEditor cases={values.cases} rhythm={rhythm} periodStart={values.startDate} onChange={(cases) => form.setFieldValue('cases', cases)} />

        <Divider label="Exceptions (congés, horaires particuliers…)" labelPosition="left" />
        <Text size="xs" c="dimmed">
          Pendant une exception, ses propres cas remplacent ceux de la plage ; sans cas, c’est une pause.
        </Text>
        <Stack gap="sm">
          {values.exceptions.map((exception, index) => {
            const exceptionRhythm = periodRhythm(exception.from, exception.to);
            const pause = exception.cases.length === 0;
            return (
              <Paper key={index} withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
                <Stack gap="xs">
                  <Group gap={6} wrap="nowrap" align="flex-end">
                    <DatePickerInput label="Du" size="xs" valueFormat="D MMM YYYY" w={140} value={exception.from} onChange={(date) => date && setException(index, { from: String(date) })} />
                    <DatePickerInput
                      label="Au"
                      size="xs"
                      valueFormat="D MMM YYYY"
                      w={140}
                      minDate={exception.from}
                      value={exception.to}
                      onChange={(date) => date && setException(index, { to: String(date) })}
                    />
                    <TextInput
                      label="Motif"
                      size="xs"
                      placeholder="Congés, formation…"
                      style={{ flex: 1 }}
                      value={exception.label}
                      onChange={(event) => setException(index, { label: event.currentTarget.value })}
                    />
                    <Tooltip label="Retirer l’exception">
                      <ActionIcon variant="subtle" color="gray" mb={4} aria-label={`Retirer l’exception ${index + 1}`} onClick={() => form.removeListItem('exceptions', index)}>
                        <TrashIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                  <Checkbox
                    size="xs"
                    label="Pause (aucune plage pendant cette période)"
                    checked={pause}
                    onChange={(event) => setException(index, { cases: event.currentTarget.checked ? [] : [newCase(exceptionRhythm === 'DAY')] })}
                  />
                  {!pause && <ScheduleCasesEditor cases={exception.cases} rhythm={exceptionRhythm} periodStart={exception.from} onChange={(cases) => setException(index, { cases })} />}
                </Stack>
              </Paper>
            );
          })}
          <div>
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<PlusIcon aria-hidden />}
              onClick={() => form.insertListItem('exceptions', { from: localToday(), to: localToday(), label: 'Congés', cases: [] } satisfies ScheduleException)}
            >
              Ajouter une exception
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
  const [opened, setOpened] = useState<string | null>(null);
  const onError = (error: Error) => notifyError(error.message);
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600}>Types de plages</Text>
        <Text size="xs" c="dimmed">
          Pour distinguer vos plages (travail, garde des enfants, sport…) : chaque type a sa couleur et son affichage dans l’agenda.
        </Text>
        {(types ?? []).map((type) => {
          const input = { name: type.name, color: type.color, ...readScheduleDisplay(type) };
          return (
            <Stack key={type.id} gap={6}>
              <Group gap="xs" wrap="nowrap">
                <ColorInput
                  size="xs"
                  w={120}
                  format="hex"
                  swatches={swatches}
                  aria-label={`Couleur de ${type.name}`}
                  defaultValue={type.color}
                  onChangeEnd={(value) => saveType.mutate({ id: type.id, input: { ...input, color: value } }, { onError })}
                />
                <TextInput
                  size="xs"
                  style={{ flex: 1 }}
                  aria-label="Nom du type"
                  defaultValue={type.name}
                  onBlur={(event) =>
                    event.currentTarget.value.trim() && event.currentTarget.value !== type.name && saveType.mutate({ id: type.id, input: { ...input, name: event.currentTarget.value } }, { onError })
                  }
                />
                <Tooltip label="Affichage dans l’agenda">
                  <ActionIcon
                    variant={opened === type.id ? 'light' : 'subtle'}
                    color="gray"
                    aria-label={`Affichage de ${type.name}`}
                    aria-expanded={opened === type.id}
                    onClick={() => setOpened(opened === type.id ? null : type.id)}
                  >
                    <SlidersHorizontalIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Supprimer (ses plages restent, sans type)">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Supprimer ${type.name}`}
                    onClick={() => removeType.mutate(type.id, { onSuccess: () => notifySuccess('Type supprimé.'), onError })}
                  >
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Collapse expanded={opened === type.id}>
                <Paper p="xs" radius="sm" bg="var(--mantine-color-default-hover)">
                  <ScheduleLookEditor name={type.name} value={type} onChange={(display) => saveType.mutate({ id: type.id, input: { ...input, ...display } }, { onError })} />
                </Paper>
              </Collapse>
            </Stack>
          );
        })}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            saveType.mutate({ id: null, input: { name: name.trim(), color, ...DEFAULT_SCHEDULE_DISPLAY } }, { onSuccess: () => setName(''), onError });
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
 * subscribing to one shows all its schedules, those added later too, read only in this calendar, in the color and
 * display of the kind, or those set here.
 * @returns {JSX.Element | null} Section, nothing without other workspaces with schedules.
 */
function ForeignSchedules() {
  const { data: kinds } = useForeignScheduleKinds();
  const { subscribe, unsubscribe, setLook } = useWorkScheduleMutations();
  const swatches = useColorSwatches();
  const [opened, setOpened] = useState<string | null>(null);
  if (!kinds?.length) return null;
  const onError = (error: Error) => notifyError(error.message);
  const byWorkspace = new Map<string, typeof kinds>();
  for (const kind of kinds) byWorkspace.set(kind.workspaceId, [...(byWorkspace.get(kind.workspaceId) ?? []), kind]);
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600}>Plages des autres espaces</Text>
        <Text size="xs" c="dimmed">
          Abonné à un type de plage, cet espace affiche toutes ses plages (même celles ajoutées ensuite) dans son agenda, en lecture seule, avec la couleur et l’affichage du type ou ceux choisis ici.
        </Text>
        {[...byWorkspace.values()].map((items) => (
          <Stack key={items[0].workspaceId} gap={4}>
            <Text size="sm" fw={600}>
              {items[0].workspaceName}
            </Text>
            {items.map((kind) => {
              const key = `${kind.workspaceId}|${kind.typeId ?? ''}`;
              const target = { workspaceId: kind.workspaceId, typeId: kind.typeId ?? null };
              const look = { color: kind.color ?? null, ...readScheduleDisplay(kind) };
              return (
                <Stack key={key} gap={6} pl="md">
                  <Group gap="sm" wrap="nowrap">
                    <ColorSwatch size={12} color={kind.color ?? 'var(--mantine-color-green-4)'} />
                    <Text size="sm" style={{ flex: 1 }}>
                      {kind.name}
                      <Text span size="xs" c="dimmed">
                        {' '}
                        · {kind.scheduleCount} plage{kind.scheduleCount > 1 ? 's' : ''}
                        {kind.customized ? ' · affichage personnalisé' : ''}
                      </Text>
                    </Text>
                    {kind.subscribed && (
                      <Tooltip label="Couleur et affichage dans cet agenda">
                        <ActionIcon
                          variant={opened === key ? 'light' : 'subtle'}
                          color="gray"
                          aria-label={`Affichage de ${kind.name} (${kind.workspaceName})`}
                          aria-expanded={opened === key}
                          onClick={() => setOpened(opened === key ? null : key)}
                        >
                          <SlidersHorizontalIcon aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <Switch
                      label="Abonné"
                      aria-label={`Abonnement à ${kind.name} (${kind.workspaceName})`}
                      checked={kind.subscribed}
                      onChange={(event) => (event.currentTarget.checked ? subscribe : unsubscribe).mutate(target, { onError })}
                    />
                  </Group>
                  <Collapse expanded={kind.subscribed && opened === key}>
                    <Paper p="xs" radius="sm" bg="var(--mantine-color-default-hover)">
                      <Stack gap={6}>
                        <Group gap="xs" align="center">
                          <Text size="xs" w={120}>
                            Couleur
                          </Text>
                          <ColorInput
                            key={kind.color ?? 'none'}
                            size="xs"
                            w={140}
                            format="hex"
                            swatches={swatches}
                            placeholder="Vert des horaires"
                            aria-label={`Couleur de ${kind.name} dans cet agenda`}
                            defaultValue={kind.color ?? ''}
                            onChangeEnd={(value) => setLook.mutate({ ...target, input: { ...look, color: value || null } }, { onError })}
                          />
                        </Group>
                        <ScheduleLookEditor name={kind.name} value={kind} onChange={(display) => setLook.mutate({ ...target, input: { ...look, ...display } }, { onError })} />
                        {kind.customized && (
                          <div>
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              leftSection={<ArrowCounterClockwiseIcon aria-hidden />}
                              onClick={() => setLook.mutate({ ...target, input: { color: null, dayDisplay: null, dayBar: null, monthDisplay: null } }, { onError })}
                            >
                              Reprendre ceux du type
                            </Button>
                          </div>
                        )}
                      </Stack>
                    </Paper>
                  </Collapse>
                </Stack>
              );
            })}
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
          Ces plages et leurs exceptions seront supprimées définitivement{perso ? '' : ' : elles ne compteront plus dans le temps prévu'}. Les autres espaces abonnés ne les verront plus. Les
          évènements ne sont pas touchés.
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
                  </Group>
                  <Text size="xs" c="dimmed">
                    {schedule.endDate ? `Du ${printedDate(String(schedule.startDate))} au ${printedDate(String(schedule.endDate))}` : `À partir du ${printedDate(String(schedule.startDate))}`}
                  </Text>
                  {readScheduleCases(schedule.cases).map((item, index) => (
                    <Text key={index} size="sm">
                      {describeCase(item)}
                    </Text>
                  ))}
                  {readScheduleExceptions(schedule.exceptions).map((exception, index) => (
                    <Text key={index} size="xs" c="dimmed">
                      {exception.label || 'Exception'} {exceptionPeriod(exception)} : {exception.cases.length ? exception.cases.map(describeCase).join(' ; ') : 'pause'}
                    </Text>
                  ))}
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
