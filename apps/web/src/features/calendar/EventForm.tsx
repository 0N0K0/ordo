import { SidePanel } from '../../components/panels/SidePanel';
import { TimeField } from '../../components/TimeField';
import { ActionIcon, Alert, Anchor, Button, ColorSwatch, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { addDays, calendarEventInputSchema, daysBetween, formatDuration, type CalendarEventInput } from '@ordo/shared';
import { ArrowArcRightIcon, ArrowCounterClockwiseIcon, CalendarXIcon, CarIcon, CopyIcon, TimerIcon, LinkIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useState } from 'react';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { ProjectSelect } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import { DestructiveActions, DestructiveButton } from '../../components/dialogs/DestructiveActions';
import { useCalendarCategories, useCalendarEventMutations, useCalendars, type EventOccurrence } from './api';
import { useTimeMutations } from '../time/api';
import { EventLocation } from '../geo/EventLocation';
import { TravelCalculator } from '../geo/TravelCalculator';
import { useTreasurySettings } from '../treasury/api';
import { useScopeQuestion } from './ask-scope';
import { AvailabilityHint } from './AvailabilityHint';
import { categoryOptions } from './category-tree';
import { LOCAL_TIME_ZONE, occurrenceInput, REMINDER_PRESETS } from './event-input';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { treeSelectProps } from '../../components/tree-select/tree-select';

type FormValues = CalendarEventInput & Record<string, unknown>;

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Printed day, with a time.
 * @param {string} date YYYY-MM-DD.
 * @param {string | null} [time] HH:MM. Optional.
 * @returns {string} "mardi 12 novembre 2026 à 10:00".
 */
const printedDay = (date: string, time?: string | null) => `${dayFormat.format(new Date(`${date}T00:00:00Z`))}${time ? ` à ${time}` : ''}`;

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
        <DatePickerInput label="Nouvelle date" required valueFormat="ddd D MMM YYYY" value={values.startDate} onChange={(date) => date && setValues({ ...values, startDate: date })} />
        {!fields.allDay && <TimeField label="Début" required value={values.startTime ?? ''} onChange={(value) => setValues({ ...values, startTime: value || null })} />}
        {!fields.allDay && <TimeField label="Fin" required value={values.endTime ?? ''} onChange={(value) => setValues({ ...values, endTime: value || null })} />}
      </SimpleGrid>
      <AvailabilityHint allDay={fields.allDay} startDate={values.startDate} startTime={values.startTime} endDate={endDate} endTime={values.endTime} />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          loading={loading}
          disabled={!valid}
          onClick={() => onConfirm({ ...fields, title: values.title.trim(), startDate: values.startDate, endDate, startTime: values.startTime, endTime: values.endTime, recurrence: null })}
        >
          Reporter
        </Button>
      </Group>
    </Stack>
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
  const { create, update, remove, setCalledOff, postpone } = useCalendarEventMutations();
  const [postponing, setPostponing] = useState(false);
  const { start: startTimer } = useTimeMutations();

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
      { onSuccess: () => notifySuccess('Chrono lancé sur l’évènement.'), onError: (error) => notifyError(error.message) },
    );
  };
  const { data: categories } = useCalendarCategories();
  const { data: treasury } = useTreasurySettings();
  const { data: calendarsData } = useCalendars();
  const calendars = calendarsData?.calendars ?? [];
  const colorOfCalendar = new Map(calendars.map((calendar) => [calendar.id, calendar.color]));
  // Questions are stacked over this form's panel: it must stay mounted to finish the save.
  const scopeQuestion = useScopeQuestion();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
        categoryIds: [],
        taskIds: [],
        ...defaults,
      };
  const form = useAppForm<FormValues>({ initialValues: initial as FormValues, schema: calendarEventInputSchema });
  const values = form.values;
  // Relations with a contributor take part as that contributor; one already chosen stays offered.
  const relationOptions = (treasury?.treasuryRelations ?? [])
    .filter((relation) => !relation.contributorId || (values.relationIds ?? []).includes(relation.id))
    .map((relation) => ({ value: relation.id, label: relation.name }));
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
      const chosen = await scopeQuestion.ask({ action: 'update', allowThis: !ruleChanged });
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
          onError: (error) => notifyError(error.message),
        },
      );
    if (recurring) {
      const scope = await scopeQuestion.ask({ action: 'delete' });
      if (scope) run(scope);
      return;
    }
    setConfirmingDelete(true);
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
      const chosen = await scopeQuestion.ask({ action: calledOff ? 'cancel' : 'restore' });
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
        onError: (error) => notifyError(error.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {scopeQuestion.dialog}
      <Modal opened={confirmingDelete} onClose={() => setConfirmingDelete(false)} title="Supprimer l’évènement" centered zIndex={300}>
        <Stack gap="md">
          <Text size="sm">L’évènement « {occurrence?.title} » sera supprimé définitivement. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={remove.isPending}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={() => {
              setConfirmingDelete(false);
              remove.mutate(
                { id: occurrence!.eventId, scope: 'ALL', occurrenceDate: occurrence!.occurrenceDate },
                {
                  onSuccess: () => {
                    notifySuccess('Évènement supprimé.');
                    onDone();
                  },
                  onError: (error) => notifyError(error.message),
                },
              );
            }}
          />
        </Stack>
      </Modal>
      <SidePanel opened={postponing} onClose={() => setPostponing(false)} title="Reporter l’évènement">
        {postponing && occurrence && (
          <PostponeForm
            fields={values}
            title={occurrence.title}
            loading={postpone.isPending}
            onCancel={() => setPostponing(false)}
            onConfirm={(input) =>
              postpone.mutate(
                { id: occurrence.eventId, occurrenceDate: occurrence.occurrenceDate, input },
                {
                  onSuccess: () => {
                    notifySuccess('Évènement reporté.');
                    setPostponing(false);
                    onDone();
                  },
                  onError: (error) => notifyError(error.message),
                },
              )
            }
          />
        )}
      </SidePanel>
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
        <Switch
          label="Journée entière"
          checked={values.allDay}
          onChange={(event) => {
            const allDay = event.currentTarget.checked;
            form.setValues({ allDay, startTime: allDay ? null : '09:00', endTime: allDay ? null : '10:00' });
          }}
        />
        <SimpleGrid cols={{ base: 1, xs: values.allDay ? 2 : 4 }} spacing="sm">
          <DatePickerInput
            label="Début"
            required
            valueFormat="ddd D MMM YYYY"
            {...form.getInputProps('startDate')}
            onChange={(startDate) => {
              if (!startDate) return;
              // The end follows, keeping the duration.
              const span = daysBetween(values.startDate, values.endDate);
              form.setValues({ startDate, endDate: addDays(startDate, Math.max(0, span)) });
            }}
          />
          {!values.allDay && <TimeField label="Heure de début" required {...form.getInputProps('startTime')} />}
          <DatePickerInput label="Fin" required valueFormat="ddd D MMM YYYY" minDate={values.startDate} {...form.getInputProps('endDate')} />
          {!values.allDay && <TimeField label="Heure de fin" required {...form.getInputProps('endTime')} />}
        </SimpleGrid>
        {!values.allDay && (
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <NumberInput
              label="Trajet aller"
              description="Avant le début"
              leftSection={<CarIcon aria-hidden />}
              suffix=" min"
              min={0}
              max={24 * 60}
              step={5}
              allowDecimal={false}
              {...form.getInputProps('travelBefore')}
            />
            <NumberInput
              label="Trajet retour"
              description="Après la fin"
              leftSection={<CarIcon aria-hidden />}
              suffix=" min"
              min={0}
              max={24 * 60}
              step={5}
              allowDecimal={false}
              {...form.getInputProps('travelAfter')}
            />
            <div>
              <TravelCalculator
                eventPoint={values.locationLat != null && values.locationLon != null ? { lat: values.locationLat, lon: values.locationLon } : null}
                onResult={({ before, after }) => form.setValues({ travelBefore: before, travelAfter: after })}
              />
            </div>
          </SimpleGrid>
        )}
        <AvailabilityHint allDay={values.allDay} startDate={values.startDate} startTime={values.startTime ?? null} endDate={values.endDate} endTime={values.endTime ?? null} />

        <RecurrenceEditor
          value={values.recurrence ? { ...values.recurrence, weekParity: values.recurrence.weekParity ?? null } : null}
          onChange={(recurrence) => form.setFieldValue('recurrence', recurrence)}
          start={ruleStart}
        />

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
            data={calendars.map((calendar) => ({ value: calendar.id, label: calendar.name }))}
            // Without a choice, the event goes into the first calendar.
            value={values.calendarId ?? calendars[0]?.id ?? null}
            onChange={(calendarId) => form.setFieldValue('calendarId', calendarId)}
            allowDeselect={false}
            leftSection={<ColorSwatch size={12} color={colorOfCalendar.get(values.calendarId ?? calendars[0]?.id ?? '') ?? 'transparent'} />}
            renderOption={({ option }) => (
              <Group gap="xs" wrap="nowrap">
                <ColorSwatch size={12} color={colorOfCalendar.get(option.value) ?? 'transparent'} />
                {option.label}
              </Group>
            )}
          />
          <ProjectSelect context={context} label="Projet" clearable placeholder="Aucun" {...form.getInputProps('projectId')} />
          <BatchMultiSelect
            label="Contributeurs"
            placeholder={values.contributorIds.length ? undefined : 'Aucun'}
            data={context.contributors.map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor) }))}
            searchable
            clearable
            {...form.getInputProps('contributorIds')}
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
            description={values.projectId ? 'Tâches du projet et de ses sous-projets.' : undefined}
            data={context.tasks
              .filter((task) => values.taskIds?.includes(task.id) || (!task.archived && (!values.projectId || context.rootOf(task.projectId) === context.rootOf(values.projectId))))
              .map((task) => ({ value: task.id, label: `${context.taskLabel(task, values.projectId)}${task.closed ? ' (fermée)' : ''}` }))}
            searchable
            clearable
            limit={100}
            nothingFoundMessage="Aucune tâche"
            value={values.taskIds ?? []}
            onChange={(taskIds) => form.setFieldValue('taskIds', taskIds)}
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
              <Button variant="light" size="xs" leftSection={<TimerIcon aria-hidden />} disabled={!values.projectId} loading={startTimer.isPending} onClick={handleTimer}>
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
                  <Button variant="subtle" color="gray" leftSection={<ArrowArcRightIcon aria-hidden />} onClick={() => setPostponing(true)}>
                    Reporter
                  </Button>
                </>
              )}
            </Group>
          ) : (
            <span />
          )}
          <Group gap="sm">
            <Button variant="default" onClick={onDone}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {occurrence ? 'Enregistrer' : 'Créer l’évènement'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
