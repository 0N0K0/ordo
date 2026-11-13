import { ActionIcon, Group, Paper, Select, Skeleton, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { CaretLeftIcon, CaretRightIcon, CheckCircleIcon, ClockCounterClockwiseIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { localDay, localToday } from '../../lib/dates';
import { notifyError, notifyWithUndo } from '../../lib/notify';
import { useRoutineChecks, useRoutineMutations, useRoutinesData, type Routine, type RoutineCheck } from './api';
import { windowText } from './routine-format';
import classes from './Routines.module.css';

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * First and last days of a month.
 * @param {string} month Month (YYYY-MM).
 * @returns {{ from: string, to: string }} Days (YYYY-MM-DD).
 */
function monthBounds(month: string): { from: string; to: string } {
  const [year, index] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/**
 * Month shifted by some months.
 * @param {string} month Month (YYYY-MM).
 * @param {number} delta Months to add (negative before).
 * @returns {string} Month (YYYY-MM).
 */
function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Ticks of each day, latest day first.
 * @param {RoutineCheck[]} checks Ticks.
 * @returns {[string, RoutineCheck[]][]} Days and their ticks.
 */
function byDay(checks: RoutineCheck[]): [string, RoutineCheck[]][] {
  const days = new Map<string, RoutineCheck[]>();
  for (const check of checks) days.set(check.date, [...(days.get(check.date) ?? []), check]);
  // Days latest first; the ticks of a day in the order they were made.
  return [...days].sort(([a], [b]) => b.localeCompare(a)).map(([day, items]) => [day, [...items].sort((a, b) => a.doneAt.localeCompare(b.doneAt))]);
}

/**
 * When a time of the day was ticked: its hour, with its day when ticked another day than the occurrence.
 * @param {RoutineCheck} check Tick.
 * @returns {string} Text.
 */
function doneAtText(check: RoutineCheck): string {
  const at = new Date(check.doneAt);
  const day = localDay(at);
  return day === check.date ? `cochée à ${timeFormat.format(at)}` : `cochée le ${shortDayFormat.format(at)} à ${timeFormat.format(at)}`;
}

/**
 * One tick: the routine, the time of the day ticked, when it was ticked; it can be unticked (with an undo).
 * @param {{ check: RoutineCheck, routine: Routine | undefined }} props Component props.
 * @returns {JSX.Element} Row.
 */
function CheckRow({ check, routine }: { check: RoutineCheck; routine: Routine | undefined }) {
  const { setDone } = useRoutineMutations();
  const title = routine?.title ?? 'Routine supprimée';
  const window = windowText(check);
  const onError = { onError: (error: Error) => notifyError(error.message) };
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs" className={classes.historyRow}>
      <Group gap="xs" wrap="nowrap" miw={0}>
        <CheckCircleIcon aria-hidden weight="fill" color="var(--mantine-color-green-6)" style={{ flexShrink: 0 }} />
        <Text size="sm" truncate c={routine ? undefined : 'dimmed'}>
          {title}
        </Text>
        {window && (
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {window}
          </Text>
        )}
      </Group>
      <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {doneAtText(check)}
        </Text>
        {routine && (
          <Tooltip label="Décocher">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={`Décocher « ${title} » du ${dayFormat.format(new Date(`${check.date}T00:00:00Z`))}`}
              onClick={() =>
                setDone.mutate(
                  { id: check.routineId, done: false, date: check.date, slot: check.slot },
                  {
                    ...onError,
                    onSuccess: () => notifyWithUndo('Routine décochée.', () => setDone.mutate({ id: check.routineId, done: true, date: check.date, slot: check.slot }, onError)),
                  },
                )
              }
            >
              <XIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Group>
  );
}

/**
 * History of the routines: what was ticked as done on which day, month by month, for every routine or for one.
 * @param {{ routineId: string | null, onRoutine: (id: string | null) => void }} props Component props.
 * @param {string | null} props.routineId Routine shown alone, or null for all.
 * @param {(id: string | null) => void} props.onRoutine Changes the routine shown.
 * @returns {JSX.Element} History.
 */
export function RoutineHistory({ routineId, onRoutine }: { routineId: string | null; onRoutine: (id: string | null) => void }) {
  const today = localToday();
  const current = today.slice(0, 7);
  const [month, setMonth] = useState(current);
  const { from, to } = monthBounds(month);
  const { data: routinesData } = useRoutinesData();
  const { data: checks, isPending } = useRoutineChecks(from, to);
  const routines = routinesData?.routines ?? [];
  const byId = new Map(routines.map((routine) => [routine.id, routine]));
  const shown = (checks ?? []).filter((check) => !routineId || check.routineId === routineId);
  const days = byDay(shown);
  const label = monthFormat.format(new Date(`${from}T00:00:00Z`));

  return (
    <Stack gap="lg">
      <Group justify="space-between" gap="sm">
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}>
            <CaretLeftIcon aria-hidden />
          </ActionIcon>
          <Text fw={600} w={160} ta="center" tt="capitalize" aria-live="polite">
            {label}
          </Text>
          <ActionIcon variant="subtle" color="gray" aria-label="Mois suivant" disabled={month >= current} onClick={() => setMonth(shiftMonth(month, 1))}>
            <CaretRightIcon aria-hidden />
          </ActionIcon>
        </Group>
        <Select
          aria-label="Routine"
          placeholder="Toutes les routines"
          data={[...routines].sort((a, b) => a.title.localeCompare(b.title, 'fr')).map((routine) => ({ value: routine.id, label: routine.archived ? `${routine.title} (archivée)` : routine.title }))}
          value={routineId}
          onChange={onRoutine}
          searchable
          clearable
          nothingFoundMessage="Aucune routine"
          w={280}
          maw="100%"
        />
      </Group>
      {isPending ? (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height={96} />
          ))}
        </Stack>
      ) : days.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon variant="light" size="xl" radius="xl">
              <ClockCounterClockwiseIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed" ta="center">
              {routineId ? `« ${byId.get(routineId)?.title ?? 'Cette routine'} » n’a pas été cochée en ${label}.` : `Aucune routine cochée en ${label}.`}
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {shown.length} coche{shown.length > 1 ? 's' : ''} sur {days.length} jour{days.length > 1 ? 's' : ''}
          </Text>
          {days.map(([day, items]) => (
            <Paper key={day} withBorder radius="md" p="sm">
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
                {day === today ? 'Aujourd’hui' : dayFormat.format(new Date(`${day}T00:00:00Z`))}
              </Text>
              <Stack gap={0}>
                {items.map((check) => (
                  <CheckRow key={`${check.routineId}/${check.slot}`} check={check} routine={byId.get(check.routineId)} />
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
