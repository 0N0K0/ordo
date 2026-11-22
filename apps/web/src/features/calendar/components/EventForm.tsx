import { relationNoun } from '../../../components/people/people-options';
import { LinksField } from '../../../components/inputs/LinksField';
import { copyName, fitName } from '../../../lib/text';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';

import { itemSelectProps } from '../../../components/items/item-look';

import { Anchor, Badge, Fieldset, Select, Stack, Text, TextInput } from '@mantine/core';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { addDays, mapById, type CalendarEventInput, calendarEventInputSchema, daysBetween, EVENT_REMINDER_ANCHORS, type Recurrence, sharePeople, shiftTime, TEXT_MAX } from '@ordo/shared';
import { ArrowArcRightIcon, ArrowCounterClockwiseIcon, CalendarXIcon, TrashIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useRef, useState, type ReactNode } from 'react';
import { localToday } from '../../../lib/dates';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { AssigneesSelect, ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { calendarQueryKey, useCalendarCategories, useCalendarEventMutations, useCalendars, type EventOccurrence, type CalendarEventScope } from '../api';
import { archivedIds, archiveEntry, unarchived, unarchivedOffered, useSetArchived } from '../../../lib/archive';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { fetchLostOnDelete } from '../../time/api';
import { LostOnDeleteRisk } from '../../time/components/LostOnDeleteRisk';
import { scopeLostNote } from '../../time/lib/lost-on-delete';
import { timeTaskOptions, timeTasks } from '../../time/lib/time-tasks';
import { EventLocation } from '../../geo/components/EventLocation';
import { addressOf } from '../../geo/lib/location';
import { useFormLocation } from '../../geo/hooks/use-location-draft';
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
import { ActionsMenu, type RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { duplicateRowsAction, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { FormDescription } from '../../../components/markdown/DescriptionSection';
import { DetailLayout, PanelGroup } from '../../../components/panels/DetailLayout';
import { PANEL_GROUPS } from '../../../components/panels/panel-groups';
import { TrackedTime } from '../../time/components/TrackedTime';
import { TravelTimes } from '../../geo/components/TravelTimes';
import { SavedCountdownsField } from '../../countdowns/components/SavedCountdownsField';
import { useCountdownMenuEntries } from '../../countdowns/hooks/use-saved-countdowns';
import { useSetSavedCountdownLinks } from '../../countdowns/api';
import { eventCountdownItem } from '../lib/event-countdowns';
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
  const [values, setValues] = useState({
    label: fitName('Report de l’évènement « ', label, ' »'),
    startDate: addDays(fields.startDate, 1),
    endDate: addDays(fields.endDate, 1),
    startTime: fields.startTime ?? null,
    endTime: fields.endTime ?? null,
  });
  const { endDate } = values;
  const valid = Boolean(values.label.trim() && values.startDate && (fields.allDay || (values.startTime && values.endTime && (endDate > values.startDate || values.endTime > values.startTime))));
  return (
    <Stack gap="sm">
      <Text size="sm">La date initiale sera annulée (l’évènement reste barré dans l’agenda) et un nouvel évènement, lié à elle, sera créé à la nouvelle date.</Text>
      <TextInput label="Libellé" required maxLength={TEXT_MAX} value={values.label} onChange={(event) => setValues({ ...values, label: event.currentTarget.value })} />
      <PeriodField
        label="Nouvelle date"
        description="L’évènement garde sa durée ; changez la fin pour la modifier."
        required
        weekday
        keepLength
        value={[values.startDate, values.endDate]}
        times={fields.allDay ? undefined : [values.startTime, values.endTime]}
        onChange={([startDate, end], hours) => startDate && end && setValues({ ...values, startDate, endDate: end, ...(hours ? { startTime: hours[0], endTime: hours[1] } : {}) })}
      />
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
 * Calendar event, laid out as the task and routine panels (`DetailLayout`): its label and its « … » menu
 * (« Dupliquer », « Annuler l’évènement » / « Rétablir », « Reporter », « Archiver » / « Restaurer », « Supprimer »,
 * its saved timers), its project, the mentions « Annulé », « Reporté », « Archivé » and « Enregistré »; on the left its
 * description, « Relations » (tasks, routines of its days) and the comments of the occurrence; on the right
 * « Classement » (calendar, categories), « Parties prenantes », « Dates et heures » (its repetition, whole day, period,
 * right in the panel, the warning outside working hours, the time tracked), « Lieu » (travel times, when to leave),
 * « Alarmes » and « Ressources ». Postponed: cancelled, and a new event linked to it takes the new date. A new event is
 * a form with « Créer l’évènement »; an existing one saves each field as soon as it changes (texts on leaving them,
 * `useFieldSave`), for the occurrences chosen when it opened (`scope`): one occurrence alone changes only its own
 * fields (label, description, place, links, days and hours, travel times, routines of its days), the others are those
 * of the series. Deleting still asks which occurrences. An archived event (or one of an archived calendar) opens read
 * only: it can be restored or deleted. Opened without a scope (the question dismissed), it is read only too, its
 * comments open.
 * @param {EventFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function EventForm({ context, occurrence, defaults, onDone, onDuplicated, scope = 'ALL' }: EventFormProps) {
  const categoryItems = useCalendarCategoryItems();
  const { create, update, remove, setCalledOff } = useCalendarEventMutations();
  const countdownEntries = useCountdownMenuEntries();
  // The panel does not follow the cache: the saved timers of the event as saved from it.
  const [savedCountdownIds, setSavedCountdownIds] = useState(occurrence?.savedCountdownIds ?? []);
  const copyCountdowns = useSetSavedCountdownLinks([calendarQueryKey]);

  /**
   * Opens the postponement of this occurrence; once postponed, the event form closes too.
   * @returns {void}
   */
  const openPostpone = () =>
    occurrence &&
    openFormPanel('Reporter l’évènement', (close) => (
      <PostponePanel fields={values} occurrence={{ ...occurrence, eventId: target.eventId, occurrenceDate: target.occurrenceDate }} onCancel={close} onDone={() => (close(), onDone())} />
    ));

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
  const { form, saving, commit, fieldProps } = useFieldSave(base, {
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

  // Tasks of the event a timer on its project takes (the API's rule: the project, its sub-projects, tasks without
  // project; without project, only those).
  const timerTasks = new Set(timeTasks(context, values.projectId).map((task) => task.id));
  const timer = { projectId: values.projectId, taskIds: (values.taskIds ?? []).filter((id) => timerTasks.has(id)), description: values.label, events: [{ eventId: target.eventId, occurrenceDate: target.occurrenceDate }] };
  // When to leave and when back, an event with hours (told once an outward travel is given).
  const leave =
    !values.allDay && values.startTime
      ? `Partir à ${shiftTime(values.startTime, -(values.travelBefore ?? 0)).replace(':', ' h ')}${(values.travelAfter ?? 0) > 0 && values.endTime ? ` · retour vers ${shiftTime(values.endTime, values.travelAfter ?? 0).replace(':', ' h ')}` : ''}`
      : null;

  /**
   * Fields of the series, read only while one occurrence is edited alone (laid out as the others).
   * @param {ReactNode} children Fields.
   * @returns {JSX.Element} Fieldset.
   */
  const series = (children: ReactNode) => (
    <Fieldset variant="unstyled" disabled={seriesFields} display="contents">
      {children}
    </Fieldset>
  );

  // Its « … » menu: « Dupliquer », « Annuler l’évènement » / « Rétablir », « Reporter », « Archiver » / « Restaurer »
  // (the whole series), « Supprimer », then « Lancer » its saved timers; archived: restored or deleted only.
  const menu: RowMenuEntry[] = occurrence
    ? [
        !readOnly &&
          onDuplicated &&
          rowMenuEntry(
            duplicateRowsAction([{ ...values, label: copyName(values.label), recurrence: recurring ? null : (values.recurrence ?? null) }], {
              duplicate: async (fields: CalendarEventInput) => {
                const id = await create.mutateAsync(fields);
                // The copy launches the same saved timers.
                if (savedCountdownIds.length) await copyCountdowns.mutateAsync({ target: 'EVENT', id, savedCountdownIds });
                return { id, fields };
              },
              done: 'Évènement dupliqué.',
              open: ({ id, fields }) => onDuplicated(id, fields),
            }),
          ),
        ...(readOnly
          ? []
          : occurrence.calledOff
            ? [{ label: 'Rétablir', icon: <ArrowCounterClockwiseIcon aria-hidden />, disabled: setCalledOff.isPending, onClick: () => handleCalledOff(false) }]
            : [
                { label: 'Annuler l’évènement', icon: <CalendarXIcon aria-hidden />, disabled: setCalledOff.isPending, onClick: () => handleCalledOff(true) },
                { label: 'Reporter', icon: <ArrowArcRightIcon aria-hidden />, onClick: openPostpone },
              ]),
        !calendarArchived && archiveEntry({ archived: occurrence.archived, type: 'Évènement', label: occurrence.label }, setArchived, target.eventId, onDone),
        { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, disabled: remove.isPending, onClick: () => void handleDelete() },
        // « Lancer » its saved timers, for this occurrence.
        ...(readOnly ? [] : countdownEntries({ savedCountdownIds }, eventCountdownItem({ eventId: target.eventId, label: values.label || occurrence.label }, target.occurrenceDate))),
      ]
    : [];

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DetailLayout
        readOnly={readOnly}
        title={form.getInputProps('label')}
        focusTitle={!occurrence}
        // No scope chosen when it opened: no action.
        menu={occurrence && !reading && <ActionsMenu about="l’évènement" items={menu} variant="light" size="input-xs" />}
        project={series(
          <ProjectSelect
            context={context}
            label="Projet"
            clearable
            placeholder="Aucun"
            // The contributors stay: on saving, they are attached to the new project.
            {...form.getInputProps('projectId')}
          />,
        )}
        mentions={
          <>
            {occurrence?.calledOff && (
              <Badge color="gray" variant="light" leftSection={<CalendarXIcon aria-hidden />}>
                Annulé
              </Badge>
            )}
            {occurrence && occurrence.postponedTo.length > 0 && (
              <Badge color="gray" variant="light" leftSection={<ArrowArcRightIcon aria-hidden />}>
                Reporté
              </Badge>
            )}
            {archived && <ArchivedBadge />}
          </>
        }
        notes={
          <>
            {reading && !archived && (
              <Text size="sm" c="dimmed">
                Lecture seule : aucune portée n’a été choisie à l’ouverture. Fermez le panneau et rouvrez-le pour modifier l’évènement.
              </Text>
            )}
            {archived && (
              <Text size="sm" c="dimmed">
                {calendarArchived ? 'Calendrier archivé : restaurez-le pour modifier l’évènement.' : 'Restaurez-le pour le modifier.'}
              </Text>
            )}
            {occurrence?.calledOff && (
              <Text size="sm" c="dimmed">
                Il reste dans l’agenda, barré.{' '}
                {occurrence.postponedTo.map((next) => (
                  <span key={next.eventId}>
                    Reporté au{' '}
                    <Anchor component={Link} to={calendarPath(next.startDate)} onClick={onDone}>
                      {fmt.dayLong(next.startDate)}
                      {next.startTime && ` à ${next.startTime}`}
                    </Anchor>
                    .{' '}
                  </span>
                ))}
              </Text>
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
            {seriesFields && (
              <Text size="xs" c="dimmed">
                Cette occurrence seulement : sa répétition, son calendrier, son projet, ses personnes, ses catégories, ses tâches et ses rappels sont ceux de la série.
              </Text>
            )}
            {recurring && !seriesFields && (
              <Text size="xs" c="dimmed">
                Projet, contributeurs, catégories, tâches et rappels s’appliquent à toute la série.
              </Text>
            )}
          </>
        }
        saving={occurrence && !readOnly ? saving : undefined}
        main={
          <>
            <FormDescription field={fieldProps('description')} commit={() => commit(['description'])} targets={context.targetsFor(values.projectId ?? null)} suggestions={context.suggestionsFor(values.projectId ?? null)} readOnly={readOnly} />
            <PanelGroup title={PANEL_GROUPS.relations}>
              {series(
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
                />,
              )}
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
            </PanelGroup>
          </>
        }
        comments={
          occurrence && (
            <PanelGroup title={target.occurrenceDate ? `${PANEL_GROUPS.comments} du ${fmt.day(target.occurrenceDate)}` : PANEL_GROUPS.comments}>
              <Comments target="EVENT" id={target.eventId} occurrenceDate={target.occurrenceDate} projectId={values.projectId ?? null} title={null} readOnly={archived} />
            </PanelGroup>
          )
        }
        side={
          <>
            <PanelGroup title={PANEL_GROUPS.ranking}>
              {series(
                <>
                  <Select
                    label="Calendrier"
                    description={recurring ? 'Pour toute la série.' : undefined}
                    // Without a choice, the event goes into the first calendar not archived.
                    {...itemSelectProps(calendars, values.calendarId ?? defaultCalendarId, undefined, values.calendarId ?? occurrence?.calendarId)}
                    value={values.calendarId ?? defaultCalendarId}
                    onChange={(calendarId) => form.setFieldValue('calendarId', calendarId)}
                    allowDeselect={false}
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
                </>,
              )}
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.people}>
              {series(
                <>
                  <AssigneesSelect
                    label="Contributeurs"
                    description={values.projectId ? 'Contributeurs du projet.' : undefined}
                    contributors={context.assignableFor([values.projectId ?? null], values.contributorIds)}
                    value={values.contributorIds}
                    onChange={(contributorIds) => form.setFieldValue('contributorIds', contributorIds)}
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
                  <BeneficiariesSelect
                    description="Pour qui est l’évènement (l’anniversaire de votre fils) : ni forcément présents, ni contributeurs."
                    value={{ beneficiaryIds: values.beneficiaryIds ?? [], beneficiaryRelationIds: values.beneficiaryRelationIds ?? [] }}
                    onChange={(beneficiaries) => form.setValues({ ...beneficiaries })}
                  />
                </>,
              )}
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.dates}>
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
              <AvailabilityHint allDay={values.allDay} startDate={values.startDate} startTime={values.startTime ?? null} endDate={values.endDate} endTime={values.endTime ?? null} />
              {occurrence && (
                <TrackedTime
                  seconds={occurrence.trackedSeconds}
                  on={(entry) => (entry.events ?? []).some((event) => event.eventId === target.eventId && event.occurrenceDate === target.occurrenceDate)}
                  start={timer}
                  disabled={readOnly}
                />
              )}
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.place}>
              <EventLocation value={place.value} error={form.errors.location} onChange={place.onChange} onBlur={place.leave} />
              {!values.allDay && (
                <TravelTimes
                  value={{ travelBefore: values.travelBefore ?? 0, travelAfter: values.travelAfter ?? 0 }}
                  hints={['Avant le début', 'Après la fin']}
                  point={addressOf(values).point}
                  onChange={(changes) => form.setValues(changes)}
                  onCommit={commit}
                  errors={{ travelBefore: form.errors.travelBefore, travelAfter: form.errors.travelAfter }}
                  leave={leave}
                />
              )}
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.alarms}>
              {series(
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
                />,
              )}
              {occurrence && (
                <SavedCountdownsField
                  target="EVENT"
                  id={target.eventId}
                  value={savedCountdownIds}
                  invalidate={[calendarQueryKey]}
                  readOnly={readOnly}
                  description={recurring ? 'Minuteurs enregistrés lancés depuis son menu « … » ; pour toute la série.' : undefined}
                  onSaved={setSavedCountdownIds}
                />
              )}
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.resources}>
              <LinksField form={form} onRemoved={() => commit(['links'])} />
              {occurrence && !readOnly && <SheetsSection owner={{ eventId: target.eventId }} occurrenceDate={target.occurrenceDate ?? values.startDate} label={values.label || 'l’évènement'} />}
            </PanelGroup>
          </>
        }
        footer={!occurrence && <FormActions onCancel={onDone} submitLabel="Créer l’évènement" loading={create.isPending} />}
      />
    </form>
  );
}
