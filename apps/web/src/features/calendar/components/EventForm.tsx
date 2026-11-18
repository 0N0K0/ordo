import { relationNoun } from '../../../components/people/people-options';
import { ArchivedNotice } from '../../../components/feedback/ArchivedNotice';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { copyName } from '../../../lib/text';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { TravelField } from '../../geo/components/TravelField';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { PICKER_FORMATS } from '../../../lib/format';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { listSelectProps } from '../../../components/items/item-look';

import { Alert, Anchor, Button, Fieldset, Group, Select, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { addDays, mapById, type CalendarEventInput, calendarEventInputSchema, daysBetween, formatDuration, type Recurrence, sharePeople, EVENT_LABEL_MAX } from '@ordo/shared';
import { ArrowArcRightIcon, ArrowCounterClockwiseIcon, CalendarXIcon, CopyIcon, TimerIcon, LinkIcon, XIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useState } from 'react';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { AssigneesSelect, ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { DeleteButton } from '../../../components/dialogs/DestructiveActions';
import { calendarQueryKey, useCalendarCategories, useCalendarEventMutations, useCalendars, type EventOccurrence, type CalendarEventScope } from '../api';
import { archivedCalendarIds } from '../lib/calendar-events';
import { archiveEntry, unarchived, unarchivedOffered, useSetArchived } from '../../../lib/archive';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { TIMER_REPLACED_HINT, useStartTimer } from '../../time/hooks/use-start-timer';
import { timeTasks } from '../../time/lib/time-tasks';
import { EventLocation } from '../../geo/components/EventLocation';
import { TravelCalculator } from '../../geo/components/TravelCalculator';
import { useTreasurySettings } from '../../treasury/api';
import { useActiveWorkspace } from '../../workspaces/api';
import { askScope, chooseScope } from '../lib/ask-scope';
import { AvailabilityHint } from './AvailabilityHint';
import { categoryOptions } from '../../../components/tree/category-tree';
import { LOCAL_TIME_ZONE, occurrenceInput } from '../lib/event-input';
import { EVENT_REMINDERS } from '../../../components/inputs/reminder-presets';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { BeneficiariesSelect } from '../../beneficiaries/components/BeneficiariesSelect';
import { useRoutineOccurrences, useRoutinesData } from '../../routines/api';
import { EventRepetition } from './EventRepetition';
import { Comments } from '../../comments/components/Comments';
import { SheetsSection } from '../../sheets/components/SheetsSection';
import { useCalendarCategoryItems } from '../hooks/use-settings-items';
import { itemCreator } from '../../../components/settings/create-settings-item';
import { FormActions } from '../../../components/dialogs/FormActions';
import { RemindersSelect } from '../../../components/inputs/RemindersSelect';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { calendarPath } from '../../../app/pages';

type FormValues = CalendarEventInput & Record<string, unknown>;

interface PostponeFormProps {
  /** Fields of the event postponed (with the changes of the form). */
  fields: CalendarEventInput;
  /** Original label, for the label of the postponement. */
  label: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (input: CalendarEventInput) => void;
}

/**
 * New date (and label) of a postponement: the event keeps its duration, from the next day by default.
 * @param {PostponeFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function PostponeForm({ fields, label, loading, onCancel, onConfirm }: PostponeFormProps) {
  const span = Math.max(0, daysBetween(fields.startDate, fields.endDate));
  const [values, setValues] = useState({
    label: `Report de l’évènement « ${label} »`,
    startDate: addDays(fields.startDate, 1),
    startTime: fields.startTime ?? null,
    endTime: fields.endTime ?? null,
  });
  const endDate = addDays(values.startDate, span);
  const valid = Boolean(values.label.trim() && values.startDate && (fields.allDay || (values.startTime && values.endTime && (span > 0 || values.endTime > values.startTime))));
  return (
    <Stack gap="sm">
      <Text size="sm">La date initiale sera annulée (l’évènement reste barré dans l’agenda) et un nouvel évènement, lié à elle, sera créé à la nouvelle date.</Text>
      <TextInput label="Titre" required value={values.label} onChange={(event) => setValues({ ...values, label: event.currentTarget.value })} />
      <SimpleGrid cols={fields.allDay ? 1 : 3} spacing="sm">
        <DatePickerInput label="Nouvelle date" required valueFormat={PICKER_FORMATS.weekday} value={values.startDate} onChange={(date) => date && setValues({ ...values, startDate: date })} />
        {!fields.allDay && <TimePicker label="Début" required value={values.startTime ?? ''} onChange={(value) => setValues({ ...values, startTime: value || null })} />}
        {!fields.allDay && <TimePicker label="Fin" required value={values.endTime ?? ''} onChange={(value) => setValues({ ...values, endTime: value || null })} />}
      </SimpleGrid>
      <AvailabilityHint allDay={fields.allDay} startDate={values.startDate} startTime={values.startTime} endDate={endDate} endTime={values.endTime} />
      <FormActions
        onCancel={onCancel}
        submitLabel="Reporter"
        submitIcon={<ArrowArcRightIcon aria-hidden />}
        loading={loading}
        disabled={!valid}
        onSubmit={() => onConfirm({ ...fields, label: values.label.trim(), startDate: values.startDate, endDate, startTime: values.startTime, endTime: values.endTime, recurrence: null })}
      />
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
      label={occurrence.label}
      loading={postpone.isPending}
      onCancel={onCancel}
      onConfirm={(input) => postpone.mutate({ id: occurrence.eventId, occurrenceDate: occurrence.occurrenceDate, input }, formCallbacks(null, 'Évènement reporté.', onDone))}
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
 * Calendar event form: label, dates and times (or all day), repetition with pauses, place, links,
 * project, contributors, categories, tasks, reminders, description; a timer can be started on it. An event can be cancelled (kept struck through)
 * and restored, or postponed (cancelled, and a new event linked to it takes the new date); a warning tells
 * when it falls outside the working hours. For an occurrence of a recurring event, saving, deleting,
 * cancelling and restoring ask which occurrences are concerned. An archived event (or one of an archived calendar)
 * opens read only: it can be restored or deleted.
 * @param {EventFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function EventForm({ context, occurrence, defaults, onDone, onDuplicate }: EventFormProps) {
  const categoryItems = useCalendarCategoryItems();
  const { create, update, remove, setCalledOff } = useCalendarEventMutations();
  const { startTimer, isPending: timerStarting, replacing } = useStartTimer();

  /**
   * Opens the postponement of this occurrence; once postponed, the event form closes too.
   * @returns {void}
   */
  const openPostpone = () =>
    occurrence && openFormPanel('Reporter l’évènement', (close) => <PostponePanel fields={values} occurrence={occurrence} onCancel={close} onDone={() => (close(), onDone())} />);

  /**
   * Starts a timer on this occurrence (its project, tasks and label).
   * @returns {void}
   */
  const handleTimer = () => {
    if (!occurrence || !values.projectId) return;
    const allowed = new Set(timeTasks(context, values.projectId).map((task) => task.id));
    const timeTaskIds = (values.taskIds ?? []).filter((id) => allowed.has(id));
    startTimer({
      projectId: values.projectId,
      // Tasks of the event a timer on its project takes (the API's rule: the project, its sub-projects, tasks without project).
      taskIds: timeTaskIds,
      description: values.label,
      event: { eventId: occurrence.eventId, occurrenceDate: occurrence.occurrenceDate },
    });
  };
  const { data: categories } = useCalendarCategories();
  const { data: treasury } = useTreasurySettings();
  const { data: calendarsData } = useCalendars();
  const calendars = calendarsData?.calendars ?? [];
  const setArchived = useSetArchived('CALENDAR_EVENT', [calendarQueryKey]);
  // Archived (its series), or in an archived calendar (its container): read only.
  const calendarArchived = occurrence ? archivedCalendarIds(calendars).has(occurrence.calendarId) : false;
  const readOnly = Boolean(occurrence?.archived) || calendarArchived;
  // Without a choice, the event goes into the first calendar not archived.
  const defaultCalendarId = unarchived(calendars)[0]?.id ?? null;
  // Questions are stacked over this form's panel: it must stay mounted to finish the save.
  const today = localToday();
  const initial: CalendarEventInput = occurrence
    ? occurrenceInput(occurrence)
    : {
        label: '',
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
  const { perso } = useActiveWorkspace();
  // Relations with a contributor take part as that contributor, archived ones are not offered; one already chosen stays.
  const relationOptions = (treasury?.treasuryRelations ?? [])
    .filter((relation) => (!relation.contributorId && !relation.archived) || (values.relationIds ?? []).includes(relation.id))
    .map((relation) => ({ value: relation.id, label: relation.name }));
  // Routines due on the days of the event (an occurrence each), with someone in common with it; those chosen stay.
  const { data: routinesData } = useRoutinesData();
  const { data: routineDays } = useRoutineOccurrences(values.startDate && values.endDate ? { from: values.startDate, to: values.endDate } : null);
  const routineById = mapById(routinesData?.routines ?? []);
  const multiDay = values.startDate !== values.endDate;
  const chosenLinks = new Set((values.routineLinks ?? []).map((link) => `${link.routineId}|${link.date}`));
  const routineOptions = [
    ...new Map(
      [...(routineDays ?? []).map((item) => ({ routineId: item.routineId, date: item.date })), ...(values.routineLinks ?? [])].map((link) => [`${link.routineId}|${link.date}`, link]),
    ).values(),
  ].flatMap((link) => {
    const routine = routineById.get(link.routineId);
    const key = `${link.routineId}|${link.date}`;
    if (!routine || (!chosenLinks.has(key) && (routine.archived || !sharePeople(routine.assigneeIds, values.contributorIds)))) return [];
    return [{ value: key, label: multiDay ? `${routine.label} (${fmt.weekday(link.date)})` : routine.label }];
  });
  const recurring = occurrence?.occurrenceDate != null;

  // Archives the event (its whole series) or restores it, with an undo, then closes the form; in its « … » menu.
  const archiveMenu = occurrence && (
    <ActionsMenu name="l’évènement" items={[archiveEntry({ archived: occurrence.archived, type: 'Évènement', name: occurrence.label }, setArchived, occurrence.eventId, onDone)]} />
  );
  // A rule is edited from the start of its series (for the whole series or the following occurrences).
  const ruleStart = recurring && occurrence ? occurrence.seriesStartDate : values.startDate;

  const handleSubmit = form.onSubmit(async (input) => {
    const callbacks = formCallbacks(form, occurrence ? 'Évènement modifié.' : 'Évènement créé.', onDone);
    if (!occurrence) {
      create.mutate(input, callbacks);
      return;
    }
    // A new rule applies from an occurrence on, never to this one alone.
    const ruleChanged = JSON.stringify(input.recurrence) !== JSON.stringify(occurrence.recurrence);
    const scope = await chooseScope(recurring, { action: 'update', allowThis: !ruleChanged });
    if (!scope) return;
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
     * @param {CalendarEventScope} scope Scope.
     * @returns {void}
     */
    const run = (scope: CalendarEventScope) => remove.mutate({ id: occurrence.eventId, scope, occurrenceDate: occurrence.occurrenceDate }, formCallbacks(null, 'Évènement supprimé.', onDone));
    if (recurring) {
      const scope = await askScope({ action: 'delete' });
      if (scope) run(scope);
      return;
    }
    confirmDestructive({
      title: 'Supprimer l’évènement',
      risks: `L’évènement « ${occurrence?.label ?? ''} » sera supprimé définitivement.`,
      onConfirm: () => run('ALL'),
    });
  };

  /**
   * Cancels the event (kept struck through) or restores it, asking which occurrences for a recurring one.
   * @param {boolean} calledOff Cancel (true) or restore (false).
   * @returns {Promise<void>}
   */
  const handleCalledOff = async (calledOff: boolean) => {
    if (!occurrence) return;
    const scope = await chooseScope(recurring, { action: calledOff ? 'cancel' : 'restore' });
    if (!scope) return;
    setCalledOff.mutate({ id: occurrence.eventId, scope, occurrenceDate: occurrence.occurrenceDate, calledOff }, formCallbacks(null, calledOff ? 'Évènement annulé.' : 'Évènement rétabli.', onDone));
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        {readOnly && (
          <ArchivedNotice
            title={
              <Group gap="xs">
                {calendarArchived ? 'Calendrier archivé' : 'Évènement archivé'}
                <ArchivedBadge size="sm" />
              </Group>
            }
          >
            {calendarArchived ? 'Restaurez son calendrier pour modifier l’évènement.' : 'Restaurez-le pour le modifier.'}
          </ArchivedNotice>
        )}
        {occurrence?.calledOff && (
          <Alert color="gray" icon={<CalendarXIcon aria-hidden />} title="Évènement annulé">
            Il reste dans l’agenda, barré.{' '}
            {occurrence.postponedTo.map((target) => (
              <span key={target.eventId}>
                Reporté au{' '}
                <Anchor component={Link} to={calendarPath(target.startDate)} onClick={onDone}>
                  {fmt.dayLong(target.startDate)}
                  {target.startTime && ` à ${target.startTime}`}
                </Anchor>
                .{' '}
              </span>
            ))}
          </Alert>
        )}
        {occurrence?.postponedFrom && (
          <Text size="sm" c="dimmed">
            Report de l’évènement « {occurrence.postponedFrom.label} »
            {occurrence.postponedFrom.date && (
              <>
                {' '}
                du{' '}
                <Anchor component={Link} to={calendarPath(occurrence.postponedFrom.date)} onClick={onDone}>
                  {fmt.dayLong(occurrence.postponedFrom.date)}
                </Anchor>
              </>
            )}
            .
          </Text>
        )}
        <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
          <Stack gap="md">
            <TextInput label="Titre" required data-autofocus {...form.getInputProps('label')} />
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

            <LabeledField label="Liens">
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
                  <RemoveButton
                    label="Retirer le lien"
                    mt={4}
                    aria-label={`Retirer le lien ${index + 1}`}
                    onClick={() =>
                      form.setFieldValue(
                        'links',
                        values.links.filter((__, position) => position !== index),
                      )
                    }
                  />
                </Group>
              ))}
              <AddItemButton onClick={() => form.setFieldValue('links', [...values.links, { url: '', label: '' }])}>Ajouter un lien</AddItemButton>
            </LabeledField>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label="Calendrier"
                description={recurring ? 'Pour toute la série.' : undefined}
                {...listSelectProps(calendars, undefined, values.calendarId ?? occurrence?.calendarId)}
                // Without a choice, the event goes into the first calendar not archived.
                value={values.calendarId ?? defaultCalendarId}
                onChange={(calendarId) => form.setFieldValue('calendarId', calendarId)}
                allowDeselect={false}
                leftSection={(() => {
                  const current = calendars.find((calendar) => calendar.id === (values.calendarId ?? defaultCalendarId));
                  return current ? <ItemAvatar name={current.label} iconUrl={current.iconUrl} color={current.color} /> : undefined;
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
                  form.setFieldValue(
                    'contributorIds',
                    values.contributorIds.filter((id) => allowed.has(id)),
                  );
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
                label={relationNoun(perso, true)}
                description={perso ? 'Personnes hors du foyer, sans contributeur' : 'Personnes hors de l’équipe, sans contributeur'}
                placeholder={(values.relationIds ?? []).length ? undefined : 'Aucune'}
                data={relationOptions}
                searchable
                clearable
                nothingFoundMessage={perso ? 'Ajoutez des proches dans Paramètres › Foyer et contributeurs' : 'Ajoutez des relations dans Paramètres › Équipe et contributeurs'}
                {...form.getInputProps('relationIds')}
              />
              <BatchMultiSelect
                onCreate={itemCreator('Nouvelle catégorie d’agenda', categoryItems, { tree: unarchived(categories ?? []) })}
                label="Catégories"
                placeholder={values.categoryIds.length ? undefined : 'Aucune'}
                // Archived categories are no longer offered, but those of the event stay.
                {...treeSelectProps(categoryOptions(categories ?? [], undefined, unarchivedOffered(categories ?? [], values.categoryIds)))}
                searchable
                clearable
                nothingFoundMessage="Créez des catégories dans Agenda › Paramètres"
                {...form.getInputProps('categoryIds')}
              />
              <BatchMultiSelect
                label="Tâches"
                placeholder={values.taskIds?.length ? undefined : 'Aucune'}
                description={
                  [values.projectId ? 'Tâches du projet et de ses sous-projets' : null, values.contributorIds.length ? 'avec un contributeur de l’évènement (ou sans assigné)' : null]
                    .filter(Boolean)
                    .join(', ') || undefined
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
                onChange={(keys) =>
                  form.setFieldValue(
                    'routineLinks',
                    keys.map((key) => ({ routineId: key.split('|')[0], date: key.split('|')[1] })),
                  )
                }
                error={form.errors.routineLinks as string | undefined}
              />
              <RemindersSelect label="Rappels" emptyLabel="Aucun" presets={EVENT_REMINDERS} value={values.reminders} onChange={(reminders) => form.setFieldValue('reminders', reminders)} clearable />
            </SimpleGrid>
            {recurring && (
              <Text size="xs" c="dimmed">
                Projet, contributeurs, catégories, tâches et rappels s’appliquent à toute la série.
              </Text>
            )}
            {occurrence && (
              <Group gap="sm">
                <Tooltip label={values.projectId ? `Démarre un chrono rattaché à cet évènement. ${replacing ? TIMER_REPLACED_HINT : ''}`.trim() : 'Choisissez d’abord un projet'}>
                  <Button variant="default" size="xs" leftSection={<TimerIcon aria-hidden />} disabled={!values.projectId} loading={timerStarting} onClick={handleTimer}>
                    Démarrer le chrono
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
          </Stack>
        </Fieldset>
        {occurrence && !readOnly && <SheetsSection owner={{ eventId: occurrence.eventId }} occurrenceDate={occurrence.occurrenceDate ?? occurrence.startDate} name={values.label || 'l’évènement'} />}
        {occurrence && (
          <Comments target="EVENT" id={occurrence.eventId} projectId={values.projectId ?? null} title={occurrence.occurrenceDate ? 'Commentaires (toute la série)' : undefined} readOnly={readOnly} />
        )}

        {readOnly ? (
          <Group justify="space-between" gap="sm">
            {occurrence ? (
              <Group gap={4}>
                <DeleteButton onClick={() => void handleDelete()} loading={remove.isPending} />
                {!calendarArchived && archiveMenu}
              </Group>
            ) : (
              <span />
            )}
            <Button variant="default" leftSection={<XIcon aria-hidden />} onClick={onDone}>
              Fermer
            </Button>
          </Group>
        ) : (
          <FormActions
            onCancel={onDone}
            submitLabel={occurrence ? 'Enregistrer' : 'Créer l’évènement'}
            loading={create.isPending || update.isPending}
            danger={
              occurrence && (
                <>
                  <DeleteButton onClick={() => void handleDelete()} loading={remove.isPending} />
                  {onDuplicate && (
                    <Tooltip label={recurring ? 'Copie de cette occurrence, en évènement unique, à enregistrer' : 'Copie de l’évènement, à enregistrer'}>
                      <Button
                        variant="subtle"
                        color="gray"
                        leftSection={<CopyIcon aria-hidden />}
                        onClick={() =>
                          // Its fields as they are in the form; an occurrence of a series becomes a one-off event.
                          onDuplicate({ ...values, label: copyName(values.label, EVENT_LABEL_MAX), recurrence: recurring ? null : (values.recurrence ?? null) })
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
                  {archiveMenu}
                </>
              )
            }
          />
        )}
      </Stack>
    </form>
  );
}
