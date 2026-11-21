import { Stack } from '@mantine/core';
import { TimerIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { useCountdowns } from '../api';
import { openCountdownForm } from '../lib/open-countdown-form';
import { CountdownRow } from './CountdownRow';

/**
 * Timers of the user (every workspace), the soonest end first, each with its commands, and « Lancer un
 * minuteur » (the form of « Ajouter › Minuteur »): the page « Alarmes », the header, the home card.
 * @param {{ compact?: boolean, bare?: boolean }} props In a popover (`compact`: small button), or in a card (`bare`):
 *   no empty state text but the button (optional).
 * @returns {JSX.Element} List.
 */
export function CountdownList({ compact = false, bare = compact }: { compact?: boolean; bare?: boolean }) {
  const { data: countdowns, isPending } = useCountdowns();
  return (
    <Stack gap="sm">
      {isPending ? (
        <ListSkeleton items={2} lines={1} />
      ) : countdowns?.length ? (
        countdowns.map((countdown) => <CountdownRow key={countdown.id} countdown={countdown} />)
      ) : (
        !bare && <EmptyState compact icon={<TimerIcon aria-hidden />} message="Aucun minuteur en cours." />
      )}
      <ActionButton priority="secondary" size={compact ? 'xs' : undefined} icon={<TimerIcon aria-hidden />} onClick={() => openCountdownForm()} style={{ alignSelf: 'flex-start' }}>
        Lancer un minuteur
      </ActionButton>
    </Stack>
  );
}
