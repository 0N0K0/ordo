import { Group } from '@mantine/core';
import { TimerIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { taggedKey } from '../../../lib/tagged-key';
import { useItemLaunchers, type ItemLaunchers } from '../hooks/use-saved-countdowns';
import type { CountdownItem } from '../lib/countdowns';

/**
 * Buttons « Lancer « Lave-linge (1 h 30) » » of an item where no menu is (an occurrence of a routine in its day agenda,
 * the page of a sheet): each dead time opens the form launching its timer, each saved timer starts at once. Nothing
 * without any.
 * @param {ItemLaunchers & { item: CountdownItem }} props Dead times and saved timers, and their item.
 * @returns {JSX.Element | null} Buttons.
 */
export function CountdownLaunchButtons({ item, ...launchers }: ItemLaunchers & { item: CountdownItem }) {
  const { deadTimes, saved } = useItemLaunchers()(launchers, item);
  const all = [...deadTimes.map((launcher) => ({ ...launcher, key: taggedKey('dead', launcher.label) })), ...saved.map((launcher) => ({ ...launcher, key: taggedKey('saved', launcher.label) }))];
  if (!all.length) return null;
  return (
    <Group gap="xs">
      {all.map(({ key, label, launch }) => (
        <ActionButton key={key} priority="tertiary" size="xs" icon={<TimerIcon aria-hidden />} onClick={launch}>
          Lancer « {label} »
        </ActionButton>
      ))}
    </Group>
  );
}
