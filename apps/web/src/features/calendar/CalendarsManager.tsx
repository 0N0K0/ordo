import { EmptyState } from '../../components/feedback/EmptyState';
import { ListSkeleton } from '../../components/feedback/Skeletons';
import { ActionIcon, Button, ColorSwatch, Group, Paper, Stack, Switch, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { calendarFormSchema } from '@ordo/shared';
import { listMutations } from '../../components/settings/settings-api';
import { SettingsList } from '../../components/settings/SettingsList';
import { CalendarBlankIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { notifyError } from '../../lib/notify';
import { WorkspaceKindIcon } from '../workspaces/WorkspaceKindIcon';
import { calendarIcsUrl, useCalendarMutations, useCalendars, useSubscribableCalendars, type SubscribableCalendar } from './api';

/**
 * Calendars of the workspace, as every settings list: added, edited (name, color, image), reordered by drag and drop,
 * exported as iCalendar (one, or all), deleted (with their events; the last one stays).
 * @returns {JSX.Element} Section.
 */
function OwnCalendars() {
  const { data, isPending } = useCalendars();
  const { create, update, remove, move } = useCalendarMutations();
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
      {...listMutations({ create, update, remove: { mutateAsync: ({ id }: { id: string }) => remove.mutateAsync(id) }, move })}
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
  const onError = (error: Error) => notifyError(error.message);
  const byWorkspace = new Map<string, SubscribableCalendar[]>();
  for (const calendar of calendars ?? []) byWorkspace.set(calendar.workspace.id, [...(byWorkspace.get(calendar.workspace.id) ?? []), calendar]);

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2} size="h4">
            Calendriers des autres espaces
          </Title>
          <Text size="sm" c="dimmed">
            Un calendrier auquel cet espace est abonné s’affiche dans son agenda, en lecture seule : ses évènements se modifient dans leur espace.
          </Text>
        </Stack>
        {isPending ? (
          <ListSkeleton items={2} />
        ) : byWorkspace.size === 0 ? (
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" radius="xl">
              <CalendarBlankIcon aria-hidden />
            </ThemeIcon>
            <EmptyState compact message="Aucun autre espace pour le moment." />
          </Group>
        ) : (
          <Stack gap="sm">
            {[...byWorkspace.values()].map((items) => (
              <Stack key={items[0].workspace.id} gap={4}>
                <Group gap="xs">
                  <WorkspaceKindIcon kind={items[0].workspace.kind as 'PRO' | 'PERSO'} />
                  <Text size="sm" fw={600}>
                    {items[0].workspace.name}
                  </Text>
                </Group>
                {items.map((calendar) => (
                  <Group key={calendar.id} gap="sm" wrap="nowrap" pl="lg">
                    <ColorSwatch color={calendar.color} size={14} />
                    <Text size="sm" style={{ flex: 1 }} truncate>
                      {calendar.name}
                    </Text>
                    <Switch
                      aria-label={`Abonnement à ${calendar.name} (${calendar.workspace.name})`}
                      label="Abonné"
                      checked={calendar.subscribed}
                      onChange={(event) => (event.currentTarget.checked ? subscribe : unsubscribe).mutate(calendar.id, { onError })}
                    />
                  </Group>
                ))}
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
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
