import { Stack, Text } from '@mantine/core';
import { ArrowCounterClockwiseIcon, CheckIcon, ProhibitIcon, TrashIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../../components/actions/ActionButton';
import type { CalendarEventScope } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';

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
  // Each answer applies the change: filled, red for a deletion (decision CN).
  const icon = remove ? <TrashIcon aria-hidden /> : action === 'cancel' ? <ProhibitIcon aria-hidden /> : action === 'restore' ? <ArrowCounterClockwiseIcon aria-hidden /> : <CheckIcon aria-hidden />;
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
          <ActionButton danger={remove} icon={icon} onClick={() => onAnswer('THIS')}>
            Cette occurrence
          </ActionButton>
        )}
        {allowFollowing && (
          <ActionButton danger={remove} icon={icon} onClick={() => onAnswer('FOLLOWING')}>
            Celle-ci et les suivantes
          </ActionButton>
        )}
        {allowAll && (
          <ActionButton danger={remove} icon={icon} onClick={() => onAnswer('ALL')}>
            Toutes les occurrences
          </ActionButton>
        )}
      </Stack>
      <FormActions onCancel={() => onAnswer(null)} submitLabel={null} />
    </Stack>
  );
}
