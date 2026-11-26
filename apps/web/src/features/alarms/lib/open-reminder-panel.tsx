import { openFormPanel } from '../../../components/panels/panels';
import { ReminderItemPanel } from '../components/ReminderItemPanel';
import type { UpcomingItemReminder } from '../hooks/use-upcoming-reminders';

/**
 * Opens the side panel of the reminders of the item of a reminder to come (one panel per item: opened again, it
 * replaces itself).
 * @param {UpcomingItemReminder} reminder Reminder to come.
 * @returns {void}
 */
export function openReminderPanel(reminder: UpcomingItemReminder): void {
  const id = reminder.kind === 'event' ? reminder.item.eventId : reminder.item.id;
  openFormPanel(`Rappels de « ${reminder.title} »`, (close) => <ReminderItemPanel key={reminder.key} reminder={reminder} close={close} />, { panelId: `reminders-${reminder.kind}-${id}` });
}
