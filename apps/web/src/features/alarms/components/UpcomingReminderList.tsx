import { Group, Stack, Text } from '@mantine/core';
import { BellIcon } from '@phosphor-icons/react';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { ListCard } from '../../../components/items/ListCard';
import * as fmt from '../../../lib/format';
import { useUpcomingReminders } from '../hooks/use-upcoming-reminders';
import { openReminderPanel } from '../lib/open-reminder-panel';
import { upcomingDueText } from '../lib/upcoming-reminders';
import { UpcomingKindIcon } from './UpcomingKindIcon';

/**
 * « Rappels à venir »: the reminders of the events, tasks and routines of the workspace for the next 30 days, of the
 * next occurrence of each item only, the soonest first (`useUpcomingReminders`), one card each: its ring time, the
 * icon of its kind, the title of its item and its due day. A card opens the panel of the reminders of its item
 * (`openReminderPanel`). An error when the events, tasks or routines fail to load; skeleton while loading; empty: « Aucun rappel dans les 30 prochains jours. ».
 * @returns {JSX.Element} List.
 */
export function UpcomingReminderList() {
  const { reminders, isPending, isError } = useUpcomingReminders();
  if (isError) return <ErrorAlert title="Rappels à venir">Les rappels à venir n’ont pas pu être chargés.</ErrorAlert>;
  if (isPending) return <ListSkeleton items={3} lines={2} />;
  if (!reminders.length) return <EmptyState icon={<BellIcon aria-hidden />} message="Aucun rappel dans les 30 prochains jours." />;
  return (
    <Stack gap="sm">
      {reminders.map((reminder) => {
        const due = upcomingDueText(reminder.due, reminder.kind);
        return (
          <ListCard key={reminder.key} onClick={() => openReminderPanel(reminder)} label={`Rappels de « ${reminder.title} », sonne ${fmt.dateTimeShort(reminder.at)}`}>
            <Group gap="sm" wrap="nowrap" align="flex-start">
              <UpcomingKindIcon reminder={reminder} />
              <Stack gap={0} miw={0}>
                <Text size="sm" fw={600}>
                  {fmt.capitalize(fmt.dateTimeShort(reminder.at))}
                </Text>
                <Text size="sm" truncate>
                  {reminder.title}
                </Text>
                {due && (
                  <Text size="xs" c="dimmed">
                    {due}
                  </Text>
                )}
              </Stack>
            </Group>
          </ListCard>
        );
      })}
    </Stack>
  );
}
