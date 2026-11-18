import { openFormPanel } from '../../../components/panels/panels';
import { openModal } from '../../../components/panels/open-modal';

import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { notifyWithUndo, onMutationError } from '../../../lib/notify';
import { descendantIds, useSetClientArchived, useSetClientFavorite, useSetProjectArchived, useSetProjectFavorite, useUpdateClient, useUpdateProject, workspaceQueryKey, type Client, type Project, type Workspace } from '../api';
import { ClientForm } from '../components/ClientForm';
import { DeleteClientDialog, DeleteProjectDialog } from '../components/DeleteDialogs';
import { ProjectForm } from '../components/ProjectForm';

export type EntityRef = { type: 'client'; item: Client } | { type: 'project'; item: Project };

/**
 * Displayed label of a client (its name) or a project (its title).
 * @param {EntityRef} entity Client or project.
 * @returns {string} Label.
 */
export function entityLabel(entity: EntityRef): string {
  return entity.type === 'client' ? entity.item.name : entity.item.title;
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
    if (pathname === path) navigate('/', { replace: true });
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
   * Archives or restores, with an undo toast.
   * @param {EntityRef} entity Client or project.
   * @param {boolean} archived Target state.
   * @param {boolean} [notify=true] Whether to show the toast. Optional. Default = true.
   * @returns {void}
   */
  const setArchived = (entity: EntityRef, archived: boolean, notify = true): void => {
    const mutation = entity.type === 'client' ? setClientArchived : setProjectArchived;
    mutation.mutate(
      { id: entity.item.id, archived },
      {
        onSuccess: () => {
          if (!notify) return;
          const cascade = entity.type === 'client' && archived ? ' avec ses projets' : '';
          const message = `« ${entityLabel(entity)} » ${archived ? 'archivé' : 'restauré'}${cascade}.`;
          notifyWithUndo(message, () => setArchived(entity, !archived, false));
        },
        onError: onMutationError,
      },
    );
  };

  /**
   * Renames a client or retitles a project.
   * @param {EntityRef} entity Client or project.
   * @param {string} label New name or title (already trimmed and non-empty).
   * @returns {void}
   */
  const rename = (entity: EntityRef, label: string): void => {
    if (label === entityLabel(entity)) return;
    const onError = onMutationError;
    if (entity.type === 'client') updateClient.mutate({ id: entity.item.id, input: { name: label } }, { onError });
    else updateProject.mutate({ id: entity.item.id, input: { title: label } }, { onError });
  };

  return {
    setFavorite,
    setArchived,
    rename,

    /**
     * Opens the client form (creation when no client is given).
     * @param {Client} [client] Client to edit. Optional.
     * @returns {void}
     */
    openClientForm: (client?: Client) =>
      openFormPanel(client ? 'Modifier le client' : 'Nouveau client', (close) => (
        <ClientForm client={client} onDone={close} />
      )),

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

    /**
     * Asks for confirmation, then deletes.
     * @param {EntityRef} entity Client or project.
     * @returns {void}
     */
    confirmDelete: (entity: EntityRef) => {
      if (entity.type === 'client') {
        const workspace = queryClient.getQueryData<Workspace>(workspaceQueryKey);
        const projectCount = workspace?.projects.filter((project) => project.clientId === entity.item.id).length ?? 0;
        openModal('Supprimer le client', (close) => (
          <DeleteClientDialog
            client={entity.item}
            projectCount={projectCount}
            onDone={(deleted) => {
              close();
              if (deleted) leaveIfOn(`/clients/${entity.item.id}`);
            }}
          />
        ));
      } else {
        const workspace = queryClient.getQueryData<Workspace>(workspaceQueryKey);
        const subProjectCount = workspace ? descendantIds(workspace.projects, entity.item.id).size : 0;
        openModal('Supprimer le projet', (close) => (
          <DeleteProjectDialog
            project={entity.item}
            subProjectCount={subProjectCount}
            onDone={(deleted) => {
              close();
              if (deleted) leaveIfOn(`/projects/${entity.item.id}`);
            }}
          />
        ));
      }
    },
  };
}
