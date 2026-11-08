import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  ColorSwatch,
  Divider,
  Group,
  MultiSelect,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DEFAULT_SCHEDULE_KIND_NAME, periodRhythm, readScheduleCases, readScheduleExceptions, workScheduleSchema, type ScheduleCase, type ScheduleException } from '@ordo/shared';
import { CaretDownIcon, CopyIcon, CaretUpDownIcon, CaretUpIcon, ClockIcon, FunnelSimpleIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useActiveWorkspace } from '../workspaces/api';
import { useDefaultScheduleKind, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules, type WorkSchedule } from './api';
import { ScheduleCasesEditor } from './ScheduleCasesEditor';
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
 * A copy starts with the cases and the kind of its schedule, without dates nor exceptions, saved as a new one.
 * @param {{ schedule?: WorkSchedule, copyOf?: WorkSchedule, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ScheduleForm({ schedule, copyOf, onDone }: { schedule?: WorkSchedule; copyOf?: WorkSchedule; onDone: () => void }) {
  const { create, update } = useWorkScheduleMutations();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const form = useAppForm<ScheduleValues>({
    initialValues: {
      name: schedule?.name ?? (copyOf ? `${copyOf.name} (copie)` : 'Semaine type'),
      // A copy has no dates: to choose.
      startDate: schedule ? String(schedule.startDate) : copyOf ? '' : localToday(),
      endDate: schedule?.endDate ? String(schedule.endDate) : null,
      cases: schedule ? readScheduleCases(schedule.cases) : copyOf ? readScheduleCases(copyOf.cases) : [newCase(false)],
      exceptions: schedule ? readScheduleExceptions(schedule.exceptions) : [],
      typeId: schedule?.typeId ?? copyOf?.typeId ?? null,
    },
    schema: workScheduleSchema,
  });
  const values = form.values;
  // Every rhythm until the start is chosen (a copy has none); rhythms count from today meanwhile.
  const rhythm = values.startDate ? periodRhythm(values.startDate, values.endDate) : 'ANY';
  const periodStart = values.startDate || localToday();

  /**
   * Changes the period of the schedule, its cases fitted to the rhythms it allows.
   * @param {Partial<{ startDate: string, endDate: string | null }>} period New dates.
   * @returns {void}
   */
  const setPeriod = (period: Partial<{ startDate: string; endDate: string | null }>) => {
    const next = { startDate: values.startDate, endDate: values.endDate, ...period };
    form.setValues({ ...next, cases: next.startDate ? fitCases(values.cases, periodRhythm(next.startDate, next.endDate)) : values.cases });
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
        {copyOf && (
          <Text size="sm" c="dimmed">
            Copie de « {copyOf.name} », sans ses dates ni ses exceptions : choisissez ses dates.
          </Text>
        )}
        <Group grow align="flex-start">
          <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
          <Select
            label="Type"
            placeholder={defaultKind?.name ?? DEFAULT_SCHEDULE_KIND_NAME}
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
            placeholder="À choisir"
            value={values.startDate || null}
            error={form.errors.startDate}
            onChange={(date) => date && setPeriod({ startDate: String(date) })}
          />
          <DatePickerInput
            label="Jusqu’au"
            clearable
            placeholder="Sans fin"
            valueFormat="D MMM YYYY"
            minDate={values.startDate || undefined}
            value={values.endDate}
            error={form.errors.endDate}
            onChange={(date) => setPeriod({ endDate: date ? String(date) : null })}
          />
        </Group>

        <Divider label="Cas" labelPosition="left" />
        <ScheduleCasesEditor cases={values.cases} rhythm={rhythm} periodStart={periodStart} onChange={(cases) => form.setFieldValue('cases', cases)} />

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

/** State of a schedule today. */
type ScheduleState = 'CURRENT' | 'UPCOMING' | 'PAST';
const STATE_LABELS: Record<ScheduleState, string> = { CURRENT: 'En cours', UPCOMING: 'À venir', PAST: 'Passée' };
const STATE_COLORS: Record<ScheduleState, string> = { CURRENT: 'green', UPCOMING: 'blue', PAST: 'gray' };
const STATE_ORDER: Record<ScheduleState, number> = { CURRENT: 0, UPCOMING: 1, PAST: 2 };
/** Kind filter value of the schedules without kind. */
const NO_KIND = 'none';

type SortKey = 'name' | 'type' | 'start' | 'end' | 'state';
interface Sort {
  key: SortKey;
  descending: boolean;
}

/**
 * State of a schedule on a day: current, upcoming or past.
 * @param {WorkSchedule} schedule Schedule.
 * @param {string} today YYYY-MM-DD.
 * @returns {ScheduleState} State.
 */
function stateOf(schedule: WorkSchedule, today: string): ScheduleState {
  if (String(schedule.startDate) > today) return 'UPCOMING';
  if (schedule.endDate && String(schedule.endDate) < today) return 'PAST';
  return 'CURRENT';
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (sort: Sort) => void;
}

/**
 * Column header sorting the table: once ascending, again descending.
 * @param {SortHeaderProps} props Component props.
 * @returns {JSX.Element} Header.
 */
function SortHeader({ label, sortKey, sort, onSort }: SortHeaderProps) {
  const active = sort.key === sortKey;
  const Icon = !active ? CaretUpDownIcon : sort.descending ? CaretDownIcon : CaretUpIcon;
  return (
    <Table.Th aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : undefined}>
      <UnstyledButton onClick={() => onSort({ key: sortKey, descending: active && !sort.descending })}>
        <Group gap={4} wrap="nowrap">
          <Text size="sm" fw={600}>
            {label}
          </Text>
          <Icon aria-hidden opacity={active ? 1 : 0.4} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

/**
 * Planned time slots: the schedules in a table to search, filter (kind, state) and sort; create, edit, delete.
 * Their kinds and the subscriptions are in the settings of the calendar. They show in the calendar; in a
 * professional workspace, they are the working hours (compared with the timers, events outside them told).
 * @returns {JSX.Element} Manager.
 */
export function WorkSchedulesManager() {
  const { data: schedules } = useWorkSchedules();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const { remove } = useWorkScheduleMutations();
  const { perso } = useActiveWorkspace();
  const [editing, setEditing] = useState<WorkSchedule | 'new' | { copyOf: WorkSchedule } | null>(null);
  const [deleting, setDeleting] = useState<WorkSchedule | null>(null);
  const [search, setSearch] = useState('');
  const [kinds, setKinds] = useState<string[]>([]);
  const [state, setState] = useState<ScheduleState | 'ALL'>('ALL');
  const [sort, setSort] = useState<Sort>({ key: 'start', descending: true });
  const typeById = new Map((types ?? []).map((type) => [type.id, type]));
  const defaultName = defaultKind?.name ?? DEFAULT_SCHEDULE_KIND_NAME;
  const today = localToday();

  if (editing) {
    return editing === 'new' ? (
      <ScheduleForm onDone={() => setEditing(null)} />
    ) : 'copyOf' in editing ? (
      <ScheduleForm copyOf={editing.copyOf} onDone={() => setEditing(null)} />
    ) : (
      <ScheduleForm schedule={editing} onDone={() => setEditing(null)} />
    );
  }
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

  const kindName = (schedule: WorkSchedule) => (schedule.typeId ? (typeById.get(schedule.typeId)?.name ?? '') : defaultName);
  const needle = search.trim().toLocaleLowerCase('fr');
  const rows = (schedules ?? [])
    .map((schedule) => ({ schedule, state: stateOf(schedule, today), exceptions: readScheduleExceptions(schedule.exceptions) }))
    .filter(({ schedule, state: rowState, exceptions }) => {
      if (state !== 'ALL' && rowState !== state) return false;
      if (kinds.length && !kinds.includes(schedule.typeId ?? NO_KIND)) return false;
      if (!needle) return true;
      return [schedule.name, kindName(schedule), ...exceptions.map((exception) => exception.label)].some((text) => text.toLocaleLowerCase('fr').includes(needle));
    })
    .sort((a, b) => {
      const end = (schedule: WorkSchedule) => (schedule.endDate ? String(schedule.endDate) : '9999-12-31');
      const order =
        sort.key === 'name'
          ? a.schedule.name.localeCompare(b.schedule.name, 'fr')
          : sort.key === 'type'
            ? kindName(a.schedule).localeCompare(kindName(b.schedule), 'fr')
            : sort.key === 'end'
              ? end(a.schedule).localeCompare(end(b.schedule))
              : sort.key === 'state'
                ? STATE_ORDER[a.state] - STATE_ORDER[b.state]
                : 0;
      // Ties (and the start column) by start date.
      const result = order || String(a.schedule.startDate).localeCompare(String(b.schedule.startDate));
      return sort.descending ? -result : result;
    });
  const filtered = Boolean(needle) || kinds.length > 0 || state !== 'ALL';

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Text size="sm" c="dimmed">
          {perso
            ? 'Vos plages prévues, affichées dans l’agenda. Leurs types et leur affichage sont dans les paramètres de l’agenda.'
            : 'Vos horaires de travail prévus : affichés dans l’agenda, comparés au temps chronométré, et signalés quand un évènement tombe en dehors.'}
        </Text>
        <Button leftSection={<PlusIcon aria-hidden />} onClick={() => setEditing('new')} style={{ flexShrink: 0 }}>
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
        <>
          <Group gap="xs" align="flex-end">
            <TextInput
              size="xs"
              style={{ flex: 1, minWidth: 160 }}
              aria-label="Rechercher une plage"
              placeholder="Rechercher (nom, type, exception)…"
              leftSection={<MagnifyingGlassIcon aria-hidden />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <MultiSelect
              size="xs"
              w={220}
              aria-label="Types"
              placeholder={kinds.length ? undefined : 'Tous les types'}
              clearable
              data={[{ value: NO_KIND, label: defaultName }, ...(types ?? []).map((type) => ({ value: type.id, label: type.name }))]}
              value={kinds}
              onChange={setKinds}
            />
            <SegmentedControl
              size="xs"
              aria-label="État"
              data={[{ value: 'ALL', label: 'Toutes' }, ...(['CURRENT', 'UPCOMING', 'PAST'] as const).map((value) => ({ value, label: STATE_LABELS[value] }))]}
              value={state}
              onChange={(value) => setState(value as ScheduleState | 'ALL')}
            />
          </Group>
          <Text size="xs" c="dimmed">
            {filtered ? `${rows.length} plage${rows.length > 1 ? 's' : ''} sur ${schedules.length}` : `${schedules.length} plage${schedules.length > 1 ? 's' : ''}`}
          </Text>
          {rows.length === 0 ? (
            <Paper withBorder radius="md" p="xl">
              <Stack align="center" gap="sm">
                <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
                  <FunnelSimpleIcon aria-hidden />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Aucune plage ne correspond.
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    setSearch('');
                    setKinds([]);
                    setState('ALL');
                  }}
                >
                  Effacer les filtres
                </Button>
              </Stack>
            </Paper>
          ) : (
            <Table.ScrollContainer minWidth={640}>
              <Table highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <SortHeader label="Nom" sortKey="name" sort={sort} onSort={setSort} />
                    <SortHeader label="Type" sortKey="type" sort={sort} onSort={setSort} />
                    <SortHeader label="Début" sortKey="start" sort={sort} onSort={setSort} />
                    <SortHeader label="Fin" sortKey="end" sort={sort} onSort={setSort} />
                    <Table.Th>Horaires</Table.Th>
                    <SortHeader label="État" sortKey="state" sort={sort} onSort={setSort} />
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map(({ schedule, state: rowState, exceptions }) => {
                    const type = schedule.typeId ? typeById.get(schedule.typeId) : undefined;
                    const color = type?.color ?? defaultKind?.color ?? 'var(--mantine-color-green-6)';
                    return (
                      <Table.Tr key={schedule.id}>
                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {schedule.name}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <ColorSwatch size={10} color={color} />
                            <Text size="sm">{kindName(schedule)}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{printedDate(String(schedule.startDate))}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c={schedule.endDate ? undefined : 'dimmed'}>
                            {schedule.endDate ? printedDate(String(schedule.endDate)) : 'Sans fin'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={0}>
                            {readScheduleCases(schedule.cases).map((item, index) => (
                              <Text key={index} size="xs">
                                {describeCase(item)}
                              </Text>
                            ))}
                            {exceptions.length > 0 && (
                              <Tooltip
                                multiline
                                w={360}
                                label={exceptions.map((exception, index) => (
                                  <Text key={index} size="xs">
                                    {exception.label || 'Exception'} {exceptionPeriod(exception)} : {exception.cases.length ? exception.cases.map(describeCase).join(' ; ') : 'pause'}
                                  </Text>
                                ))}
                              >
                                <Text size="xs" c="dimmed" style={{ cursor: 'help' }} tabIndex={0}>
                                  {exceptions.length} exception{exceptions.length > 1 ? 's' : ''}
                                </Text>
                              </Tooltip>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color={STATE_COLORS[rowState]}>
                            {STATE_LABELS[rowState]}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={2} wrap="nowrap" justify="flex-end">
                            <Tooltip label="Modifier">
                              <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${schedule.name}`} onClick={() => setEditing(schedule)}>
                                <PencilSimpleIcon aria-hidden />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Dupliquer (sans dates ni exceptions)">
                              <ActionIcon variant="subtle" color="gray" aria-label={`Dupliquer ${schedule.name}`} onClick={() => setEditing({ copyOf: schedule })}>
                                <CopyIcon aria-hidden />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Supprimer">
                              <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${schedule.name}`} onClick={() => setDeleting(schedule)}>
                                <TrashIcon aria-hidden />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </>
      )}
    </Stack>
  );
}
