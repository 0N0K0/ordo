import { Button, Group, Radio, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useDeleteClient, useDeleteProject, type Client, type Project } from './api';

interface DialogActionsProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

/**
 * Destructive dialog buttons: Confirm first, then Cancel, bottom-right.
 * @param {DialogActionsProps} props Component props.
 * @returns {JSX.Element} Buttons.
 */
export function DestructiveActions({ onConfirm, onCancel, loading }: DialogActionsProps) {
  return (
    <Group justify="flex-end" gap="sm">
      <Button color="red" onClick={onConfirm} loading={loading} data-autofocus>
        Supprimer
      </Button>
      <Button variant="default" onClick={onCancel}>
        Annuler
      </Button>
    </Group>
  );
}

interface DeleteClientDialogProps {
  client: Client;
  projectCount: number;
  onDone: (deleted: boolean) => void;
}

/**
 * Client deletion confirmation, asking what to do with its projects.
 * @param {DeleteClientDialogProps} props Component props.
 * @param {Client} props.client Client to delete.
 * @param {number} props.projectCount Number of its projects (archived included).
 * @param {(deleted: boolean) => void} props.onDone Called when the dialog closes.
 * @returns {JSX.Element} Dialog content.
 */
export function DeleteClientDialog({ client, projectCount, onDone }: DeleteClientDialogProps) {
  const deleteClient = useDeleteClient();
  const [mode, setMode] = useState<'detach' | 'delete'>('detach');

  /**
   * Deletes the client with the chosen mode.
   * @returns {void}
   */
  const handleConfirm = () => {
    deleteClient.mutate(
      { id: client.id, deleteProjects: mode === 'delete' },
      {
        onSuccess: () => {
          notifySuccess(`Client « ${client.name} » supprimé.`);
          onDone(true);
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  return (
    <Stack gap="md">
      <Text size="sm">
        Le client <strong>{client.name}</strong> sera supprimé définitivement. Cette action est irréversible ; pour le
        retirer de la liste sans perdre ses données, archivez-le plutôt.
      </Text>
      {projectCount > 0 && (
        <Radio.Group
          label={`Que faire de ses ${projectCount} projet${projectCount > 1 ? 's' : ''} ?`}
          value={mode}
          onChange={(value) => setMode(value as 'detach' | 'delete')}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="detach" label="Les conserver, sans client" />
            <Radio value="delete" label="Les supprimer aussi, définitivement" color="red" />
          </Stack>
        </Radio.Group>
      )}
      <DestructiveActions onConfirm={handleConfirm} onCancel={() => onDone(false)} loading={deleteClient.isPending} />
    </Stack>
  );
}

interface DeleteProjectDialogProps {
  project: Project;
  /** Number of sub-projects, deleted along. */
  subProjectCount: number;
  onDone: (deleted: boolean) => void;
}

/**
 * Project deletion confirmation.
 * @param {DeleteProjectDialogProps} props Component props.
 * @param {Project} props.project Project to delete.
 * @param {number} props.subProjectCount Number of sub-projects deleted along.
 * @param {(deleted: boolean) => void} props.onDone Called when the dialog closes.
 * @returns {JSX.Element} Dialog content.
 */
export function DeleteProjectDialog({ project, subProjectCount, onDone }: DeleteProjectDialogProps) {
  const deleteProject = useDeleteProject();

  /**
   * Deletes the project.
   * @returns {void}
   */
  const handleConfirm = () => {
    deleteProject.mutate(
      { id: project.id },
      {
        onSuccess: () => {
          notifySuccess(`Projet « ${project.title} » supprimé.`);
          onDone(true);
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  return (
    <Stack gap="md">
      <Text size="sm">
        Le projet <strong>{project.title}</strong>
        {subProjectCount > 0 &&
          ` et ses ${subProjectCount} sous-projet${subProjectCount > 1 ? 's' : ''}`}{' '}
        {subProjectCount > 0 ? 'seront supprimés' : 'sera supprimé'} définitivement. Cette action est irréversible ;
        pour {subProjectCount > 0 ? 'les' : 'le'} retirer de la liste sans perdre de données, archivez plutôt.
      </Text>
      <DestructiveActions onConfirm={handleConfirm} onCancel={() => onDone(false)} loading={deleteProject.isPending} />
    </Stack>
  );
}
