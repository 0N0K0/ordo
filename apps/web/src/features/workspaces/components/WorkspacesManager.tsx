import { moveEntries } from '../../../components/actions/move-entries';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { formCallbacks } from '../../../lib/form';
import { InlineActions } from '../../../components/actions/ActionsMenu';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Badge, Chip, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { TEXT_MAX, workspaceLabelSchema } from '@ordo/shared';
import { ArrowSquareOutIcon, PlusIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ON_ERROR, toastCallbacks } from '../../../lib/notify';

import { useWorkspaceMutations, useWorkspaces, type NotificationSource, type Workspace, type WorkspaceKind } from '../api';
import { switchWorkspace } from '../lib/switch';
import { WorkspaceKindIcon } from './WorkspaceKindIcon';
import { SettingsGrid } from '../../../components/settings/SettingsGrid';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { ActionButton } from '../../../components/actions/ActionButton';

import { openLabelForm } from '../../../components/dialogs/open-label-form';
import { LabelField } from '../../../components/inputs/LabelField';

const KINDS = [
  { value: 'PRO', label: 'Pro' },
  { value: 'PERSO', label: 'Perso' },
];

// Alarms and reminders ring whatever workspace is open: only the new mails are a choice.
const SOURCES: { value: NotificationSource; label: string }[] = [{ value: 'MAILS', label: 'Nouveaux mails' }];

interface WorkspaceRowProps {
  workspace: Workspace;
  index: number;
  count: number;
  current: boolean;
  /** Workspace opened when this one, the current one, is deleted. */
  fallbackId: string | null;
}

/**
 * One workspace: label (renamed in the side panel) and kind, order, opening, deletion after confirmation.
 * @param {WorkspaceRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function WorkspaceRow({ workspace, index, count, current, fallbackId }: WorkspaceRowProps) {
  const { update, setNotifications, move, remove } = useWorkspaceMutations();
  /**
   * Changes the kind of the workspace.
   * @param {WorkspaceKind} kind New kind.
   * @returns {void}
   */
  const changeKind = (kind: WorkspaceKind) =>
    update.mutate({ id: workspace.id, input: { label: workspace.label, kind } }, toastCallbacks(kind === 'PERSO' ? 'Espace passé en personnel.' : 'Espace passé en professionnel.'));

  /**
   * Opens the form renaming the workspace, in the side panel as elsewhere.
   * @returns {void}
   */
  const rename = () =>
    openLabelForm('Renommer l’espace', {
      initial: workspace.label,
      schema: workspaceLabelSchema,
      submitLabel: 'Renommer',
      onSubmit: (label) => (label === workspace.label ? undefined : update.mutateAsync({ id: workspace.id, input: { label, kind: workspace.kind } })),
    });

  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap">
        <WorkspaceKindIcon kind={workspace.kind} />
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} truncate>
            {workspace.label}
          </Text>
          {current && (
            <Badge size="xs" variant="light">
              Actuel
            </Badge>
          )}
        </Group>
        <SegmentedControl size="xs" aria-label="Type d’espace" data={KINDS} value={workspace.kind} onChange={(kind) => changeKind(kind as WorkspaceKind)} />
        <InlineActions
          name={workspace.label}
          items={[
            { label: 'Renommer', icon: <PencilSimpleIcon aria-hidden />, onClick: rename },
            ...moveEntries(index, count, (to) => move.mutate({ id: workspace.id, index: to }, ON_ERROR)),
            { label: 'Ouvrir', icon: <ArrowSquareOutIcon aria-hidden />, disabled: current, onClick: () => switchWorkspace(workspace.id) },
          ]}
        />
        <RemoveButton
          label={count === 1 ? 'Le dernier espace ne peut pas être supprimé' : 'Supprimer'}
          aria-label={`Supprimer « ${workspace.label} »`}
          disabled={count === 1}
          onClick={() =>
            confirmDestructive({
              title: 'Supprimer l’espace',
              risks: `L’espace « ${workspace.label} » sera supprimé définitivement avec tout son contenu : projets, tâches, temps, agenda, mails liés, documents, tableaux de bord, trésorerie${workspace.kind === 'PRO' ? ', clients et facturation' : ''}. Les boîtes mail restent intactes sur leur serveur.`,
              run: () =>
                remove.mutateAsync(workspace.id).then(() => {
                  if (current && fallbackId) switchWorkspace(fallbackId);
                }),
              done: 'Espace supprimé.',
            })
          }
        />
      </Group>
      <Group gap="xs" pl={28}>
        <Text size="xs" c="dimmed">
          Quand un autre espace est ouvert (alarmes et rappels sonnent toujours), notifier aussi :
        </Text>
        <Chip.Group multiple value={workspace.notifyElsewhere} onChange={(sources) => setNotifications.mutate({ id: workspace.id, sources: sources as NotificationSource[] }, ON_ERROR)}>
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
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<WorkspaceKind>('PERSO');
  const workspaces = data?.workspaces ?? [];

  /**
   * Adds the workspace typed.
   * @returns {void}
   */
  const add = () => {
    if (!label.trim()) return;
    create.mutate(
      { label: label.trim(), kind },
      formCallbacks(null, 'Espace créé.', () => setLabel('')),
    );
  };

  return (
    <SettingsGrid>
      <SettingsSection
        title="Espaces"
        description={
          <>
            Chaque espace a ses propres projets, tâches, temps, agenda, alarmes, boîtes mail, documents, tableaux de bord, trésorerie et paramètres. Un espace personnel n’a ni facturation, ni clients,
            ni société. Un espace peut continuer à notifier ses alarmes, rappels d’agenda et nouveaux mails quand un autre est ouvert.
          </>
        }
      >
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
      </SettingsSection>
      <SettingsSection title="Nouvel espace">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <LabelField sticky={false} required={false} placeholder="Libellé de l’espace" style={{ flex: 1 }} value={label} maxLength={TEXT_MAX} onChange={(event) => setLabel(event.currentTarget.value)} />
            <SegmentedControl aria-label="Type du nouvel espace" data={KINDS} value={kind} onChange={(value) => setKind(value as WorkspaceKind)} />
            <ActionButton priority="secondary" type="submit" icon={<PlusIcon aria-hidden />} loading={create.isPending} disabled={!label.trim()}>
              Ajouter
            </ActionButton>
          </Group>
        </form>
      </SettingsSection>
    </SettingsGrid>
  );
}
