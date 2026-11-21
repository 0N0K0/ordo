import { Anchor, Divider, Group, Stack, Text } from '@mantine/core';
import { nextRings } from '../../alarms/lib/alarm-labels';
import { AlarmIcon, PlayIcon, TimerIcon } from '@phosphor-icons/react';
import { Fragment, useMemo } from 'react';
import { Link } from 'react-router';
import { useAlarms } from '../../alarms/api';
import { useAlarmForm } from '../../alarms/hooks/use-alarm-form';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useRunningTimers } from '../../time/api';
import { openTimerForm } from '../../time/lib/open-timer-form';
import { RunningTimer, TimerStartForm } from '../../time/components/TimerCard';
import { HomeCard } from './HomeCard';
import { CountdownList } from '../../countdowns/components/CountdownList';
import * as fmt from '../../../lib/format';
import { ActionButton } from '../../../components/actions/ActionButton';
import { PAGES } from '../../../app/pages';

/**
 * Timer and alarms: the running chronos (several at once) and a button starting another one, or the form
 * starting one; the running timers (« minuteurs ») with their commands and « Lancer un minuteur »; a
 * button programming an alarm, with the next one to ring.
 * @param {{ context: TaskContext | null }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function ChronoCard({ context }: { context: TaskContext | null }) {
  const running = useRunningTimers();
  const entries = running.data ?? [];
  const alarms = useAlarms();
  const next = useMemo(() => {
    const now = new Date();
    return nextRings(alarms.data ?? [], now)[0];
  }, [alarms.data]);

  const openAlarmForm = useAlarmForm(context);

  return (
    <HomeCard title="Chrono et alarmes" icon={<TimerIcon aria-hidden />} to={PAGES.time.path} linkLabel="Tous les chronos" loading={!context || running.isPending}>
      {context && !running.isPending && (
        <Stack gap="sm">
          {entries.map((entry, index) => (
            <Fragment key={entry.id}>
              {index > 0 && <Divider />}
              <RunningTimer entry={entry} context={context} />
            </Fragment>
          ))}
          {entries.length ? (
            <ActionButton priority="secondary" icon={<PlayIcon aria-hidden />} onClick={() => openTimerForm(context)}>
              Démarrer un autre chrono
            </ActionButton>
          ) : (
            <TimerStartForm context={context} />
          )}
          <Divider />
          <CountdownList bare />
          <Divider />
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Stack gap={0} miw={0}>
              <Text size="xs" c="dimmed">
                Prochaine alarme
              </Text>
              <Text size="sm" truncate>
                {next ? `${next.alarm.label} · ${fmt.dateTimeShort(next.at)}` : 'Aucune'}
              </Text>
            </Stack>
            <Anchor component={Link} to={PAGES.alarms.path} size="sm" style={{ flexShrink: 0 }}>
              Gérer
            </Anchor>
          </Group>
          <ActionButton priority="secondary" icon={<AlarmIcon aria-hidden />} onClick={() => openAlarmForm()}>
            Programmer une alarme
          </ActionButton>
        </Stack>
      )}
    </HomeCard>
  );
}
