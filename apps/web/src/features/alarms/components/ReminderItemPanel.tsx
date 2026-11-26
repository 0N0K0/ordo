import { Group, Stack, Text } from '@mantine/core';
import { taskPath, type Reminder, type ReminderFields } from '@ordo/shared';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { EventRemindersField, RoutineRemindersField, TaskRemindersField } from '../../../components/inputs/ItemReminders';
import { onMutationError } from '../../../lib/notify';
import { routineHasHoursOf } from '../../../lib/routine-hours';
import { useCalendarEventMutations } from '../../calendar/api';
import { useEventForm } from '../../calendar/hooks/use-event-form';
import { seriesInput } from '../../calendar/lib/event-input';
import { useRoutineMutations } from '../../routines/api';
import { openRoutineForm } from '../../routines/lib/open-routine-form';
import { useUpdateTask } from '../../tasks/api';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useUpcomingSources, type UpcomingItemReminder } from '../hooks/use-upcoming-reminders';
import { upcomingDueText } from '../lib/upcoming-reminders';
import { UpcomingKindIcon } from './UpcomingKindIcon';

/**
 * The reminder to come with its item as the cache has it now (changed elsewhere since the card was clicked: in its own
 * panel, in another tab), and whether it is missing there (deleted, an occurrence moved to other days, or not loaded):
 * then nothing is saved from the item as it was.
 * @param {UpcomingItemReminder} reminder Reminder to come, as clicked.
 * @returns {{ reminder: UpcomingItemReminder, missing: boolean }} Reminder with its current item, and whether it is missing.
 */
function useCurrentItem(reminder: UpcomingItemReminder): { reminder: UpcomingItemReminder; missing: boolean } {
  const { occurrences, tasksData, routinesData } = useUpcomingSources();
  if (reminder.kind === 'task') {
    const item = tasksData?.tasks.find((task) => task.id === reminder.item.id);
    return { reminder: { ...reminder, item: item ?? reminder.item }, missing: !item };
  }
  if (reminder.kind === 'routine') {
    const item = routinesData?.routines.find((routine) => routine.id === reminder.item.id);
    return { reminder: { ...reminder, item: item ?? reminder.item }, missing: !item };
  }
  const item = occurrences?.find((occurrence) => occurrence.key === reminder.item.key);
  return { reminder: { ...reminder, item: item ?? reminder.item }, missing: !item };
}

/**
 * Saves the reminders of the item of a reminder to come with the mutation of its kind (a task, a routine: these fields
 * only; an event: its whole series, its other fields sent as they are, as its panel « Toutes les occurrences » does).
 * @returns {{ save: (reminder: UpcomingItemReminder, reminders: Reminder[], onError: (error: Error) => void) => void, saving: boolean }} Saver, and whether a save runs.
 */
function useItemRemindersSave() {
  const updateTask = useUpdateTask();
  const { patch } = useRoutineMutations();
  const { update } = useCalendarEventMutations();
  /**
   * Saves the reminders of an item.
   * @param {UpcomingItemReminder} reminder Reminder to come, with its current item.
   * @param {Reminder[]} reminders Reminders.
   * @param {(error: Error) => void} onError Failure.
   * @returns {void}
   */
  const save = (reminder: UpcomingItemReminder, reminders: Reminder[], onError: (error: Error) => void) => {
    if (reminder.kind === 'task') updateTask.mutate({ id: reminder.item.id, input: { reminders } }, { onError });
    else if (reminder.kind === 'routine') patch.mutate({ id: reminder.item.id, input: { reminders } }, { onError });
    else update.mutate({ id: reminder.item.eventId, input: { ...seriesInput(reminder.item), reminders }, scope: 'ALL', occurrenceDate: reminder.item.occurrenceDate }, { onError });
  };
  return { save, saving: updateTask.isPending || patch.isPending || update.isPending };
}

/**
 * « Ouvrir » of the item of a reminder to come: the page of a task (its panel open), the panel of a routine, the panel
 * of the occurrence of an event; the panel of the reminders closes first (the whole panel takes over).
 * @param {{ reminder: UpcomingItemReminder, close: () => void, disabled: boolean }} props Reminder to come (its current item), closing of the panel, disabled (its item missing).
 * @returns {JSX.Element} Button.
 */
function OpenItemButton({ reminder, close, disabled }: { reminder: UpcomingItemReminder; close: () => void; disabled: boolean }) {
  const { context } = useTaskContext();
  const openEvent = useEventForm(context);
  const icon = <ArrowSquareOutIcon aria-hidden />;
  const hint = disabled ? 'Élément introuvable.' : `Ouvre « ${reminder.title} ».`;
  // Disabled: no link (a disabled link stays reachable by the keyboard).
  if (reminder.kind === 'task' && !disabled)
    return (
      <ActionButton priority="secondary" icon={icon} hint={hint} to={taskPath(reminder.item)} onClick={close} disabled={disabled}>
        Ouvrir
      </ActionButton>
    );
  /**
   * Closes this panel, then opens the panel of the routine or of the event.
   * @returns {void}
   */
  const open = () => {
    close();
    if (reminder.kind === 'task') return;
    if (reminder.kind === 'routine') openRoutineForm({ routine: reminder.item, occurrenceDate: reminder.occurrenceDate });
    else openEvent({ occurrence: reminder.item });
  };
  return (
    <ActionButton priority="secondary" icon={icon} hint={hint} disabled={disabled || (reminder.kind === 'event' && !context)} onClick={open}>
      Ouvrir
    </ActionButton>
  );
}

/**
 * Side panel of a reminder to come (« Rappels à venir » of the page « Alarmes »): the item (its kind, title and due
 * day) and its « Rappels » only, as the cache has them, each change saved at once (« Enregistrement… » then
 * « Enregistré »; a failure shows them as saved, in an error toast), and « Ouvrir » for its whole panel or page; its
 * item missing from the cache, both are disabled, told by a warning.
 * @param {{ reminder: UpcomingItemReminder, close: () => void }} props Reminder to come (as clicked), closing of the panel.
 * @returns {JSX.Element} Panel content.
 */
export function ReminderItemPanel({ reminder: clicked, close }: { reminder: UpcomingItemReminder; close: () => void }) {
  const { reminder, missing } = useCurrentItem(clicked);
  const { save, saving } = useItemRemindersSave();
  // The reminders chosen here, until the cache tells them (a new list of the item drops them).
  const [draft, setDraft] = useState<{ base: readonly ReminderFields[]; value: readonly ReminderFields[] } | null>(null);
  const saved = reminder.item.reminders;
  const value = draft && draft.base === saved ? draft.value : saved;
  const due = upcomingDueText(reminder.due, reminder.kind);

  /**
   * Saves the reminders chosen; a failure shows those saved again.
   * @param {Reminder[]} reminders Reminders.
   * @returns {void}
   */
  const change = (reminders: Reminder[]) => {
    setDraft({ base: saved, value: reminders });
    save(reminder, reminders, (error) => {
      setDraft(null);
      onMutationError(error);
    });
  };

  return (
    <Stack gap="md">
      <SaveStatus saving={saving} />
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <UpcomingKindIcon reminder={reminder} />
        <Stack gap={0} miw={0}>
          <Text fw={600}>{reminder.title}</Text>
          {due && (
            <Text size="sm" c="dimmed">
              {due}
            </Text>
          )}
        </Stack>
      </Group>
      {missing && (
        <NoticeAlert kind="warning" title="Élément introuvable">
          Il a été supprimé ou déplacé ailleurs : ses rappels ne peuvent plus être changés ici.
        </NoticeAlert>
      )}
      {reminder.kind === 'task' ? (
        <TaskRemindersField value={value} minDate={reminder.item.effectiveMinDate} deadline={reminder.item.effectiveDeadline} onChange={change} disabled={missing} />
      ) : reminder.kind === 'routine' ? (
        <RoutineRemindersField timed={routineHasHoursOf(reminder.item)} value={value} onChange={change} disabled={missing} />
      ) : (
        // Saved for the whole series: its description is the one of the series.
        <EventRemindersField allDay={seriesInput(reminder.item).allDay} value={value} onChange={change} disabled={missing} />
      )}
      <Group justify="flex-end">
        <OpenItemButton reminder={reminder} close={close} disabled={missing} />
      </Group>
    </Stack>
  );
}
