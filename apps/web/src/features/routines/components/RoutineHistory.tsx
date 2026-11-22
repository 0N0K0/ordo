import { PeriodNav } from '../../../components/page/PeriodNav';
import { PICKER_FORMATS } from '../../../lib/format';
import { BlockSkeleton } from '../../../components/feedback/Skeletons';
import { Group, Paper, Select, Stack, Text } from '@mantine/core';
import { DateField } from '../../../components/inputs/DateField';
import { useLocalStorage } from '@mantine/hooks';
import { addDays, mapById } from '@ordo/shared';
import { useState } from 'react';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { localToday } from '../../../lib/dates';
import { useRoutineChecks, useRoutineOccurrences, useRoutinesData, type Routine, type RoutineCheck, type RoutineOccurrence } from '../api';
import { RoutineDayAgenda, type AgendaLayers, type HistoryItem } from './RoutineDayAgenda';
import { useAgendaLayerOptions } from '../hooks/use-agenda-layers';
import * as fmt from '../../../lib/format';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { routineTreeOptions } from '../lib/routine-format';
import { countOf, collator } from '../../../lib/text';
import { archivedLabel } from '../../../lib/archive';

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
      startDate: occurrence.startDate,
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
  return items.sort((a, b) => timeOf(a).localeCompare(timeOf(b)) || collator.compare(byId.get(a.routineId)?.label ?? '', byId.get(b.routineId)?.label ?? ''));
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
  const byId = mapById(routines);
  const items = historyItems(
    // A cancelled occurrence is not planned (struck through in the calendar).
    (occurrences ?? []).filter((occurrence) => occurrence.date === day && !occurrence.cancelled && (!routineId || occurrence.routineId === routineId)),
    (checks ?? []).filter((check) => check.date === day && (!routineId || check.routineId === routineId)),
    byId,
  );
  const doneCount = items.filter((item) => item.check).length;
  const label = day === today ? 'aujourd’hui' : `le ${fmt.dayLong(day)}`;

  return (
    <Stack gap="lg">
      <Group justify="space-between" gap="sm">
        <PeriodNav
          current={day === today}
          last={day >= today}
          labels={{ previous: 'Jour précédent', next: 'Jour suivant' }}
          onToday={() => setDay(today)}
          onPrevious={() => setDay(addDays(day, -1))}
          onNext={() => setDay(addDays(day, 1))}
        >
          <DateField
            aria-label="Jour"
            value={day}
            onChange={(value) => value && setDay(value)}
            maxDate={today}
            valueFormat={PICKER_FORMATS.weekday}
            w={240}
            styles={{ input: { textAlign: 'center', textTransform: 'capitalize' } }}
          />
        </PeriodNav>
        <Select
          aria-label="Routine"
          placeholder="Toutes les routines"
          {...treeSelectProps(routineTreeOptions(routines, undefined, (routine) => archivedLabel(routine, true)))}
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
          label="Créneaux"
          placeholder={layers.scheduleIds.length ? undefined : 'Aucune'}
          data={layerOptions.schedules}
          value={layers.scheduleIds}
          onChange={(scheduleIds) => setLayers((current) => ({ ...current, scheduleIds }))}
          searchable
          clearable
          nothingFoundMessage="Aucun créneau (voir Agenda › Paramètres)"
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
        <BlockSkeleton height={20} />
      ) : (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {items.length === 0
              ? routineId
                ? `Rien de prévu pour « ${byId.get(routineId)?.label ?? 'cette routine'} » ${label}.`
                : `Aucune routine prévue ${label}.`
              : `${countOf(doneCount, 'faite')} sur ${countOf(items.length, 'prévue')}. Cliquez sur une routine pour la cocher (à l’heure prévue par défaut) ou la décocher.`}
          </Text>
          <Paper withBorder radius="md" p="xs">
            <RoutineDayAgenda day={day} today={today} items={items} byId={byId} layers={layers} />
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}
