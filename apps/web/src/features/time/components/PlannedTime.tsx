import { Group, Progress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { addDays, daysBetween, entrySecondsWithin, formatDuration, plannedSlots, slotMinutes, weekRange } from '@ordo/shared';
import { useMemo } from 'react';
import { localMidnight, localToday } from '../../../lib/dates';
import { useWorkingHours } from '../../calendar/api';
import { schedulesTitle } from '../../calendar/lib/schedule-text';
import { useActiveWorkspace } from '../../workspaces/api';
import { useTimeEntriesSince } from '../api';
import { useNow } from '../../../lib/use-now';
import * as fmt from '../../../lib/format';
import { currentWeek } from '../../../lib/week';
import { SettingsSection } from '../../../components/settings/SettingsSection';

/**
 * Tracked time against planned time.
 * @param {{ label: string, tracked: number, planned: number }} props Label, tracked seconds and planned minutes.
 * @returns {JSX.Element} Gauge.
 */
function Gauge({ label, tracked, planned }: { label: string; tracked: number; planned: number }) {
  const ratio = planned ? (tracked / (planned * 60)) * 100 : 0;
  return (
    <Stack gap={4}>
      <Group justify="space-between" gap="xs">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        <Text size="sm" ff="monospace">
          {formatDuration(tracked)} / {planned ? formatDuration(planned * 60) : '—'}
        </Text>
      </Group>
      <Progress value={Math.min(100, ratio)} color={ratio > 100 ? 'orange' : 'blue'} aria-label={`${label} : temps chronométré sur le temps prévu`} />
    </Stack>
  );
}

/**
 * Planned time (working hours: the créneaux counted, `useWorkingHours`) against tracked time: today, this week, and
 * each day of the week. Nothing without working hours.
 * @returns {JSX.Element | null} Card.
 */
export function PlannedTime() {
  const { perso } = useActiveWorkspace();
  const today = localToday();
  // The week of the workspace (it may start another day than Monday, or last 8 days).
  const [monday, after] = weekRange(today, currentWeek());
  const sunday = addDays(after, -1);
  const length = daysBetween(monday, after);
  const { data: rules } = useWorkingHours();
  const entries = useTimeEntriesSince(localMidnight(monday));
  const running = (entries.data ?? []).some((entry) => entry.endedAt === null && entry.pausedAt === null);
  const now = useNow(running);

  const days = useMemo(() => {
    if (!rules) return [];
    // The créneaux counted only: an éphéméride is no planned work, nor an archived créneau.
    const slots = plannedSlots(rules, monday, sunday);
    const trackedByDay = new Map<string, number>();
    // Each day its part of the times (a timer running past midnight counts on both days).
    for (const entry of entries.data ?? []) {
      for (let index = 0; index < length; index += 1) {
        const day = addDays(monday, index);
        const seconds = entrySecondsWithin(entry, Date.parse(localMidnight(day)), Date.parse(localMidnight(addDays(day, 1))), now);
        if (seconds) trackedByDay.set(day, (trackedByDay.get(day) ?? 0) + seconds);
      }
    }
    return Array.from({ length }, (_, index) => {
      const date = addDays(monday, index);
      return { date, planned: slotMinutes(slots.filter((slot) => slot.date === date)), tracked: trackedByDay.get(date) ?? 0 };
    });
  }, [rules, entries.data, monday, sunday, now, length]);

  if (!rules?.length) return null;
  const todayRow = days.find((day) => day.date === today);
  const week = days.reduce((sum, day) => ({ planned: sum.planned + day.planned, tracked: sum.tracked + day.tracked }), { planned: 0, tracked: 0 });

  return (
    <SettingsSection title="Prévu et réalisé">
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Gauge label="Aujourd’hui" tracked={todayRow?.tracked ?? 0} planned={todayRow?.planned ?? 0} />
          <Gauge label="Cette semaine" tracked={week.tracked} planned={week.planned} />
        </SimpleGrid>
        <SimpleGrid cols={7} spacing={4}>
          {days.map((day) => {
            const ratio = day.planned ? Math.min(100, (day.tracked / (day.planned * 60)) * 100) : day.tracked ? 100 : 0;
            return (
              <Tooltip key={day.date} label={`${formatDuration(day.tracked)} chronométrées sur ${day.planned ? formatDuration(day.planned * 60) : 'aucune'} prévues`}>
                <Stack gap={2} align="center">
                  <Progress
                    value={ratio}
                    color={day.planned ? (day.tracked > day.planned * 60 ? 'orange' : 'blue') : 'gray'}
                    w="100%"
                    size="sm"
                    aria-label={`${fmt.weekday(day.date)} : temps chronométré sur le temps prévu`}
                  />
                  <Text size="xs" c={day.date === today ? undefined : 'dimmed'} fw={day.date === today ? 600 : undefined}>
                    {fmt.weekday(day.date)}
                  </Text>
                </Stack>
              </Tooltip>
            );
          })}
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          Temps prévu par vos {schedulesTitle(perso).toLowerCase()} (Agenda › {schedulesTitle(perso)}), hors pauses.
        </Text>
      </Stack>
    </SettingsSection>
  );
}
