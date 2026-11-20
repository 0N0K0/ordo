import { PERIOD_STATES, periodState, type PeriodState } from '../../../lib/periods';
import { itemChoices, itemSelectProps, listSelectProps } from '../../../components/items/item-look';
import { countOf, copyName } from '../../../lib/text';
import { ActionButton } from '../../../components/actions/ActionButton';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import * as fmt from '../../../lib/format';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Fieldset, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import {
  mapById,
  DEFAULT_SCHEDULE_KIND_LABEL,
  readScheduleCases,
  readScheduleExceptions,
  type ScheduleCase,
  type ScheduleException,
  type WorkScheduleInput,
  wholeDaysCase,
  workScheduleSchema,
} from '@ordo/shared';
import { CalendarStarIcon, ClockIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { cachedItem } from '../../../lib/mutation';
import type { WorkSchedulesQuery } from '../../../graphql/graphql';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { EditableDate, EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { type DataColumn, readOnlyCells } from '../../../components/data-table/table/data-table';
import { localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { notifyError, ON_ERROR } from '../../../lib/notify';

import { openFormPanel } from '../../../components/panels/panels';
import { SectionHeader } from '../../../components/page/SectionHeader';
import { useActiveWorkspace } from '../../workspaces/api';
import { calendarQueryKey, useDefaultScheduleKind, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules, type WorkSchedule } from '../api';
import { archiveEntry, useSetArchived } from '../../../lib/archive';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { ScheduleRepetition } from './ScheduleRepetition';
import { describeScheduleCase, EPHEMERIDES_TITLE, exceptionPeriod, newScheduleCase, schedulesTitle } from '../lib/schedule-text';
import { EPHEMERIS_COLOR } from '../lib/calendar-events';
import { useScheduleConversion } from '../hooks/use-schedule-conversion';
import { Comments } from '../../comments/components/Comments';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { archiveRowsAction, deleteItemsAction, duplicateRowsAction, rowMenuEntry, type DuplicateOptions } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { useScheduleTypeItems } from '../hooks/use-settings-items';
import { itemCreator } from '../../../components/settings/create-settings-item';
import { FormActions } from '../../../components/dialogs/FormActions';
import { followBounds } from '../../../components/inputs/date-range';

interface ScheduleValues extends Record<string, unknown> {
  label: string;
  startDate: string;
  endDate: string | null;
  cases: ScheduleCase[];
  exceptions: ScheduleException[];
  typeId: string | null;
  ephemeris: boolean;
}

/**
 * Input of a schedule as it is saved (its hours and exceptions kept): the values of its form, the base of a change in
 * its cells or of a copy.
 * @param {WorkSchedule} schedule Schedule.
 * @returns {ScheduleValues} Input.
 */
const scheduleInputOf = (schedule: WorkSchedule): ScheduleValues => ({
  label: schedule.label,
  startDate: schedule.startDate,
  endDate: schedule.endDate || null,
  cases: readScheduleCases(schedule.cases, schedule.startDate),
  exceptions: readScheduleExceptions(schedule.exceptions),
  typeId: schedule.typeId ?? null,
  ephemeris: schedule.ephemeris,
});

/**
 * Words of the schedules of a nature (lot 16): créneaux, or éphémérides.
 * @param {boolean} ephemeris Éphémérides.
 * @param {boolean} perso Personal workspace (its créneaux are not « de travail »).
 * @returns {object} Words.
 */
const wordsOf = (ephemeris: boolean, perso: boolean) =>
  ephemeris
    ? { title: EPHEMERIDES_TITLE, one: 'éphéméride', many: 'éphémérides', type: 'Éphéméride', create: 'Nouvelle éphéméride', created: 'Éphéméride créée.', copied: 'Éphéméride dupliquée.', empty: 'Aucune éphéméride.', newType: 'Nouveau type d’éphémérides' }
    : { title: schedulesTitle(perso), one: 'créneau', many: 'créneaux', type: 'Créneau', create: 'Nouveaux créneaux', created: 'Créneaux créés.', copied: 'Créneaux dupliqués.', empty: 'Aucun créneau.', newType: 'Nouveau type de créneau' };

/**
 * Schedule form: label, kind, period, its cases (days and hours), and exceptions (a period with cases of its own,
 * edited the same way, or none: a pause). Rhythms ("every n weeks"…) are offered only when the period is long enough.
 * New schedules are created by its button; an existing one is saved field by field (decision D22, the whole schedule
 * each time; occurrences of routines a change makes disappear confirmed first, declined: put back), read only once
 * archived. An éphéméride (lot 16) is the same form, its kinds those of éphémérides; a new one lasts today, the whole
 * day.
 * @param {{ schedule?: WorkSchedule, ephemeris: boolean, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ScheduleForm({ schedule, ephemeris, onDone }: { schedule?: WorkSchedule; ephemeris: boolean; onDone: () => void }) {
  const { create, update } = useWorkScheduleMutations();
  const typeItems = useScheduleTypeItems({ ephemeris });
  const { data: allTypes } = useScheduleTypes();
  const types = (allTypes ?? []).filter((type) => type.ephemeris === ephemeris);
  const { data: defaultKind } = useDefaultScheduleKind();
  const { perso } = useActiveWorkspace();
  const words = wordsOf(ephemeris, perso);
  const { data: schedules } = useWorkSchedules();
  const current = schedule && (schedules?.find((item) => item.id === schedule.id) ?? schedule);
  const readOnly = Boolean(current?.archived);
  const base = useAppForm<ScheduleValues>({
    initialValues: schedule
      ? scheduleInputOf(schedule)
      : ephemeris
        ? { label: '', startDate: localToday(), endDate: localToday(), cases: [wholeDaysCase()], exceptions: [], typeId: null, ephemeris: true }
        : { label: 'Semaine type', startDate: localToday(), endDate: null, cases: [newScheduleCase(localToday())], exceptions: [], typeId: null, ephemeris: false },
    schema: workScheduleSchema,
  });
  const { form, saving } = useFieldSave(base, {
    save: schedule ? (_changes, input) => update.mutateAsync({ id: schedule.id, input }) : null,
    schema: workScheduleSchema,
    saved: current && scheduleInputOf(current),
    onBlur: ['label'],
    readOnly,
  });
  const values = form.values;
  return (
    <Stack gap="lg">
      <form
        noValidate
        // A new schedule only: an existing one is saved field by field (Enter saves the text typed).
        onSubmit={form.onSubmit(
          (input) => create.mutate(input, formCallbacks(form, words.created, onDone)),
          // An error on a field without input (a case, an exception…) is told.
          (errors) => {
            const message = Object.values(errors).find(Boolean);
            if (message) notifyError(String(message));
          },
        )}
      >
        <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
          <Stack gap="md">
            {schedule && !readOnly && <SaveStatus saving={saving} />}
            <Group grow align="flex-start">
              <TextInput label="Libellé" required data-autofocus placeholder={ephemeris ? 'Vacances, Noël, Anniversaire de Léa…' : undefined} {...form.getInputProps('label')} />
              <CreatableSelect
                label="Type"
                placeholder={ephemeris ? NO_KIND_LABEL : (defaultKind?.label ?? DEFAULT_SCHEDULE_KIND_LABEL)}
                clearable
                searchable
                onCreate={itemCreator(words.newType, typeItems)}
                {...itemSelectProps(types, form.values.typeId, undefined, schedule?.typeId)}
                {...form.getInputProps('typeId')}
              />
            </Group>
            <ScheduleRepetition
              error={(form.errors.startDate ?? form.errors.endDate ?? form.errors.cases ?? form.errors.exceptions) as string | undefined}
              value={{ startDate: values.startDate, endDate: values.endDate, cases: values.cases, exceptions: values.exceptions }}
              onChange={(repetition) => form.setValues({ ...repetition })}
            />
            {!schedule && <FormActions onCancel={onDone} submitLabel="Créer" loading={create.isPending} />}
          </Stack>
        </Fieldset>
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
/** Kind of the éphémérides without kind (there is no default kind of éphémérides). */
const NO_KIND_LABEL = 'Sans type';

/**
 * State of a schedule on a day: current, upcoming or past.
 * @param {WorkSchedule} schedule Schedule.
 * @param {string} today YYYY-MM-DD.
 * @returns {ScheduleState} State.
 */
function scheduleState(schedule: WorkSchedule, today: string): ScheduleState {
  return STATE_OF[periodState(schedule.startDate, schedule.endDate ?? null, today)];
}

/**
 * Hours of a schedule, one line per case.
 * @param {{ schedule: { cases: unknown, startDate: string } }} props Component props.
 * @returns {JSX.Element[]} Lines.
 */
function ScheduleHours({ schedule }: { schedule: { cases: unknown; startDate: string } }) {
  return readScheduleCases(schedule.cases, schedule.startDate).map((item, index) => (
    <Text key={index} size="xs">
      {describeScheduleCase(item, schedule.startDate)}
    </Text>
  ));
}

/**
 * Planned time slots: the schedules in a table to search, filter (kind, state) and sort; create, edit, « Dupliquer »,
 * convert (lot 16), archive, restore, delete. Archived ones (hidden unless the view includes them) are read only,
 * still followed by the routines using them.
 * Their kinds and the subscriptions are in the settings of the calendar. They show in the calendar; in a
 * professional workspace, they are the working hours (compared with the timers, events outside them told). The
 * éphémérides (lot 16: holidays, birthdays…) are the same table apart, of their own kinds, out of the free time and
 * of the working hours.
 * @param {{ ephemeris?: boolean }} [props] Component props: the éphémérides instead of the créneaux. Optional.
 * @returns {JSX.Element} Manager.
 */
export function WorkSchedulesManager({ ephemeris = false }: { ephemeris?: boolean }) {
  const { data: allSchedules } = useWorkSchedules();
  const schedules = allSchedules?.filter((schedule) => schedule.ephemeris === ephemeris);
  const { data: allTypes } = useScheduleTypes();
  const types = allTypes?.filter((type) => type.ephemeris === ephemeris);
  const convert = useScheduleConversion();
  const { data: defaultKind } = useDefaultScheduleKind();
  const { create, remove, update } = useWorkScheduleMutations();
  const queryClient = useQueryClient();
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
    const input = { ...scheduleInputOf(schedule), ...change };
    const result = workScheduleSchema.safeParse(input);
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Valeur invalide.'} Rien n’a été modifié.`);
      return;
    }
    update.mutate({ id: schedule.id, input }, ON_ERROR);
  };
  const { perso } = useActiveWorkspace();
  const words = wordsOf(ephemeris, perso);
  /**
   * Opens the form of a schedule in a side panel: a new one, or one to edit.
   * @param {{ schedule?: WorkSchedule }} [target] Schedule to edit. Optional. Default = a new one.
   * @returns {void}
   */
  const openForm = ({ schedule }: { schedule?: WorkSchedule } = {}) => {
    openFormPanel(schedule ? `Modifier « ${schedule.label} »` : words.create, (close) => <ScheduleForm schedule={schedule} ephemeris={schedule?.ephemeris ?? ephemeris} onDone={close} />, 'lg');
  };
  /** « Dupliquer » a schedule (decision D20): saved at once with its dates, cases and type, without its exceptions, then its form opens. */
  const duplicateSchedule: DuplicateOptions<WorkSchedule, string> = {
    duplicate: (schedule) => create.mutateAsync({ ...scheduleInputOf(schedule), label: copyName(schedule.label), exceptions: [] }),
    done: words.copied,
    open: (id) => {
      const copy = cachedItem(queryClient, [...calendarQueryKey, 'work-schedules'], id, (data: WorkSchedulesQuery) => data.workSchedules);
      if (copy) openForm({ schedule: copy });
    },
  };
  /**
   * « Supprimer » of schedules, on a row as on a selection.
   * @param {ScheduleRow[]} rows Schedules.
   * @param {() => void} [clear] Clears the selection once done. Optional.
   * @returns {SelectionAction} Action.
   */
  const deleteSchedules = (rows: ScheduleRow[], clear?: () => void) =>
    deleteItemsAction(rows, {
      noun: words.one,
      many: words.many,
      the: `l${ephemeris ? '’' : 'e '}${words.one}`,
      label: ({ schedule }) => schedule.label,
      risks: (subject, one) =>
        `${subject} et ${one ? 'ses' : 'leurs'} exceptions seront supprimés définitivement${perso || ephemeris ? '' : ` : ${one ? 'il ne comptera' : 'ils ne compteront'} plus dans le temps prévu`}. Les autres espaces abonnés ne ${one ? 'le' : 'les'} verront plus. Les évènements ne sont pas touchés.`,
      remove: ({ schedule }) => remove.mutateAsync(schedule.id),
      clear,
    });
  const typeById = mapById(allTypes ?? []);
  // Without kind: the working hours for the créneaux, no kind for the éphémérides.
  const defaultLabel = ephemeris ? NO_KIND_LABEL : (defaultKind?.label ?? DEFAULT_SCHEDULE_KIND_LABEL);
  const defaultColor = ephemeris ? EPHEMERIS_COLOR : (defaultKind?.color ?? null);
  const today = localToday();
  const kindLabel = (schedule: WorkSchedule) => (schedule.typeId ? (typeById.get(schedule.typeId)?.label ?? '') : defaultLabel);
  const scheduleComments = useCommentCounts(
    'SCHEDULE',
    (schedules ?? []).map((schedule) => schedule.id),
  );
  const columns: DataColumn<ScheduleRow>[] = [
    { id: 'label', required: true, label: 'Libellé', size: 220, locked: true, bulk: true, sortValue: ({ schedule }) => schedule.label, text: ({ schedule }) => schedule.label },
    {
      id: 'type',
      required: true,
      bulk: true,
      label: 'Type',
      size: 160,
      sortValue: ({ schedule }) => kindLabel(schedule),
      text: ({ schedule }) => kindLabel(schedule),
      filter: {
        kind: 'choice',
        value: ({ schedule }) => schedule.typeId ?? NO_KIND,
        options: [{ value: NO_KIND, label: defaultLabel }, ...itemChoices(types ?? [])],
      },
      groupable: true,
    },
    {
      id: 'start',
      required: true,
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
      filter: { kind: 'date', value: ({ schedule }) => schedule.endDate || null },
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
      required: true,
      label: 'État',
      size: 110,
      sortValue: ({ state: rowState }) => STATE_ORDER[rowState],
      text: ({ state: rowState }) => STATE_LABELS[rowState],
      filter: { kind: 'choice', value: ({ state: rowState }) => rowState, options: (['CURRENT', 'UPCOMING', 'PAST'] as const).map((value) => ({ value, label: STATE_LABELS[value] })) },
      groupable: true,
    },
    commentColumn<ScheduleRow>(scheduleComments, ({ schedule }) => schedule.id),
  ];
  const rows = (schedules ?? []).map((schedule) => ({ schedule, state: scheduleState(schedule, today), exceptions: readScheduleExceptions(schedule.exceptions) }));
  const view = useDataView({
    tableKey: ephemeris ? 'ephemerides' : 'work-schedules',
    getKey: ({ schedule }) => schedule.id,
    columns,
    rows,
    archived: ({ schedule }) => schedule.archived,
    title: words.title,
    first: [{ label: 'Toutes', config: { sorting: [{ id: 'start', desc: true }] } }],
  });
  const cellLabelOf = bulkCellLabels(view, (row) => row.schedule.label);
  const bulk = bulkSaver<ScheduleRow, Partial<WorkScheduleInput>>(view, (row, change) => Object.keys(change).length > 0 && saveSchedule(row.schedule, change));

  return (
    <Stack gap="md">
      <SectionHeader
        description={
          ephemeris
            ? 'Vacances, jours fériés, anniversaires… : affichés dans l’agenda, ils comptent dans les conditions de créneaux qui les citent, jamais dans le temps libre ni les heures de travail. Leurs types (dont les contextes du budget) sont dans les paramètres de l’agenda.'
            : perso
              ? 'Vos créneaux prévus, affichées dans l’agenda. Leurs types et leur affichage sont dans les paramètres de l’agenda.'
              : 'Vos créneaux de travail prévus : affichées dans l’agenda, comparées au temps chronométré, et signalées quand un évènement tombe en dehors.'
        }
        actions={
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            {words.create}
          </ActionButton>
        }
      />
      {!schedules?.length ? (
        <EmptyState icon={ephemeris ? <CalendarStarIcon aria-hidden /> : <ClockIcon aria-hidden />} message={words.empty} />
      ) : (
        <DataTable
          view={view}
          bar={{ searchLabel: 'Rechercher (libellé, type, exception)…' }}
          selectionLabel={(count) => selectedLabel(count, [words.one, words.many], false)}
          isArchived={({ schedule }) => schedule.archived}
          selectionActions={(rows, clear) => [
            archiveRowsAction({
              archived: rows.every(({ schedule }) => schedule.archived),
              apply: (archived) => setArchived.mutateAsync({ ids: rows.map(({ schedule }) => schedule.id), archived }),
              label: countOf(rows.length, words.one, words.many),
              count: rows.length,
              loading: setArchived.isPending,
              clear,
            }),
            deleteSchedules(rows, clear),
          ]}
          highlightOnHover
          verticalSpacing="xs"
          getKey={({ schedule }) => schedule.id}
          cells={(row) => {
            const { schedule, state: rowState, exceptions } = row;
            const type = schedule.typeId ? typeById.get(schedule.typeId) : undefined;
            const color = type?.color ?? defaultColor ?? 'var(--mantine-color-green-6)';
            const typeLabel = type?.label ?? defaultLabel;
            // Archived: read only.
            if (schedule.archived) {
              return {
                ...readOnlyCells(columns, row),
                label: (
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={600}>
                      {schedule.label}
                    </Text>
                    <ArchivedBadge feminine size="xs" />
                  </Group>
                ),
                type: (
                  <Group gap="xs" wrap="nowrap">
                    <ItemAvatar name={typeLabel} iconUrl={type?.iconUrl} color={color} />
                    <Text size="sm">{typeLabel}</Text>
                  </Group>
                ),
                hours: <ScheduleHours schedule={schedule} />,
                state: (
                  <Badge size="sm" variant="light" color={STATE_COLORS[rowState]}>
                    {STATE_LABELS[rowState]}
                  </Badge>
                ),
              };
            }
            return {
              label: <EditableText value={schedule.label} label={cellLabelOf('label', row, 'Libellé')} strong onSave={(label) => label && bulk('label')(row, { label })} />,
              type: (
                <EditableSelect
                  value={schedule.typeId ?? NO_KIND}
                  label={cellLabelOf('type', row, 'Type')}
                  leftSection={<ItemAvatar name={typeLabel} iconUrl={type?.iconUrl} color={color} />}
                  {...listSelectProps([{ id: NO_KIND, label: defaultLabel, color: defaultColor, archived: false }, ...(types ?? [])], undefined, schedule.typeId)}
                  onSave={(typeId) => typeId && bulk('type')(row, { typeId: typeId === NO_KIND ? null : typeId })}
                />
              ),
              start: (
                <EditableDate
                  value={schedule.startDate}
                  label={cellLabelOf('start', row, 'Début')}
                  // A start set after the end moves the end to it (decision Q).
                  onSave={(startDate) =>
                    startDate && bulk('start')(row, (target) => ({ startDate, endDate: followBounds([target.schedule.startDate, target.schedule.endDate], 'start', startDate)[1] }))
                  }
                />
              ),
              end: (
                <EditableDate
                  value={schedule.endDate || null}
                  label={cellLabelOf('end', row, 'Fin')}
                  nullable
                  minDate={schedule.startDate}
                  onSave={(endDate) =>
                    bulk('end')(row, (target) => ({ startDate: followBounds([target.schedule.startDate, target.schedule.endDate], 'end', endDate)[0] ?? target.schedule.startDate, endDate }))
                  }
                />
              ),
              hours: (
                <>
                  <Stack gap={0}>
                    <ScheduleHours schedule={schedule} />
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
                          {countOf(exceptions.length, 'exception')}
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
          actions={(row) => {
            const { schedule } = row;
            return (
              <RowActions
                name={schedule.label}
                primary={!schedule.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm({ schedule }) }}
                items={[
                  !schedule.archived && rowMenuEntry(duplicateRowsAction([schedule], duplicateSchedule)),
                  !schedule.archived && convert.schedule(schedule, schedule.typeId ? typeById.get(schedule.typeId) : undefined),
                  archiveEntry({ archived: schedule.archived, type: words.type, label: schedule.label }, setArchived, schedule.id),
                  rowMenuEntry(deleteSchedules([row])),
                ]}
              />
            );
          }}
        />
      )}
    </Stack>
  );
}
