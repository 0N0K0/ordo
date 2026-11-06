import { Group, Paper, Progress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { addDays, entrySeconds, formatDuration, mondayOf, plannedSlots, slotMinutes } from '@ordo/shared';
import { useMemo } from 'react';
import { localToday } from '../../lib/dates';
import { scheduleRules, useWorkSchedules } from '../calendar/api';
import { localParts } from '../calendar/event-input';
import { useTimeEntriesSince } from './api';
import { useNow } from './use-now';

const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

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
 * Planned time (working hours) against tracked time: today, this week, and each day of the week. Nothing
 * without working hours.
 * @returns {JSX.Element | null} Card.
 */
export function PlannedTime() {
  const today = localToday();
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const { data: schedules } = useWorkSchedules();
  const entries = useTimeEntriesSince(new Date(`${monday}T00:00:00`).toISOString());
  const running = (entries.data ?? []).some((entry) => entry.endedAt === null && entry.pausedAt === null);
  const now = useNow(running);

  const days = useMemo(() => {
    if (!schedules) return [];
    const slots = plannedSlots(scheduleRules(schedules), monday, sunday);
    const trackedByDay = new Map<string, number>();
    for (const entry of entries.data ?? []) {
      const day = localParts(new Date(entry.startedAt)).date;
      trackedByDay.set(day, (trackedByDay.get(day) ?? 0) + entrySeconds(entry, now));
    }
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(monday, index);
      return { date, planned: slotMinutes(slots.filter((slot) => slot.date === date)), tracked: trackedByDay.get(date) ?? 0 };
    });
  }, [schedules, entries.data, monday, sunday, now]);

  if (!schedules?.length) return null;
  const todayRow = days.find((day) => day.date === today);
  const week = days.reduce((sum, day) => ({ planned: sum.planned + day.planned, tracked: sum.tracked + day.tracked }), { planned: 0, tracked: 0 });

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Text fw={600}>Prévu et réalisé</Text>
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
                    aria-label={`${dayLabel.format(new Date(`${day.date}T00:00:00Z`))} : temps chronométré sur le temps prévu`}
                  />
                  <Text size="xs" c={day.date === today ? undefined : 'dimmed'} fw={day.date === today ? 600 : undefined}>
                    {dayLabel.format(new Date(`${day.date}T00:00:00Z`))}
                  </Text>
                </Stack>
              </Tooltip>
            );
          })}
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          Temps prévu par vos plages de travail (Agenda › Plages de travail), hors pauses.
        </Text>
      </Stack>
    </Paper>
  );
}
