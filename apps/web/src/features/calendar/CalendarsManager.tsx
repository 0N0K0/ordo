import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { closePanel, openPanel } from '../../components/panels/panels';
import { ActionIcon, Button, ColorInput, ColorSwatch, Group, Paper, Skeleton, Stack, Switch, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { calendarFormSchema, type CalendarFormValues } from '@ordo/shared';
import { ArrowDownIcon, ArrowUpIcon, CalendarBlankIcon, DownloadSimpleIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { WorkspaceKindIcon } from '../workspaces/WorkspaceKindIcon';
import { calendarIcsUrl, useCalendarMutations, useCalendars, useSubscribableCalendars, type Calendar, type SubscribableCalendar } from './api';

let modalCount = 0;

interface CalendarFormProps {
  calendar?: Calendar;
  onDone: () => void;
}

/**
 * Calendar form: name and color.
 * @param {CalendarFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function CalendarForm({ calendar, onDone }: CalendarFormProps) {
  const { create, update } = useCalendarMutations();
  const swatches = useColorSwatches();
  const form = useAppForm<CalendarFormValues>({
    initialValues: { name: calendar?.name ?? '', color: calendar?.color ?? swatches[0] },
    schema: calendarFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    const callbacks = {
      onSuccess: () => {
        notifySuccess(calendar ? 'Calendrier modifié.' : 'Calendrier créé.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (calendar) update.mutate({ id: calendar.id, input: values }, callbacks);
    else create.mutate(values, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <ColorInput label="Couleur" required format="hex" swatches={swatches} swatchesPerRow={9} {...form.getInputProps('color')} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {calendar ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Calendars of the workspace: create, edit, reorder, export as iCalendar (one, or all), delete (with their events;
 * the last one stays).
 * @returns {JSX.Element} Section.
 */
function OwnCalendars() {
  const { data, isPending } = useCalendars();
  const { remove, move } = useCalendarMutations();
  const calendars = data?.calendars ?? [];
  const onError = (error: Error) => notifyError(error.message);

  /**
   * Opens the calendar form.
   * @param {Calendar} [calendar] Calendar to edit. Optional.
   * @returns {void}
   */
  const openForm = (calendar?: Calendar) => {
    const modalId = `calendar-${++modalCount}`;
    openPanel({
      panelId: modalId,
      title: calendar ? 'Modifier le calendrier' : 'Nouveau calendrier',
      children: <CalendarForm calendar={calendar} onDone={() => closePanel(modalId)} />,
    });
  };

  /**
   * Asks for confirmation before deleting a calendar and its events.
   * @param {Calendar} calendar Calendar.
   * @returns {void}
   */
  const confirmDelete = (calendar: Calendar) => {
    confirmDestructive({
      title: 'Supprimer le calendrier',
      risks: (
        <>
          <Text size="sm">
            Le calendrier « {calendar.name} » sera supprimé définitivement avec tous ses évènements (récurrents compris). Les temps suivis sur ces évènements sont conservés, sans lien. Les autres
            espaces abonnés ne le verront plus. Cette action est irréversible.
          </Text>
        </>
      ),
      onConfirm: () => {
        remove.mutate(calendar.id, { onSuccess: () => notifySuccess('Calendrier supprimé.'), onError });
      },
    });
  };

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              Calendriers
            </Title>
            <Text size="sm" c="dimmed">
              Chaque évènement appartient à un calendrier, que l’agenda peut afficher ou masquer. D’autres espaces peuvent s’y abonner, en lecture seule.
            </Text>
          </Stack>
          <Group gap="xs">
            <Tooltip label="Tous les calendriers de l’espace, dans un fichier pour un autre agenda (Google, Apple, Outlook…)">
              <Button component="a" href={calendarIcsUrl(null)} download variant="default" leftSection={<DownloadSimpleIcon aria-hidden />} disabled={!calendars.length}>
                Tout exporter (.ics)
              </Button>
            </Tooltip>
            <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
              Ajouter
            </Button>
          </Group>
        </Group>
        {isPending ? (
          <Skeleton height={48} />
        ) : (
          <Stack gap={4}>
            {calendars.map((calendar, index) => (
              <Group key={calendar.id} gap="sm" wrap="nowrap">
                <ColorSwatch color={calendar.color} size={14} />
                <Text size="sm" style={{ flex: 1 }} truncate>
                  {calendar.name}
                </Text>
                <Tooltip label="Monter">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Monter ${calendar.name}`}
                    disabled={index === 0}
                    onClick={() => move.mutate({ id: calendar.id, index: index - 1 }, { onError })}
                  >
                    <ArrowUpIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Descendre">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Descendre ${calendar.name}`}
                    disabled={index === calendars.length - 1}
                    onClick={() => move.mutate({ id: calendar.id, index: index + 1 }, { onError })}
                  >
                    <ArrowDownIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Exporter (.ics)">
                  <ActionIcon component="a" href={calendarIcsUrl(calendar.id)} download variant="subtle" color="gray" aria-label={`Exporter ${calendar.name} (.ics)`}>
                    <DownloadSimpleIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Modifier">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${calendar.name}`} onClick={() => openForm(calendar)}>
                    <PencilSimpleIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={calendars.length === 1 ? 'Le dernier calendrier ne peut pas être supprimé' : 'Supprimer'}>
                  <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${calendar.name}`} disabled={calendars.length === 1} onClick={() => confirmDelete(calendar)}>
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
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
          <Skeleton height={48} />
        ) : byWorkspace.size === 0 ? (
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" radius="xl">
              <CalendarBlankIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun autre espace pour le moment.
            </Text>
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
