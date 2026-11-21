import { Group } from '@mantine/core';
import { readDeadTimes } from '@ordo/shared';
import { TimerIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../../components/actions/ActionButton';
import type { DeadTimeOutput } from '../api';
import { deadTimeLabel, type DeadTimeItem } from '../lib/countdowns';
import { openCountdownForm } from '../lib/open-countdown-form';

/**
 * Buttons « Lancer « Lave-linge (1 h 30) » » of the dead times of an item where no menu is (an occurrence of a routine
 * in its day agenda): each opens the form launching its timer. Nothing without dead times.
 * @param {{ value: readonly DeadTimeOutput[], item: DeadTimeItem }} props Dead times and their item.
 * @returns {JSX.Element | null} Buttons.
 */
export function DeadTimeLaunchButtons({ value, item }: { value: readonly DeadTimeOutput[]; item: DeadTimeItem }) {
  const deadTimes = readDeadTimes(value);
  if (!deadTimes.length) return null;
  return (
    <Group gap="xs">
      {deadTimes.map((deadTime) => (
        <ActionButton key={deadTimeLabel(deadTime)} priority="tertiary" size="xs" icon={<TimerIcon aria-hidden />} onClick={() => openCountdownForm({ item, deadTimes, deadTime })}>
          Lancer « {deadTimeLabel(deadTime)} »
        </ActionButton>
      ))}
    </Group>
  );
}
