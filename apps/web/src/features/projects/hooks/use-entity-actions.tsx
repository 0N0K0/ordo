import { subtreeOf, personNameSchema, projectLabelSchema } from '@ordo/shared';
import { clientPath, PAGES, projectPath } from '../../../app/pages';
import { openFormPanel } from '../../../components/panels/panels';
import { openModal } from '../../../components/panels/open-modal';

import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { notifyWithUndo, onMutationError } from '../../../lib/notify';
import { archiveEntry, type ArchiveMutation } from '../../../lib/archive';
import {
  useSetClientArchived,
  useSetClientFavorite,
  useSetProjectArchived,
  useSetProjectFavorite,
  useUpdateClient,
  useUpdateProject,
  projectTreeQueryKey,
  type Client,
  type Project,
  type ProjectTree,
} from '../api';
import { ClientForm } from '../components/ClientForm';
import { DeleteClientDialog, DeleteProjectDialog } from '../components/DeleteDialogs';
import { ProjectForm } from '../components/ProjectForm';
import { openLabelForm } from '../../../components/dialogs/open-label-form';
import { type RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { TrashIcon } from '@phosphor-icons/react';

export type EntityRef = { type: 'client'; item: Client } | { type: 'project'; item: Project };

/**
 * Displayed label of a client (its name) or a project (its title).
 * @param {EntityRef} entity Client or project.
 * @returns {string} Label.
 */
export function entityLabel(entity: EntityRef): string {
  return entity.type === 'client' ? entity.item.name : entity.item.label;
}

/**
 * Every action available on clients and projects (menu, tree, detail pages).
 * @returns {object} Actions.
 */
export function useEntityActions() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setClientFavorite = useSetClientFavorite();
  const setProjectFavorite = useSetProjectFavorite();
  const setClientArchived = useSetClientArchived();
  const setProjectArchived = useSetProjectArchived();
  const updateClient = useUpdateClient();
  const updateProject = useUpdateProject();

  /**
   * Leaves the detail page of a deleted entity.
   * @param {string} path Detail page path.
   * @returns {void}
   */
  const leaveIfOn = (path: string) => {
    if (pathname === path) navigate(PAGES.home.path, { replace: true });
  };

  /**
   * Sets the favorite flag, with an undo toast.
   * @param {EntityRef} entity Client or project.
   * @param {boolean} favorite Target state.
   * @param {boolean} [notify=true] Whether to show the toast. Optional. Default = true.
   * @returns {void}
   */
  const setFavorite = (entity: EntityRef, favorite: boolean, notify = true): void => {
    const mutation = entity.type === 'client' ? setClientFavorite : setProjectFavorite;
    mutation.mutate(
      { id: entity.item.id, favorite },
      {
        onSuccess: () => {
          if (!notify) return;
          const message = `« ${entityLabel(entity)} » ${favorite ? 'ajouté aux' : 'retiré des'} favoris.`;
          notifyWithUndo(message, () => setFavorite(entity, !favorite, false));
        },
        onError: onMutationError,
      },
    );
  };

  /**
   * Archive mutation of a client (its projects along) or a project, for `archiveEntry`.
   * @param {EntityRef} entity Client or project.
   * @returns {ArchiveMutation} Mutation.
   */
  const archiver = (entity: EntityRef): ArchiveMutation => ({
    mutateAsync: ({ ids: [id], archived }) => (entity.type === 'client' ? setClientArchived.mutateAsync({ id, archived }) : setProjectArchived.mutateAsync({ id, archived })),
  });

  /**
   * Opens the form renaming a client or relabelling a project, in the side panel as elsewhere.
   * @param {EntityRef} entity Client or project.
   * @returns {void}
   */
  const rename = (entity: EntityRef): void => {
    const client = entity.type === 'client';
    openLabelForm(client ? 'Renommer le client' : 'Renommer le projet', {
      initial: entityLabel(entity),
      schema: client ? personNameSchema : projectLabelSchema,
      fieldLabel: client ? 'Nom' : 'Libellé',
      submitLabel: 'Renommer',
      onSubmit: (label) => {
        if (label === entityLabel(entity)) return;
        return client ? updateClient.mutateAsync({ id: entity.item.id, input: { name: label } }) : updateProject.mutateAsync({ id: entity.item.id, input: { label } });
      },
    });
  };

  /**
   * Asks for confirmation, then deletes.
   * @param {EntityRef} entity Client or project.
   * @returns {void}
   */
  const confirmDelete = (entity: EntityRef): void => {
    if (entity.type === 'client') {
      const workspace = queryClient.getQueryData<ProjectTree>(projectTreeQueryKey);
      const projectCount = workspace?.projects.filter((project) => project.clientId === entity.item.id).length ?? 0;
      openModal('Supprimer le client', (close) => (
        <DeleteClientDialog
          client={entity.item}
          projectCount={projectCount}
          onDone={(deleted) => {
            close();
            if (deleted) leaveIfOn(clientPath(entity.item.id));
          }}
        />
      ));
    } else {
      const workspace = queryClient.getQueryData<ProjectTree>(projectTreeQueryKey);
      const subProjectCount = workspace ? subtreeOf(workspace.projects, entity.item.id, false).size : 0;
      openModal('Supprimer le projet', (close) => (
        <DeleteProjectDialog
          project={entity.item}
          subProjectCount={subProjectCount}
          onDone={(deleted) => {
            close();
            if (deleted) leaveIfOn(projectPath(entity.item.id));
          }}
        />
      ));
    }
  };

  return {
    setFavorite,
    archiver,
    rename,

    /**
     * Opens the client form (creation when no client is given).
     * @param {Client} [client] Client to edit. Optional.
     * @returns {void}
     */
    openClientForm: (client?: Client) => openFormPanel(client ? 'Modifier le client' : 'Nouveau client', (close) => <ClientForm client={client} onDone={close} />),

    /**
     * Opens the project form (creation when no project is given).
     * @param {Project} [project] Project to edit. Optional.
     * @param {{ clientId?: string, parentId?: string }} [defaults] Client or parent preselected on creation. Optional.
     * @returns {void}
     */
    openProjectForm: (project?: Project, defaults?: { clientId?: string; parentId?: string }) =>
      openFormPanel(
        project ? 'Modifier le projet' : defaults?.parentId ? 'Nouveau sous-projet' : 'Nouveau projet',
        (close) => <ProjectForm project={project} defaults={defaults} onDone={close} />,
        'lg',
      ),

    confirmDelete,

    /**
     * Entries of the « … » menu of a client or a project archiving or restoring it, and deleting it (its tree row, its page).
     * @param {EntityRef} entity Client or project.
     * @returns {RowMenuEntry[]} Entries.
     */
    lifecycleEntries: (entity: EntityRef): RowMenuEntry[] => [
      archiveEntry(
        { archived: entity.item.archived, type: entity.type === 'client' ? 'Client' : 'Projet', label: entityLabel(entity), cascade: entity.type === 'client' ? 'avec ses projets' : undefined },
        archiver(entity),
        entity.item.id,
      ),
      { label: 'Supprimer', icon: <TrashIcon aria-hidden />, onClick: () => confirmDelete(entity), danger: true },
    ],
  };
}
