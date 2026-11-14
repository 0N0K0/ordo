import { ActionIcon, Badge, Button, Collapse, ColorInput, ColorSwatch, Group, Paper, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { DEFAULT_SCHEDULE_DISPLAY, DEFAULT_SCHEDULE_KIND_NAME, readScheduleDisplay } from '@ordo/shared';
import { ArrowCounterClockwiseIcon, PlusIcon, SlidersHorizontalIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useColorSwatches } from '../workspace/use-color-swatches';
import { useDefaultScheduleKind, useForeignScheduleKinds, useScheduleTypes, useWorkScheduleMutations } from './api';
import { ScheduleLookEditor } from './ScheduleLookEditor';

/** Key of the default kind among the kinds whose display is open. */
const DEFAULT_KEY = 'default';

/**
 * Kinds of time slots ("Travail", "Garde des enfants"…) and the default kind (the schedules without kind): name,
 * color and display in the calendar.
 * @returns {JSX.Element} Section.
 */
function ScheduleTypes() {
  const { data: types } = useScheduleTypes();
  const { saveType, removeType, saveDefaultKind } = useWorkScheduleMutations();
  const { data: defaultKind } = useDefaultScheduleKind();
  const swatches = useColorSwatches();
  const [name, setName] = useState('');
  const [color, setColor] = useState(swatches[0]);
  const [opened, setOpened] = useState<string | null>(null);
  const onError = (error: Error) => notifyError(error.message);
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600}>Types de plages</Text>
        <Text size="xs" c="dimmed">
          Pour distinguer vos plages (travail, garde des enfants, sport…) : chaque type a sa couleur et son affichage dans l’agenda. Les plages sans type prennent ceux de la première ligne.
        </Text>
        {defaultKind && (
          <Stack gap={6}>
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
                <ActionIcon
                  variant={opened === DEFAULT_KEY ? 'light' : 'subtle'}
                  color="gray"
                  aria-label="Affichage des plages sans type"
                  aria-expanded={opened === DEFAULT_KEY}
                  onClick={() => setOpened(opened === DEFAULT_KEY ? null : DEFAULT_KEY)}
                >
                  <SlidersHorizontalIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
              {/* Keeps the column of the delete buttons of the kinds. */}
              <ActionIcon variant="transparent" aria-hidden tabIndex={-1} style={{ visibility: 'hidden' }}>
                <TrashIcon />
              </ActionIcon>
            </Group>
            <Collapse expanded={opened === DEFAULT_KEY}>
              <Paper p="xs" radius="sm" bg="var(--mantine-color-default-hover)">
                <ScheduleLookEditor name={defaultKind.name} value={defaultKind} onChange={(display) => saveDefaultKind.mutate({ ...defaultKind, ...display }, { onError })} />
              </Paper>
            </Collapse>
          </Stack>
        )}
        {(types ?? []).map((type) => {
          const input = { name: type.name, color: type.color, ...readScheduleDisplay(type) };
          return (
            <Stack key={type.id} gap={6}>
              <Group gap="xs" wrap="nowrap">
                <ColorInput
                  size="xs"
                  w={120}
                  format="hex"
                  swatches={swatches}
                  aria-label={`Couleur de ${type.name}`}
                  defaultValue={type.color}
                  onChangeEnd={(value) => saveType.mutate({ id: type.id, input: { ...input, color: value } }, { onError })}
                />
                <TextInput
                  size="xs"
                  style={{ flex: 1 }}
                  aria-label="Nom du type"
                  defaultValue={type.name}
                  onBlur={(event) =>
                    event.currentTarget.value.trim() && event.currentTarget.value !== type.name && saveType.mutate({ id: type.id, input: { ...input, name: event.currentTarget.value } }, { onError })
                  }
                />
                <Tooltip label="Affichage dans l’agenda">
                  <ActionIcon
                    variant={opened === type.id ? 'light' : 'subtle'}
                    color="gray"
                    aria-label={`Affichage de ${type.name}`}
                    aria-expanded={opened === type.id}
                    onClick={() => setOpened(opened === type.id ? null : type.id)}
                  >
                    <SlidersHorizontalIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Supprimer (ses plages restent, sans type)">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Supprimer ${type.name}`}
                    onClick={() => removeType.mutate(type.id, { onSuccess: () => notifySuccess('Type supprimé.'), onError })}
                  >
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Collapse expanded={opened === type.id}>
                <Paper p="xs" radius="sm" bg="var(--mantine-color-default-hover)">
                  <ScheduleLookEditor name={type.name} value={type} onChange={(display) => saveType.mutate({ id: type.id, input: { ...input, ...display } }, { onError })} />
                </Paper>
              </Collapse>
            </Stack>
          );
        })}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            saveType.mutate({ id: null, input: { name: name.trim(), color, ...DEFAULT_SCHEDULE_DISPLAY } }, { onSuccess: () => setName(''), onError });
          }}
        >
          <Group gap="xs" wrap="nowrap">
            <ColorInput size="xs" w={120} format="hex" swatches={swatches} aria-label="Couleur du nouveau type" value={color} onChange={setColor} />
            <TextInput size="xs" style={{ flex: 1 }} aria-label="Nom du nouveau type" placeholder="Nouveau type…" value={name} onChange={(event) => setName(event.currentTarget.value)} />
            <Button type="submit" size="xs" variant="default" leftSection={<PlusIcon aria-hidden />} disabled={!name.trim()} loading={saveType.isPending}>
              Ajouter
            </Button>
          </Group>
        </form>
      </Stack>
    </Paper>
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
  const onError = (error: Error) => notifyError(error.message);
  const byWorkspace = new Map<string, typeof kinds>();
  for (const kind of kinds) byWorkspace.set(kind.workspaceId, [...(byWorkspace.get(kind.workspaceId) ?? []), kind]);
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Text fw={600}>Plages des autres espaces</Text>
        <Text size="xs" c="dimmed">
          Abonné à un type de plage, cet espace affiche toutes ses plages (même celles ajoutées ensuite) dans son agenda, en lecture seule, avec la couleur et l’affichage du type ou ceux choisis ici.
        </Text>
        {[...byWorkspace.values()].map((items) => (
          <Stack key={items[0].workspaceId} gap={4}>
            <Text size="sm" fw={600}>
              {items[0].workspaceName}
            </Text>
            {items.map((kind) => {
              const key = `${kind.workspaceId}|${kind.typeId ?? ''}`;
              const target = { workspaceId: kind.workspaceId, typeId: kind.typeId ?? null };
              const look = { color: kind.color ?? null, ...readScheduleDisplay(kind) };
              return (
                <Stack key={key} gap={6} pl="md">
                  <Group gap="sm" wrap="nowrap">
                    <ColorSwatch size={12} color={kind.color ?? 'var(--mantine-color-green-4)'} />
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
            })}
          </Stack>
        ))}
      </Stack>
    </Paper>
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
      <ScheduleTypes />
      <ForeignSchedules />
    </Stack>
  );
}
