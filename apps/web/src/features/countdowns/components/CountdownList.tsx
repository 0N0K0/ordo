import { Group, Stack } from '@mantine/core';
import { GearSixIcon, PlayIcon, TimerIcon } from '@phosphor-icons/react';
import { PAGES, settingsPath } from '../../../app/pages';
import { ActionButton } from '../../../components/actions/ActionButton';
import { unarchived } from '../../../lib/archive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { useCountdowns, useSavedCountdowns } from '../api';
import { useStartSavedCountdown } from '../hooks/use-saved-countdowns';
import { timerLabel } from '../lib/countdowns';
import { openCountdownForm } from '../lib/open-countdown-form';
import { CountdownRow } from './CountdownRow';

/**
 * Timers of the user (every workspace), the soonest end first, each with its commands, « Lancer un
 * minuteur » (the form of « Ajouter › Minuteur »), the saved timers of the workspace started in one click, and
 * « Minuteurs enregistrés » (their settings, on the page « Alarmes »): the page « Alarmes », the header, the home card.
 * @param {{ compact?: boolean, bare?: boolean }} props In a popover (`compact`: small button), or in a card (`bare`):
 *   no empty state text but the button (optional).
 * @returns {JSX.Element} List.
 */
export function CountdownList({ compact = false, bare = compact }: { compact?: boolean; bare?: boolean }) {
  const { data: countdowns, isPending } = useCountdowns();
  const { data: savedCountdowns = [] } = useSavedCountdowns();
  const startSaved = useStartSavedCountdown();
  const size = compact ? 'xs' : undefined;
  return (
    <Stack gap="sm">
      {isPending ? (
        <ListSkeleton items={2} lines={1} />
      ) : countdowns?.length ? (
        countdowns.map((countdown) => <CountdownRow key={countdown.id} countdown={countdown} />)
      ) : (
        !bare && <EmptyState compact icon={<TimerIcon aria-hidden />} message="Aucun minuteur en cours." />
      )}
      <Group gap="xs">
        <ActionButton priority="secondary" size={size} icon={<TimerIcon aria-hidden />} onClick={() => openCountdownForm()}>
          Lancer un minuteur
        </ActionButton>
        {unarchived(savedCountdowns).map((saved) => (
          <ActionButton key={saved.id} priority="tertiary" size="xs" icon={<PlayIcon aria-hidden />} hint="Lance ce minuteur enregistré." onClick={() => startSaved(saved)}>
            {timerLabel(saved)}
          </ActionButton>
        ))}
        <ActionButton priority="tertiary" size="xs" icon={<GearSixIcon aria-hidden />} to={settingsPath(PAGES.alarms.path)}>
          Minuteurs enregistrés
        </ActionButton>
      </Group>
    </Stack>
  );
}
