import { openFormPanel } from '../../components/panels/panels';
import { modals } from '@mantine/modals';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { notifyError, notifyWithUndo } from '../../lib/notify';
import {
  descendantIds,
  useSetClientArchived,
  useSetClientFavorite,
  useSetProjectArchived,
  useSetProjectFavorite,
  useUpdateClient,
  useUpdateProject,
  workspaceQueryKey,
  type Client,
  type Project,
  type Workspace,
} from './api';
import { ClientForm } from './ClientForm';
import { DeleteClientDialog, DeleteProjectDialog } from './DeleteDialogs';
import { ProjectForm } from './ProjectForm';

export type EntityRef = { type: 'client'; item: Client } | { type: 'project'; item: Project };

/**
 * Displayed label of a client (its name) or a project (its title).
 * @param {EntityRef} entity Client or project.
 * @returns {string} Label.
 */
export function entityLabel(entity: EntityRef): string {
  return entity.type === 'client' ? entity.item.name : entity.item.title;
}

let modalCount = 0;

/**
 * Opens a dialog (confirmations: the forms open in the side panel) whose content receives a close callback.
 * @param {string} title Modal title.
 * @param {(close: () => void) => JSX.Element} render Modal content.
 * @param {string} [size] Modal size. Optional.
 * @returns {void}
 */
function openDialog(title: string, render: (close: () => void) => React.ReactNode, size?: string): void {
  const modalId = `workspace-modal-${++modalCount}`;
  const close = () => modals.close(modalId);
  modals.open({ modalId, title, size, children: render(close) });
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
        onError: (error) => notifyError(error.message),
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
          const message = `« ${entityLabel(entity)} » ${archived ? 'archivé' : 'désarchivé'}${cascade}.`;
          notifyWithUndo(message, () => setArchived(entity, !archived, false));
        },
        onError: (error) => notifyError(error.message),
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
    const onError = (error: Error) => notifyError(error.message);
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
        openDialog('Supprimer le client', (close) => (
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
        openDialog('Supprimer le projet', (close) => (
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
