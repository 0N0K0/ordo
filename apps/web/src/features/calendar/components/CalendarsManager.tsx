import { EmptyState } from '../../../components/feedback/EmptyState';
import { ByWorkspace } from '../../../components/settings/ByWorkspace';

import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { ActionIcon, Button, Stack, Tooltip } from '@mantine/core';
import { calendarFormSchema } from '@ordo/shared';
import { listMutations } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { CalendarBlankIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { ON_ERROR } from '../../../lib/notify';

import { calendarIcsUrl, useCalendarMutations, useCalendars, useSubscribableCalendars } from '../api';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { SubscriptionRow } from './SubscriptionRow';

/**
 * Calendars of the workspace, as every settings list: added, edited (name, color, image), reordered by drag and drop,
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
      headerActions={
        <Tooltip label="Tous les calendriers de l’espace, dans un fichier pour un autre agenda (Google, Apple, Outlook…)">
          <Button component="a" href={calendarIcsUrl(null)} download variant="default" leftSection={<DownloadSimpleIcon aria-hidden />} disabled={!calendars.length}>
            Tout exporter (.ics)
          </Button>
        </Tooltip>
      }
      renderActions={(calendar) => (
        <Tooltip label="Exporter (.ics)">
          <ActionIcon component="a" href={calendarIcsUrl(calendar.id)} download variant="subtle" color="gray" aria-label={`Exporter ${calendar.name} (.ics)`}>
            <DownloadSimpleIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      )}
      undeletable={() => (calendars.length === 1 ? 'Le dernier calendrier ne peut pas être supprimé' : null)}
      deleteMessage={(calendar) => (
        <>
          Le calendrier « {calendar.name} » sera supprimé définitivement avec tous ses évènements (récurrents compris). Les temps suivis sur ces évènements sont conservés, sans lien. Les autres
          espaces abonnés ne le verront plus. Cette action est irréversible.
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
              name={calendar.name}
              color={calendar.color}
              workspaceName={calendar.workspace.name}
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
