import { formCallbacks } from '../../../lib/form';
import { Stack } from '@mantine/core';
import { useState } from 'react';
import { CascadeChoice, DestructiveActions, DestructiveRisks } from '../../../components/dialogs/DestructiveActions';
import { useDeleteClient, useDeleteProject, type Client, type Project } from '../api';
import { countOf } from '../../../lib/text';

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
      formCallbacks(null, `Client « ${client.name} » supprimé.`, () => onDone(true)),
    );
  };

  return (
    <Stack gap="md">
      <DestructiveRisks>
        Le client <strong>{client.name}</strong> sera supprimé définitivement. Pour le retirer de la liste sans perdre ses données, archivez-le plutôt.
      </DestructiveRisks>
      {projectCount > 0 && <CascadeChoice label={`Que faire de ses ${countOf(projectCount, 'projet')} ?`} keepLabel="Les conserver, sans client" value={mode} onChange={setMode} />}
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
      formCallbacks(null, `Projet « ${project.label} » supprimé.`, () => onDone(true)),
    );
  };

  return (
    <Stack gap="md">
      <DestructiveRisks>
        Le projet <strong>{project.label}</strong>
        {subProjectCount > 0 && ` et ses ${countOf(subProjectCount, 'sous-projet')}`} {subProjectCount > 0 ? 'seront supprimés' : 'sera supprimé'} définitivement. Pour{' '}
        {subProjectCount > 0 ? 'les' : 'le'} retirer de la liste sans perdre de données, archivez plutôt.
      </DestructiveRisks>
      <DestructiveActions onConfirm={handleConfirm} onCancel={() => onDone(false)} loading={deleteProject.isPending} />
    </Stack>
  );
}
