import { ArrowCounterClockwiseIcon, CheckIcon, ProhibitIcon, TrashIcon } from '@phosphor-icons/react';
import type { CalendarEventScope } from '../api';
import { ChoiceList } from '../../../components/dialogs/ChoiceList';

export interface ScopeQuestion {
  /**
   * What the answer does; `cancelOrDelete`: this occurrence is cancelled (it stays, struck through), it and the
   * following ones are deleted (a routine).
   */
  action: 'update' | 'delete' | 'cancel' | 'restore' | 'cancelOrDelete';
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
 * Choices of the occurrences a change of a recurring event applies to.
 * @param {ScopeQuestion & { onAnswer: (scope: CalendarEventScope | null) => void }} props Question and answer handler.
 * @returns {JSX.Element} Choices.
 */
export function ScopeChoices({ action, allowThis = true, allowFollowing = true, allowAll = true, note, onAnswer }: ScopeQuestion & { onAnswer: (scope: CalendarEventScope | null) => void }) {
  if (action === 'cancelOrDelete') {
    return (
      <ChoiceList
        question={`Annuler cette occurrence (elle reste dans l’agenda, barrée, et pourra être rétablie), ou supprimer celle-ci et les suivantes (définitif) ?${note ? ` ${note}` : ''}`}
        choices={[
          ...(allowThis ? [{ value: 'THIS' as const, label: 'Annuler cette occurrence', icon: <ProhibitIcon aria-hidden /> }] : []),
          ...(allowFollowing ? [{ value: 'FOLLOWING' as const, label: 'Supprimer celle-ci et les suivantes', icon: <TrashIcon aria-hidden />, danger: true }] : []),
        ]}
        onAnswer={onAnswer}
      />
    );
  }
  const remove = action === 'delete';
  // Each answer applies the change: filled, red for a deletion.
  const icon = remove ? <TrashIcon aria-hidden /> : action === 'cancel' ? <ProhibitIcon aria-hidden /> : action === 'restore' ? <ArrowCounterClockwiseIcon aria-hidden /> : <CheckIcon aria-hidden />;
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
        ...(allowThis ? [{ value: 'THIS' as const, label: 'Cette occurrence', icon, danger: remove }] : []),
        ...(allowFollowing ? [{ value: 'FOLLOWING' as const, label: 'Celle-ci et les suivantes', icon, danger: remove }] : []),
        ...(allowAll ? [{ value: 'ALL' as const, label: 'Toutes les occurrences', icon, danger: remove }] : []),
      ]}
      onAnswer={onAnswer}
    />
  );
}
