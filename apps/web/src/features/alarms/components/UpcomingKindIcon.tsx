import { Text } from '@mantine/core';
import type { UpcomingItemReminder } from '../hooks/use-upcoming-reminders';
import { ringIcon } from '../lib/ringing';
import { UPCOMING_KIND_LABELS } from '../lib/upcoming-reminders';

/**
 * Icon of the kind of the item of a reminder to come (that of its ring, `ringIcon`), named « Évènement », « Tâche » or
 * « Routine ».
 * @param {{ reminder: UpcomingItemReminder }} props Reminder to come.
 * @returns {JSX.Element} Icon.
 */
export function UpcomingKindIcon({ reminder }: { reminder: UpcomingItemReminder }) {
  return (
    <Text component="span" size="lg" lh={0} c="dimmed" role="img" aria-label={UPCOMING_KIND_LABELS[reminder.kind]}>
      {ringIcon(reminder.key)}
    </Text>
  );
}
