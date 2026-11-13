import { Button, Group, Stack, Text } from '@mantine/core';
import type { CalendarEventScope } from './api';

export interface ScopeQuestion {
  action: 'update' | 'delete' | 'cancel' | 'restore';
  /** Whether the occurrence alone can be changed (not when the repetition changed). */
  allowThis?: boolean;
  /** Whether it and the following ones can be changed. Optional. Default = true. */
  allowFollowing?: boolean;
  /** Whether every occurrence can be changed. Optional. Default = true. */
  allowAll?: boolean;
  /** Title instead of the one of a recurring event. Optional. */
  title?: string;
}

/**
 * Choices of the occurrences a change of a recurring event applies to.
 * @param {ScopeQuestion & { onAnswer: (scope: CalendarEventScope | null) => void }} props Question and answer handler.
 * @returns {JSX.Element} Choices.
 */
export function ScopeChoices({ action, allowThis = true, allowFollowing = true, allowAll = true, onAnswer }: ScopeQuestion & { onAnswer: (scope: CalendarEventScope | null) => void }) {
  const remove = action === 'delete';
  const color = remove ? 'red' : undefined;
  return (
    <Stack gap="md">
      <Text size="sm">
        {remove
          ? 'Quelles occurrences supprimer ? La suppression est définitive.'
          : action === 'cancel'
            ? 'Quelles occurrences annuler ? Elles restent dans l’agenda, barrées, et pourront être rétablies.'
            : action === 'restore'
              ? 'Quelles occurrences rétablir ?'
              : 'À quelles occurrences appliquer la modification ?'}
        {!allowThis && ' La répétition a changé : elle ne peut pas s’appliquer à une seule occurrence.'}
      </Text>
      <Stack gap="xs">
        {allowThis && (
          <Button variant="light" color={color} onClick={() => onAnswer('THIS')}>
            Cette occurrence
          </Button>
        )}
        {allowFollowing && (
          <Button variant="light" color={color} onClick={() => onAnswer('FOLLOWING')}>
            Celle-ci et les suivantes
          </Button>
        )}
        {allowAll && (
          <Button variant="light" color={color} onClick={() => onAnswer('ALL')}>
            Toutes les occurrences
          </Button>
        )}
      </Stack>
      <Group justify="flex-end">
        <Button variant="default" onClick={() => onAnswer(null)}>
          Annuler
        </Button>
      </Group>
    </Stack>
  );
}
