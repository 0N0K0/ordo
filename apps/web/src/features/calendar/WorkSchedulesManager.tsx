import { EmptyState } from '../../components/feedback/EmptyState';
import { ActionIcon, Badge, Button, Checkbox, ColorSwatch, Divider, Group, Paper, Select, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  DEFAULT_SCHEDULE_KIND_NAME,
  periodRhythm,
  readScheduleCases,
  readScheduleExceptions,
  workScheduleSchema,
  type ScheduleCase,
  type ScheduleException,
  type WorkScheduleInput,
} from '@ordo/shared';
import { CopyIcon, ClockIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { DataTable } from '../../components/data-table/DataTable';
import { EditableDate, EditableSelect, EditableText } from '../../components/data-table/EditableCells';
import { useDataView } from '../../components/data-table/use-data-view';
import { RowActions } from '../../components/data-table/RowActions';
import type { DataColumn } from '../../components/data-table/data-table';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../../components/dialogs/DestructiveActions';
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

/** Row of the table of the schedules: a schedule, its state today, its exceptions. */
type ScheduleRow = { schedule: WorkSchedule; state: ScheduleState; exceptions: ReturnType<typeof readScheduleExceptions> };
/** Kind filter value of the schedules without kind. */
const NO_KIND = 'none';

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
  const { remove, update } = useWorkScheduleMutations();

  /**
   * Saves fields of a schedule changed in their cells (its hours and exceptions kept).
   * @param {WorkSchedule} schedule Schedule.
   * @param {Partial<WorkScheduleInput>} change Change.
   * @returns {void}
   */
  const saveSchedule = (schedule: WorkSchedule, change: Partial<WorkScheduleInput>) => {
    const input = {
      name: schedule.name,
      startDate: String(schedule.startDate).slice(0, 10),
      endDate: schedule.endDate ? String(schedule.endDate).slice(0, 10) : null,
      cases: readScheduleCases(schedule.cases),
      exceptions: readScheduleExceptions(schedule.exceptions),
      typeId: schedule.typeId ?? null,
      ...change,
    };
    const result = workScheduleSchema.safeParse(input);
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Valeur invalide.'} Rien n’a été modifié.`);
      return;
    }
    update.mutate({ id: schedule.id, input }, { onError: (error) => notifyError(error.message) });
  };
  const { perso } = useActiveWorkspace();
  const [editing, setEditing] = useState<WorkSchedule | 'new' | { copyOf: WorkSchedule } | null>(null);
  const [deleting, setDeleting] = useState<WorkSchedule | null>(null);
  const typeById = new Map((types ?? []).map((type) => [type.id, type]));
  const defaultName = defaultKind?.name ?? DEFAULT_SCHEDULE_KIND_NAME;
  const today = localToday();
  const kindName = (schedule: WorkSchedule) => (schedule.typeId ? (typeById.get(schedule.typeId)?.name ?? '') : defaultName);
  const columns: DataColumn<ScheduleRow>[] = [
    { id: 'name', label: 'Nom', size: 220, locked: true, sortValue: ({ schedule }) => schedule.name, text: ({ schedule }) => schedule.name },
    {
      id: 'type',
      label: 'Type',
      size: 160,
      sortValue: ({ schedule }) => kindName(schedule),
      text: ({ schedule }) => kindName(schedule),
      filter: {
        kind: 'choice',
        value: ({ schedule }) => schedule.typeId ?? NO_KIND,
        options: [{ value: NO_KIND, label: defaultName }, ...(types ?? []).map((type) => ({ value: type.id, label: type.name }))],
      },
      groupable: true,
    },
    {
      id: 'start',
      label: 'Début',
      size: 120,
      sortValue: ({ schedule }) => String(schedule.startDate),
      text: ({ schedule }) => printedDate(String(schedule.startDate)),
      filter: { kind: 'date', value: ({ schedule }) => String(schedule.startDate).slice(0, 10) },
    },
    {
      id: 'end',
      label: 'Fin',
      size: 120,
      sortValue: ({ schedule }) => (schedule.endDate ? String(schedule.endDate) : '9999-12-31'),
      text: ({ schedule }) => (schedule.endDate ? printedDate(String(schedule.endDate)) : 'Sans fin'),
      filter: { kind: 'date', value: ({ schedule }) => (schedule.endDate ? String(schedule.endDate).slice(0, 10) : null) },
    },
    {
      id: 'hours',
      label: 'Horaires',
      size: 320,
      text: ({ schedule, exceptions }) => [...readScheduleCases(schedule.cases).map(describeCase), ...exceptions.map((exception) => exception.label)].filter(Boolean).join(' ; '),
    },
    {
      id: 'state',
      label: 'État',
      size: 110,
      sortValue: ({ state: rowState }) => STATE_ORDER[rowState],
      text: ({ state: rowState }) => STATE_LABELS[rowState],
      filter: { kind: 'choice', value: ({ state: rowState }) => rowState, options: (['CURRENT', 'UPCOMING', 'PAST'] as const).map((value) => ({ value, label: STATE_LABELS[value] })) },
      groupable: true,
    },
  ];
  const rows = (schedules ?? []).map((schedule) => ({ schedule, state: stateOf(schedule, today), exceptions: readScheduleExceptions(schedule.exceptions) }));
  const view = useDataView({
    tableKey: 'work-schedules',
    columns,
    rows,
    title: perso ? 'Plages' : 'Horaires de travail',
    first: [{ name: 'Toutes', config: { sorting: [{ id: 'start', desc: true }] } }],
  });

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
        <EmptyState icon={<ClockIcon aria-hidden />} message="Aucune plage." />
      ) : (
        <DataTable
          view={view}
          bar={{ searchLabel: 'Rechercher (nom, type, exception)…' }}
          highlightOnHover
          verticalSpacing="xs"
          getKey={({ schedule }) => schedule.id}
          cells={({ schedule, state: rowState, exceptions }) => {
            const type = schedule.typeId ? typeById.get(schedule.typeId) : undefined;
            const color = type?.color ?? defaultKind?.color ?? 'var(--mantine-color-green-6)';
            return {
              name: <EditableText value={schedule.name} label={`Nom de ${schedule.name}`} strong onSave={(name) => name && saveSchedule(schedule, { name })} />,
              type: (
                <EditableSelect
                  value={schedule.typeId ?? NO_KIND}
                  label={`Type de ${schedule.name}`}
                  leftSection={<ColorSwatch size={10} color={color} />}
                  data={[{ value: NO_KIND, label: defaultName }, ...(types ?? []).map((item) => ({ value: item.id, label: item.name }))]}
                  onSave={(typeId) => typeId && saveSchedule(schedule, { typeId: typeId === NO_KIND ? null : typeId })}
                />
              ),
              start: <EditableDate value={String(schedule.startDate).slice(0, 10)} label={`Début de ${schedule.name}`} onSave={(startDate) => startDate && saveSchedule(schedule, { startDate })} />,
              end: (
                <EditableDate
                  value={schedule.endDate ? String(schedule.endDate).slice(0, 10) : null}
                  label={`Fin de ${schedule.name}`}
                  nullable
                  minDate={String(schedule.startDate).slice(0, 10)}
                  onSave={(endDate) => saveSchedule(schedule, { endDate })}
                />
              ),
              hours: (
                <>
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
                </>
              ),
              state: (
                <>
                  <Badge size="sm" variant="light" color={STATE_COLORS[rowState]}>
                    {STATE_LABELS[rowState]}
                  </Badge>
                </>
              ),
            };
          }}
          actions={({ schedule }) => (
            <RowActions
              name={schedule.name}
              primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => setEditing(schedule) }}
              items={[
                { label: 'Dupliquer (sans dates ni exceptions)', icon: <CopyIcon aria-hidden />, onClick: () => setEditing({ copyOf: schedule }) },
                { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => setDeleting(schedule) },
              ]}
            />
          )}
        />
      )}
    </Stack>
  );
}
