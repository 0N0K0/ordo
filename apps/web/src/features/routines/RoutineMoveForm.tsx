import { PICKER_FORMATS } from '../../lib/format';
import { ActionIcon, Button, Group, Select, Stack, Text, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { addDays, type RoutineMoveTimes } from '@ordo/shared';
import { ArrowRightIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { TimeField } from '../../components/TimeField';
import { notifyError, notifySuccess } from '../../lib/notify';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { DestructiveButton } from '../../components/dialogs/DestructiveActions';
import { localToday } from '../../lib/dates';
import { useRoutineMutations, useRoutineOccurrences, useRoutinesData, type RoutineOccurrence } from './api';
import { movableOccurrence, moveTo, movesOf, windowText } from './routine-format';
import { longDay, useRoutineMove } from './use-routine-move';
import * as fmt from '../../lib/format';

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
  const today = localToday();
  const [range] = useState(() => ({ from: addDays(today, -PAST_DAYS), to: addDays(today, NEXT_DAYS) }));
  const { data: allOccurrences } = useRoutineOccurrences(range);
  // Those not ticked (a ticked one is not changed), late ones only when past.
  const occurrences = (allOccurrences ?? []).filter((item) => item.routineId === routineId && !item.slots.some((slot) => slot.done));
  const movable = routine ? movableOccurrence(routine) : null;
  const [chosen, setChosen] = useState<string | null>(null);
  const date = chosen ?? movable;
  const occurrence = occurrences.find((item) => item.date === date);
  const [to, setTo] = useState<string | null>(null);
  const [edited, setEdited] = useState<Times | null>(null);
  const move = useRoutineMove();
  const { removeMove, moveOccurrence, deleteOccurrence } = useRoutineMutations();
  if (!routine) return <Text size="sm">Cette routine n’existe plus.</Text>;
  const moved = moveTo(routine, date);
  const moves = movesOf(routine);
  const target = to ?? (date ? addDays(date, 1) : null);
  const original = timesOf(occurrence);
  const times = edited ?? original;
  const timesChanged = times.some((item, index) => item.fromTime !== original[index]?.fromTime || item.dueTime !== original[index]?.dueTime);
  const options = [...new Set([...(movable ? [movable] : []), ...occurrences.map((item) => item.date)])].sort().map((day) => {
    const item = occurrences.find((other) => other.date === day);
    const hours = item?.slots
      .map((slot) => windowText(slot))
      .filter(Boolean)
      .join(', ');
    return { value: day, label: `${fmt.capitalize(longDay(day))}${day === today ? ' (aujourd’hui)' : day < today ? ' (en retard)' : ''}${hours ? ` · ${hours}` : ''}` };
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
  const submitLabel = !target || target === date ? 'Changer l’horaire' : target < date! ? 'Avancer' : 'Reporter';

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!date || !target || (target === date && !timesChanged)) return;
        move(routine, target, date, onDone, timesChanged ? { times: times as RoutineMoveTimes, previous: original as RoutineMoveTimes } : undefined);
      }}
    >
      <Stack gap="md">
        {date ? (
          <>
            <Select
              label="Occurrence"
              description={moved ? `Déjà déplacée depuis le ${longDay(moved.from)}.` : 'Ne change que celle-ci : c’est une exception, la règle ne change pas.'}
              data={options}
              value={date}
              onChange={choose}
              allowDeselect={false}
            />
            <DatePickerInput
              label="Nouvelle date"
              description="Plus tard pour la reporter, plus tôt pour l’avancer ; son jour pour n’en changer que l’horaire."
              required
              valueFormat={PICKER_FORMATS.weekday}
              minDate={routine.startDate}
              value={target}
              onChange={setTo}
              data-autofocus
            />
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Horaires
              </Text>
              {times.map((item, index) => (
                <Group key={index} gap={6} wrap="nowrap">
                  <TimeField
                    size="xs"
                    aria-label={`À partir de, moment ${index + 1}`}
                    leftSection={<Text size="xs">dès</Text>}
                    value={item.fromTime ?? ''}
                    onChange={(value) => changeTimes(index, { fromTime: value || null })}
                  />
                  <TimeField
                    size="xs"
                    aria-label={`Avant, moment ${index + 1}`}
                    leftSection={<Text size="xs">avant</Text>}
                    value={item.dueTime ?? ''}
                    onChange={(value) => changeTimes(index, { dueTime: value || null })}
                  />
                </Group>
              ))}
              {times.some((item) => item.fromTime && item.dueTime && item.fromTime >= item.dueTime) && (
                <Text size="xs" c="red">
                  L’heure maximale doit suivre l’heure de début.
                </Text>
              )}
            </Stack>
          </>
        ) : (
          <Text size="sm" c="dimmed">
            Plus d’occurrence à venir à changer.
          </Text>
        )}
        {moves.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Exceptions
            </Text>
            {moves.map((item) => (
              <Group key={item.from} gap="xs" wrap="nowrap">
                <Text size="sm">{shortText(item.from)}</Text>
                <ArrowRightIcon aria-hidden />
                <Text size="sm" style={{ flex: 1 }}>
                  {item.to === null
                    ? 'annulée'
                    : item.to === item.from
                      ? 'autres horaires'
                      : `${shortText(item.to)} (${item.to > item.from ? 'reportée' : 'avancée'}${item.times ? ', autres horaires' : ''})`}
                </Text>
                <Tooltip label="Remettre à son jour">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label={`Remettre l’occurrence du ${longDay(item.from)} à son jour`}
                    loading={removeMove.isPending && removeMove.variables?.from === item.from}
                    onClick={() => removeMove.mutate({ id: routine.id, from: item.from }, { onError: (error) => notifyError(error.message) })}
                  >
                    <XIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Fermer
          </Button>
          {date && (
            <DestructiveButton
              loading={deleteOccurrence.isPending}
              onClick={() =>
                confirmDestructive({
                  title: 'Annuler cette occurrence ?',
                  risks: `L’occurrence du ${longDay(date)} n’aura pas lieu : c’est une exception, les autres occurrences ne changent pas. Elle se rétablit depuis la liste des exceptions.`,
                  confirmLabel: 'Annuler l’occurrence',
                  onConfirm: () =>
                    deleteOccurrence.mutate(
                      { id: routine.id, date, scope: 'THIS' },
                      {
                        onSuccess: () => {
                          notifySuccess(`Occurrence du ${longDay(date)} annulée.`);
                          onDone();
                        },
                        onError: (error) => notifyError(error.message),
                      },
                    ),
                })
              }
            >
              Annuler l’occurrence
            </DestructiveButton>
          )}
          {date && (
            <Button type="submit" disabled={!target || (target === date && !timesChanged)} loading={moveOccurrence.isPending}>
              {submitLabel}
            </Button>
          )}
        </Group>
      </Stack>
    </form>
  );
}
