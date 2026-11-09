import { ActionIcon, Badge, Button, Chip, Group, Paper, SegmentedControl, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { ArrowDownIcon, ArrowSquareOutIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useWorkspaceMutations, useWorkspaces, type NotificationSource, type Workspace, type WorkspaceKind } from './api';
import { switchWorkspace } from './switch';
import { WorkspaceKindIcon } from './WorkspaceKindIcon';
import { SettingsGrid } from '../../components/settings/SettingsGrid';

const KINDS = [
  { value: 'PRO', label: 'Pro' },
  { value: 'PERSO', label: 'Perso' },
];

const SOURCES: { value: NotificationSource; label: string }[] = [
  { value: 'ALARMS', label: 'Alarmes' },
  { value: 'CALENDAR', label: 'Rappels d’agenda' },
  { value: 'MAILS', label: 'Nouveaux mails' },
];

interface WorkspaceRowProps {
  workspace: Workspace;
  index: number;
  count: number;
  current: boolean;
  /** Workspace opened when this one, the current one, is deleted. */
  fallbackId: string | null;
}

/**
 * One workspace: name (saved when left) and kind, order, opening, deletion after confirmation.
 * @param {WorkspaceRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function WorkspaceRow({ workspace, index, count, current, fallbackId }: WorkspaceRowProps) {
  const { update, setNotifications, move, remove } = useWorkspaceMutations();
  const [name, setName] = useState(workspace.name);
  const [confirming, setConfirming] = useState(false);
  const onError = (error: Error) => notifyError(error.message);

  /**
   * Saves the name or the kind when they changed.
   * @param {{ name?: string, kind?: WorkspaceKind }} changes Changes.
   * @returns {void}
   */
  const save = (changes: { name?: string; kind?: WorkspaceKind }) => {
    const input = { name: (changes.name ?? name).trim(), kind: changes.kind ?? workspace.kind };
    if (!input.name) {
      setName(workspace.name);
      return;
    }
    if (input.name === workspace.name && input.kind === workspace.kind) return;
    update.mutate(
      { id: workspace.id, input },
      {
        onSuccess: () => changes.kind && notifySuccess(changes.kind === 'PERSO' ? 'Espace passé en personnel.' : 'Espace passé en professionnel.'),
        onError,
      },
    );
  };

  if (confirming) {
    return (
      <Stack gap="xs">
        <Text size="sm">
          L’espace « {workspace.name} » sera supprimé définitivement avec tout son contenu : projets, tâches, temps, agenda, mails liés, documents, tableaux de bord, trésorerie
          {workspace.kind === 'PRO' ? ', clients et facturation' : ''}. Les boîtes mail restent intactes sur leur serveur. Cette action est irréversible.
        </Text>
        <DestructiveActions
          loading={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            remove.mutate(workspace.id, {
              onSuccess: () => {
                notifySuccess('Espace supprimé.');
                if (current && fallbackId) switchWorkspace(fallbackId);
              },
              onError,
            })
          }
        />
      </Stack>
    );
  }
  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap">
        <WorkspaceKindIcon kind={workspace.kind} />
        <TextInput
          aria-label="Nom de l’espace"
          style={{ flex: 1 }}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.currentTarget.value)}
          onBlur={() => save({ name })}
          rightSection={
            current ? (
              <Badge size="xs" variant="light">
                Actuel
              </Badge>
            ) : null
          }
          rightSectionWidth={current ? 64 : undefined}
        />
        <SegmentedControl size="xs" aria-label="Type d’espace" data={KINDS} value={workspace.kind} onChange={(kind) => save({ kind: kind as WorkspaceKind })} />
        <Tooltip label="Monter">
          <ActionIcon variant="subtle" color="gray" aria-label={`Monter ${workspace.name}`} disabled={index === 0} onClick={() => move.mutate({ id: workspace.id, index: index - 1 }, { onError })}>
            <ArrowUpIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Descendre">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Descendre ${workspace.name}`}
            disabled={index === count - 1}
            onClick={() => move.mutate({ id: workspace.id, index: index + 1 }, { onError })}
          >
            <ArrowDownIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Ouvrir">
          <ActionIcon variant="subtle" color="gray" aria-label={`Ouvrir ${workspace.name}`} disabled={current} onClick={() => switchWorkspace(workspace.id)}>
            <ArrowSquareOutIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={count === 1 ? 'Le dernier espace ne peut pas être supprimé' : 'Supprimer'}>
          <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${workspace.name}`} disabled={count === 1} onClick={() => setConfirming(true)}>
            <TrashIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Group gap="xs" pl={28}>
        <Text size="xs" c="dimmed">
          Notifier quand un autre espace est ouvert :
        </Text>
        <Chip.Group multiple value={workspace.notifyElsewhere} onChange={(sources) => setNotifications.mutate({ id: workspace.id, sources: sources as NotificationSource[] }, { onError })}>
          {SOURCES.map((source) => (
            <Chip key={source.value} value={source.value} size="xs" variant="light">
              {source.label}
            </Chip>
          ))}
        </Chip.Group>
      </Group>
    </Stack>
  );
}

/**
 * Workspaces: add (professional or personal), rename, change the kind, order, open, delete. A personal workspace
 * has no invoicing, no clients and no company.
 * @returns {JSX.Element} Manager.
 */
export function WorkspacesManager() {
  const { data } = useWorkspaces();
  const { create } = useWorkspaceMutations();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WorkspaceKind>('PERSO');
  const workspaces = data?.workspaces ?? [];

  /**
   * Adds the workspace typed.
   * @returns {void}
   */
  const add = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), kind },
      {
        onSuccess: () => {
          notifySuccess('Espace créé.');
          setName('');
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  return (
    <SettingsGrid>
      <Paper withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={2} size="h4">
            Espaces
          </Title>
          <Text size="sm" c="dimmed">
            Chaque espace a ses propres projets, tâches, temps, agenda, alarmes, boîtes mail, documents, tableaux de bord, trésorerie et paramètres. Un espace personnel n’a ni facturation, ni clients,
            ni société. Un espace peut continuer à notifier ses alarmes, rappels d’agenda et nouveaux mails quand un autre est ouvert.
          </Text>
          {workspaces.map((workspace, index) => (
            <WorkspaceRow
              key={workspace.id}
              workspace={workspace}
              index={index}
              count={workspaces.length}
              current={workspace.id === data?.currentWorkspaceId}
              fallbackId={workspaces.find((item) => item.id !== workspace.id)?.id ?? null}
            />
          ))}
        </Stack>
      </Paper>
      <Paper withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={2} size="h4">
            Nouvel espace
          </Title>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              add();
            }}
          >
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <TextInput label="Nom" placeholder="Nom de l’espace" style={{ flex: 1 }} value={name} maxLength={60} onChange={(event) => setName(event.currentTarget.value)} />
              <SegmentedControl aria-label="Type du nouvel espace" data={KINDS} value={kind} onChange={(value) => setKind(value as WorkspaceKind)} />
              <Button type="submit" variant="light" leftSection={<PlusIcon aria-hidden />} loading={create.isPending} disabled={!name.trim()}>
                Ajouter
              </Button>
            </Group>
          </form>
        </Stack>
      </Paper>
    </SettingsGrid>
  );
}
