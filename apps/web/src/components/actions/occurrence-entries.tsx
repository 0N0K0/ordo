import { ArrowCounterClockwiseIcon, CalendarXIcon, TrashIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import type { RowMenuEntry } from './ActionsMenu';

/** What an action of an occurrence of a repetition does, the same words everywhere (events, routines, slots…). */
export type OccurrenceAction = 'cancel' | 'restore' | 'delete';

/**
 * Words and icons of the actions of an occurrence: « Annuler » (it stays shown, struck through, with its comments),
 * « Rétablir » (back as its repetition gives it), « Supprimer » (nothing that day, or it and the following ones).
 */
export const OCCURRENCE_ACTIONS: Record<OccurrenceAction, { label: string; icon: ReactNode; danger?: boolean }> = {
  cancel: { label: 'Annuler', icon: <CalendarXIcon aria-hidden /> },
  restore: { label: 'Rétablir', icon: <ArrowCounterClockwiseIcon aria-hidden /> },
  delete: { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true },
};

/**
 * Entry of an action of an occurrence in a « … » menu, its words and icon the same everywhere.
 * @param {OccurrenceAction} action Action.
 * @param {() => void} onClick Runs it.
 * @param {boolean} [disabled] Disabled (running). Optional. Default = false.
 * @returns {RowMenuEntry} Entry.
 */
export function occurrenceEntry(action: OccurrenceAction, onClick: () => void, disabled = false): RowMenuEntry {
  const { label, icon, danger } = OCCURRENCE_ACTIONS[action];
  return { label, icon, danger, disabled, onClick };
}
