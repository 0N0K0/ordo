import { Anchor, Button, Divider, Group, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { nextOccurrence } from '@ordo/shared';
import { AlarmIcon, TimerIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { AlarmForm } from '../alarms/AlarmForm';
import { useAlarms } from '../alarms/api';
import type { TaskContext } from '../tasks/use-task-context';
import { useRunningTimer } from '../time/api';
import { RunningTimer, TimerStartForm } from '../time/TimerCard';
import { HomeCard } from './HomeCard';

const nextFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
let modalCount = 0;

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

  /**
   * Opens the form of a new alarm.
   * @returns {void}
   */
  const openAlarmForm = () => {
    if (!context) return;
    const modalId = `home-alarm-${++modalCount}`;
    modals.open({ modalId, title: 'Nouvelle alarme', size: 'lg', children: <AlarmForm context={context} onDone={() => modals.close(modalId)} /> });
  };

  return (
    <HomeCard title="Chrono et alarmes" icon={<TimerIcon aria-hidden />} loading={!context || running.isPending}>
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
          <Button variant="light" leftSection={<AlarmIcon aria-hidden />} onClick={openAlarmForm}>
            Programmer une alarme
          </Button>
        </Stack>
      )}
    </HomeCard>
  );
}
