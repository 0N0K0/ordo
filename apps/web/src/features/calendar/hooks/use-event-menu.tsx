import { postponedRestoreRefusal, type CalendarEventInput } from '@ordo/shared';
import { followingOffered } from '../lib/calendar-events';
import { notifyError } from '../../../lib/notify';
import { ArrowArcRightIcon } from '@phosphor-icons/react';
import { occurrenceEntry } from '../../../components/actions/occurrence-entries';
import type { RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { duplicateRowsAction, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { openFormPanel } from '../../../components/panels/panels';
import { archivedIds, archiveEntry, useSetArchived } from '../../../lib/archive';
import { formCallbacks } from '../../../lib/form';
import { copyName } from '../../../lib/text';
import { useSetSavedCountdownLinks } from '../../countdowns/api';
import { useCountdownMenuEntries } from '../../countdowns/hooks/use-saved-countdowns';
import { fetchLostOnDelete } from '../../time/api';
import { LostOnDeleteRisk } from '../../time/components/LostOnDeleteRisk';
import { scopeLostNote } from '../../time/lib/lost-on-delete';
import { calendarQueryKey, useCalendarEventMutations, useCalendars, type CalendarEventScope, type EventOccurrence } from '../api';
import { PostponePanel } from '../components/EventPostpone';
import { askScope } from '../../../components/recurrence/ask-scope';
import { eventCountdownItem } from '../lib/event-countdowns';
import { occurrenceInput, seriesInput } from '../lib/event-input';

/** Event and occurrence the actions of a menu go to. */
export interface EventMenuTarget {
  eventId: string;
  /** Occurrence in its series (null: a single event). */
  occurrenceDate: string | null;
  /** Occurrences « Annuler » / « Rétablir » apply to. */
  scope: CalendarEventScope;
}

/** Options of the menu of an occurrence. */
export interface EventMenuOptions {
  /**
   * Fields of the event as shown (those of its panel, with their changes): copied by « Dupliquer », postponed by
   * « Reporter », named in « Lancer ». Optional. Default = those of the occurrence (its own for `THIS`, else its series').
   */
  fields?: CalendarEventInput;
  /** Event and occurrence acted on (its panel's, once a save split or moved its series). Optional. Default = the occurrence, `THIS` for one of a series. */
  target?: EventMenuTarget;
  /** Read only (archived, no scope chosen): only « Archiver » / « Restaurer » and « Supprimer ». Optional. Default = archived, or in an archived calendar. */
  readOnly?: boolean;
  /** Saved timers of the event (its panel's, as saved from it). Optional. Default = the occurrence's. */
  savedCountdownIds?: string[];
  /** Opens the copy once saved: its id and fields. Optional: no « Dupliquer ». */
  onDuplicated?: (id: string, fields: CalendarEventInput) => void;
  /** Once cancelled, restored, postponed, archived or deleted (closes its panel). Optional. */
  onDone?: () => void;
}

/**
 * « … » menu of an occurrence of an event, the same in its panel and in a list: « Dupliquer », « Annuler »
 * / « Rétablir », « Reporter », « Archiver » / « Restaurer » (the whole series), « Supprimer » (asking which occurrences
 * for a recurring one, telling the times and comments deleted with it), then « Lancer » its saved timers for this
 * occurrence; read only: archived or restored, and deleted, only. No occurrence: no entry.
 * @param {EventOccurrence | undefined} occurrence Occurrence.
 * @param {EventMenuOptions} [options] Fields, target and callbacks. Optional.
 * @returns {RowMenuEntry[]} Entries.
 */
export function useEventMenu(occurrence: EventOccurrence | undefined, options: EventMenuOptions = {}): RowMenuEntry[] {
  const { create, remove, setCalledOff } = useCalendarEventMutations();
  const countdownEntries = useCountdownMenuEntries();
  const copyCountdowns = useSetSavedCountdownLinks([calendarQueryKey]);
  const setArchived = useSetArchived('CALENDAR_EVENT', [calendarQueryKey]);
  const { data: calendarsData } = useCalendars();
  if (!occurrence) return [];
  const calendarArchived = archivedIds(calendarsData?.calendars ?? []).has(occurrence.calendarId);
  const recurringOccurrence = occurrence.occurrenceDate !== null;
  const target = options.target ?? { eventId: occurrence.eventId, occurrenceDate: occurrence.occurrenceDate, scope: recurringOccurrence ? 'THIS' : 'ALL' };
  const fields = options.fields ?? (target.scope === 'THIS' ? occurrenceInput(occurrence) : seriesInput(occurrence));
  const readOnly = options.readOnly ?? (occurrence.archived || calendarArchived);
  const savedCountdownIds = options.savedCountdownIds ?? occurrence.savedCountdownIds ?? [];
  // Nothing to do once done, by default.
  const onDone = options.onDone ?? (() => undefined);
  const { onDuplicated } = options;
  const recurring = target.occurrenceDate !== null;

  /**
   * Opens the postponement of this occurrence; once postponed, `onDone` runs too.
   * @returns {void}
   */
  const openPostpone = () =>
    openFormPanel('Reporter l’évènement', (close) => (
      <PostponePanel fields={fields} occurrence={{ ...occurrence, eventId: target.eventId, occurrenceDate: target.occurrenceDate }} onCancel={close} onDone={() => (close(), onDone())} />
    ));

  /**
   * Deletes the event (asking which occurrences for a recurring one), telling the times without project and the
   * comments deleted with it.
   * @returns {Promise<void>}
   */
  const handleDelete = async () => {
    /**
     * Runs the deletion.
     * @param {CalendarEventScope} scope Scope.
     * @returns {void}
     */
    const run = (scope: CalendarEventScope) => remove.mutate({ id: target.eventId, scope, occurrenceDate: target.occurrenceDate }, formCallbacks(null, 'Évènement supprimé.', onDone));
    const lost = { eventId: target.eventId, occurrenceDate: target.occurrenceDate };
    if (recurring) {
      const [THIS, FOLLOWING, ALL] = await Promise.all((['THIS', 'FOLLOWING', 'ALL'] as const).map((scope) => fetchLostOnDelete({ ...lost, scope })));
      const scope = await askScope({ action: 'delete', allowFollowing: followingOffered(occurrence), note: scopeLostNote({ THIS, FOLLOWING, ALL }) });
      if (scope) run(scope);
      return;
    }
    confirmDestructive({
      title: 'Supprimer l’évènement',
      risks: (
        <>
          L’évènement « {occurrence.label} » sera supprimé définitivement.
          <LostOnDeleteRisk query={{ ...lost, scope: 'ALL' }} />
        </>
      ),
      onConfirm: () => run('ALL'),
    });
  };

  /**
   * Cancels the event (kept struck through) or restores it, for the occurrences of the target.
   * @param {boolean} calledOff Cancel (true) or restore (false).
   * @returns {void}
   */
  const handleCalledOff = (calledOff: boolean) =>
    setCalledOff.mutate(
      { id: target.eventId, scope: target.scope, occurrenceDate: target.occurrenceDate, calledOff },
      formCallbacks(null, calledOff ? 'Évènement annulé.' : 'Évènement rétabli.', onDone),
    );

  return [
    !readOnly &&
      onDuplicated &&
      rowMenuEntry(
        duplicateRowsAction([{ ...fields, label: copyName(fields.label), recurrence: recurring ? null : (fields.recurrence ?? null) }], {
          duplicate: async (copy: CalendarEventInput) => {
            const id = await create.mutateAsync(copy);
            // The copy launches the same saved timers.
            if (savedCountdownIds.length) await copyCountdowns.mutateAsync({ target: 'EVENT', id, savedCountdownIds });
            return { id, fields: copy };
          },
          done: 'Évènement dupliqué.',
          open: ({ id, fields: copy }) => onDuplicated(id, copy),
        }),
      ),
    ...(readOnly
      ? []
      : occurrence.calledOff
        ? [
            // A postponed occurrence (alone, or a one-off event) is not given back: its postponement would take place too.
            occurrenceEntry('restore', () => ((target.scope === 'THIS' || !recurring) && occurrence.postponedTo[0] ? notifyError(postponedRestoreRefusal(occurrence.postponedTo[0].startDate)) : handleCalledOff(false)), setCalledOff.isPending),
          ]
        : [
            occurrenceEntry('cancel', () => handleCalledOff(true), setCalledOff.isPending),
            { label: 'Reporter', icon: <ArrowArcRightIcon aria-hidden />, onClick: openPostpone },
          ]),
    !calendarArchived && archiveEntry({ archived: occurrence.archived, type: 'Évènement', label: occurrence.label }, setArchived, target.eventId, onDone),
    occurrenceEntry('delete', () => void handleDelete(), remove.isPending),
    // « Lancer » its saved timers, for this occurrence.
    ...(readOnly ? [] : countdownEntries({ savedCountdownIds }, eventCountdownItem({ eventId: target.eventId, label: fields.label || occurrence.label }, target.occurrenceDate))),
  ];
}
