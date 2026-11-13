import { ActionIcon, Button, Group, Paper, Select, Skeleton, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useLocalStorage } from '@mantine/hooks';
import { addDays } from '@ordo/shared';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { localToday } from '../../lib/dates';
import { useRoutineChecks, useRoutineOccurrences, useRoutinesData, type Routine, type RoutineCheck, type RoutineOccurrence } from './api';
import { RoutineDayAgenda, type AgendaLayers, type HistoryItem } from './RoutineDayAgenda';
import { useAgendaLayerOptions } from './use-agenda-layers';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * What a day held: each time of the day planned for the routines that day (done or not, with its tick); nothing
 * else (not a late occurrence of another day); by time of the day, then by title.
 * @param {RoutineOccurrence[]} occurrences Occurrences of the day.
 * @param {RoutineCheck[]} checks Ticks of the day.
 * @param {Map<string, Routine>} byId Routines by id.
 * @returns {HistoryItem[]} Items.
 */
function historyItems(occurrences: RoutineOccurrence[], checks: RoutineCheck[], byId: Map<string, Routine>): HistoryItem[] {
  const tickOf = new Map(checks.map((check) => [`${check.routineId}/${check.slot}`, check]));
  const items: HistoryItem[] = occurrences.flatMap((occurrence) =>
    occurrence.slots.map((slot) => ({
      key: `${occurrence.routineId}/${slot.index}`,
      routineId: occurrence.routineId,
      date: occurrence.date,
      slot: slot.index,
      fromTime: slot.fromTime,
      dueTime: slot.dueTime,
      planned: true,
      optional: slot.optional,
      movedFrom: occurrence.movedFrom,
      check: tickOf.get(`${occurrence.routineId}/${slot.index}`),
    })),
  );
  const timeOf = (item: HistoryItem) => item.fromTime ?? item.dueTime ?? '99:99';
  return items.sort((a, b) => timeOf(a).localeCompare(timeOf(b)) || (byId.get(a.routineId)?.title ?? '').localeCompare(byId.get(b.routineId)?.title ?? '', 'fr'));
}

/**
 * History of the routines, day by day (back and forth, or a day picked), as an agenda: what was planned, whether it
 * was done and when, for every routine or for one; with the slots and events of the schedules and calendars chosen.
 * @param {{ routineId: string | null, onRoutine: (id: string | null) => void }} props Component props.
 * @param {string | null} props.routineId Routine shown alone, or null for all.
 * @param {(id: string | null) => void} props.onRoutine Changes the routine shown.
 * @returns {JSX.Element} History.
 */
export function RoutineHistory({ routineId, onRoutine }: { routineId: string | null; onRoutine: (id: string | null) => void }) {
  const today = localToday();
  const [day, setDay] = useState(today);
  const { data: routinesData } = useRoutinesData();
  const { data: checks, isPending } = useRoutineChecks(day, day);
  const { data: occurrences, isPending: occurrencesPending } = useRoutineOccurrences({ from: day, to: day });
  // Slots and events shown with the routines, remembered.
  const [layers, setLayers] = useLocalStorage<AgendaLayers>({ key: 'ordo.routines.history.layers', defaultValue: { scheduleIds: [], calendarIds: [] } });
  const layerOptions = useAgendaLayerOptions();
  const routines = routinesData?.routines ?? [];
  const byId = new Map(routines.map((routine) => [routine.id, routine]));
  const items = historyItems(
    (occurrences ?? []).filter((occurrence) => occurrence.date === day && (!routineId || occurrence.routineId === routineId)),
    (checks ?? []).filter((check) => check.date === day && (!routineId || check.routineId === routineId)),
    byId,
  );
  const doneCount = items.filter((item) => item.check).length;
  const label = day === today ? 'aujourd’hui' : `le ${dayFormat.format(new Date(`${day}T00:00:00Z`))}`;

  return (
    <Stack gap="lg">
      <Group justify="space-between" gap="sm">
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" aria-label="Jour précédent" onClick={() => setDay(addDays(day, -1))}>
            <CaretLeftIcon aria-hidden />
          </ActionIcon>
          <DatePickerInput
            aria-label="Jour"
            value={day}
            onChange={(value) => value && setDay(value)}
            maxDate={today}
            valueFormat="dddd D MMMM YYYY"
            w={240}
            styles={{ input: { textAlign: 'center', textTransform: 'capitalize' } }}
          />
          <ActionIcon variant="subtle" color="gray" aria-label="Jour suivant" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}>
            <CaretRightIcon aria-hidden />
          </ActionIcon>
          {day !== today && (
            <Button variant="subtle" size="compact-sm" onClick={() => setDay(today)}>
              Aujourd’hui
            </Button>
          )}
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
      <Group gap="sm" grow preventGrowOverflow={false}>
        <BatchMultiSelect
          label="Plages"
          placeholder={layers.scheduleIds.length ? undefined : 'Aucune'}
          data={layerOptions.schedules}
          value={layers.scheduleIds}
          onChange={(scheduleIds) => setLayers((current) => ({ ...current, scheduleIds }))}
          searchable
          clearable
          nothingFoundMessage="Aucune plage (voir Agenda › Paramètres)"
        />
        <BatchMultiSelect
          label="Calendriers"
          placeholder={layers.calendarIds.length ? undefined : 'Aucun'}
          data={layerOptions.calendars}
          value={layers.calendarIds}
          onChange={(calendarIds) => setLayers((current) => ({ ...current, calendarIds }))}
          searchable
          clearable
          nothingFoundMessage="Aucun calendrier"
        />
      </Group>
      {isPending || occurrencesPending ? (
        <Skeleton height={96} aria-label="Chargement" />
      ) : (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {items.length === 0
              ? routineId
                ? `Rien de prévu pour « ${byId.get(routineId)?.title ?? 'cette routine'} » ${label}.`
                : `Aucune routine prévue ${label}.`
              : `${doneCount} faite${doneCount > 1 ? 's' : ''} sur ${items.length} prévue${items.length > 1 ? 's' : ''}. Cliquez sur une routine pour la cocher (à l’heure prévue par défaut) ou la décocher.`}
          </Text>
          <Paper withBorder radius="md" p="xs">
            <RoutineDayAgenda day={day} today={today} items={items} byId={byId} layers={layers} />
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}
