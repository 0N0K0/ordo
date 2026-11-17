import { TravelField } from '../../geo/components/TravelField';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { PICKER_FORMATS } from '../../../lib/format';
import { ItemAvatar } from '../../../components/settings/ItemAvatar';
import { listSelectProps } from '../../../components/settings/item-look';

import { TimeField } from '../../../components/inputs/TimeField';
import { ActionIcon, Alert, Anchor, Button, Group, Select, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { addDays, mapById, type CalendarEventInput, calendarEventInputSchema, daysBetween, formatDuration, type Recurrence, sharePeople } from '@ordo/shared';
import { ArrowArcRightIcon, ArrowCounterClockwiseIcon, CalendarXIcon, CopyIcon, TimerIcon, LinkIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useState } from 'react';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { localToday } from '../../../lib/dates';
import { showFormError, useAppForm } from '../../../lib/form';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { AssigneesSelect, ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { DestructiveButton } from '../../../components/dialogs/DestructiveActions';
import { useCalendarCategories, useCalendarEventMutations, useCalendars, type EventOccurrence, useCalendarCategoryMutations } from '../api';
import { useTimeMutations } from '../../time/api';
import { EventLocation } from '../../geo/components/EventLocation';
import { TravelCalculator } from '../../geo/components/TravelCalculator';
import { useTreasurySettings } from '../../treasury/api';
import { askScope } from '../lib/ask-scope';
import { AvailabilityHint } from './AvailabilityHint';
import { categoryOptions } from '../../../components/tree/category-tree';
import { LOCAL_TIME_ZONE, occurrenceInput, REMINDER_PRESETS } from '../lib/event-input';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { BeneficiariesSelect } from '../../beneficiaries/components/BeneficiariesSelect';
import { useRoutineOccurrences, useRoutinesData } from '../../routines/api';
import { EventRepetition } from './EventRepetition';
import { Comments } from '../../comments/components/Comments';
import { SheetsSection } from '../../sheets/components/SheetsSection';
import { useDefaultColor } from '../../workspace/hooks/use-default-color';
import { FormActions } from '../../../components/dialogs/FormActions';

type FormValues = CalendarEventInput & Record<string, unknown>;

/**
 * Printed day, with a time.
 * @param {string} date YYYY-MM-DD.
 * @param {string | null} [time] HH:MM. Optional.
 * @returns {string} "mardi 12 novembre 2026 à 10:00".
 */
const printedDay = (date: string, time?: string | null) => `${fmt.dayLong(date)}${time ? ` à ${time}` : ''}`;

interface PostponeFormProps {
  /** Fields of the event postponed (with the changes of the form). */
  fields: CalendarEventInput;
  /** Original title, for the title of the postponement. */
  title: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (input: CalendarEventInput) => void;
}

/**
 * New date (and title) of a postponement: the event keeps its duration, from the next day by default.
 * @param {PostponeFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function PostponeForm({ fields, title, loading, onCancel, onConfirm }: PostponeFormProps) {
  const span = Math.max(0, daysBetween(fields.startDate, fields.endDate));
  const [values, setValues] = useState({
    title: `Report de l’évènement « ${title} »`,
    startDate: addDays(fields.startDate, 1),
    startTime: fields.startTime ?? null,
    endTime: fields.endTime ?? null,
  });
  const endDate = addDays(values.startDate, span);
  const valid = Boolean(values.title.trim() && values.startDate && (fields.allDay || (values.startTime && values.endTime && (span > 0 || values.endTime > values.startTime))));
  return (
    <Stack gap="sm">
      <Text size="sm">La date initiale sera annulée (l’évènement reste barré dans l’agenda) et un nouvel évènement, lié à elle, sera créé à la nouvelle date.</Text>
      <TextInput label="Titre" required value={values.title} onChange={(event) => setValues({ ...values, title: event.currentTarget.value })} />
      <SimpleGrid cols={fields.allDay ? 1 : 3} spacing="sm">
        <DatePickerInput label="Nouvelle date" required valueFormat={PICKER_FORMATS.weekday} value={values.startDate} onChange={(date) => date && setValues({ ...values, startDate: date })} />
        {!fields.allDay && <TimeField label="Début" required value={values.startTime ?? ''} onChange={(value) => setValues({ ...values, startTime: value || null })} />}
        {!fields.allDay && <TimeField label="Fin" required value={values.endTime ?? ''} onChange={(value) => setValues({ ...values, endTime: value || null })} />}
      </SimpleGrid>
      <AvailabilityHint allDay={fields.allDay} startDate={values.startDate} startTime={values.startTime} endDate={endDate} endTime={values.endTime} />
      <FormActions onCancel={onCancel} submitLabel="Reporter" loading={loading} disabled={!valid} onSubmit={() => onConfirm({ ...fields, title: values.title.trim(), startDate: values.startDate, endDate, startTime: values.startTime, endTime: values.endTime, recurrence: null })} />
    </Stack>
  );
}

/**
 * Postponement of an occurrence in its panel: its form, and the postponement once confirmed.
 * @param {{ fields: PostponeFormProps['fields'], occurrence: EventOccurrence, onCancel: () => void, onDone: () => void }} props Fields of the event, occurrence, closing.
 * @returns {JSX.Element} Panel content.
 */
function PostponePanel({ fields, occurrence, onCancel, onDone }: { fields: PostponeFormProps['fields']; occurrence: EventOccurrence; onCancel: () => void; onDone: () => void }) {
  const { postpone } = useCalendarEventMutations();
  return (
    <PostponeForm
      fields={fields}
      title={occurrence.title}
      loading={postpone.isPending}
      onCancel={onCancel}
      onConfirm={(input) =>
        postpone.mutate(
          { id: occurrence.eventId, occurrenceDate: occurrence.occurrenceDate, input },
          {
            onSuccess: () => {
              notifySuccess('Évènement reporté.');
              onDone();
            },
            onError: onMutationError,
          },
        )
      }
    />
  );
}

interface EventFormProps {
  context: TaskContext;
  /** Occurrence edited. */
  occurrence?: EventOccurrence;
  /** Fields of a new event (dates selected in the calendar…). */
  defaults?: Partial<CalendarEventInput>;
  onDone: () => void;
  /** Duplicates the event: the fields of its copy (not saved yet). */
  onDuplicate?: (fields: CalendarEventInput) => void;
}

/**
 * Calendar event form: title, dates and times (or all day), repetition with pauses, place, links,
 * project, contributors, categories, tasks, reminders, description; a timer can be started on it. An event can be cancelled (kept struck through)
 * and restored, or postponed (cancelled, and a new event linked to it takes the new date); a warning tells
 * when it falls outside the working hours. For an occurrence of a recurring event, saving, deleting,
 * cancelling and restoring ask which occurrences are concerned.
 * @param {EventFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function EventForm({ context, occurrence, defaults, onDone, onDuplicate }: EventFormProps) {
  const { create: createCategory } = useCalendarCategoryMutations();
  const color = useDefaultColor();
  const { create, update, remove, setCalledOff } = useCalendarEventMutations();
  const { start: startTimer } = useTimeMutations();

  /**
   * Opens the postponement of this occurrence; once postponed, the event form closes too.
   * @returns {void}
   */
  const openPostpone = () =>
    occurrence && openFormPanel('Reporter l’évènement', (close) => <PostponePanel fields={values} occurrence={occurrence} onCancel={close} onDone={() => (close(), onDone())} />);

  /**
   * Starts a timer on this occurrence (its project, tasks and title).
   * @returns {void}
   */
  const handleTimer = () => {
    if (!occurrence || !values.projectId) return;
    startTimer.mutate(
      {
        projectId: values.projectId,
        // Tasks of the event belonging to its project tree (a timer only takes those).
        taskIds: (values.taskIds ?? []).filter((id) => {
          const task = context.taskById.get(id);
          return task !== undefined && context.rootOf(task.projectId) === context.rootOf(values.projectId!);
        }),
        description: values.title,
        event: { eventId: occurrence.eventId, occurrenceDate: occurrence.occurrenceDate },
      },
      { onSuccess: () => notifySuccess('Chrono lancé sur l’évènement.'), onError: onMutationError },
    );
  };
  const { data: categories } = useCalendarCategories();
  const { data: treasury } = useTreasurySettings();
  const { data: calendarsData } = useCalendars();
  const calendars = calendarsData?.calendars ?? [];
  // Questions are stacked over this form's panel: it must stay mounted to finish the save.
  const today = localToday();
  const initial: CalendarEventInput = occurrence
    ? occurrenceInput(occurrence)
    : {
        title: '',
        description: '',
        location: '',
        locationLat: null,
        locationLon: null,
        links: [],
        allDay: false,
        startDate: today,
        startTime: '09:00',
        endDate: today,
        endTime: '10:00',
        timeZone: LOCAL_TIME_ZONE,
        recurrence: null,
        reminders: [15],
        travelBefore: 0,
        travelAfter: 0,
        projectId: null,
        calendarId: null,
        contributorIds: [],
        relationIds: [],
        beneficiaryIds: [],
        beneficiaryRelationIds: [],
        categoryIds: [],
        taskIds: [],
        routineLinks: [],
        ...defaults,
      };
  const form = useAppForm<FormValues>({ initialValues: initial as FormValues, schema: calendarEventInputSchema });
  const values = form.values;
  // Relations with a contributor take part as that contributor; one already chosen stays offered.
  const relationOptions = (treasury?.treasuryRelations ?? [])
    .filter((relation) => !relation.contributorId || (values.relationIds ?? []).includes(relation.id))
    .map((relation) => ({ value: relation.id, label: relation.name }));
  // Routines due on the days of the event (an occurrence each), with someone in common with it; those chosen stay.
  const { data: routinesData } = useRoutinesData();
  const { data: routineDays } = useRoutineOccurrences(values.startDate && values.endDate ? { from: values.startDate, to: values.endDate } : null);
  const routineById = mapById(routinesData?.routines ?? []);
  const multiDay = values.startDate !== values.endDate;
  const chosenLinks = new Set((values.routineLinks ?? []).map((link) => `${link.routineId}|${link.date}`));
  const routineOptions = [
    ...new Map(
      [...(routineDays ?? []).map((item) => ({ routineId: item.routineId, date: String(item.date) })), ...(values.routineLinks ?? [])].map((link) => [`${link.routineId}|${link.date}`, link]),
    ).values(),
  ].flatMap((link) => {
    const routine = routineById.get(link.routineId);
    const key = `${link.routineId}|${link.date}`;
    if (!routine || (!chosenLinks.has(key) && (routine.archived || !sharePeople(routine.assigneeIds, values.contributorIds)))) return [];
    return [{ value: key, label: multiDay ? `${routine.title} (${fmt.weekday(link.date)})` : routine.title }];
  });
  const recurring = occurrence?.occurrenceDate != null;
  // A rule is edited from the start of its series (for the whole series or the following occurrences).
  const ruleStart = recurring && occurrence ? occurrence.seriesStartDate : values.startDate;

  const handleSubmit = form.onSubmit(async (input) => {
    const callbacks = {
      onSuccess: () => {
        notifySuccess(occurrence ? 'Évènement modifié.' : 'Évènement créé.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (!occurrence) {
      create.mutate(input, callbacks);
      return;
    }
    let scope: 'THIS' | 'FOLLOWING' | 'ALL' = 'ALL';
    if (recurring) {
      const ruleChanged = JSON.stringify(input.recurrence) !== JSON.stringify(occurrence.recurrence);
      const chosen = await askScope({ action: 'update', allowThis: !ruleChanged });
      if (!chosen) return;
      scope = chosen;
    }
    update.mutate({ id: occurrence.eventId, input, scope, occurrenceDate: occurrence.occurrenceDate }, callbacks);
  });

  /**
   * Deletes the event (asking which occurrences for a recurring one).
   * @returns {Promise<void>}
   */
  const handleDelete = async () => {
    if (!occurrence) return;
    /**
     * Runs the deletion.
     * @param {'THIS' | 'FOLLOWING' | 'ALL'} scope Scope.
     * @returns {void}
     */
    const run = (scope: 'THIS' | 'FOLLOWING' | 'ALL') =>
      remove.mutate(
        { id: occurrence.eventId, scope, occurrenceDate: occurrence.occurrenceDate },
        {
          onSuccess: () => {
            notifySuccess('Évènement supprimé.');
            onDone();
          },
          onError: onMutationError,
        },
      );
    if (recurring) {
      const scope = await askScope({ action: 'delete' });
      if (scope) run(scope);
      return;
    }
    confirmDestructive({
      title: 'Supprimer l’évènement',
      risks: `L’évènement « ${occurrence?.title ?? ''} » sera supprimé définitivement. Cette action est irréversible.`,
      onConfirm: () =>
        remove.mutate(
          { id: occurrence!.eventId, scope: 'ALL', occurrenceDate: occurrence!.occurrenceDate },
          {
            onSuccess: () => {
              notifySuccess('Évènement supprimé.');
              onDone();
            },
            onError: onMutationError,
          },
        ),
    });
  };

  /**
   * Cancels the event (kept struck through) or restores it, asking which occurrences for a recurring one.
   * @param {boolean} calledOff Cancel (true) or restore (false).
   * @returns {Promise<void>}
   */
  const handleCalledOff = async (calledOff: boolean) => {
    if (!occurrence) return;
    let scope: 'THIS' | 'FOLLOWING' | 'ALL' = 'ALL';
    if (recurring) {
      const chosen = await askScope({ action: calledOff ? 'cancel' : 'restore' });
      if (!chosen) return;
      scope = chosen;
    }
    setCalledOff.mutate(
      { id: occurrence.eventId, scope, occurrenceDate: occurrence.occurrenceDate, calledOff },
      {
        onSuccess: () => {
          notifySuccess(calledOff ? 'Évènement annulé.' : 'Évènement rétabli.');
          onDone();
        },
        onError: onMutationError,
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        {occurrence?.calledOff && (
          <Alert color="gray" icon={<CalendarXIcon aria-hidden />} title="Évènement annulé">
            Il reste dans l’agenda, barré.{' '}
            {occurrence.postponedTo.map((target) => (
              <span key={target.eventId}>
                Reporté au{' '}
                <Anchor component={Link} to={`/calendar?date=${target.startDate}`} onClick={onDone}>
                  {printedDay(target.startDate, target.startTime)}
                </Anchor>
                .{' '}
              </span>
            ))}
          </Alert>
        )}
        {occurrence?.postponedFrom && (
          <Text size="sm" c="dimmed">
            Report de l’évènement « {occurrence.postponedFrom.title} »
            {occurrence.postponedFrom.date && (
              <>
                {' '}
                du{' '}
                <Anchor component={Link} to={`/calendar?date=${occurrence.postponedFrom.date}`} onClick={onDone}>
                  {printedDay(occurrence.postponedFrom.date)}
                </Anchor>
              </>
            )}
            .
          </Text>
        )}
        <TextInput label="Titre" required data-autofocus {...form.getInputProps('title')} />
        <EventRepetition
          ruleStart={ruleStart}
          error={(form.errors.startDate ?? form.errors.endDate ?? form.errors.startTime ?? form.errors.endTime ?? form.errors.recurrence) as string | undefined}
          value={{
            allDay: values.allDay,
            startDate: values.startDate,
            startTime: values.startTime ?? null,
            endDate: values.endDate,
            endTime: values.endTime ?? null,
            recurrence: (values.recurrence as Recurrence | null | undefined) ?? null,
          }}
          onChange={(timing) => form.setValues({ ...timing })}
        />
        {!values.allDay && (
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <TravelField way="before" description="Avant le début" {...form.getInputProps('travelBefore')} />
            <TravelField way="after" description="Après la fin" {...form.getInputProps('travelAfter')} />
            <div>
              <TravelCalculator
                eventPoint={values.locationLat != null && values.locationLon != null ? { lat: values.locationLat, lon: values.locationLon } : null}
                onResult={({ before, after }) => form.setValues({ ...(before !== undefined && { travelBefore: before }), ...(after !== undefined && { travelAfter: after }) })}
              />
            </div>
          </SimpleGrid>
        )}
        <AvailabilityHint allDay={values.allDay} startDate={values.startDate} startTime={values.startTime ?? null} endDate={values.endDate} endTime={values.endTime ?? null} />


        <EventLocation
          value={{ text: values.location ?? '', point: values.locationLat != null && values.locationLon != null ? { lat: values.locationLat, lon: values.locationLon } : null }}
          error={form.errors.location}
          onChange={(value) => form.setValues({ location: value.text, locationLat: value.point?.lat ?? null, locationLon: value.point?.lon ?? null })}
        />

        <Stack gap={4}>
          <Group gap="xs">
            <Text size="sm" fw={500}>
              Liens
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<PlusIcon aria-hidden />}
              onClick={() => form.setFieldValue('links', [...values.links, { url: '', label: '' }])}
            >
              Ajouter un lien
            </Button>
          </Group>
          {values.links.map((_, index) => (
            <Group key={index} gap="xs" wrap="nowrap" align="flex-start">
              <TextInput
                aria-label={`Adresse du lien ${index + 1}`}
                placeholder="https://…"
                leftSection={<LinkIcon aria-hidden />}
                style={{ flex: 2 }}
                {...form.getInputProps(`links.${index}.url`)}
              />
              <TextInput aria-label={`Libellé du lien ${index + 1}`} placeholder="Libellé (facultatif)" style={{ flex: 1 }} {...form.getInputProps(`links.${index}.label`)} />
              <Tooltip label="Retirer le lien">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  mt={4}
                  aria-label={`Retirer le lien ${index + 1}`}
                  onClick={() => form.setFieldValue('links', values.links.filter((__, position) => position !== index))}
                >
                  <XIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Calendrier"
            description={recurring ? 'Pour toute la série.' : undefined}
            {...listSelectProps(calendars)}
            // Without a choice, the event goes into the first calendar.
            value={values.calendarId ?? calendars[0]?.id ?? null}
            onChange={(calendarId) => form.setFieldValue('calendarId', calendarId)}
            allowDeselect={false}
            leftSection={(() => {
              const current = calendars.find((calendar) => calendar.id === (values.calendarId ?? calendars[0]?.id));
              return current ? <ItemAvatar name={current.name} iconUrl={current.iconUrl} color={current.color} /> : undefined;
            })()}
          />
          <ProjectSelect
            context={context}
            label="Projet"
            clearable
            placeholder="Aucun"
            {...form.getInputProps('projectId')}
            onChange={(projectId) => {
              form.setFieldValue('projectId', projectId);
              // Contributors out of the new project are dropped.
              const allowed = new Set(context.assignableFor([projectId], initial.contributorIds ?? []).map((contributor) => contributor.id));
              form.setFieldValue('contributorIds', values.contributorIds.filter((id) => allowed.has(id)));
            }}
          />
          <AssigneesSelect
            label="Contributeurs"
            description={values.projectId ? 'Contributeurs du projet.' : undefined}
            contributors={context.assignableFor([values.projectId ?? null], initial.contributorIds ?? [])}
            value={values.contributorIds}
            onChange={(contributorIds) => form.setFieldValue('contributorIds', contributorIds)}
          />
          <BeneficiariesSelect
            description="Pour qui est l’évènement (l’anniversaire de votre fils) : ni forcément présents, ni contributeurs."
            value={{ beneficiaryIds: values.beneficiaryIds ?? [], beneficiaryRelationIds: values.beneficiaryRelationIds ?? [] }}
            onChange={(beneficiaries) => form.setValues({ ...beneficiaries })}
          />
          <BatchMultiSelect
            label="Relations"
            description="Personnes hors de l’équipe, sans contributeur"
            placeholder={(values.relationIds ?? []).length ? undefined : 'Aucune'}
            data={relationOptions}
            searchable
            clearable
            nothingFoundMessage="Ajoutez des relations dans Paramètres › Équipe (ou Foyer) et contributeurs"
            {...form.getInputProps('relationIds')}
          />
          <BatchMultiSelect
            onCreate={async (name) => (await createCategory.mutateAsync({ name, color, parentId: null })).id}
            label="Catégories"
            placeholder={values.categoryIds.length ? undefined : 'Aucune'}
            {...treeSelectProps(categoryOptions(categories ?? []))}
            searchable
            clearable
            nothingFoundMessage="Créez des catégories dans Agenda › Paramètres"
            {...form.getInputProps('categoryIds')}
          />
          <BatchMultiSelect
            label="Tâches"
            placeholder={values.taskIds?.length ? undefined : 'Aucune'}
            description={
              [values.projectId ? 'Tâches du projet et de ses sous-projets' : null, values.contributorIds.length ? 'avec un contributeur de l’évènement (ou sans assigné)' : null].filter(Boolean).join(', ') || undefined
            }
            // Of the project, and with someone in common with the event (or nobody on either side); those chosen stay.
            data={context.tasks
              .filter(
                (task) =>
                  values.taskIds?.includes(task.id) ||
                  (!task.archived && (!values.projectId || context.rootOf(task.projectId) === context.rootOf(values.projectId)) && sharePeople(task.assigneeIds, values.contributorIds)),
              )
              .map((task) => ({ value: task.id, label: `${context.taskLabel(task, values.projectId)}${task.closed ? ' (fermée)' : ''}` }))}
            searchable
            clearable
            limit={100}
            nothingFoundMessage="Aucune tâche"
            value={values.taskIds ?? []}
            onChange={(taskIds) => form.setFieldValue('taskIds', taskIds)}
            error={form.errors.taskIds as string | undefined}
          />
          <BatchMultiSelect
            label="Routines"
            placeholder={(values.routineLinks ?? []).length ? undefined : 'Aucune'}
            description="Routines de ces jours faites pendant l’évènement (ce jour-là seulement), avec un contributeur de l’évènement."
            data={routineOptions}
            searchable
            clearable
            nothingFoundMessage="Aucune routine ces jours-là"
            value={(values.routineLinks ?? []).map((link) => `${link.routineId}|${link.date}`)}
            onChange={(keys) => form.setFieldValue('routineLinks', keys.map((key) => ({ routineId: key.split('|')[0], date: key.split('|')[1] })))}
            error={form.errors.routineLinks as string | undefined}
          />
          <BatchMultiSelect
            label="Rappels"
            placeholder={values.reminders.length ? undefined : 'Aucun'}
            data={REMINDER_PRESETS.map((preset) => ({ value: String(preset.value), label: preset.label }))}
            value={values.reminders.map(String)}
            onChange={(reminders) => form.setFieldValue('reminders', reminders.map(Number).sort((a, b) => a - b))}
            clearable
          />
        </SimpleGrid>
        {recurring && (
          <Text size="xs" c="dimmed">
            Projet, contributeurs, catégories, tâches et rappels s’appliquent à toute la série.
          </Text>
        )}
        {occurrence && (
          <Group gap="sm">
            <Tooltip label={values.projectId ? 'Lance un chrono rattaché à cet évènement' : 'Choisissez d’abord un projet'}>
              <Button variant="default" size="xs" leftSection={<TimerIcon aria-hidden />} disabled={!values.projectId} loading={startTimer.isPending} onClick={handleTimer}>
                Chronométrer
              </Button>
            </Tooltip>
            {occurrence.trackedSeconds > 0 && (
              <Text size="sm" c="dimmed">
                {formatDuration(occurrence.trackedSeconds)} chronométrées sur cet évènement.
              </Text>
            )}
          </Group>
        )}

        <MarkdownEditor
          label="Description"
          value={values.description ?? ''}
          onChange={(description) => form.setFieldValue('description', description)}
          suggestions={context.suggestionsFor(values.projectId ?? null)}
          minRows={3}
        />
        {occurrence && <SheetsSection owner={{ eventId: occurrence.eventId }} occurrenceDate={String(occurrence.occurrenceDate ?? occurrence.startDate)} name={values.title || 'l’évènement'} />}
        {occurrence && <Comments target="EVENT" id={occurrence.eventId} projectId={values.projectId ?? null} title={occurrence.occurrenceDate ? 'Commentaires (toute la série)' : undefined} />}

        <Group justify="space-between" gap="sm">
          {occurrence ? (
            <Group gap={4}>
              <DestructiveButton leftSection={<TrashIcon aria-hidden />} onClick={() => void handleDelete()} loading={remove.isPending}>
                Supprimer
              </DestructiveButton>
              {onDuplicate && (
                <Tooltip label={recurring ? 'Copie de cette occurrence, en évènement unique, à enregistrer' : 'Copie de l’évènement, à enregistrer'}>
                  <Button
                    variant="subtle"
                    color="gray"
                    leftSection={<CopyIcon aria-hidden />}
                    onClick={() =>
                      // Its fields as they are in the form; an occurrence of a series becomes a one-off event.
                      onDuplicate({ ...values, title: `${values.title} (copie)`, recurrence: recurring ? null : (values.recurrence ?? null) })
                    }
                  >
                    Dupliquer
                  </Button>
                </Tooltip>
              )}
              {occurrence.calledOff ? (
                <Button variant="subtle" color="gray" leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={() => void handleCalledOff(false)} loading={setCalledOff.isPending}>
                  Rétablir
                </Button>
              ) : (
                <>
                  <Button variant="subtle" color="gray" leftSection={<CalendarXIcon aria-hidden />} onClick={() => void handleCalledOff(true)} loading={setCalledOff.isPending}>
                    Annuler l’évènement
                  </Button>
                  <Button variant="subtle" color="gray" leftSection={<ArrowArcRightIcon aria-hidden />} onClick={openPostpone}>
                    Reporter
                  </Button>
                </>
              )}
            </Group>
          ) : (
            <span />
          )}
          <FormActions onCancel={onDone} submitLabel={occurrence ? 'Enregistrer' : 'Créer l’évènement'} loading={create.isPending || update.isPending} />
        </Group>
      </Stack>
    </form>
  );
}
