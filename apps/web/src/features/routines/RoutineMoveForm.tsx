import { PICKER_FORMATS } from '../../lib/format';
import { ActionIcon, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { addDays } from '@ordo/shared';
import { ArrowRightIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError } from '../../lib/notify';
import { useRoutineMutations, useRoutinesData } from './api';
import { movableOccurrence, moveTo, movesOf } from './routine-format';
import { longDay, useRoutineMove } from './use-routine-move';
import * as fmt from '../../lib/format';

/**
 * Short date of a calendar date: "jeu. 13 nov.".
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Text.
 */
const shortText = (date: string) => fmt.weekday(date);

/**
 * Moves an occurrence of a routine to another day (the next day by default): an exception to its rule. Lists the
 * exceptions of the routine, each one removable (the occurrence goes back to its own day).
 * @param {{ routineId: string, onDone: () => void }} props Component props.
 * @param {string} props.routineId Routine.
 * @param {() => void} props.onDone Closes the form.
 * @returns {JSX.Element} Form.
 */
export function RoutineMoveForm({ routineId, onDone }: { routineId: string; onDone: () => void }) {
  const { data } = useRoutinesData();
  const routine = data?.routines.find((item) => item.id === routineId);
  const date = routine ? movableOccurrence(routine) : null;
  const [to, setTo] = useState<string | null>(date ? addDays(date, 1) : null);
  const move = useRoutineMove();
  const { removeMove, moveOccurrence } = useRoutineMutations();
  if (!routine) return <Text size="sm">Cette routine n’existe plus.</Text>;
  const moved = moveTo(routine, date);
  const moves = movesOf(routine);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (routine && date && to && to !== date) move(routine, to, date, onDone);
      }}
    >
      <Stack gap="md">
        {date ? (
          <Text size="sm">
            Occurrence du <strong>{longDay(date)}</strong>
            {moved && ` (déjà déplacée depuis le ${longDay(moved.from)})`}. Elle n’a lieu que ce jour-là à la place : c’est une exception, la règle ne change pas.
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            Plus d’occurrence à venir à déplacer.
          </Text>
        )}
        {date && (
          <DatePickerInput
            label="Nouvelle date"
            description="Plus tard pour la reporter, plus tôt pour l’avancer."
            required
            valueFormat={PICKER_FORMATS.weekday}
            minDate={routine.startDate}
            excludeDate={(day) => day === date}
            value={to}
            onChange={setTo}
            data-autofocus
          />
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
                    ? 'supprimée'
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
            Annuler
          </Button>
          {date && (
            <Button type="submit" disabled={!to || to === date} loading={moveOccurrence.isPending}>
              {to && to < date ? 'Avancer' : 'Reporter'}
            </Button>
          )}
        </Group>
      </Stack>
    </form>
  );
}
