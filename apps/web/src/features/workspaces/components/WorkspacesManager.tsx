import { moveEntries } from '../../../components/actions/move-entries';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { formCallbacks } from '../../../lib/form';
import { InlineActions } from '../../../components/actions/ActionsMenu';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Badge, Chip, Group, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { readWeek, WEEKDAY_LABELS, weekLength, WORKSPACE_LABEL_MAX } from '@ordo/shared';
import { ArrowSquareOutIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifySuccess, ON_ERROR, onMutationError } from '../../../lib/notify';

import { useWorkspaceMutations, useWorkspaces, type NotificationSource, type Workspace, type WorkspaceKind } from '../api';
import { switchWorkspace } from '../lib/switch';
import { WorkspaceKindIcon } from './WorkspaceKindIcon';
import { SettingsGrid } from '../../../components/settings/SettingsGrid';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { ActionButton } from '../../../components/actions/ActionButton';
import { itemCellLabel } from '../../../components/data-table/cells/cell-field';

const KINDS = [
  { value: 'PRO', label: 'Pro' },
  { value: 'PERSO', label: 'Perso' },
];

const SOURCES: { value: NotificationSource; label: string }[] = [
  { value: 'ALARMS', label: 'Alarmes' },
  { value: 'CALENDAR', label: 'Rappels d’agenda' },
  { value: 'MAILS', label: 'Nouveaux mails' },
];

const WEEKDAYS = WEEKDAY_LABELS.map((label, index) => ({ value: String(index + 1), label }));

interface WorkspaceRowProps {
  workspace: Workspace;
  index: number;
  count: number;
  current: boolean;
  /** Workspace opened when this one, the current one, is deleted. */
  fallbackId: string | null;
}

/**
 * One workspace: label (saved when left) and kind, order, opening, deletion after confirmation.
 * @param {WorkspaceRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function WorkspaceRow({ workspace, index, count, current, fallbackId }: WorkspaceRowProps) {
  const { update, setNotifications, setWeek, move, remove } = useWorkspaceMutations();
  const week = readWeek(workspace);
  const [label, setLabel] = useState(workspace.label);

  /**
   * Saves the label or the kind when they changed.
   * @param {{ label?: string, kind?: WorkspaceKind }} changes Changes.
   * @returns {void}
   */
  const save = (changes: { label?: string; kind?: WorkspaceKind }) => {
    const input = { label: (changes.label ?? label).trim(), kind: changes.kind ?? workspace.kind };
    if (!input.label) {
      setLabel(workspace.label);
      return;
    }
    if (input.label === workspace.label && input.kind === workspace.kind) return;
    update.mutate(
      { id: workspace.id, input },
      {
        onSuccess: () => changes.kind && notifySuccess(changes.kind === 'PERSO' ? 'Espace passé en personnel.' : 'Espace passé en professionnel.'),
        onError: onMutationError,
      },
    );
  };

  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap">
        <WorkspaceKindIcon kind={workspace.kind} />
        <TextInput
          aria-label={itemCellLabel('Libellé', `« ${workspace.label} »`, 1)}
          style={{ flex: 1 }}
          value={label}
          maxLength={WORKSPACE_LABEL_MAX}
          onChange={(event) => setLabel(event.currentTarget.value)}
          onBlur={() => save({ label })}
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
        <InlineActions
          name={workspace.label}
          items={[
            ...moveEntries(index, count, (to) => move.mutate({ id: workspace.id, index: to }, ON_ERROR)),
            { label: 'Ouvrir', icon: <ArrowSquareOutIcon aria-hidden />, disabled: current, onClick: () => switchWorkspace(workspace.id) },
          ]}
        />
        <RemoveButton
          label={count === 1 ? 'Le dernier espace ne peut pas être supprimé' : 'Supprimer'}
          aria-label={`Supprimer ${workspace.label}`}
          disabled={count === 1}
          onClick={() =>
            confirmDestructive({
              title: 'Supprimer l’espace',
              risks: `L’espace « ${workspace.label} » sera supprimé définitivement avec tout son contenu : projets, tâches, temps, agenda, mails liés, documents, tableaux de bord, trésorerie${workspace.kind === 'PRO' ? ', clients et facturation' : ''}. Les boîtes mail restent intactes sur leur serveur.`,
              onConfirm: () =>
                remove.mutate(
                  workspace.id,
                  formCallbacks(null, 'Espace supprimé.', () => {
                    if (current && fallbackId) switchWorkspace(fallbackId);
                  }),
                ),
            })
          }
        />
      </Group>
      <Group gap="xs" pl={28}>
        <Text size="xs" c="dimmed">
          Notifier quand un autre espace est ouvert :
        </Text>
        <Chip.Group multiple value={workspace.notifyElsewhere} onChange={(sources) => setNotifications.mutate({ id: workspace.id, sources: sources as NotificationSource[] }, ON_ERROR)}>
          {SOURCES.map((source) => (
            <Chip key={source.value} value={source.value} size="xs" variant="light">
              {source.label}
            </Chip>
          ))}
        </Chip.Group>
      </Group>
      <Group gap="xs" pl={28} align="center">
        <Text size="xs" c="dimmed">
          Semaine du
        </Text>
        <Select
          size="xs"
          w={120}
          aria-label="Premier jour de la semaine"
          data={WEEKDAYS}
          value={String(week.start)}
          allowDeselect={false}
          onChange={(value) => value && setWeek.mutate({ id: workspace.id, start: Number(value), end: week.end }, ON_ERROR)}
        />
        <Text size="xs" c="dimmed">
          au
        </Text>
        <Select
          size="xs"
          w={120}
          aria-label="Dernier jour de la semaine"
          data={WEEKDAYS}
          value={String(week.end)}
          allowDeselect={false}
          onChange={(value) => value && setWeek.mutate({ id: workspace.id, start: week.start, end: Number(value) }, ON_ERROR)}
        />
        <Text size="xs" c="dimmed">
          {weekLength(week) === 8 ? '8 jours : les semaines se chevauchent ce jour-là.' : `${weekLength(week)} jours.`} Vue semaine de l’agenda, « cette semaine »…
        </Text>
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
            <TextInput label="Libellé" placeholder="Libellé de l’espace" style={{ flex: 1 }} value={label} maxLength={WORKSPACE_LABEL_MAX} onChange={(event) => setLabel(event.currentTarget.value)} />
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
