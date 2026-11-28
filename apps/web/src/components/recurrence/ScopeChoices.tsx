import { CheckIcon } from '@phosphor-icons/react';
import { OCCURRENCE_ACTIONS } from '../actions/occurrence-entries';
import type { EventScope as CalendarEventScope } from '@ordo/shared';
import { ChoiceList } from '../dialogs/ChoiceList';

export interface ScopeQuestion {
  /** What the answer does. */
  action: 'update' | 'delete' | 'cancel' | 'restore';
  /** Whether the occurrence alone can be changed (not when the repetition changed). */
  allowThis?: boolean;
  /** Whether it and the following ones can be changed. Optional. Default = true. */
  allowFollowing?: boolean;
  /** Whether every occurrence can be changed. Optional. Default = true. */
  allowAll?: boolean;
  /** Title instead of the one of a recurring event. Optional. */
  title?: string;
  /** What else the change takes (times deleted with the occurrences…), after the question. Optional. */
  note?: string;
}

/**
 * Choices of the occurrences a change of a repetition applies to (an event, a routine, a slot, a forecast…).
 * @param {ScopeQuestion & { onAnswer: (scope: CalendarEventScope | null) => void }} props Question and answer handler.
 * @returns {JSX.Element} Choices.
 */
export function ScopeChoices({ action, allowThis = true, allowFollowing = true, allowAll = true, note, onAnswer }: ScopeQuestion & { onAnswer: (scope: CalendarEventScope | null) => void }) {
  const remove = action === 'delete';
  // Each answer applies the change: filled, red for a deletion.
  const icon = remove ? OCCURRENCE_ACTIONS.delete.icon : action === 'cancel' ? OCCURRENCE_ACTIONS.cancel.icon : action === 'restore' ? OCCURRENCE_ACTIONS.restore.icon : <CheckIcon aria-hidden />;
  const question = remove
    ? 'Quelles occurrences supprimer ? La suppression est définitive.'
    : action === 'cancel'
      ? 'Quelles occurrences annuler ? Elles restent dans l’agenda, barrées, et pourront être rétablies.'
      : action === 'restore'
        ? 'Quelles occurrences rétablir ?'
        : 'À quelles occurrences appliquer la modification ?';
  return (
    <ChoiceList
      question={`${question}${allowThis ? '' : ' La répétition a changé : elle ne peut pas s’appliquer à une seule occurrence.'}${note ? ` ${note}` : ''}`}
      choices={[
        /* eslint-disable no-restricted-syntax -- the one scope question. */
        ...(allowThis ? [{ value: 'THIS' as const, label: 'Cette occurrence', icon, danger: remove }] : []),
        ...(allowFollowing ? [{ value: 'FOLLOWING' as const, label: 'Celle-ci et les suivantes', icon, danger: remove }] : []),
        ...(allowAll ? [{ value: 'ALL' as const, label: 'Toutes les occurrences', icon, danger: remove }] : []),
        /* eslint-enable no-restricted-syntax */
      ]}
      onAnswer={onAnswer}
    />
  );
}
