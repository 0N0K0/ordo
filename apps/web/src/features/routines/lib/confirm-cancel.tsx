import { CalendarXIcon } from '@phosphor-icons/react';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import * as fmt from '../../../lib/format';

/**
 * Asks for the confirmation of « Annuler » on an occurrence of a routine, the same dialog everywhere (its panel
 * « Reporter ou annuler », the calendar): it stays shown, struck through, with its comments, and is restored from the
 * exceptions or the calendar.
 * @param {string} due Its due day.
 * @param {() => Promise<unknown>} run The cancel, once confirmed (its failure in an error toast).
 * @param {string} [done] Success message. Optional. Default = no toast (the caller tells it, with « Annuler »).
 * @returns {void}
 */
export function confirmCancelOccurrence(due: string, run: () => Promise<unknown>, done?: string): void {
  confirmDestructive({
    title: 'Annuler cette occurrence ?',
    risks: `L’occurrence du ${fmt.dayLong(due)} n’aura pas lieu : elle reste affichée, barrée, avec ses commentaires ; c’est une exception, les autres occurrences ne changent pas. Elle se rétablit depuis la liste des exceptions ou l’agenda.`,
    confirmLabel: 'Annuler l’occurrence',
    confirmIcon: <CalendarXIcon aria-hidden />,
    reversible: true,
    run,
    done,
  });
}
