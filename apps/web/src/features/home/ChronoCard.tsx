import { Anchor, Button, Divider, Group, Stack, Text } from '@mantine/core';
import { nextOccurrence } from '@ordo/shared';
import { AlarmIcon, TimerIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useAlarms } from '../alarms/api';
import { useAlarmForm } from '../alarms/use-alarm-form';
import type { TaskContext } from '../tasks/use-task-context';
import { useRunningTimer } from '../time/api';
import { RunningTimer, TimerStartForm } from '../time/TimerCard';
import { HomeCard } from './HomeCard';

const nextFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Timer and alarms: the running timer (or the form starting one), and a button programming an alarm, with
 * the next one to ring.
 * @param {{ context: TaskContext | null }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function ChronoCard({ context }: { context: TaskContext | null }) {
  const running = useRunningTimer();
  const alarms = useAlarms();
  const next = useMemo(() => {
    const now = new Date();
    return (alarms.data ?? [])
      .filter((alarm) => alarm.enabled && alarm.type !== 'TRACKING_DURATION')
      .map((alarm) => ({ alarm, at: nextOccurrence(alarm, now) }))
      .filter((item): item is { alarm: (typeof item)['alarm']; at: Date } => item.at !== null)
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  }, [alarms.data]);

  const openAlarmForm = useAlarmForm(context);

  return (
    <HomeCard title="Chrono et alarmes" icon={<TimerIcon aria-hidden />} to="/time" linkLabel="Tous les chronos" loading={!context || running.isPending}>
      {context && !running.isPending && (
        <Stack gap="sm">
          {running.data ? <RunningTimer key={running.data.id} entry={running.data} context={context} /> : <TimerStartForm context={context} />}
          <Divider />
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Stack gap={0} miw={0}>
              <Text size="xs" c="dimmed">
                Prochaine alarme
              </Text>
              <Text size="sm" truncate>
                {next ? `${next.alarm.title} · ${nextFormat.format(next.at)}` : 'Aucune'}
              </Text>
            </Stack>
            <Anchor component={Link} to="/alarms" size="sm" style={{ flexShrink: 0 }}>
              Gérer
            </Anchor>
          </Group>
          <Button variant="default" leftSection={<AlarmIcon aria-hidden />} onClick={() => openAlarmForm()}>
            Programmer une alarme
          </Button>
        </Stack>
      )}
    </HomeCard>
  );
}
