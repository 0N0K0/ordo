import { plural, countOf } from '../../../lib/text';
import { ActionButton } from '../../../components/actions/ActionButton';
import { ItemAvatar } from '../../../components/settings/ItemAvatar';
import * as fmt from '../../../lib/format';
import { listSelectProps } from '../../../components/settings/item-look';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Group, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import {
  mapById,
  DEFAULT_SCHEDULE_DISPLAY,
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
import { useState } from 'react';
import { localToday } from '../../../lib/dates';
import { showFormError, useAppForm } from '../../../lib/form';
import { notifyError, notifySuccess, onMutationError } from '../../../lib/notify';
import { DestructiveActions } from '../../../components/dialogs/DestructiveActions';
import { useActiveWorkspace } from '../../workspaces/api';
import { useDefaultScheduleKind, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules, type WorkSchedule } from '../api';
import { ScheduleRepetition } from './ScheduleRepetition';
import { describeScheduleCase, exceptionPeriod, newScheduleCase } from '../lib/schedule-text';
import { Comments } from '../../comments/components/Comments';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { deleteRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { useDefaultColor } from '../../workspace/hooks/use-default-color';
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
  const { create, update, saveType } = useWorkScheduleMutations();
  const color = useDefaultColor();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  const form = useAppForm<ScheduleValues>({
    initialValues: {
      name: schedule?.name ?? (copyOf ? `${copyOf.name} (copie)` : 'Semaine type'),
      // A copy has no dates: to choose.
      startDate: schedule ? String(schedule.startDate) : copyOf ? '' : localToday(),
      endDate: schedule?.endDate ? String(schedule.endDate) : null,
      cases: schedule ? readScheduleCases(schedule.cases, String(schedule.startDate)) : copyOf ? readScheduleCases(copyOf.cases, String(copyOf.startDate)) : [newScheduleCase(localToday())],
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
            <CreatableSelect
              label="Type"
              placeholder={defaultKind?.name ?? DEFAULT_SCHEDULE_KIND_NAME}
              clearable
              searchable
              onCreate={(name) => saveType.mutateAsync({ id: null, input: { name, color, ...DEFAULT_SCHEDULE_DISPLAY } })}
              {...listSelectProps(types ?? [])}
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
      {schedule && <Comments target="SCHEDULE" id={schedule.id} />}
    </Stack>
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
      cases: readScheduleCases(schedule.cases, String(schedule.startDate).slice(0, 10)),
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
  const [editing, setEditing] = useState<WorkSchedule | 'new' | { copyOf: WorkSchedule } | null>(null);
  const [deleting, setDeleting] = useState<WorkSchedule | null>(null);
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
        options: [{ value: NO_KIND, label: defaultName }, ...(types ?? []).map((type) => ({ value: type.id, label: type.name, color: type.color ?? 'gray', iconUrl: type.iconUrl }))],
      },
      groupable: true,
    },
    {
      id: 'start',
      bulk: true,
      label: 'Début',
      size: 120,
      sortValue: ({ schedule }) => String(schedule.startDate),
      text: ({ schedule }) => fmt.day(String(schedule.startDate)),
      filter: { kind: 'date', value: ({ schedule }) => String(schedule.startDate).slice(0, 10) },
    },
    {
      id: 'end',
      bulk: true,
      label: 'Fin',
      size: 120,
      sortValue: ({ schedule }) => (schedule.endDate ? String(schedule.endDate) : '9999-12-31'),
      text: ({ schedule }) => (schedule.endDate ? fmt.day(String(schedule.endDate)) : 'Sans fin'),
      filter: { kind: 'date', value: ({ schedule }) => (schedule.endDate ? String(schedule.endDate).slice(0, 10) : null) },
    },
    {
      id: 'hours',
      label: 'Horaires',
      size: 320,
      text: ({ schedule, exceptions }) =>
        [...readScheduleCases(schedule.cases, String(schedule.startDate)).map((item) => describeScheduleCase(item, String(schedule.startDate))), ...exceptions.map((exception) => exception.label)]
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
    title: perso ? 'Plages' : 'Horaires de travail',
    first: [{ name: 'Toutes', config: { sorting: [{ id: 'start', desc: true }] } }],
  });
  const bulk = bulkSaver<ScheduleRow, Partial<WorkScheduleInput>>(view, (row, change) => Object.keys(change).length > 0 && saveSchedule(row.schedule, change));

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
              onError: onMutationError,
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
        <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => setEditing('new')} style={{ flexShrink: 0 }}>
          Nouvelles plages
        </ActionButton>
      </Group>
      {!schedules?.length ? (
        <EmptyState icon={<ClockIcon aria-hidden />} message="Aucune plage." />
      ) : (
        <DataTable
          view={view}
          bar={{ searchLabel: 'Rechercher (nom, type, exception)…' }}
          selectionLabel={(count) => selectedLabel(count, ['plage', 'plages'])}
          selectionActions={(rows, clear) => [
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
            return {
              name: <EditableText value={schedule.name} label={`Nom de ${schedule.name}`} strong onSave={(name) => name && bulk('name')(row, { name })} />,
              type: (
                <EditableSelect
                  value={schedule.typeId ?? NO_KIND}
                  label={`Type de ${schedule.name}`}
                  leftSection={<ItemAvatar name={kindName} iconUrl={type?.iconUrl} color={color} />}
                  {...listSelectProps([{ id: NO_KIND, name: defaultName, color: defaultKind?.color ?? null }, ...(types ?? [])])}
                  onSave={(typeId) => typeId && bulk('type')(row, { typeId: typeId === NO_KIND ? null : typeId })}
                />
              ),
              start: (
                <EditableDate
                  value={String(schedule.startDate).slice(0, 10)}
                  label={`Début de ${schedule.name}`}
                  onSave={(startDate) => startDate && bulk('start')(row, (target) => (target.schedule.endDate && String(target.schedule.endDate).slice(0, 10) < startDate ? {} : { startDate }))}
                />
              ),
              end: (
                <EditableDate
                  value={schedule.endDate ? String(schedule.endDate).slice(0, 10) : null}
                  label={`Fin de ${schedule.name}`}
                  nullable
                  minDate={String(schedule.startDate).slice(0, 10)}
                  onSave={(endDate) => bulk('end')(row, (target) => (endDate && endDate < String(target.schedule.startDate).slice(0, 10) ? {} : { endDate }))}
                />
              ),
              hours: (
                <>
                  <Stack gap={0}>
                    {readScheduleCases(schedule.cases, String(schedule.startDate)).map((item, index) => (
                      <Text key={index} size="xs">
                        {describeScheduleCase(item, String(schedule.startDate))}
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
