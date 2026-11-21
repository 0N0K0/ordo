import { Group, Progress, Stack, Text } from '@mantine/core';
import { COUNTDOWN_EXTENSIONS, countdownRemaining, formatClock } from '@ordo/shared';
import { PauseIcon, PlayIcon, PlusIcon } from '@phosphor-icons/react';
import { IconAction } from '../../../components/actions/IconAction';
import { ActionButton } from '../../../components/actions/ActionButton';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { ON_ERROR } from '../../../lib/notify';
import { useNow } from '../../../lib/use-now';
import { useCountdownMutations, type Countdown } from '../api';
import { countdownName } from '../lib/countdowns';

/**
 * Commands of a timer, the same everywhere (decision FT): pause / resume, « +1 min », « +5 min », and « Supprimer le
 * minuteur » (confirmed: it will not ring).
 * @param {{ countdown: Countdown, size?: 'xs' | 'sm' }} props Timer and the size of the buttons (optional).
 * @returns {JSX.Element} Buttons.
 */
export function CountdownControls({ countdown, size = 'sm' }: { countdown: Countdown; size?: 'xs' | 'sm' }) {
  const { setPaused, extend, cancel } = useCountdownMutations();
  const paused = countdown.endsAt === null;
  const name = countdownName(countdown);

  /**
   * Asks before cancelling the timer.
   * @returns {void}
   */
  const confirmCancel = () =>
    confirmDestructive({
      title: 'Supprimer le minuteur',
      risks: <>« {name} » s’arrête sans sonner, sur tous vos appareils.</>,
      run: () => cancel.mutateAsync(countdown.id),
      done: 'Minuteur supprimé.',
    });

  return (
    <Group gap={4} wrap="nowrap">
      <IconAction label={paused ? 'Reprendre' : 'Pause'} item={name} size={size} loading={setPaused.isPending} onClick={() => setPaused.mutate({ id: countdown.id, paused: !paused }, ON_ERROR)}>
        {paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
      </IconAction>
      {COUNTDOWN_EXTENSIONS.map((minutes) => (
        <ActionButton
          key={minutes}
          priority="tertiary"
          size="xs"
          icon={<PlusIcon aria-hidden />}
          aria-label={`Ajouter ${minutes} min à « ${name} »`}
          onClick={() => extend.mutate({ id: countdown.id, minutes }, ON_ERROR)}
        >
          {minutes} min
        </ActionButton>
      ))}
      <RemoveButton label="Supprimer le minuteur" item={name} size={size} onClick={confirmCancel} />
    </Group>
  );
}

/**
 * A timer: its name (and its item), the time left live with its progress, its commands.
 * @param {{ countdown: Countdown, withSubject?: boolean }} props Timer, and whether its item is told (optional, default = true).
 * @returns {JSX.Element} Row.
 */
export function CountdownRow({ countdown, withSubject = true }: { countdown: Countdown; withSubject?: boolean }) {
  const paused = countdown.endsAt === null;
  const now = useNow(!paused);
  const left = countdownRemaining(countdown, now);
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Stack gap={0} miw={0}>
          <Text size="sm" truncate>
            {countdownName(countdown)}
          </Text>
          {withSubject && countdown.subject && (
            <Text size="xs" c="dimmed" truncate>
              {countdown.subject}
            </Text>
          )}
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" ff="monospace" fw={600} c={paused ? 'dimmed' : undefined} aria-live="off">
            {formatClock(left)}
          </Text>
          <CountdownControls countdown={countdown} />
        </Group>
      </Group>
      <Progress size="xs" value={countdown.durationSeconds ? 100 - (left / countdown.durationSeconds) * 100 : 100} color={paused ? 'gray' : 'orange'} aria-hidden />
    </Stack>
  );
}
