import { PERIOD_STATES, periodState, type PeriodState } from '../../../lib/periods';
import { itemChoices } from '../../../components/items/item-look';
import { plural, countOf, copyName } from '../../../lib/text';
import { ActionButton } from '../../../components/actions/ActionButton';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import * as fmt from '../../../lib/format';
import { listSelectProps } from '../../../components/items/item-look';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import {
  mapById,
  DEFAULT_SCHEDULE_KIND_NAME,
  readScheduleCases,
  readScheduleExceptions,
  type ScheduleCase,
  type ScheduleException,
  type WorkScheduleInput,
  workScheduleSchema,
} from '@ordo/shared';
import { CopyIcon, ClockIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { EditableDate, EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { notifyError, onMutationError } from '../../../lib/notify';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { SectionHeader } from '../../../components/page/SectionHeader';
import { useActiveWorkspace } from '../../workspaces/api';
import { calendarQueryKey, useDefaultScheduleKind, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules, type WorkSchedule } from '../api';
import { archiveEntry, useSetArchived } from '../../../lib/archive';
import { ArchivedBadge } from '../../../components/items/ItemBadge';
import { ScheduleRepetition } from './ScheduleRepetition';
import { describeScheduleCase, exceptionPeriod, newScheduleCase, schedulesTitle } from '../lib/schedule-text';
import { Comments } from '../../comments/components/Comments';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { archiveRowsAction, deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { useScheduleTypeItems } from '../hooks/use-settings-items';
import { itemCreator } from '../../../components/settings/create-settings-item';
import { FormActions } from '../../../components/dialogs/FormActions';

interface ScheduleValues extends Record<string, unknown> {
  name: string;
  startDate: string;
  endDate: string | null;
  cases: ScheduleCase[];
  exceptions: ScheduleException[];
  typeId: string | null;
}

/**
 * Schedule form: name, kind, period, its cases (days and hours), and exceptions (a period with cases of its own,
 * edited the same way, or none: a pause). Rhythms ("every n weeks"…) are offered only when the period is long enough.
 * A copy starts with the cases and the kind of its schedule, without dates nor exceptions, saved as a new one.
 * @param {{ schedule?: WorkSchedule, copyOf?: WorkSchedule, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ScheduleForm({ schedule, copyOf, onDone }: { schedule?: WorkSchedule; copyOf?: WorkSchedule; onDone: () => void }) {
  const { create, update } = useWorkScheduleMutations();
  const typeItems = useScheduleTypeItems();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const form = useAppForm<ScheduleValues>({
    initialValues: {
      name: schedule?.name ?? (copyOf ? copyName(copyOf.name) : 'Semaine type'),
      // A copy has no dates: to choose.
      startDate: schedule ? schedule.startDate : copyOf ? '' : localToday(),
      endDate: schedule?.endDate ? schedule.endDate : null,
      cases: schedule ? readScheduleCases(schedule.cases, schedule.startDate) : copyOf ? readScheduleCases(copyOf.cases, copyOf.startDate) : [newScheduleCase(localToday())],
      exceptions: schedule ? readScheduleExceptions(schedule.exceptions) : [],
      typeId: schedule?.typeId ?? copyOf?.typeId ?? null,
    },
    schema: workScheduleSchema,
  });
  const values = form.values;
  return (
    <Stack gap="lg">
      <form
        noValidate
        onSubmit={form.onSubmit(
          (input) => {
            const callbacks = formCallbacks(form, schedule ? 'Plages modifiées.' : 'Plages créées.', onDone);
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
            <CreatableSelect
              label="Type"
              placeholder={defaultKind?.name ?? DEFAULT_SCHEDULE_KIND_NAME}
              clearable
              searchable
              onCreate={itemCreator('Nouveau type de plage', typeItems)}
              {...listSelectProps(types ?? [], undefined, schedule?.typeId)}
              {...form.getInputProps('typeId')}
            />
          </Group>
          <ScheduleRepetition
            error={(form.errors.startDate ?? form.errors.endDate ?? form.errors.cases ?? form.errors.exceptions) as string | undefined}
            value={{ startDate: values.startDate, endDate: values.endDate, cases: values.cases, exceptions: values.exceptions }}
            onChange={(repetition) => form.setValues({ ...repetition })}
          />

          <FormActions onCancel={onDone} loading={create.isPending || update.isPending} />
        </Stack>
      </form>
      {schedule && <Comments target="SCHEDULE" id={schedule.id} readOnly={schedule.archived} />}
    </Stack>
  );
}

/** State of a schedule today (the values kept in the saved views' filters). */
type ScheduleState = 'CURRENT' | 'UPCOMING' | 'PAST';
/** State of its period, for its label and color. */
const PERIOD_OF: Record<ScheduleState, PeriodState> = { CURRENT: 'current', UPCOMING: 'upcoming', PAST: 'past' };
const STATE_OF: Record<PeriodState, ScheduleState> = { current: 'CURRENT', upcoming: 'UPCOMING', past: 'PAST' };
const STATE_LABELS = Object.fromEntries(Object.entries(PERIOD_OF).map(([state, period]) => [state, PERIOD_STATES[period].label])) as Record<ScheduleState, string>;
const STATE_COLORS = Object.fromEntries(Object.entries(PERIOD_OF).map(([state, period]) => [state, PERIOD_STATES[period].color])) as Record<ScheduleState, string>;
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
  return STATE_OF[periodState(schedule.startDate, schedule.endDate ?? null, today)];
}

/**
 * Planned time slots: the schedules in a table to search, filter (kind, state) and sort; create, edit, archive,
 * restore, delete. Archived ones (hidden unless the view includes them) are read only, still followed by the routines
 * using them.
 * Their kinds and the subscriptions are in the settings of the calendar. They show in the calendar; in a
 * professional workspace, they are the working hours (compared with the timers, events outside them told).
 * @returns {JSX.Element} Manager.
 */
export function WorkSchedulesManager() {
  const { data: schedules } = useWorkSchedules();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const { remove, update } = useWorkScheduleMutations();
  const setArchived = useSetArchived('WORK_SCHEDULE', [calendarQueryKey]);

  /**
   * Saves fields of a schedule changed in their cells (its hours and exceptions kept).
   * @param {WorkSchedule} schedule Schedule.
   * @param {Partial<WorkScheduleInput>} change Change.
   * @returns {void}
   */
  const saveSchedule = (schedule: WorkSchedule, change: Partial<WorkScheduleInput>) => {
    // Archived: read only (a bulk change skips it).
    if (schedule.archived) return;
    const input = {
      name: schedule.name,
      startDate: schedule.startDate,
      endDate: schedule.endDate ? schedule.endDate : null,
      cases: readScheduleCases(schedule.cases, schedule.startDate),
      exceptions: readScheduleExceptions(schedule.exceptions),
      typeId: schedule.typeId ?? null,
      ...change,
    };
    const result = workScheduleSchema.safeParse(input);
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Valeur invalide.'} Rien n’a été modifié.`);
      return;
    }
    update.mutate({ id: schedule.id, input }, { onError: onMutationError });
  };
  const { perso } = useActiveWorkspace();
  /**
   * Opens the form of a schedule in a side panel: a new one, a copy, or one to edit.
   * @param {{ schedule?: WorkSchedule, copyOf?: WorkSchedule }} [target] Schedule to edit or to copy. Optional. Default = a new one.
   * @returns {void}
   */
  const openForm = ({ schedule, copyOf }: { schedule?: WorkSchedule; copyOf?: WorkSchedule } = {}) => {
    openFormPanel(
      schedule ? `Modifier « ${schedule.name} »` : copyOf ? `Dupliquer « ${copyOf.name} »` : 'Nouvelles plages',
      (close) => <ScheduleForm schedule={schedule} copyOf={copyOf} onDone={close} />,
      'lg',
    );
  };
  /**
   * Deletes a schedule, once confirmed.
   * @param {WorkSchedule} schedule Schedule.
   * @returns {void}
   */
  const confirmDelete = (schedule: WorkSchedule) =>
    confirmDestructive({
      title: `Supprimer « ${schedule.name} »`,
      risks: `Ces plages et leurs exceptions seront supprimées définitivement${perso ? '' : ' : elles ne compteront plus dans le temps prévu'}. Les autres espaces abonnés ne les verront plus. Les évènements ne sont pas touchés.`,
      run: () => remove.mutateAsync(schedule.id),
      done: 'Plages supprimées.',
    });
  const typeById = mapById(types ?? []);
  const defaultName = defaultKind?.name ?? DEFAULT_SCHEDULE_KIND_NAME;
  const today = localToday();
  const kindName = (schedule: WorkSchedule) => (schedule.typeId ? (typeById.get(schedule.typeId)?.name ?? '') : defaultName);
  const scheduleComments = useCommentCounts(
    'SCHEDULE',
    (schedules ?? []).map((schedule) => schedule.id),
  );
  const columns: DataColumn<ScheduleRow>[] = [
    { id: 'name', label: 'Nom', size: 220, locked: true, bulk: true, sortValue: ({ schedule }) => schedule.name, text: ({ schedule }) => schedule.name },
    {
      id: 'type',
      bulk: true,
      label: 'Type',
      size: 160,
      sortValue: ({ schedule }) => kindName(schedule),
      text: ({ schedule }) => kindName(schedule),
      filter: {
        kind: 'choice',
        value: ({ schedule }) => schedule.typeId ?? NO_KIND,
        options: [{ value: NO_KIND, label: defaultName }, ...itemChoices(types ?? [])],
      },
      groupable: true,
    },
    {
      id: 'start',
      bulk: true,
      label: 'Début',
      size: 120,
      sortValue: ({ schedule }) => schedule.startDate,
      text: ({ schedule }) => fmt.day(schedule.startDate),
      filter: { kind: 'date', value: ({ schedule }) => schedule.startDate },
    },
    {
      id: 'end',
      bulk: true,
      label: 'Fin',
      size: 120,
      sortValue: ({ schedule }) => (schedule.endDate ? schedule.endDate : '9999-12-31'),
      text: ({ schedule }) => (schedule.endDate ? fmt.day(schedule.endDate) : 'Sans fin'),
      filter: { kind: 'date', value: ({ schedule }) => (schedule.endDate ? schedule.endDate : null) },
    },
    {
      id: 'hours',
      label: 'Horaires',
      size: 320,
      text: ({ schedule, exceptions }) =>
        [...readScheduleCases(schedule.cases, schedule.startDate).map((item) => describeScheduleCase(item, schedule.startDate)), ...exceptions.map((exception) => exception.label)]
          .filter(Boolean)
          .join(' ; '),
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
    commentColumn<ScheduleRow>(scheduleComments, ({ schedule }) => schedule.id),
  ];
  const rows = (schedules ?? []).map((schedule) => ({ schedule, state: stateOf(schedule, today), exceptions: readScheduleExceptions(schedule.exceptions) }));
  const view = useDataView({
    tableKey: 'work-schedules',
    getKey: ({ schedule }) => schedule.id,
    columns,
    rows,
    archived: ({ schedule }) => schedule.archived,
    title: schedulesTitle(perso),
    first: [{ name: 'Toutes', config: { sorting: [{ id: 'start', desc: true }] } }],
  });
  const bulk = bulkSaver<ScheduleRow, Partial<WorkScheduleInput>>(view, (row, change) => Object.keys(change).length > 0 && saveSchedule(row.schedule, change));

  return (
    <Stack gap="md">
      <SectionHeader
        description={
          perso
            ? 'Vos plages prévues, affichées dans l’agenda. Leurs types et leur affichage sont dans les paramètres de l’agenda.'
            : 'Vos plages de travail prévues : affichées dans l’agenda, comparées au temps chronométré, et signalées quand un évènement tombe en dehors.'
        }
        actions={
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Nouvelles plages
          </ActionButton>
        }
      />
      {!schedules?.length ? (
        <EmptyState icon={<ClockIcon aria-hidden />} message="Aucune plage." />
      ) : (
        <DataTable
          view={view}
          bar={{ searchLabel: 'Rechercher (nom, type, exception)…' }}
          selectionLabel={(count) => selectedLabel(count, ['plage', 'plages'])}
          isArchived={({ schedule }) => schedule.archived}
          selectionActions={(rows, clear) => [
            archiveRowsAction({
              archived: rows.every(({ schedule }) => schedule.archived),
              apply: (archived) => setArchived.mutateAsync({ ids: rows.map(({ schedule }) => schedule.id), archived }),
              label: countOf(rows.length, 'plage'),
              count: rows.length,
              feminine: true,
              loading: setArchived.isPending,
              clear,
            }),
            deleteRowsAction(rows, {
              title: 'Supprimer les plages',
              risks: `${countOf(rows.length, 'plage')} et leurs exceptions seront supprimées définitivement${perso ? '' : ' : elles ne compteront plus dans le temps prévu'}. Les autres espaces abonnés ne les verront plus. Les évènements ne sont pas touchés.`,
              remove: ({ schedule }) => remove.mutateAsync(schedule.id),
              done: `${countOf(rows.length, 'plage')} ${plural(rows.length, 'supprimée')}.`,
              clear,
            }),
          ]}
          highlightOnHover
          verticalSpacing="xs"
          getKey={({ schedule }) => schedule.id}
          cells={(row) => {
            const { schedule, state: rowState, exceptions } = row;
            const type = schedule.typeId ? typeById.get(schedule.typeId) : undefined;
            const color = type?.color ?? defaultKind?.color ?? 'var(--mantine-color-green-6)';
            const kindName = type?.name ?? defaultName;
            // Archived: read only.
            if (schedule.archived) {
              return {
                name: (
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={600}>
                      {schedule.name}
                    </Text>
                    <ArchivedBadge feminine size="xs" />
                  </Group>
                ),
                type: (
                  <Group gap="xs" wrap="nowrap">
                    <ItemAvatar name={kindName} iconUrl={type?.iconUrl} color={color} />
                    <Text size="sm">{kindName}</Text>
                  </Group>
                ),
                start: <Text size="sm">{fmt.day(schedule.startDate)}</Text>,
                end: <Text size="sm">{schedule.endDate ? fmt.day(schedule.endDate) : 'Sans fin'}</Text>,
                hours: (
                  <Stack gap={0}>
                    {readScheduleCases(schedule.cases, schedule.startDate).map((item, index) => (
                      <Text key={index} size="xs">
                        {describeScheduleCase(item, schedule.startDate)}
                      </Text>
                    ))}
                  </Stack>
                ),
                state: (
                  <Badge size="sm" variant="light" color={STATE_COLORS[rowState]}>
                    {STATE_LABELS[rowState]}
                  </Badge>
                ),
              };
            }
            return {
              name: <EditableText value={schedule.name} label={`Nom de ${schedule.name}`} strong onSave={(name) => name && bulk('name')(row, { name })} />,
              type: (
                <EditableSelect
                  value={schedule.typeId ?? NO_KIND}
                  label={`Type de ${schedule.name}`}
                  leftSection={<ItemAvatar name={kindName} iconUrl={type?.iconUrl} color={color} />}
                  {...listSelectProps([{ id: NO_KIND, name: defaultName, color: defaultKind?.color ?? null, archived: false }, ...(types ?? [])], undefined, schedule.typeId)}
                  onSave={(typeId) => typeId && bulk('type')(row, { typeId: typeId === NO_KIND ? null : typeId })}
                />
              ),
              start: (
                <EditableDate
                  value={schedule.startDate}
                  label={`Début de ${schedule.name}`}
                  onSave={(startDate) => startDate && bulk('start')(row, (target) => (target.schedule.endDate && target.schedule.endDate < startDate ? {} : { startDate }))}
                />
              ),
              end: (
                <EditableDate
                  value={schedule.endDate ? schedule.endDate : null}
                  label={`Fin de ${schedule.name}`}
                  nullable
                  minDate={schedule.startDate}
                  onSave={(endDate) => bulk('end')(row, (target) => (endDate && endDate < target.schedule.startDate ? {} : { endDate }))}
                />
              ),
              hours: (
                <>
                  <Stack gap={0}>
                    {readScheduleCases(schedule.cases, schedule.startDate).map((item, index) => (
                      <Text key={index} size="xs">
                        {describeScheduleCase(item, schedule.startDate)}
                      </Text>
                    ))}
                    {exceptions.length > 0 && (
                      <Tooltip
                        multiline
                        w={360}
                        label={exceptions.map((exception, index) => (
                          <Text key={index} size="xs">
                            {exception.label || 'Exception'} {exceptionPeriod(exception)} :{' '}
                            {exception.cases.length ? exception.cases.map((item) => describeScheduleCase(item, exception.from)).join(' ; ') : 'pause'}
                          </Text>
                        ))}
                      >
                        <Text size="xs" c="dimmed" style={{ cursor: 'help' }} tabIndex={0}>
                          {exceptions.length} {plural(exceptions.length, 'exception')}
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
              primary={!schedule.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm({ schedule }) }}
              items={[
                !schedule.archived && { label: 'Dupliquer (sans dates ni exceptions)', icon: <CopyIcon aria-hidden />, onClick: () => openForm({ copyOf: schedule }) },
                archiveEntry({ archived: schedule.archived, label: `« ${schedule.name} »`, feminine: true }, setArchived, schedule.id),
                { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(schedule) },
              ]}
            />
          )}
        />
      )}
    </Stack>
  );
}
