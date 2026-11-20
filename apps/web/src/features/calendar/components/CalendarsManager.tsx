import { IconAction } from '../../../components/actions/IconAction';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ByWorkspace } from './ByWorkspace';

import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { Stack } from '@mantine/core';
import { CalendarsIcsButton } from './CalendarsIcsButton';
import { calendarFormSchema } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { CalendarBlankIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { ON_ERROR } from '../../../lib/notify';

import { calendarIcsUrl, useCalendarMutations, useCalendars, useSubscribableCalendars } from '../api';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { SubscriptionRow } from './SubscriptionRow';

/**
 * Calendars of the workspace, as every settings list: added, edited (label, color, image), reordered by drag and drop,
 * exported as iCalendar (one, or all), deleted (with their events; the last one stays).
 * @returns {JSX.Element} Section.
 */
function OwnCalendars() {
  const { data, isPending } = useCalendars();
  const { create, update, remove } = useCalendarMutations();
  const calendars = data?.calendars ?? [];
  return (
    <SettingsList
      kind="CALENDAR"
      title="Calendriers"
      description="Chaque évènement appartient à un calendrier, que l’agenda peut afficher ou masquer. D’autres espaces peuvent s’y abonner, en lecture seule."
      noun="le calendrier"
      items={calendars}
      loading={isPending}
      schema={calendarFormSchema}
      {...listMutations({ create, update, remove: { mutateAsync: ({ id }: { id: string }) => remove.mutateAsync(id) } })}
      headerActions={<CalendarsIcsButton disabled={!calendars.length} />}
      renderActions={(calendar) => (
        <IconAction label="Exporter (.ics)" component="a" href={calendarIcsUrl(calendar.id)} download item={calendar.label}>
          <DownloadSimpleIcon aria-hidden />
        </IconAction>
      )}
      undeletable={() => (calendars.length === 1 ? 'Le dernier calendrier ne peut pas être supprimé' : null)}
      deleteMessage={(calendar) => (
        <>
          Le calendrier « {calendar.label} » sera supprimé définitivement avec tous ses évènements (récurrents compris). Les temps suivis sur ces évènements sont conservés, sans eux, sauf ceux sans projet qui ne portent sur rien d’autre (les temps facturés sont toujours gardés). Les autres
          espaces abonnés ne le verront plus.
        </>
      )}
    />
  );
}

/**
 * Calendars of the other workspaces, by workspace: subscribing shows one, read only, in this agenda.
 * @returns {JSX.Element} Section.
 */
function OtherCalendars() {
  const { data: calendars, isPending } = useSubscribableCalendars(true);
  const { subscribe, unsubscribe } = useCalendarMutations();

  return (
    <SettingsSection
      title="Calendriers des autres espaces"
      description="Un calendrier auquel cet espace est abonné s’affiche dans son agenda, en lecture seule : ses évènements se modifient dans leur espace."
    >
      {isPending ? (
        <ListSkeleton items={2} />
      ) : !calendars?.length ? (
        <EmptyState compact icon={<CalendarBlankIcon aria-hidden />} message="Aucun autre espace pour le moment." />
      ) : (
        <ByWorkspace items={calendars} workspaceOf={(calendar) => calendar.workspace}>
          {(calendar) => (
            <SubscriptionRow
              key={calendar.id}
              pl="lg"
              label={calendar.label}
              color={calendar.color}
              workspaceLabel={calendar.workspace.label}
              subscribed={calendar.subscribed}
              onChange={(subscribed) => (subscribed ? subscribe : unsubscribe).mutate(calendar.id, ON_ERROR)}
            />
          )}
        </ByWorkspace>
      )}
    </SettingsSection>
  );
}

/**
 * Settings of the calendars: those of the workspace, and the subscriptions to those of the other workspaces.
 * @returns {JSX.Element} Sections.
 */
export function CalendarsManager() {
  return (
    <Stack gap="md">
      <OwnCalendars />
      <OtherCalendars />
    </Stack>
  );
}
