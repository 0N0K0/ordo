import { LabeledField } from '../../../components/inputs/LabeledField';
import { Group, Text } from '@mantine/core';
import { formatDuration } from '@ordo/shared';
import { PlayIcon } from '@phosphor-icons/react';
import { runningOn, useRunningTimers, type TimeEntry, type TimerStartValues } from '../api';
import { useStartTimer } from '../hooks/use-start-timer';
import { TimerControls } from './TimerControls';
import { TimerRunningBadge } from './TimerStop';
import { ActionButton } from '../../../components/actions/ActionButton';

interface TrackedTimeProps {
  /** Time tracked on the item (its share of each time entry), in seconds. */
  seconds: number;
  /** Whether a running timer is on the item. */
  on: (entry: TimeEntry) => boolean;
  /** Timer started by « Démarrer le chrono ». */
  start: TimerStartValues;
  /** No timer can be started (archived). Optional. Default = false. */
  disabled?: boolean;
}

/**
 * « Temps passé » of a task, a routine or an event in its panel: the time tracked on it, and « Démarrer le chrono »
 * (or the badge and the commands of the timer running on it).
 * @param {TrackedTimeProps} props Component props.
 * @returns {JSX.Element} Tracked time.
 */
export function TrackedTime({ seconds, on, start, disabled = false }: TrackedTimeProps) {
  const running = useRunningTimers();
  const { startTimer, isPending } = useStartTimer();
  const mine = runningOn(running.data, on);
  return (
    <LabeledField label="Temps passé">
      <Group gap="sm" justify="space-between" wrap="nowrap">
        <Text size="sm" c={seconds ? undefined : 'dimmed'}>
          {seconds ? formatDuration(seconds) : 'Aucun'}
        </Text>
        {mine ? (
          <Group gap="xs" wrap="nowrap">
            <TimerRunningBadge />
            <TimerControls entry={mine} size="sm" look="header" />
          </Group>
        ) : (
          <ActionButton priority="secondary" size="compact-sm" icon={<PlayIcon aria-hidden />} loading={isPending} disabled={disabled} onClick={() => startTimer(start)}>
            Démarrer le chrono
          </ActionButton>
        )}
      </Group>
    </LabeledField>
  );
}
