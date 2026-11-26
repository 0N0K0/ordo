import { relationNoun } from '../../../components/people/people-options';
import { LinksField } from '../../../components/inputs/LinksField';
import { countOf, plural } from '../../../lib/text';
import { notifySuccess } from '../../../lib/notify';

import { itemSelectProps } from '../../../components/items/item-look';

import { Anchor, Badge, Fieldset, Select, Text } from '@mantine/core';
import { mapById, type CalendarEventInput, calendarEventInputSchema, daysBetween, type Recurrence, cutSeries, seriesOn, sharePeople, shiftedSeries, shiftTime } from '@ordo/shared';
import { ArrowArcRightIcon, CalendarXIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useRef, useState, type ReactNode } from 'react';
import { parisToday } from '../../../lib/dates';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { ProjectSelect } from '../../tasks/components/task-ui';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { calendarQueryKey, useCalendarCategories, useCalendarEventMutations, useCalendars, type EventOccurrence, type CalendarEventScope } from '../api';
import { archivedIds, unarchived, unarchivedOffered } from '../../../lib/archive';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { timeTaskOptions, timeTasks } from '../../time/lib/time-tasks';
import { EventLocation } from '../../geo/components/EventLocation';
import { addressOf } from '../../geo/lib/location';
import { useFormLocation } from '../../geo/hooks/use-location-draft';
import { useActiveWorkspace } from '../../workspaces/api';
import { AvailabilityHint } from './AvailabilityHint';
import { categoryOptions } from '../../../components/tree/category-tree';
import { occurrenceInput, routineLinkKey, routineLinkOf, seriesInput, withDays } from '../lib/event-input';
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
import { EventRemindersField } from '../../../components/inputs/ItemReminders';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { FormDescription } from '../../../components/markdown/DescriptionSection';
import { DetailLayout, PanelGroup } from '../../../components/panels/DetailLayout';
import { PANEL_GROUPS } from '../../../components/panels/panel-groups';
import { DocumentsField } from '../../documents/components/DocumentsField';
import { resourcesInTree } from '../../documents/lib/document-keys';
import { useDocumentOptions } from '../../documents/api';
import { inProjectTree } from '../../tasks/lib/task-links';
import { TrackedTime } from '../../time/components/TrackedTime';
import { TravelTimes } from '../../geo/components/TravelTimes';
import { SavedCountdownsField } from '../../countdowns/components/SavedCountdownsField';
import { calendarPath } from '../../../app/pages';
import { useEventMenu } from '../hooks/use-event-menu';
import { eventTimerInput, onEventOccurrence } from '../lib/event-timer';

type FormValues = CalendarEventInput & Record<string, unknown>;

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

/** Days, hours and repetition of an event: saved together, once chosen or left (`EventRepetition`'s `onCommit`). */
const TIMING = ['allDay', 'startDate', 'startTime', 'endDate', 'endTime', 'recurrence'] as const;

/**
 * Fields of an event saved on leaving them, in its panel: texts, travel times, its links and its place; its days,
 * hours and repetition once chosen (a number of its repetition once left).
 */
const ON_BLUR = ['label', 'description', 'links', 'location', 'locationLat', 'locationLon', 'travelBefore', 'travelAfter', ...TIMING] as const;

/** Event and occurrence the panel saves to: the series may be split (« celle-ci et les suivantes ») or moved by a save. */
interface SaveTarget {
  eventId: string;
  /** Occurrence in its series (null: a single event). */
  occurrenceDate: string | null;
  scope: CalendarEventScope;
  /** First day of its series (its rule is edited from there). */
  ruleStart: string;
  /** Rule of its series as saved (a cut reduces its number of occurrences from it). */
  rule: Recurrence | null;
}

/**
 * Calendar event, laid out as the task and routine panels (`DetailLayout`): its label and its « … » menu
 * (« Dupliquer », « Annuler l’évènement » / « Rétablir », « Reporter », « Archiver » / « Restaurer », « Supprimer »,
 * its saved timers), its project, the mentions « Annulé », « Reporté », « Archivé » and « Enregistré »; on the left its
 * description, « Relations » (tasks, routines of its days) and the comments of the occurrence; on the right
 * « Classement » (calendar, categories), « Parties prenantes », « Dates et heures » (its repetition, whole day, period,
 * right in the panel, the warning outside working hours, the time tracked), « Lieu » (travel times, when to leave),
 * « Alarmes » and « Ressources » (links, documents, sheets). Postponed: cancelled, and a new event linked to it takes the new date. A new event is
 * a form with « Créer l’évènement »; an existing one saves each field as soon as it changes (texts on leaving them,
 * its days, hours and repetition once chosen, a number of its repetition once left: `useFieldSave`), for the occurrences chosen when it opened (`scope`): one occurrence alone changes only its own
 * fields (label, description, place, links, days and hours, travel times, routines of its days), the others are those
 * of the series. Deleting still asks which occurrences. An archived event (or one of an archived calendar) opens read
 * only: it can be restored or deleted. Opened without a scope (the question dismissed), it is read only too, its
 * comments open.
 * @param {EventFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function EventForm({ context, occurrence, defaults, onDone, onDuplicated, scope = 'ALL' }: EventFormProps) {
  const categoryItems = useCalendarCategoryItems();
  const { create, update } = useCalendarEventMutations();
  // The panel does not follow the cache: the saved timers of the event as saved from it.
  const [savedCountdownIds, setSavedCountdownIds] = useState(occurrence?.savedCountdownIds ?? []);

  const { data: categories } = useCalendarCategories();
  const { data: documentOptions } = useDocumentOptions();
  const { data: calendarsData } = useCalendars();
  const calendars = calendarsData?.calendars ?? [];
  // Archived (its series), or in an archived calendar (its container): read only.
  const calendarArchived = occurrence ? archivedIds(calendars).has(occurrence.calendarId) : false;
  const archived = Boolean(occurrence?.archived) || calendarArchived;
  // No scope chosen when it opened: read only, nothing archived.
  const reading = scope === null;
  const readOnly = archived || reading;
  // Without a choice, the event goes into the first calendar not archived.
  const defaultCalendarId = unarchived(calendars)[0]?.id ?? null;
  // Questions are stacked over this form's panel: it must stay mounted to finish the save.
  const today = parisToday();
  // Edited with its series (« Toutes les occurrences », « Celle-ci et les suivantes »): an occurrence changed on its own
  // shows the fields of its series on its date.
  const initial: CalendarEventInput = occurrence
    ? scope === 'THIS'
      ? occurrenceInput(occurrence)
      : seriesInput(occurrence)
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
        libraryDocumentIds: [],
        projectResourceIds: [],
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
    rule: (occurrence?.recurrence as Recurrence | null | undefined) ?? null,
  }));
  // The saves run one after the other: each reads where the previous one left the event.
  const saveTarget = useRef(target);
  const { form, saving, commit, fieldProps } = useFieldSave(base, {
    save: occurrence
      ? async (_changes, input) => {
          const now = saveTarget.current;
          const { id: eventId, movedRule } = await update.mutateAsync({ id: now.eventId, input, scope: now.scope, occurrenceDate: now.occurrenceDate });
          if (now.scope === 'THIS') return;
          const split = now.scope === 'FOLLOWING' && eventId !== now.eventId;
          // A series moved keeps its days of the week, of the month or of the year (as the API moves its rule); on the
          // last day of the month, it takes the new rule chosen.
          const shift = daysBetween(now.occurrenceDate ?? input.startDate, input.startDate);
          const rule = input.recurrence as Recurrence | null | undefined;
          // The series the API saved the occurrence in: moved with the series (its weekdays changing week apart from
          // the others make series of their own), and, after a cut, its number of occurrences reduced by those before
          // it; the next saves start from it.
          const series = rule
            ? split && now.rule && now.occurrenceDate
              ? cutSeries(rule, now.rule, now.ruleStart, now.occurrenceDate, shift, movedRule)
              : shiftedSeries(rule, now.ruleStart, shift, movedRule, input.startDate)
            : null;
          const saved = series && seriesOn(series, input.startDate);
          if (saved && saved.rule !== rule) form.setFieldValue('recurrence', saved.rule);
          saveTarget.current = {
            eventId,
            occurrenceDate: input.recurrence ? input.startDate : null,
            scope: 'ALL',
            ruleStart: saved?.start ?? input.startDate,
            rule: saved?.rule ?? null,
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
  // Routines due on the days of the event (an occurrence each, as the agenda shows them: one moved there and kept apart
  // too, told by the day it comes from), with someone in common with it; those chosen stay.
  const { data: routinesData } = useRoutinesData();
  const { data: routineDays } = useRoutineOccurrences(values.startDate && values.endDate ? { from: values.startDate, to: values.endDate } : null);
  const routineById = mapById(routinesData?.routines ?? []);
  const multiDay = values.startDate !== values.endDate;
  const chosenLinks = new Set((values.routineLinks ?? []).map(routineLinkKey));
  const shownDays = new Map((routineDays ?? []).map((item) => [routineLinkKey(item), item.dueDate]));
  const routineOptions = [
    ...new Map([...unarchived(routineDays ?? []).filter((item) => !item.cancelled).map((item) => ({ routineId: item.routineId, date: item.date })), ...(values.routineLinks ?? [])].map((link) => [routineLinkKey(link), link])).values(),
  ].flatMap((link) => {
    const routine = routineById.get(link.routineId);
    const key = routineLinkKey(link);
    if (!routine || (!chosenLinks.has(key) && (routine.archived || !sharePeople(routine.assigneeIds, values.contributorIds)))) return [];
    const shown = shownDays.get(key) ?? link.date;
    const details = [...(multiDay ? [fmt.weekday(shown)] : []), ...(shown !== link.date ? [`déplacée du ${fmt.weekday(link.date)}`] : [])];
    return [{ value: key, label: details.length ? `${routine.label} (${details.join(', ')})` : routine.label }];
  });
  const recurring = target.occurrenceDate !== null;

  /**
   * Puts the event in another project: its documents of projects out of the new project tree are removed (told).
   * @param {string | null} projectId New project.
   * @returns {void}
   */
  const changeProject = (projectId: string | null) => {
    const linked = values.projectResourceIds ?? [];
    const kept = resourcesInTree(linked, documentOptions ?? [], inProjectTree(context, projectId));
    form.setValues({ projectId, projectResourceIds: kept });
    const removed = linked.length - kept.length;
    if (removed > 0) notifySuccess(`${countOf(removed, 'document')} de projet ${plural(removed, 'retiré')} : hors de l’arborescence du nouveau projet.`);
  };

  // A rule is edited from the start of its series (for the whole series or the following occurrences).
  const ruleStart = recurring ? target.ruleStart : values.startDate;

  // A new event only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((input) => create.mutate(input, formCallbacks(form, 'Évènement créé.', onDone)));

  // The timer of « Temps passé »: its project and its linked tasks, on this occurrence.
  const timer = eventTimerInput(context, values, target);
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
  const menu = useEventMenu(occurrence, { fields: values, target, readOnly, savedCountdownIds, onDuplicated, onDone });

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
            onChange={changeProject}
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
                Il reste dans l’agenda, barré.
              </Text>
            )}
            {/* Each postponement on its own line. */}
            {occurrence?.calledOff &&
              occurrence.postponedTo.map((next) => (
                <Text key={next.eventId} size="sm" c="dimmed">
                  Reporté au{' '}
                  <Anchor component={Link} to={calendarPath(next.startDate)} onClick={onDone}>
                    {fmt.dayLong(next.startDate)}
                    {next.startTime && ` à ${next.startTime}`}
                  </Anchor>
                  .
                </Text>
              ))}
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
                Cette occurrence seulement : sa répétition, son calendrier, son projet, ses personnes, ses catégories, ses tâches, ses documents et ses rappels sont ceux de la série.
              </Text>
            )}
            {recurring && !seriesFields && (
              <Text size="xs" c="dimmed">
                Projet, assignés, catégories, tâches, documents et rappels s’appliquent à toute la série.
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
                  <BeneficiariesSelect
                    label="Assignés"
                    description={`Contributeurs${values.projectId ? ' du projet' : ''} ou ${relationNoun(perso, true).toLowerCase()} (personnes hors ${perso ? 'du foyer' : 'de l’équipe'}).`}
                    placeholder="Personne"
                    contributors={context.assignableFor([values.projectId ?? null], values.contributorIds)}
                    value={{ beneficiaryIds: values.contributorIds, beneficiaryRelationIds: values.relationIds ?? [] }}
                    onChange={({ beneficiaryIds, beneficiaryRelationIds }) => form.setValues({ contributorIds: beneficiaryIds, relationIds: beneficiaryRelationIds })}
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
                // Its routine links move with it.
                onChange={(timing) =>
                  form.setValues({ ...timing, routineLinks: withDays(values, timing.startDate, timing.endDate).routineLinks, ...(seriesFields && { recurrence: values.recurrence }) })
                }
                onCommit={() => commit(TIMING)}
              />
              <AvailabilityHint allDay={values.allDay} startDate={values.startDate} startTime={values.startTime ?? null} endDate={values.endDate} endTime={values.endTime ?? null} />
              {occurrence && (
                <TrackedTime
                  seconds={occurrence.trackedSeconds}
                  on={onEventOccurrence(target)}
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
                <EventRemindersField allDay={values.allDay} value={values.reminders} onChange={(reminders) => form.setFieldValue('reminders', reminders)} />,
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
              {series(
                <DocumentsField
                  value={{ libraryDocumentIds: values.libraryDocumentIds ?? [], projectResourceIds: values.projectResourceIds ?? [] }}
                  projectId={values.projectId ?? null}
                  inTree={inProjectTree(context, values.projectId ?? null)}
                  readOnly={readOnly || seriesFields}
                  error={form.errors.libraryDocumentIds ?? form.errors.projectResourceIds}
                  onChange={(documents) => form.setValues({ ...documents })}
                />,
              )}
              {occurrence && !readOnly && <SheetsSection owner={{ eventId: target.eventId }} occurrenceDate={target.occurrenceDate ?? values.startDate} label={values.label || 'l’évènement'} />}
            </PanelGroup>
          </>
        }
        footer={!occurrence && <FormActions onCancel={onDone} submitLabel="Créer l’évènement" loading={create.isPending} />}
      />
    </form>
  );
}
