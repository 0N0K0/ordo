import { ActionIcon, Badge, Button, Collapse, ColorInput, Group, Paper, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { ByWorkspace } from '../../components/settings/ByWorkspace';
import { ItemAvatar } from '../../components/settings/ItemAvatar';
import { DEFAULT_SCHEDULE_DISPLAY, DEFAULT_SCHEDULE_KIND_NAME, labelFormSchema, readScheduleDisplay, type ScheduleDisplay } from '@ordo/shared';
import { createdId } from '../../components/settings/settings-api';
import { SettingsList } from '../../components/settings/SettingsList';
import { ArrowCounterClockwiseIcon, SlidersHorizontalIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { onMutationError } from '../../lib/notify';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useDefaultScheduleKind, useForeignScheduleKinds, useScheduleTypes, useWorkScheduleMutations } from './api';
import { ScheduleLookEditor } from './ScheduleLookEditor';

/**
 * Schedules without kind: their name, color and display in the calendar (a setting apart, not an item of the list of
 * kinds).
 * @returns {JSX.Element | null} Section.
 */
function DefaultScheduleKind() {
  const { saveDefaultKind } = useWorkScheduleMutations();
  const { data: defaultKind } = useDefaultScheduleKind();
  const swatches = useColorSwatches();
  const [opened, setOpened] = useState(false);
  if (!defaultKind) return null;
  const onError = onMutationError;
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600}>Plages sans type</Text>
        <Group gap="xs" wrap="nowrap">
          <ColorInput
            key={defaultKind.color ?? 'none'}
            size="xs"
            w={120}
            format="hex"
            swatches={swatches}
            placeholder="Vert"
            aria-label="Couleur des plages sans type"
            defaultValue={defaultKind.color ?? ''}
            onChangeEnd={(value) => saveDefaultKind.mutate({ ...defaultKind, ...readScheduleDisplay(defaultKind), color: value || null }, { onError })}
          />
          <TextInput
            key={defaultKind.name}
            size="xs"
            style={{ flex: 1 }}
            aria-label="Nom des plages sans type"
            placeholder={DEFAULT_SCHEDULE_KIND_NAME}
            defaultValue={defaultKind.name}
            rightSectionWidth={80}
            rightSection={
              <Badge size="xs" variant="light" color="gray">
                Par défaut
              </Badge>
            }
            onBlur={(event) =>
              event.currentTarget.value.trim() !== defaultKind.name && saveDefaultKind.mutate({ ...defaultKind, ...readScheduleDisplay(defaultKind), name: event.currentTarget.value }, { onError })
            }
          />
          <Tooltip label="Affichage dans l’agenda">
            <ActionIcon variant={opened ? 'light' : 'subtle'} color="gray" aria-label="Affichage des plages sans type" aria-expanded={opened} onClick={() => setOpened(!opened)}>
              <SlidersHorizontalIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Collapse expanded={opened}>
          <Paper p="xs" radius="sm" bg="var(--mantine-color-default-hover)">
            <ScheduleLookEditor name={defaultKind.name} value={defaultKind} onChange={(display) => saveDefaultKind.mutate({ ...defaultKind, ...display }, { onError })} />
          </Paper>
        </Collapse>
      </Stack>
    </Paper>
  );
}

/**
 * Kinds of time slots ("Travail", "Garde des enfants"…), as every settings list: name, color, image and display in the
 * calendar, reordered by drag and drop.
 * @returns {JSX.Element} Section.
 */
function ScheduleTypes() {
  const { data: types } = useScheduleTypes();
  const { saveType, removeType } = useWorkScheduleMutations();
  /**
   * Input of a kind from the form values.
   * @param {{ name: string, color: string } & ScheduleDisplay} values Values.
   * @returns {{ name: string, color: string } & ScheduleDisplay} Input.
   */
  const input = (values: { name: string; color: string } & ScheduleDisplay) => ({ name: values.name, color: values.color, ...readScheduleDisplay(values) });
  return (
    <SettingsList<NonNullable<typeof types>[number], ScheduleDisplay>
      kind="SCHEDULE_TYPE"
      title="Types de plages"
      description="Pour distinguer vos plages (travail, garde des enfants, sport…) : chaque type a sa couleur et son affichage dans l’agenda."
      noun="le type"
      items={types ?? []}
      schema={labelFormSchema}
      extra={{
        initial: (type) => (type ? readScheduleDisplay(type) : DEFAULT_SCHEDULE_DISPLAY),
        render: (form) => <ScheduleLookEditor name={form.getValues().name} value={form.getValues()} onChange={(display) => form.setValues(display)} />,
      }}
      create={async (values) => createdId(await saveType.mutateAsync({ id: null, input: input(values) }))}
      update={(id, values) => saveType.mutateAsync({ id, input: input(values) })}
      remove={(id) => removeType.mutateAsync(id)}
      deleteMessage={(type) => <>Le type « {type.name} » sera supprimé ; ses plages restent, sans type. Cette action est irréversible.</>}
    />
  );
}

/**
 * Kinds of schedules of the other workspaces (and their working hours, schedules without kind), by workspace:
 * subscribing to one shows all its schedules, those added later too, read only in this calendar, in the color and
 * display of the kind, or those set here.
 * @returns {JSX.Element | null} Section, nothing without other workspaces with schedules.
 */
function ForeignSchedules() {
  const { data: kinds } = useForeignScheduleKinds();
  const { subscribe, unsubscribe, setLook } = useWorkScheduleMutations();
  const swatches = useColorSwatches();
  const [opened, setOpened] = useState<string | null>(null);
  if (!kinds?.length) return null;
  const onError = onMutationError;
  return (
    <SettingsSection
      title="Plages des autres espaces"
      description="Abonné à un type de plage, cet espace affiche toutes ses plages (même celles ajoutées ensuite) dans son agenda, en lecture seule, avec la couleur et l’affichage du type ou ceux choisis ici."
    >
      <ByWorkspace items={kinds} workspaceOf={(kind) => ({ id: kind.workspaceId, name: kind.workspaceName })}>
        {(kind) => {
          const key = `${kind.workspaceId}|${kind.typeId ?? ''}`;
          const target = { workspaceId: kind.workspaceId, typeId: kind.typeId ?? null };
          const look = { color: kind.color ?? null, ...readScheduleDisplay(kind) };
          return (
            <Stack key={key} gap={6} pl="md">
              <Group gap="sm" wrap="nowrap">
                <ItemAvatar name={kind.name} color={kind.color ?? 'green'} />
                <Text size="sm" style={{ flex: 1 }}>
                  {kind.name}
                  <Text span size="xs" c="dimmed">
                    {' '}
                    · {kind.scheduleCount} plage{kind.scheduleCount > 1 ? 's' : ''}
                    {kind.customized ? ' · affichage personnalisé' : ''}
                  </Text>
                </Text>
                {kind.subscribed && (
                  <Tooltip label="Couleur et affichage dans cet agenda">
                    <ActionIcon
                      variant={opened === key ? 'light' : 'subtle'}
                      color="gray"
                      aria-label={`Affichage de ${kind.name} (${kind.workspaceName})`}
                      aria-expanded={opened === key}
                      onClick={() => setOpened(opened === key ? null : key)}
                    >
                      <SlidersHorizontalIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Switch
                  label="Abonné"
                  aria-label={`Abonnement à ${kind.name} (${kind.workspaceName})`}
                  checked={kind.subscribed}
                  onChange={(event) => (event.currentTarget.checked ? subscribe : unsubscribe).mutate(target, { onError })}
                />
              </Group>
              <Collapse expanded={kind.subscribed && opened === key}>
                <Paper p="xs" radius="sm" bg="var(--mantine-color-default-hover)">
                  <Stack gap={6}>
                    <Group gap="xs" align="center">
                      <Text size="xs" w={120}>
                        Couleur
                      </Text>
                      <ColorInput
                        key={kind.color ?? 'none'}
                        size="xs"
                        w={140}
                        format="hex"
                        swatches={swatches}
                        placeholder="Vert"
                        aria-label={`Couleur de ${kind.name} dans cet agenda`}
                        defaultValue={kind.color ?? ''}
                        onChangeEnd={(value) => setLook.mutate({ ...target, input: { ...look, color: value || null } }, { onError })}
                      />
                    </Group>
                    <ScheduleLookEditor name={kind.name} value={kind} onChange={(display) => setLook.mutate({ ...target, input: { ...look, ...display } }, { onError })} />
                    {kind.customized && (
                      <div>
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          leftSection={<ArrowCounterClockwiseIcon aria-hidden />}
                          onClick={() => setLook.mutate({ ...target, input: { color: null, dayDisplay: null, dayBar: null, monthDisplay: null } }, { onError })}
                        >
                          Reprendre ceux du type
                        </Button>
                      </div>
                    )}
                  </Stack>
                </Paper>
              </Collapse>
            </Stack>
          );
        }}
      </ByWorkspace>
    </SettingsSection>
  );
}

/**
 * Settings of the time slots, apart from the slots themselves: their kinds (and the default kind) with their color
 * and display, and the subscriptions to kinds of other workspaces.
 * @returns {JSX.Element} Settings.
 */
export function ScheduleSettings() {
  return (
    <Stack gap="md">
      <DefaultScheduleKind />
      <ScheduleTypes />
      <ForeignSchedules />
    </Stack>
  );
}
