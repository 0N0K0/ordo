import { LabeledField } from '../../../components/inputs/LabeledField';
import { PICKER_FORMATS } from '../../../lib/format';
import { Group, Select, Stack, Text } from '@mantine/core';
import { DateField } from '../../../components/inputs/DateField';
import { addDays, type RoutineMoveTimes } from '@ordo/shared';
import { ArrowRightIcon, CalendarXIcon, ArrowBendUpLeftIcon, ArrowBendUpRightIcon, ClockIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { SubSection } from '../../../components/page/SubSection';
import { ON_ERROR } from '../../../lib/notify';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { parisToday } from '../../../lib/dates';
import { useRoutineMutations, useRoutineOccurrences, useRoutinesData, type RoutineOccurrence } from '../api';
import { dueDayOf, movableOccurrence, moveTo, movesOf, windowText } from '../lib/routine-format';
import { useRoutineMove } from '../hooks/use-routine-move';
import * as fmt from '../../../lib/format';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { SlotTimesFields } from './SlotTimesFields';
import { OccurrenceOpening } from './OccurrenceOpening';
import { ActionButton } from '../../../components/actions/ActionButton';

/**
 * Short date of a calendar date: "jeu. 13 nov.".
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Text.
 */
const shortText = (date: string) => fmt.weekday(date);

/** Days of occurrences offered before and after today (the query covers 100 days at most). */
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
 * Changes an occurrence of a routine, chosen among those around today (by default its current one): another day
 * (postponed or brought forward), other times of the day (the same day or another one), or cancelled. Each change is
 * an exception to its rule. Lists the exceptions of the routine, each one removable (the occurrence goes back to its
 * own day and times).
 * @param {{ routineId: string, onDone: () => void }} props Component props.
 * @param {string} props.routineId Routine.
 * @param {() => void} props.onDone Closes the form.
 * @returns {JSX.Element} Form.
 */
export function RoutineMoveForm({ routineId, onDone }: { routineId: string; onDone: () => void }) {
  const { data } = useRoutinesData();
  const routine = data?.routines.find((item) => item.id === routineId);
  const today = parisToday();
  const [range] = useState(() => ({ from: addDays(today, -PAST_DAYS), to: addDays(today, NEXT_DAYS) }));
  const { data: allOccurrences } = useRoutineOccurrences(range);
  // Those not ticked (a ticked one is not changed) nor cancelled (given back from the exceptions), late ones only when past.
  const occurrences = (allOccurrences ?? []).filter((item) => item.routineId === routineId && !item.cancelled && !item.slots.some((slot) => slot.done));
  const movable = routine ? movableOccurrence(routine) : null;
  const [chosen, setChosen] = useState<string | null>(null);
  const date = chosen ?? movable;
  const occurrence = occurrences.find((item) => item.date === date);
  // The day it is on (`date` identifies it: the day of its rule when moved and kept apart on another one's day).
  const due = date && (occurrence?.dueDate ?? (routine ? dueDayOf(routine, date) : date));
  const [to, setTo] = useState<string | null>(null);
  const [edited, setEdited] = useState<Times | null>(null);
  const move = useRoutineMove();
  const { removeMove, moveOccurrence, deleteOccurrence } = useRoutineMutations();
  if (!routine) return <Text size="sm">Cette routine n’existe plus.</Text>;
  const moved = moveTo(routine, date);
  const moves = movesOf(routine);
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
    const from = shown !== day ? ` · déplacée du ${fmt.dayShort(day)}` : '';
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
        move(routine, target, date, onDone, timesChanged ? { times: times as RoutineMoveTimes, previous: original as RoutineMoveTimes } : undefined);
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
        {moves.length > 0 && (
          <SubSection title="Exceptions">
            {moves.map((item) => (
              <Group key={item.from} gap="xs" wrap="nowrap">
                <Text size="sm">{shortText(item.from)}</Text>
                <ArrowRightIcon aria-hidden />
                <Text size="sm" style={{ flex: 1 }}>
                  {item.to === null
                    ? 'annulée'
                    : item.to === item.from
                      ? 'autres horaires'
                      : item.merged
                        ? `fusionnée avec celle du ${shortText(item.to)}`
                        : `${shortText(item.to)} (${item.to > item.from ? 'reportée' : 'avancée'}${item.times ? ', autres horaires' : ''}${item.apart ? ', à part de celle du jour' : ''})`}
                </Text>
                <RemoveButton
                  label="Remettre à son jour"
                  size="sm"
                  aria-label={`Remettre l’occurrence du ${fmt.dayLong(item.from)} à son jour`}
                  loading={removeMove.isPending && removeMove.variables?.from === item.from}
                  onClick={() => removeMove.mutate({ id: routine.id, from: item.from }, ON_ERROR)}
                />
              </Group>
            ))}
          </SubSection>
        )}
        <Group justify="flex-end" gap="sm">
          <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onDone}>
            Fermer
          </ActionButton>
          {date && (
            <ActionButton
              danger
              icon={<CalendarXIcon aria-hidden />}
              loading={deleteOccurrence.isPending}
              onClick={() =>
                confirmDestructive({
                  title: 'Annuler cette occurrence ?',
                  risks: `L’occurrence du ${fmt.dayLong(due!)} n’aura pas lieu : elle reste affichée, barrée, avec ses commentaires ; c’est une exception, les autres occurrences ne changent pas. Elle se rétablit depuis la liste des exceptions ou l’agenda.`,
                  confirmLabel: 'Annuler l’occurrence',
                  confirmIcon: <CalendarXIcon aria-hidden />,
                  run: () => deleteOccurrence.mutateAsync({ id: routine.id, date, scope: 'THIS' }).then(() => onDone()),
                  done: `Occurrence du ${fmt.dayLong(due!)} annulée.`,
                })
              }
            >
              Annuler l’occurrence
            </ActionButton>
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
