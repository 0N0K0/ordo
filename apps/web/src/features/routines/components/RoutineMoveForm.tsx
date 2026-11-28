import { LabeledField } from '../../../components/inputs/LabeledField';
import { OccurrenceButton } from '../../../components/actions/OccurrenceButton';
import { confirmCancelOccurrence } from '../lib/confirm-cancel';
import { PICKER_FORMATS } from '../../../lib/format';
import { Group, Select, Stack, Text } from '@mantine/core';
import { DateField } from '../../../components/inputs/DateField';
import { addDays, type RoutineMoveTimes } from '@ordo/shared';
import { ArrowBendUpLeftIcon, ArrowBendUpRightIcon, ClockIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { SubSection } from '../../../components/page/SubSection';
import { parisToday } from '../../../lib/dates';
import { useRoutineMutations, useRoutineOccurrences, useRoutinesData, type RoutineOccurrence } from '../api';
import { dueDayOf, movableOccurrence, moveTo, windowText } from '../lib/routine-format';
import { useRoutineMove } from '../hooks/use-routine-move';
import * as fmt from '../../../lib/format';
import { ExceptionsList } from '../../../components/recurrence/ExceptionsList';
import { useRoutineMoveEntries } from '../hooks/use-routine-exceptions';
import { SlotTimesFields } from './SlotTimesFields';
import { OccurrenceOpening } from './OccurrenceOpening';
import { ActionButton } from '../../../components/actions/ActionButton';

/** Days of occurrences offered before and after today, or the occurrence given when out of them (the query covers 100 days at most). */
const PAST_DAYS = 30;
const NEXT_DAYS = 68;

/** Times of the day of an occurrence, as edited. */
type Times = { fromTime: string | null; dueTime: string | null }[];

/**
 * Times of the day of an occurrence (its exception's when it has one).
 * @param {RoutineOccurrence | undefined} occurrence Occurrence.
 * @returns {Times} Times.
 */
const timesOf = (occurrence: RoutineOccurrence | undefined): Times =>
  occurrence?.slots.length ? occurrence.slots.map((slot) => ({ fromTime: slot.fromTime, dueTime: slot.dueTime })) : [{ fromTime: null, dueTime: null }];

/**
 * Changes an occurrence of a routine, chosen among those around today (by default the one given, else its current one): another day
 * (postponed or brought forward), other times of the day (the same day or another one), or cancelled. Each change is
 * an exception to its rule. Lists the exceptions of the routine, each one removable (the occurrence goes back to its
 * own day and times).
 * @param {{ routineId: string, date?: string | null, onDone: () => void }} props Component props.
 * @param {string} props.routineId Routine.
 * @param {string | null} [props.date] Occurrence chosen first. Optional. Default = its current one (the next one once ticked).
 * @param {() => void} props.onDone Closes the form.
 * @returns {JSX.Element} Form.
 */
export function RoutineMoveForm({ routineId, date: firstDate, onDone }: { routineId: string; date?: string | null; onDone: () => void }) {
  const { data } = useRoutinesData();
  const routine = data?.routines.find((item) => item.id === routineId);
  const today = parisToday();
  // Around today; an occurrence given further away (a day of « Ma journée »), around it, so its times are read.
  const [range] = useState(() => {
    const around = firstDate && (firstDate < addDays(today, -PAST_DAYS) || firstDate > addDays(today, NEXT_DAYS)) ? firstDate : today;
    return { from: addDays(around, -PAST_DAYS), to: addDays(around, NEXT_DAYS) };
  });
  const { data: allOccurrences } = useRoutineOccurrences(range);
  // Those not ticked (a ticked one is not changed) nor cancelled (given back from the exceptions), late ones only when past.
  const occurrences = (allOccurrences ?? []).filter((item) => item.routineId === routineId && !item.cancelled && !item.slots.some((slot) => slot.done));
  const movable = firstDate ?? (routine ? movableOccurrence(routine) : null);
  const [chosen, setChosen] = useState<string | null>(null);
  const date = chosen ?? movable;
  const occurrence = occurrences.find((item) => item.date === date);
  // The day it is on (`date` identifies it: the day of its rule when moved and kept apart on another one's day).
  const due = date && (occurrence?.dueDate ?? (routine ? dueDayOf(routine, date) : date));
  const [to, setTo] = useState<string | null>(null);
  const [edited, setEdited] = useState<Times | null>(null);
  const move = useRoutineMove();
  const { moveOccurrence, deleteOccurrence } = useRoutineMutations();
  const moveEntries = useRoutineMoveEntries(routine);
  if (!routine) return <Text size="sm">Cette routine n’existe plus.</Text>;
  const moved = moveTo(routine, date);
  const target = to ?? (due ? addDays(due, 1) : null);
  const original = timesOf(occurrence);
  const times = edited ?? original;
  const timesChanged = times.some((item, index) => item.fromTime !== original[index]?.fromTime || item.dueTime !== original[index]?.dueTime);
  const options = [...new Set([...(movable ? [movable] : []), ...occurrences.map((item) => item.date)])].sort().map((day) => {
    const item = occurrences.find((other) => other.date === day);
    const hours = item?.slots
      .map((slot) => windowText(slot))
      .filter(Boolean)
      .join(', ');
    // Shown on its due day (two the same day: the one moved there says from where).
    const shown = item?.dueDate ?? (routine ? dueDayOf(routine, day) : day);
    // Moved there: its day by its rule (or the day it was moved to) is not the one that identifies it.
    const from = (item?.ruleDueDate ?? shown) !== day ? ` · déplacée du ${fmt.dayShort(day)}` : '';
    return { value: day, label: `${fmt.capitalize(fmt.dayLong(shown))}${shown === today ? ' (aujourd’hui)' : shown < today ? ' (en retard)' : ''}${hours ? ` · ${hours}` : ''}${from}` };
  });

  /**
   * Chooses another occurrence: its day and times start again from its own.
   * @param {string | null} next Occurrence.
   * @returns {void}
   */
  const choose = (next: string | null) => {
    setChosen(next);
    setTo(null);
    setEdited(null);
  };

  /**
   * Changes the times of one of its times of the day.
   * @param {number} index Time of the day.
   * @param {Partial<Times[number]>} changes Changes.
   * @returns {void}
   */
  const changeTimes = (index: number, changes: Partial<Times[number]>) => setEdited(times.map((item, other) => (other === index ? { ...item, ...changes } : item)));
  const submitLabel = !target || target === due ? 'Changer l’horaire' : target < due! ? 'Avancer' : 'Reporter';
  const submitIcon = !target || target === due ? <ClockIcon aria-hidden /> : target < due! ? <ArrowBendUpLeftIcon aria-hidden /> : <ArrowBendUpRightIcon aria-hidden />;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!date || !target || (target === due && !timesChanged)) return;
        move(routine, target, date, onDone, timesChanged ? { times: times as RoutineMoveTimes, previous: original as RoutineMoveTimes } : undefined, due);
      }}
    >
      <Stack gap="md">
        {date ? (
          <>
            <OccurrenceOpening routine={routine} occurrence={occurrence}>
              <Select
                label="Occurrence"
                description={moved ? `Déjà déplacée depuis le ${fmt.dayLong(moved.from)}.` : 'Ne change que celle-ci : c’est une exception, la règle ne change pas.'}
                data={options}
                value={date}
                onChange={choose}
                allowDeselect={false}
              />
            </OccurrenceOpening>
            <DateField
              label="Nouvelle date"
              description="Plus tard pour la reporter, plus tôt pour l’avancer ; son jour pour n’en changer que l’horaire."
              required
              valueFormat={PICKER_FORMATS.weekday}
              minDate={routine.startDate}
              value={target}
              onChange={setTo}
              data-autofocus
            />
            <LabeledField label="Horaires">
              {times.map((item, index) => (
                <Group key={index} gap={6} wrap="nowrap">
                  <SlotTimesFields value={item} onChange={(changes) => changeTimes(index, changes)} name={`moment ${index + 1}`} />
                </Group>
              ))}
            </LabeledField>
          </>
        ) : (
          <Text size="sm" c="dimmed">
            Plus d’occurrence à venir à changer.
          </Text>
        )}
        {moveEntries.length > 0 && (
          <SubSection title="Exceptions">
            <ExceptionsList entries={moveEntries} />
          </SubSection>
        )}
        <Group justify="flex-end" gap="sm">
          <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onDone}>
            Fermer
          </ActionButton>
          {date && (
            <OccurrenceButton
              action="cancel"
              loading={deleteOccurrence.isPending}
              onClick={() => confirmCancelOccurrence(due!, () => deleteOccurrence.mutateAsync({ id: routine.id, date, scope: 'THIS' }).then(() => onDone()), `Occurrence du ${fmt.dayLong(due!)} annulée.`)}
            />
          )}
          {date && (
            <ActionButton type="submit" icon={submitIcon} disabled={!target || (target === due && !timesChanged)} loading={moveOccurrence.isPending}>
              {submitLabel}
            </ActionButton>
          )}
        </Group>
      </Stack>
    </form>
  );
}
