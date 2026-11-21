import { relationNoun } from '../../../components/people/people-options';
import { ArchivedNotice } from '../../../components/feedback/ArchivedNotice';
import { LinksField } from '../../../components/inputs/LinksField';
import { copyName, fitName } from '../../../lib/text';
import { TravelField } from '../../geo/components/TravelField';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { PICKER_FORMATS } from '../../../lib/format';

import { itemSelectProps } from '../../../components/items/item-look';

import { Alert, Anchor, Fieldset, Group, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { addDays, mapById, type CalendarEventInput, calendarEventInputSchema, daysBetween, EVENT_REMINDER_ANCHORS, formatDuration, type Recurrence, sharePeople, TEXT_MAX } from '@ordo/shared';
import { ArrowArcRightIcon, ArrowCounterClockwiseIcon, CalendarXIcon, PlayIcon, XIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useRef, useState } from 'react';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { localToday } from '../../../lib/dates';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { AssigneesSelect, ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { DeleteButton } from '../../../components/dialogs/DestructiveActions';
import { calendarQueryKey, useCalendarCategories, useCalendarEventMutations, useCalendars, type EventOccurrence, type CalendarEventScope } from '../api';
import { archivedIds, archiveEntry, unarchived, unarchivedOffered, useSetArchived } from '../../../lib/archive';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { useStartTimer } from '../../time/hooks/use-start-timer';
import { fetchLostOnDelete } from '../../time/api';
import { LostOnDeleteRisk } from '../../time/components/LostOnDeleteRisk';
import { scopeLostNote } from '../../time/lib/lost-on-delete';
import { timeTaskOptions, timeTasks } from '../../time/lib/time-tasks';
import { EventLocation } from '../../geo/components/EventLocation';
import { addressOf } from '../../geo/lib/location';
import { useFormLocation } from '../../geo/hooks/use-location-draft';
import { TravelCalculator } from '../../geo/components/TravelCalculator';
import { useTreasurySettings } from '../../treasury/api';
import { useActiveWorkspace } from '../../workspaces/api';
import { askScope } from '../lib/ask-scope';
import { AvailabilityHint } from './AvailabilityHint';
import { categoryOptions } from '../../../components/tree/category-tree';
import { occurrenceInput, routineLinkKey, routineLinkOf } from '../lib/event-input';
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
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { calendarPath } from '../../../app/pages';
import { ActionButton } from '../../../components/actions/ActionButton';
import { DuplicateButton } from '../../../components/actions/DuplicateButton';

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
    label: fitName('Report de l’évènement « ', label, ' »'),
    startDate: addDays(fields.startDate, 1),
    startTime: fields.startTime ?? null,
    endTime: fields.endTime ?? null,
  });
  const endDate = addDays(values.startDate, span);
  const valid = Boolean(values.label.trim() && values.startDate && (fields.allDay || (values.startTime && values.endTime && (span > 0 || values.endTime > values.startTime))));
  return (
    <Stack gap="sm">
      <Text size="sm">La date initiale sera annulée (l’évènement reste barré dans l’agenda) et un nouvel évènement, lié à elle, sera créé à la nouvelle date.</Text>
      <TextInput label="Libellé" required maxLength={TEXT_MAX} value={values.label} onChange={(event) => setValues({ ...values, label: event.currentTarget.value })} />
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
  /** Opens the copy of the event once saved (« Dupliquer »): its id and fields. Optional: no « Dupliquer ». */
  onDuplicated?: (id: string, fields: CalendarEventInput) => void;
  /**
   * Occurrences of a recurring event the changes of its panel apply to, chosen once when it opens; null:
   * the question was dismissed, the panel is read only (its comments can still be written). Optional. Default = 'ALL'
   * (a single event: all of it).
   */
  scope?: CalendarEventScope | null;
}

/** Fields of an event saved on leaving them, in its panel: texts, travel times, its links and its place. */
const ON_BLUR = ['label', 'description', 'links', 'location', 'locationLat', 'locationLon', 'travelBefore', 'travelAfter'] as const;

/** Event and occurrence the panel saves to: the series may be split (« celle-ci et les suivantes ») or moved by a save. */
interface SaveTarget {
  eventId: string;
  /** Occurrence in its series (null: a single event). */
  occurrenceDate: string | null;
  scope: CalendarEventScope;
  /** First day of its series (its rule is edited from there). */
  ruleStart: string;
}

/**
 * Calendar event form: label, dates and times (or all day), repetition with pauses, place, links,
 * project, contributors, categories, tasks, reminders, description; a timer can be started on it. An event can be cancelled (kept struck through)
 * and restored, or postponed (cancelled, and a new event linked to it takes the new date); a warning tells
 * when it falls outside the working hours. A new event is a form with « Créer l’évènement »; an existing one, its panel,
 * saves each field as soon as it changes (texts on leaving them, `useFieldSave`), for the occurrences
 * chosen when it opened (`scope`): one occurrence alone changes only its own fields (label, description, place, links,
 * days and hours, travel times, routines of its days), the others are those of the series. Deleting still asks which
 * occurrences. An archived event (or one of an archived calendar) opens read only: it can be restored or deleted. Opened
 * without a scope (the question dismissed), it is read only too, its comments open.
 * @param {EventFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function EventForm({ context, occurrence, defaults, onDone, onDuplicated, scope = 'ALL' }: EventFormProps) {
  const categoryItems = useCalendarCategoryItems();
  const { create, update, remove, setCalledOff } = useCalendarEventMutations();
  const { startTimer, isPending: timerStarting } = useStartTimer();

  /**
   * Opens the postponement of this occurrence; once postponed, the event form closes too.
   * @returns {void}
   */
  const openPostpone = () =>
    occurrence &&
    openFormPanel('Reporter l’évènement', (close) => (
      <PostponePanel fields={values} occurrence={{ ...occurrence, eventId: target.eventId, occurrenceDate: target.occurrenceDate }} onCancel={close} onDone={() => (close(), onDone())} />
    ));

  /**
   * Starts a timer on this occurrence (its project if any, tasks and label): no project needed.
   * @returns {void}
   */
  const handleTimer = () => {
    if (!occurrence) return;
    const allowed = new Set(timeTasks(context, values.projectId).map((task) => task.id));
    const timeTaskIds = (values.taskIds ?? []).filter((id) => allowed.has(id));
    startTimer({
      projectId: values.projectId,
      // Tasks of the event a timer on its project takes (the API's rule: the project, its sub-projects, tasks without
      // project; without project, only those).
      taskIds: timeTaskIds,
      description: values.label,
      events: [{ eventId: target.eventId, occurrenceDate: target.occurrenceDate }],
    });
  };
  const { data: categories } = useCalendarCategories();
  const { data: treasury } = useTreasurySettings();
  const { data: calendarsData } = useCalendars();
  const calendars = calendarsData?.calendars ?? [];
  const setArchived = useSetArchived('CALENDAR_EVENT', [calendarQueryKey]);
  // Archived (its series), or in an archived calendar (its container): read only.
  const calendarArchived = occurrence ? archivedIds(calendars).has(occurrence.calendarId) : false;
  const archived = Boolean(occurrence?.archived) || calendarArchived;
  // No scope chosen when it opened: read only, nothing archived.
  const reading = scope === null;
  const readOnly = archived || reading;
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
        recurrence: null,
        reminders: [{ before: 15, at: null }],
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
  const base = useAppForm<FormValues>({ initialValues: initial as FormValues, schema: calendarEventInputSchema });
  // Where the saves go: a split (« celle-ci et les suivantes ») makes a new series, then edited as a whole; a series
  // moved whole moves its occurrence; one occurrence alone stays itself.
  const [target, setTarget] = useState<SaveTarget>(() => ({
    eventId: occurrence?.eventId ?? '',
    occurrenceDate: occurrence?.occurrenceDate ?? null,
    scope: occurrence?.occurrenceDate != null ? (scope ?? 'ALL') : 'ALL',
    ruleStart: occurrence?.seriesStartDate ?? occurrence?.startDate ?? '',
  }));
  // The saves run one after the other: each reads where the previous one left the event.
  const saveTarget = useRef(target);
  const { form, saving, commit } = useFieldSave(base, {
    save: occurrence
      ? async (_changes, input) => {
          const now = saveTarget.current;
          const eventId = await update.mutateAsync({ id: now.eventId, input, scope: now.scope, occurrenceDate: now.occurrenceDate });
          if (now.scope === 'THIS') return;
          const split = now.scope === 'FOLLOWING' && eventId !== now.eventId;
          saveTarget.current = {
            eventId,
            occurrenceDate: input.recurrence ? input.startDate : null,
            scope: 'ALL',
            ruleStart: split || !input.recurrence ? input.startDate : addDays(now.ruleStart, daysBetween(now.occurrenceDate ?? input.startDate, input.startDate)),
          };
          setTarget(saveTarget.current);
        }
      : null,
    schema: calendarEventInputSchema,
    onBlur: ON_BLUR,
    readOnly,
  });
  const values = form.values;
  // Put in the form (and saved, field by field) once chosen, cleared or left.
  const place = useFormLocation(values, (change) => form.setValues(change), commit);
  // One occurrence edited alone: the fields of the series stay as they are (the API keeps them).
  const seriesFields = target.scope === 'THIS' && target.occurrenceDate !== null;
  const { perso } = useActiveWorkspace();
  // Relations with a contributor take part as that contributor, archived ones are not offered; one already chosen stays.
  const relationOptions = unarchived(treasury?.treasuryRelations ?? [], values.relationIds)
    .filter((relation) => !relation.contributorId || (values.relationIds ?? []).includes(relation.id))
    .map((relation) => ({ value: relation.id, label: relation.name }));
  // Routines due on the days of the event (an occurrence each), with someone in common with it; those chosen stay.
  const { data: routinesData } = useRoutinesData();
  const { data: routineDays } = useRoutineOccurrences(values.startDate && values.endDate ? { from: values.startDate, to: values.endDate } : null);
  const routineById = mapById(routinesData?.routines ?? []);
  const multiDay = values.startDate !== values.endDate;
  const chosenLinks = new Set((values.routineLinks ?? []).map(routineLinkKey));
  const routineOptions = [
    ...new Map([...unarchived(routineDays ?? []).filter((item) => !item.cancelled).map((item) => ({ routineId: item.routineId, date: item.date })), ...(values.routineLinks ?? [])].map((link) => [routineLinkKey(link), link])).values(),
  ].flatMap((link) => {
    const routine = routineById.get(link.routineId);
    const key = routineLinkKey(link);
    if (!routine || (!chosenLinks.has(key) && (routine.archived || !sharePeople(routine.assigneeIds, values.contributorIds)))) return [];
    return [{ value: key, label: multiDay ? `${routine.label} (${fmt.weekday(link.date)})` : routine.label }];
  });
  const recurring = target.occurrenceDate !== null;

  // Archives the event (its whole series) or restores it, with an undo, then closes the form; in its « … » menu.
  const archiveMenu = occurrence && (
    <ActionsMenu about="l’évènement" items={[archiveEntry({ archived: occurrence.archived, type: 'Évènement', label: occurrence.label }, setArchived, target.eventId, onDone)]} />
  );
  // A rule is edited from the start of its series (for the whole series or the following occurrences).
  const ruleStart = recurring ? target.ruleStart : values.startDate;

  // A new event only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((input) => create.mutate(input, formCallbacks(form, 'Évènement créé.', onDone)));

  /**
   * Deletes the event (asking which occurrences for a recurring one), telling the times without project
   * and the comments deleted with it.
   * @returns {Promise<void>}
   */
  const handleDelete = async () => {
    if (!occurrence) return;
    /**
     * Runs the deletion.
     * @param {CalendarEventScope} scope Scope.
     * @returns {void}
     */
    const run = (scope: CalendarEventScope) => remove.mutate({ id: target.eventId, scope, occurrenceDate: target.occurrenceDate }, formCallbacks(null, 'Évènement supprimé.', onDone));
    const lost = { eventId: target.eventId, occurrenceDate: target.occurrenceDate };
    if (recurring) {
      const [THIS, FOLLOWING, ALL] = await Promise.all((['THIS', 'FOLLOWING', 'ALL'] as const).map((scope) => fetchLostOnDelete({ ...lost, scope })));
      const scope = await askScope({ action: 'delete', note: scopeLostNote({ THIS, FOLLOWING, ALL }) });
      if (scope) run(scope);
      return;
    }
    confirmDestructive({
      title: 'Supprimer l’évènement',
      risks: (
        <>
          L’évènement « {occurrence?.label ?? ''} » sera supprimé définitivement.
          <LostOnDeleteRisk query={{ ...lost, scope: 'ALL' }} />
        </>
      ),
      onConfirm: () => run('ALL'),
    });
  };

  /**
   * Cancels the event (kept struck through) or restores it, for the occurrences chosen when the panel opened.
   * @param {boolean} calledOff Cancel (true) or restore (false).
   * @returns {void}
   */
  const handleCalledOff = (calledOff: boolean) => {
    if (!occurrence) return;
    setCalledOff.mutate(
      { id: target.eventId, scope: target.scope, occurrenceDate: target.occurrenceDate, calledOff },
      formCallbacks(null, calledOff ? 'Évènement annulé.' : 'Évènement rétabli.', onDone),
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        {occurrence && !readOnly && <SaveStatus saving={saving} />}
        {reading && !archived && (
          <Text size="sm" c="dimmed">
            Lecture seule : aucune portée n’a été choisie à l’ouverture. Fermez le panneau et rouvrez-le pour modifier l’évènement.
          </Text>
        )}
        {archived && (
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
            <TextInput label="Libellé" required data-autofocus={occurrence ? undefined : true} {...form.getInputProps('label')} />
            {seriesFields && (
              <Text size="xs" c="dimmed">
                Cette occurrence seulement : sa répétition, son calendrier, son projet, ses personnes, ses catégories, ses tâches et ses rappels sont ceux de la série.
              </Text>
            )}
            <EventRepetition
              ruleStart={ruleStart}
              ruleLocked={seriesFields}
              error={(form.errors.startDate ?? form.errors.endDate ?? form.errors.startTime ?? form.errors.endTime ?? form.errors.recurrence) as string | undefined}
              value={{
                allDay: values.allDay,
                startDate: values.startDate,
                startTime: values.startTime ?? null,
                endDate: values.endDate,
                endTime: values.endTime ?? null,
                recurrence: (values.recurrence as Recurrence | null | undefined) ?? null,
              }}
              // One occurrence alone keeps the rule of its series.
              onChange={(timing) => form.setValues({ ...timing, ...(seriesFields && { recurrence: values.recurrence }) })}
            />
            {!values.allDay && (
              <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                <TravelField way="before" description="Avant le début" {...form.getInputProps('travelBefore')} />
                <TravelField way="after" description="Après la fin" {...form.getInputProps('travelAfter')} />
                <div>
                  <TravelCalculator
                    eventPoint={addressOf(values).point}
                    onResult={({ before, after }) => {
                      form.setValues({ ...(before !== undefined && { travelBefore: before }), ...(after !== undefined && { travelAfter: after }) });
                      commit(['travelBefore', 'travelAfter']);
                    }}
                  />
                </div>
              </SimpleGrid>
            )}
            <AvailabilityHint allDay={values.allDay} startDate={values.startDate} startTime={values.startTime ?? null} endDate={values.endDate} endTime={values.endTime ?? null} />

            <EventLocation value={place.value} error={form.errors.location} onChange={place.onChange} onBlur={place.leave} />

            <LinksField form={form} onRemoved={() => commit(['links'])} />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {/* One occurrence edited alone: the fields of its series are read only (laid out in the grid all the same). */}
              <Fieldset variant="unstyled" disabled={seriesFields} display="contents">
                <Select
                  label="Calendrier"
                  description={recurring ? 'Pour toute la série.' : undefined}
                  // Without a choice, the event goes into the first calendar not archived.
                  {...itemSelectProps(calendars, values.calendarId ?? defaultCalendarId, undefined, values.calendarId ?? occurrence?.calendarId)}
                  value={values.calendarId ?? defaultCalendarId}
                  onChange={(calendarId) => form.setFieldValue('calendarId', calendarId)}
                  allowDeselect={false}
                />
                <ProjectSelect
                  context={context}
                  label="Projet"
                  clearable
                  placeholder="Aucun"
                  // The contributors stay: on saving, they are attached to the new project.
                  {...form.getInputProps('projectId')}
                />
                <AssigneesSelect
                  label="Contributeurs"
                  description={values.projectId ? 'Contributeurs du projet.' : undefined}
                  contributors={context.assignableFor([values.projectId ?? null], values.contributorIds)}
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
                    [values.projectId ? 'Tâches du projet, de ses sous-projets ou sans projet' : null, values.contributorIds.length ? 'avec un contributeur de l’évènement (ou sans assigné)' : null]
                      .filter(Boolean)
                      .join(', ') || undefined
                  }
                  // Those a time on its project can take (the project, its sub-projects, tasks without project: as its timer), with
                  // someone in common with the event (or nobody on either side); those chosen stay.
                  {...treeSelectProps(
                    timeTaskOptions(
                      context,
                      (values.projectId ? timeTasks(context, values.projectId, values.taskIds ?? []) : unarchived(context.tasks, values.taskIds)).filter(
                        (task) => values.taskIds?.includes(task.id) || sharePeople(task.assigneeIds, values.contributorIds),
                      ),
                    ),
                  )}
                  searchable
                  clearable
                  limit={100}
                  nothingFoundMessage="Aucune tâche"
                  value={values.taskIds ?? []}
                  onChange={(taskIds) => form.setFieldValue('taskIds', taskIds)}
                  error={form.errors.taskIds as string | undefined}
                />
              </Fieldset>
              <BatchMultiSelect
                label="Routines"
                placeholder={(values.routineLinks ?? []).length ? undefined : 'Aucune'}
                description="Routines de ces jours faites pendant l’évènement (ce jour-là seulement), avec un contributeur de l’évènement."
                data={routineOptions}
                searchable
                clearable
                nothingFoundMessage="Aucune routine ces jours-là"
                value={(values.routineLinks ?? []).map(routineLinkKey)}
                onChange={(keys) => form.setFieldValue('routineLinks', keys.map(routineLinkOf))}
                error={form.errors.routineLinks as string | undefined}
              />
              <Fieldset variant="unstyled" disabled={seriesFields} display="contents">
                <RemindersSelect
                  label="Rappels"
                  description={
                    values.allDay
                      ? 'Avant minuit le premier jour (« 6 h avant » : la veille à 18 h), 24 h au plus ; ou à une heure du premier jour ou de quelques jours avant ; ou de même depuis la fin (minuit après le dernier jour).'
                      : 'Avant le début, 24 h au plus ; ou à une heure du premier jour ou de quelques jours avant ; ou de même depuis la fin.'
                  }
                  anchors={EVENT_REMINDER_ANCHORS}
                  value={values.reminders}
                  onChange={(reminders) => form.setFieldValue('reminders', reminders)}
                />
              </Fieldset>
            </SimpleGrid>
            {recurring && !seriesFields && (
              <Text size="xs" c="dimmed">
                Projet, contributeurs, catégories, tâches et rappels s’appliquent à toute la série.
              </Text>
            )}
            {occurrence && (
              <Group gap="sm">
                <ActionButton
                  priority="secondary"
                  size="xs"
                  icon={<PlayIcon aria-hidden />}
                  hint="Démarre un chrono rattaché à cet évènement."
                  loading={timerStarting}
                  onClick={handleTimer}
                >
                  Démarrer le chrono
                </ActionButton>
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
        {occurrence && !readOnly && <SheetsSection owner={{ eventId: target.eventId }} occurrenceDate={target.occurrenceDate ?? values.startDate} label={values.label || 'l’évènement'} />}
        {occurrence && (
          <Comments
            target="EVENT"
            id={target.eventId}
            occurrenceDate={target.occurrenceDate}
            projectId={values.projectId ?? null}
            title={target.occurrenceDate ? `Commentaires du ${fmt.day(target.occurrenceDate)}` : undefined}
            readOnly={archived}
          />
        )}

        {readOnly ? (
          <Group justify="space-between" gap="sm">
            {occurrence && !reading ? (
              <Group gap={4}>
                <DeleteButton onClick={() => void handleDelete()} loading={remove.isPending} />
                {!calendarArchived && archiveMenu}
              </Group>
            ) : (
              <span />
            )}
            <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onDone}>
              Fermer
            </ActionButton>
          </Group>
        ) : occurrence ? (
          // Saved field by field: only the actions on the event.
          <Group gap={4}>
            <DeleteButton onClick={() => void handleDelete()} loading={remove.isPending} />
            {onDuplicated && (
              <DuplicateButton
                // Its fields as they are in the form; an occurrence of a series becomes a one-off event.
                item={{ ...values, label: copyName(values.label), recurrence: recurring ? null : (values.recurrence ?? null) }}
                hint={recurring ? 'Copie de cette occurrence, en évènement unique' : 'Copie de l’évènement'}
                duplicate={async (fields: CalendarEventInput) => ({ id: await create.mutateAsync(fields), fields })}
                done="Évènement dupliqué."
                open={({ id, fields }) => onDuplicated(id, fields)}
              />
            )}
            {occurrence.calledOff ? (
              <ActionButton priority="secondary" icon={<ArrowCounterClockwiseIcon aria-hidden />} onClick={() => handleCalledOff(false)} loading={setCalledOff.isPending}>
                Rétablir
              </ActionButton>
            ) : (
              <>
                <ActionButton priority="secondary" icon={<CalendarXIcon aria-hidden />} onClick={() => handleCalledOff(true)} loading={setCalledOff.isPending}>
                  Annuler l’évènement
                </ActionButton>
                <ActionButton priority="secondary" icon={<ArrowArcRightIcon aria-hidden />} onClick={openPostpone}>
                  Reporter
                </ActionButton>
              </>
            )}
            {archiveMenu}
          </Group>
        ) : (
          <FormActions onCancel={onDone} submitLabel="Créer l’évènement" loading={create.isPending} />
        )}
      </Stack>
    </form>
  );
}
