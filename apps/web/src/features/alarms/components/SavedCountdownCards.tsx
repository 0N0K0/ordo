import { Badge, Group, Stack, Text } from '@mantine/core';
import { formatDuration } from '@ordo/shared';
import { GearSixIcon, PlayIcon, TimerIcon } from '@phosphor-icons/react';
import { PAGES, settingsPath } from '../../../app/pages';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { ListCard } from '../../../components/items/ListCard';
import { unarchived } from '../../../lib/archive';
import { useSavedCountdowns } from '../../countdowns/api';
import { useStartSavedCountdown } from '../../countdowns/hooks/use-saved-countdowns';

/**
 * Saved timers of the workspace (not archived), in the order of their list, one card each: its image or color, its
 * name, its duration and « Lancer » (started at once, `useStartSavedCountdown`). Skeleton while loading; empty:
 * « Aucun minuteur enregistré. » with « Minuteurs enregistrés » (their settings).
 * @returns {JSX.Element} Cards.
 */
export function SavedCountdownCards() {
  const { data, isPending } = useSavedCountdowns();
  const startSaved = useStartSavedCountdown();
  if (isPending) return <ListSkeleton items={2} lines={1} />;
  const saved = unarchived(data ?? []);
  if (!saved.length)
    return (
      <EmptyState
        icon={<TimerIcon aria-hidden />}
        message="Aucun minuteur enregistré."
        action={
          <ActionButton priority="secondary" size="xs" icon={<GearSixIcon aria-hidden />} to={settingsPath(PAGES.alarms.path)}>
            Minuteurs enregistrés
          </ActionButton>
        }
      />
    );
  return (
    <Stack gap="sm">
      {saved.map((countdown) => (
        <ListCard key={countdown.id}>
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Group gap="sm" wrap="nowrap" miw={0}>
              <ItemAvatar name={countdown.label} iconUrl={countdown.iconUrl} color={countdown.color} size="sm" />
              <Text fw={600} truncate>
                {countdown.label}
              </Text>
              <Badge size="sm" variant="light" color="gray">
                {formatDuration(countdown.minutes * 60)}
              </Badge>
            </Group>
            <ActionButton priority="secondary" size="xs" icon={<PlayIcon aria-hidden />} aria-label={`Lancer « ${countdown.label} »`} onClick={() => startSaved(countdown)}>
              Lancer
            </ActionButton>
          </Group>
        </ListCard>
      ))}
    </Stack>
  );
}
