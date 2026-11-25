import { ArrowCounterClockwiseIcon, ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react';
import { DeleteButton } from '../../../components/dialogs/DestructiveActions';
import { Fieldset, Group, Stack, Text, Switch } from '@mantine/core';
import { changedScheduleSlot, routineSlotSchema, scheduleSlotTimeSchema, slotWords, type ScheduleSlotTime, type WorkScheduleRule } from '@ordo/shared';
import { useEffect, useRef } from 'react';
import { openRoutineForm } from '../../routines/lib/open-routine-form';
import { OccurrenceOpening } from '../../routines/components/OccurrenceOpening';
import { RoutineTickButton } from '../../routines/components/RoutineTick';
import { doneAtText, windowText } from '../../routines/lib/routine-format';
import { ROUTINE_DONE_STATES } from '../../routines/lib/routine-columns';
import { useToday } from '../../../lib/use-now';
import * as fmt from '../../../lib/format';
import type { RoutineOccurrenceRef } from '../hooks/calendar-edits';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { useAppForm, useFieldSave } from '../../../lib/form';
import { routinesKey, useRoutineMutations, useRoutinesData, type RoutineOccurrence } from '../../routines/api';
import { useCachedItem } from '../../../lib/mutation';
import { ruleScheduleInput, useScheduleTypes, useWorkScheduleMutations, useWorkSchedules, type CalendarEventScope } from '../api';
import { useScheduleConversion } from '../hooks/use-schedule-conversion';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { ActionButton } from '../../../components/actions/ActionButton';

/**
 * Panel of a slot of a schedule (a créneau or an éphéméride, in its own words) from the calendar: its day and hours (or the whole day), each saved as soon as it
 * changes for the days chosen when the panel opened (`scope`: this day, an exception; it and the
 * following ones; all; null: none chosen, read only); occurrences of routines a change makes disappear confirmed first
 * (declined: put back); or deleting it (its own question). Its « … » menu converts the schedule into an éphéméride or
 * the reverse (`useScheduleConversion`, the whole schedule whatever the scope; the panel closes once converted).
 * @param {{ label: string, schedule: WorkScheduleRule, slot: ScheduleSlotTime, scope: CalendarEventScope | null, onDelete: (schedule: WorkScheduleRule, slot: ScheduleSlotTime) => void, onClose: () => void }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function SlotEditForm({
  label,
  schedule,
  slot,
  scope,
  onDelete,
  onClose,
}: {
  label: string;
  schedule: WorkScheduleRule;
  slot: ScheduleSlotTime;
  scope: CalendarEventScope | null;
  /** Deletes the slot as it is now, in its schedule as it is now. */
  onDelete: (schedule: WorkScheduleRule, slot: ScheduleSlotTime) => void;
  onClose: () => void;
}) {
  const { update } = useWorkScheduleMutations();
  // The schedule and the slot as saved: a save changes the slot where the previous one put it.
  const saved = useRef({ schedule, slot });
  const base = useAppForm<ScheduleSlotTime & Record<string, unknown>>({ initialValues: { ...slot }, schema: scheduleSlotTimeSchema });
  const reading = scope === null;
  const { form, saving } = useFieldSave(base, {
    save:
      scope === null
        ? null
        : async (_changes, values) => {
            const change = { date: values.date, start: values.start, end: values.end, allDay: values.allDay };
            const next = changedScheduleSlot(saved.current.schedule, saved.current.slot, change, scope);
            const current = saved.current.schedule;
            await update.mutateAsync({ id: current.id, input: ruleScheduleInput(current, next) });
            saved.current = { schedule: { ...current, ...next }, slot: change };
          },
    schema: scheduleSlotTimeSchema,
  });
  const values = form.values;
  // « Convertir en éphéméride » / « Convertir en créneau », of the schedule as saved.
  const convert = useScheduleConversion();
  const { data: schedules } = useWorkSchedules();
  const { data: types } = useScheduleTypes();
  const current = schedules?.find((item) => item.id === schedule.id);
  const menu = current && (
    <ActionsMenu name={current.label} items={[convert.schedule(current, current.typeId ? types?.find((type) => type.id === current.typeId) : undefined, onClose)]} />
  );
  return (
    <Stack gap="md">
      {!reading && <SaveStatus saving={saving} />}
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" c="dimmed">
        {scope === null ? slotReadingNote(schedule.ephemeris) : slotScopeNote(scope, schedule.ephemeris)}
      </Text>
      <Fieldset variant="unstyled" disabled={reading} p={0} m={0}>
        <Stack gap="md">
          <Switch
            label="Journée entière"
            checked={values.allDay}
            onChange={(event) => form.setValues(event.currentTarget.checked ? { allDay: true, start: '00:00', end: '24:00' } : { allDay: false, start: '09:00', end: '17:00' })}
          />
          <PeriodField
            label="Jour"
            required
            weekday
            sameDay
            value={[values.date, values.date]}
            times={values.allDay ? undefined : [values.start, values.end]}
            errors={[form.errors.date, form.errors.end ?? form.errors.start]}
            onChange={([date], hours) => date && form.setValues({ date, ...(hours ? { start: hours[0] ?? '', end: hours[1] ?? '' } : {}) })}
            data-autofocus
          />
        </Stack>
      </Fieldset>
      {reading ? (
        <Group justify="space-between">
          {menu ?? <span />}
          <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onClose}>
            Fermer
          </ActionButton>
        </Group>
      ) : (
        <Group gap={4}>
          <DeleteButton onClick={() => onDelete(saved.current.schedule, saved.current.slot)} />
          {menu}
        </Group>
      )}
    </Stack>
  );
}

/**
 * Note of the panel of a slot opened without choosing which days its changes apply to: read only.
 * @param {boolean | undefined} ephemeris An éphéméride. Optional.
 * @returns {string} Note.
 */
const slotReadingNote = (ephemeris?: boolean): string => `Lecture seule : aucune portée n’a été choisie à l’ouverture. Fermez le panneau et rouvrez-le pour modifier ${slotWords(ephemeris).the}.`;

/**
 * What the changes of the panel of a slot apply to, by the scope chosen when it opened.
 * @param {CalendarEventScope} scope Scope.
 * @param {boolean | undefined} ephemeris An éphéméride. Optional.
 * @returns {string} Note.
 */
const slotScopeNote = (scope: CalendarEventScope, ephemeris?: boolean): string =>
  scope === 'THIS' ? `Ce jour seulement : c’est une exception, les autres jours ${slotWords(ephemeris).of} ne changent pas.` : scope === 'FOLLOWING' ? 'Ce jour et les suivants.' : 'Tous les jours de ces horaires.';

/** Day and times of one time of the day of a routine occurrence, as its panel edits them. */
interface OccurrenceValues extends Record<string, unknown> {
  date: string;
  fromTime: string | null;
  dueTime: string | null;
  optional: boolean;
}

/**
 * Panel of an occurrence of a routine from the calendar: its day and the times of one of its times of the day, each
 * saved as soon as it changes for the occurrences chosen when the panel opened (`scope`: this one, an
 * exception; it and the following ones; all; null: none chosen, read only); or cancelling it; or opening the routine.
 * Its time of the day is ticked there too (`RoutineTickButton`: « Faite le », its time changed, unticked), from its
 * first day. The occurrence of the cache is followed (moved or changed elsewhere). A cancelled occurrence is only given back
 * (« Rétablir »); one of an archived routine is read only, also when the routine is archived elsewhere while the panel
 * is open.
 * @param {{ occurrence: RoutineOccurrenceRef, movedFrom: string | null, scope: CalendarEventScope | null, onDelete: () => void, onRestore: () => void, onClose: () => void }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function RoutineOccurrenceForm({
  occurrence,
  movedFrom,
  scope,
  onDelete,
  onRestore,
  onClose,
}: {
  occurrence: RoutineOccurrenceRef;
  /** Day of the rule it was moved from, if any (finds it in the cache once moved). */
  movedFrom: string | null;
  scope: CalendarEventScope | null;
  onDelete: () => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const { changeOccurrence } = useRoutineMutations();
  // The day that identifies it now: a save that moves it moves the occurrence the next one changes.
  const day = useRef(occurrence.date);
  // Its day in the rule: the occurrence of the cache is the one of that day, wherever it is now.
  const ruleDay = movedFrom ?? occurrence.date;
  const current = useCachedItem(
    [...routinesKey, 'occurrences'],
    (items: RoutineOccurrence[]) => items,
    (item: RoutineOccurrence) => item.routineId === occurrence.routine.id && (item.movedFrom || item.date) === ruleDay,
  );
  const currentSlot = current?.slots.find((slot) => slot.index === occurrence.slot.index);
  // Its routine as the cache holds it: archived elsewhere while open, it turns read only (a coming occurrence leaves the
  // cache of the occurrences then, the opened copy would stay editable).
  const { data: routines } = useRoutinesData();
  const cachedRoutine = routines?.routines.find((routine) => routine.id === occurrence.routine.id);
  const archived = occurrence.archived || Boolean(cachedRoutine?.archived);
  // Ticked from its first day (« Ouverture »).
  const opened = (current?.startDate ?? occurrence.dueDate) <= useToday();
  const base = useAppForm<OccurrenceValues>({
    initialValues: { date: occurrence.dueDate, fromTime: occurrence.slot.fromTime, dueTime: occurrence.slot.dueTime, optional: false },
    schema: routineSlotSchema,
  });
  const reading = scope === null;
  const { form, saving } = useFieldSave(base, {
    save:
      occurrence.cancelled || archived || scope === null
        ? null
        : async (_changes, values) => {
            day.current = await changeOccurrence.mutateAsync({
              id: occurrence.routine.id,
              date: day.current,
              scope,
              to: values.date,
              slot: occurrence.slot.index,
              fromTime: values.fromTime,
              dueTime: values.dueTime,
            });
          },
    schema: routineSlotSchema,
    saved: current && currentSlot ? { date: current.dueDate, fromTime: currentSlot.fromTime, dueTime: currentSlot.dueTime, optional: false } : undefined,
  });
  // Moved elsewhere (another tab, the calendar): the next saves change it where it is now.
  useEffect(() => {
    if (current && !saving) day.current = current.date;
  }, [current, saving]);
  const openRoutine = (
    <ActionButton
      priority="tertiary"
      icon={<ArrowSquareOutIcon aria-hidden />}
      onClick={() => {
        onClose();
        openRoutineForm({ routine: occurrence.routine, occurrenceDate: day.current });
      }}
    >
      Ouvrir la routine
    </ActionButton>
  );
  if (occurrence.cancelled || archived) {
    return (
      <Stack gap="md">
        <Text size="sm">
          {archived
            ? 'La routine est archivée : cette occurrence est en lecture seule. Restaurez la routine pour la modifier.'
            : 'Cette occurrence est annulée : elle reste affichée, barrée, avec ses commentaires.'}
        </Text>
        <Group justify="space-between" gap="sm">
          {openRoutine}
          <Group gap="sm">
            <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onClose}>
              Fermer
            </ActionButton>
            {!archived && (
              <ActionButton icon={<ArrowCounterClockwiseIcon aria-hidden />} onClick={onRestore}>
                Rétablir
              </ActionButton>
            )}
          </Group>
        </Group>
      </Stack>
    );
  }
  return (
    <Stack gap="md">
      {!reading && <SaveStatus saving={saving} />}
      <Text size="sm" c="dimmed">
        {scope === null ? READING_NOTE : SCOPE_NOTES[scope]}
      </Text>
      <Fieldset variant="unstyled" disabled={reading} p={0} m={0}>
        <Stack gap="md">
          <OccurrenceOpening routine={cachedRoutine ?? occurrence.routine} occurrence={current}>
            <PeriodField
              label="Jour"
              required
              weekday
              sameDay
              optionalTimes
              bounds={['À partir de', 'Avant']}
              min={occurrence.routine.startDate}
              value={[form.values.date, form.values.date]}
              times={[form.values.fromTime, form.values.dueTime]}
              errors={[form.errors.date, form.errors.dueTime ?? form.errors.fromTime]}
              onChange={([date], hours) => date && form.setValues({ date, fromTime: hours?.[0] ?? null, dueTime: hours?.[1] ?? null })}
            />
          </OccurrenceOpening>
        </Stack>
      </Fieldset>
      {/* Ticked (or its time changed, or unticked) here too, whatever the scope chosen: not a change of the occurrence. */}
      <Group gap="xs" wrap="nowrap">
        <RoutineTickButton
          tick={{ id: occurrence.routine.id, date: current?.date ?? occurrence.date, slot: occurrence.slot.index }}
          label={(current?.slots.length ?? 1) > 1 ? `${occurrence.routine.label}, ${windowText(occurrence.slot) || `fois ${occurrence.slot.index + 1}`}` : occurrence.routine.label}
          hint={opened ? ROUTINE_DONE_STATES.toggleLabels.yes : 'Pas encore ouverte'}
          done={Boolean(currentSlot?.done)}
          doneAt={currentSlot?.doneAt ?? null}
          optional={currentSlot?.optional}
          // Its tick is read from the occurrence of the cache: none there (being reloaded), nothing to tick from.
          disabled={!opened || !currentSlot}
          target={{ dueDate: current?.dueDate ?? occurrence.dueDate, fromTime: currentSlot?.fromTime ?? occurrence.slot.fromTime, dueTime: currentSlot?.dueTime ?? occurrence.slot.dueTime }}
        />
        <Text size="sm">{currentSlot?.doneAt ? fmt.capitalize(doneAtText(currentSlot.doneAt)) : opened ? 'À faire' : 'Pas encore ouverte'}</Text>
      </Group>
      {reading ? (
        <Group justify="space-between" gap="sm">
          {openRoutine}
          <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onClose}>
            Fermer
          </ActionButton>
        </Group>
      ) : (
        <Group gap={4}>
          <DeleteButton onClick={onDelete} />
          {openRoutine}
        </Group>
      )}
    </Stack>
  );
}

/** Panel of a routine occurrence opened without choosing which occurrences its changes apply to: read only. */
const READING_NOTE = 'Lecture seule : aucune portée n’a été choisie à l’ouverture. Fermez le panneau et rouvrez-le pour modifier l’occurrence.';

/** What the changes of the panel of a routine occurrence apply to, by the scope chosen when it opened. */
const SCOPE_NOTES: Record<CalendarEventScope, string> = {
  THIS: 'Cette occurrence seulement : c’est une exception, la règle ne change pas.',
  FOLLOWING: 'Cette occurrence et les suivantes.',
  ALL: 'Toutes les occurrences.',
};
