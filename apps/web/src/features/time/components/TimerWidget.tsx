import { Group, Stack, Text } from '@mantine/core';
import { DURATION_MAX_SECONDS, entrySeconds, formatClock } from '@ordo/shared';
import { useEffect, useRef } from 'react';
import { notifyInfo } from '../../../lib/notify';
import { StopIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { RunningPill } from '../../../components/feedback/RunningPill';
import { useNow } from '../../../lib/use-now';
import { countOf } from '../../../lib/text';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useRunningTimers, type TimeEntry } from '../api';
import { useStopTimer } from '../hooks/use-stop-timer';
import { entrySubject } from '../lib/entry-subject';
import { RunningTimer } from './TimerCard';
import { TimerControls } from './TimerControls';

/**
 * Header pill of the one running timer: project and clock (opening the details), pause / resume, stop.
 * @param {{ entry: TimeEntry }} props Component props.
 * @returns {JSX.Element} Pill.
 */
function RunningControls({ entry }: { entry: TimeEntry }) {
  const { context } = useTaskContext();
  const paused = entry.pausedAt !== null;
  const now = useNow(!paused);
  return (
    <RunningPill
      label="Détails du chrono"
      paused={paused}
      subject={entrySubject(entry, context)}
      clock={formatClock(entrySeconds(entry, now))}
      details={context && <RunningTimer key={entry.id} entry={entry} context={context} popover />}
      controls={<TimerControls entry={entry} look="header" />}
    />
  );
}

/**
 * A running timer in the list of the header: what it is spent on, its clock, pause / resume and stop.
 * @param {{ entry: TimeEntry }} props Component props.
 * @returns {JSX.Element} Row.
 */
function RunningRow({ entry }: { entry: TimeEntry }) {
  const { context } = useTaskContext();
  const paused = entry.pausedAt !== null;
  const now = useNow(!paused);
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="sm" truncate>
        {entrySubject(entry, context)}
      </Text>
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" ff="monospace" fw={600} c={paused ? 'dimmed' : undefined}>
          {formatClock(entrySeconds(entry, now))}
        </Text>
        <TimerControls entry={entry} size="sm" look="header" />
      </Group>
    </Group>
  );
}

/**
 * Header pill of several running timers: their number and the clock of the longest one (opening the list of them,
 * each stoppable on its own, and « Arrêter tout »); grey when all are paused.
 * @param {{ entries: TimeEntry[] }} props Running timers.
 * @returns {JSX.Element} Pill.
 */
function SeveralRunning({ entries }: { entries: TimeEntry[] }) {
  const { stopAll, isPending } = useStopTimer();
  const paused = entries.every((entry) => entry.pausedAt !== null);
  const now = useNow(!paused);
  return (
    <RunningPill
      label="Chronos en cours"
      paused={paused}
      subject={countOf(entries.length, 'chrono')}
      clock={formatClock(Math.max(...entries.map((entry) => entrySeconds(entry, now))))}
      details={
        <Stack gap="sm">
          {entries.map((entry) => (
            <RunningRow key={entry.id} entry={entry} />
          ))}
          <Group justify="flex-end">
            <ActionButton priority="secondary" size="xs" icon={<StopIcon weight="fill" aria-hidden />} loading={isPending} onClick={() => stopAll(entries)}>
              Arrêter tout
            </ActionButton>
          </Group>
        </Stack>
      }
    />
  );
}

/**
 * Tells when a running timer is stopped by the API once it has run 24 hours (the longest time): « Chrono arrêté après
 * 24 heures », with what it was spent on.
 * @param {readonly TimeEntry[]} entries Timers running now.
 * @returns {void}
 */
function useTimerCapNotice(entries: readonly TimeEntry[]): void {
  const { context } = useTaskContext();
  const previous = useRef<readonly TimeEntry[]>([]);
  useEffect(() => {
    const now = Date.now();
    for (const entry of previous.current) {
      if (entries.some((item) => item.id === entry.id) || entrySeconds(entry, now) < DURATION_MAX_SECONDS) continue;
      notifyInfo({ id: `timer-cap-${entry.id}`, title: 'Chrono arrêté après 24 heures', lines: [entrySubject(entry, context), 'Sa durée est de 24 heures, le maximum d’un temps.'] });
    }
    previous.current = entries;
  }, [entries, context]);
}

/**
 * Running timers in the app header, on every page (a timer is started from the « Ajouter » menu): the one running, or
 * the number of those running (several at once).
 * @returns {JSX.Element | null} Pill, while a timer runs.
 */
export function TimerWidget() {
  const running = useRunningTimers();
  const entries = running.data ?? [];
  useTimerCapNotice(entries);
  if (!entries.length) return null;
  return entries.length === 1 ? <RunningControls entry={entries[0]} /> : <SeveralRunning entries={entries} />;
}
