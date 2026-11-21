import { unarchived } from '../../../lib/archive';
import { byPosition, subtreeOf } from '@ordo/shared';
import { patchQuery, useInvalidatingMutation } from '../../../lib/mutation';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { tasksQueryKey } from '../../tasks/api';
import { accountingQueryKey } from '../../../lib/query-keys';
import { graphql } from '../../../graphql';
import type { ClientFieldsFragment, LabelFieldsFragment, ProjectFieldsFragment, ProjectStatusFieldsFragment, ProjectTreeQuery } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';

export type Client = ClientFieldsFragment;
export type Project = ProjectFieldsFragment;
export type ProjectCategory = LabelFieldsFragment;
export type ProjectStatus = ProjectStatusFieldsFragment;
export type ProjectTree = ProjectTreeQuery;

graphql(`
  fragment ClientFields on Client {
    id
    name
    iconUrl
    color
    position
    favorite
    archived
  }
`);

graphql(`
  fragment LabelFields on ProjectCategory {
    id
    archived
    label
    color
    position
    iconUrl
  }
`);

graphql(`
  fragment ProjectStatusFields on ProjectStatus {
    id
    archived
    label
    color
    iconUrl
    position
  }
`);

graphql(`
  fragment ProjectFields on Project {
    id
    label
    clientId
    parentId
    iconUrl
    description
    statusId
    startDate
    endDate
    color
    position
    favorite
    archived
    categories {
      ...LabelFields
    }
  }
`);

const ProjectTreeDocument = graphql(`
  query ProjectTree {
    clients {
      ...ClientFields
    }
    projects {
      ...ProjectFields
    }
    projectCategories {
      ...LabelFields
    }
    projectStatuses {
      ...ProjectStatusFields
    }
  }
`);

const CreateClientDocument = graphql(`
  mutation CreateClient($input: ClientInput!) {
    createClient(input: $input) {
      ...ClientFields
    }
  }
`);

const UpdateClientDocument = graphql(`
  mutation UpdateClient($id: ID!, $input: ClientUpdateInput!) {
    updateClient(id: $id, input: $input) {
      ...ClientFields
    }
  }
`);

const SetClientFavoriteDocument = graphql(`
  mutation SetClientFavorite($id: ID!, $favorite: Boolean!) {
    setClientFavorite(id: $id, favorite: $favorite) {
      ...ClientFields
    }
  }
`);

const SetClientArchivedDocument = graphql(`
  mutation SetClientArchived($id: ID!, $archived: Boolean!) {
    setClientArchived(id: $id, archived: $archived) {
      ...ClientFields
    }
  }
`);

const DeleteClientDocument = graphql(`
  mutation DeleteClient($id: ID!, $deleteProjects: Boolean!) {
    deleteClient(id: $id, deleteProjects: $deleteProjects)
  }
`);

const MoveClientDocument = graphql(`
  mutation MoveClient($id: ID!, $index: Int!) {
    moveClient(id: $id, index: $index)
  }
`);

const CreateProjectDocument = graphql(`
  mutation CreateProject($input: ProjectInput!) {
    createProject(input: $input) {
      ...ProjectFields
    }
  }
`);

const UpdateProjectDocument = graphql(`
  mutation UpdateProject($id: ID!, $input: ProjectUpdateInput!) {
    updateProject(id: $id, input: $input) {
      ...ProjectFields
    }
  }
`);

const SetProjectFavoriteDocument = graphql(`
  mutation SetProjectFavorite($id: ID!, $favorite: Boolean!) {
    setProjectFavorite(id: $id, favorite: $favorite) {
      ...ProjectFields
    }
  }
`);

const SetProjectArchivedDocument = graphql(`
  mutation SetProjectArchived($id: ID!, $archived: Boolean!) {
    setProjectArchived(id: $id, archived: $archived) {
      ...ProjectFields
    }
  }
`);

const DeleteProjectDocument = graphql(`
  mutation DeleteProject($id: ID!) {
    deleteProject(id: $id)
  }
`);

const MoveProjectDocument = graphql(`
  mutation MoveProject($id: ID!, $parentId: ID, $clientId: ID, $index: Int!) {
    moveProject(id: $id, parentId: $parentId, clientId: $clientId, index: $index)
  }
`);

const CreateProjectCategoryDocument = graphql(`
  mutation CreateProjectCategory($input: LabelColorInput!) {
    createProjectCategory(input: $input) {
      ...LabelFields
    }
  }
`);

const UpdateProjectCategoryDocument = graphql(`
  mutation UpdateProjectCategory($id: ID!, $input: LabelColorPatch!) {
    updateProjectCategory(id: $id, input: $input) {
      ...LabelFields
    }
  }
`);

const DeleteProjectCategoryDocument = graphql(`
  mutation DeleteProjectCategory($id: ID!) {
    deleteProjectCategory(id: $id)
  }
`);

const CreateProjectStatusDocument = graphql(`
  mutation CreateProjectStatus($input: LabelColorInput!) {
    createProjectStatus(input: $input) {
      ...ProjectStatusFields
    }
  }
`);

const UpdateProjectStatusDocument = graphql(`
  mutation UpdateProjectStatus($id: ID!, $input: LabelColorPatch!) {
    updateProjectStatus(id: $id, input: $input) {
      ...ProjectStatusFields
    }
  }
`);

const DeleteProjectStatusDocument = graphql(`
  mutation DeleteProjectStatus($id: ID!) {
    deleteProjectStatus(id: $id)
  }
`);

export const projectTreeQueryKey = ['workspace'] as const;

/**
 * Clients, projects, categories and statuses (everything the sidebar needs).
 * @returns {UseQueryResult<ProjectTree>} Query state.
 */
export function useProjectTree() {
  return useQuery({
    queryKey: projectTreeQueryKey,
    queryFn: () => execute(ProjectTreeDocument),
  });
}

/**
 * Mutation refreshing the workspace afterwards, with an optional optimistic update rolled back on error.
 * @param {object} options Mutation options.
 * @param {(variables: TVariables) => Promise<TResult>} options.mutationFn Request.
 * @param {(workspace: ProjectTree, variables: TVariables) => ProjectTree} [options.optimistic] Immediate cache change. Optional.
 * @param {readonly QueryKey[]} [options.also] Other queries refreshed too. Optional. Default = none.
 * @returns {UseMutationResult<TResult, Error, TVariables>} Mutation state.
 */
function useProjectTreeMutation<TVariables, TResult>({
  mutationFn,
  optimistic,
  also = [],
}: {
  mutationFn: (variables: TVariables) => Promise<TResult>;
  optimistic?: (workspace: ProjectTree, variables: TVariables) => ProjectTree;
  also?: readonly QueryKey[];
}) {
  return useInvalidatingMutation(mutationFn, {
    invalidate: [projectTreeQueryKey, ...also],
    optimistic: optimistic && ((queryClient, variables) => patchQuery<ProjectTree>(queryClient, projectTreeQueryKey, (workspace) => optimistic(workspace, variables))),
  });
}

/**
 * Applies a change to one item of a list.
 * @param {T[]} items Items.
 * @param {string} id Id of the item to change.
 * @param {(item: T) => T} change Change to apply.
 * @returns {T[]} New list.
 */
function patch<T extends { id: string }>(items: T[], id: string, change: (item: T) => T): T[] {
  return items.map((item) => (item.id === id ? change(item) : item));
}

/**
 * Moves an item to an index among the given ordered siblings and renumbers their positions.
 * @param {T[]} items Every item of the list.
 * @param {T[]} siblings Ordered siblings the item moves among.
 * @param {T} moved Moved item, already updated (e.g. new client).
 * @param {number} index Target index.
 * @returns {T[]} New list.
 */
function reposition<T extends { id: string; position: number }>(items: T[], siblings: T[], moved: T, index: number): T[] {
  const order = siblings.filter((item) => item.id !== moved.id);
  order.splice(Math.max(0, Math.min(index, order.length)), 0, moved);
  const positions = new Map(order.map((item, position) => [item.id, position]));
  return items.map((item) => {
    const base = item.id === moved.id ? moved : item;
    return positions.has(item.id) ? { ...base, position: positions.get(item.id)! } : base;
  });
}

/**
 * Creates a client.
 * @returns {UseMutationResult} Mutation state.
 */
export function useCreateClient() {
  return useProjectTreeMutation({
    mutationFn: async (input: { name: string; color?: string | null; icon?: File | null }) => (await execute(CreateClientDocument, { input })).createClient,
  });
}

/**
 * Updates a client (name, color, icon).
 * @returns {UseMutationResult} Mutation state.
 */
export function useUpdateClient() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; input: { name?: string; color?: string | null; icon?: File | null; removeIcon?: boolean } }) =>
      (await execute(UpdateClientDocument, variables)).updateClient,
    optimistic: (workspace, { id, input }) => ({
      ...workspace,
      clients: patch(workspace.clients, id, (client) => ({
        ...client,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.color !== undefined && { color: input.color }),
      })),
    }),
  });
}

/**
 * Adds or removes a client from the favorites.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetClientFavorite() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; favorite: boolean }) => (await execute(SetClientFavoriteDocument, variables)).setClientFavorite,
    optimistic: (workspace, { id, favorite }) => ({
      ...workspace,
      clients: patch(workspace.clients, id, (client) => ({ ...client, favorite })),
    }),
  });
}

/**
 * Archives (with its active projects, its active contacts and the contributors linked to them) or restores a client;
 * the contacts and the contributors are refreshed.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetClientArchived() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; archived: boolean }) => (await execute(SetClientArchivedDocument, variables)).setClientArchived,
    also: [tasksQueryKey, accountingQueryKey],
    optimistic: (workspace, { id, archived }) => ({
      ...workspace,
      clients: patch(workspace.clients, id, (client) => ({ ...client, archived })),
      // Restoring brings back only the projects archived with the client: the refetch settles it.
      projects: archived ? workspace.projects.map((project) => (project.clientId === id ? { ...project, archived: true } : project)) : workspace.projects,
    }),
  });
}

/**
 * Deletes a client, deleting or detaching its projects.
 * @returns {UseMutationResult} Mutation state.
 */
export function useDeleteClient() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; deleteProjects: boolean }) => (await execute(DeleteClientDocument, variables)).deleteClient,
    // Tasks of deleted projects leave them: the tasks are refreshed too.
    also: [tasksQueryKey],
    optimistic: (workspace, { id, deleteProjects }) => ({
      ...workspace,
      clients: workspace.clients.filter((client) => client.id !== id),
      projects: deleteProjects
        ? workspace.projects.filter((project) => project.clientId !== id)
        : workspace.projects.map((project) => (project.clientId === id ? { ...project, clientId: null } : project)),
    }),
  });
}

/**
 * Moves a client among the active clients.
 * @returns {UseMutationResult} Mutation state.
 */
export function useMoveClient() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; index: number }) => (await execute(MoveClientDocument, variables)).moveClient,
    optimistic: (workspace, { id, index }) => {
      const moved = workspace.clients.find((client) => client.id === id);
      if (!moved) return workspace;
      const siblings = unarchived(workspace.clients).sort(byPosition);
      return { ...workspace, clients: reposition(workspace.clients, siblings, moved, index) };
    },
  });
}

interface ProjectInputValues {
  label: string;
  clientId?: string | null;
  parentId?: string | null;
  categoryIds?: string[];
  statusId?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  color?: string | null;
  icon?: File | null;
  removeIcon?: boolean;
}

/**
 * Creates a project.
 * @returns {UseMutationResult} Mutation state.
 */
export function useCreateProject() {
  return useProjectTreeMutation({
    mutationFn: async (input: Omit<ProjectInputValues, 'removeIcon'>) => (await execute(CreateProjectDocument, { input })).createProject,
  });
}

/**
 * Updates a project.
 * @returns {UseMutationResult} Mutation state.
 */
export function useUpdateProject() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; input: Partial<ProjectInputValues> }) => (await execute(UpdateProjectDocument, variables)).updateProject,
    optimistic: (workspace, { id, input }) => ({
      ...workspace,
      projects: patch(workspace.projects, id, (project) => ({
        ...project,
        ...(input.label !== undefined && { label: input.label }),
      })),
    }),
  });
}

/**
 * Adds or removes a project from the favorites.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetProjectFavorite() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; favorite: boolean }) => (await execute(SetProjectFavoriteDocument, variables)).setProjectFavorite,
    optimistic: (workspace, { id, favorite }) => ({
      ...workspace,
      projects: patch(workspace.projects, id, (project) => ({ ...project, favorite })),
    }),
  });
}

/**
 * Archives or restores a project.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSetProjectArchived() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; archived: boolean }) => (await execute(SetProjectArchivedDocument, variables)).setProjectArchived,
    optimistic: (workspace, { id, archived }) => {
      // Archiving cascades to sub-projects; restoring is settled by the refetch.
      const affected = archived ? subtreeOf(workspace.projects, id) : new Set([id]);
      return {
        ...workspace,
        projects: workspace.projects.map((project) => (affected.has(project.id) ? { ...project, archived } : project)),
      };
    },
  });
}

/**
 * Deletes a project with its sub-projects; their tasks leave them.
 * @returns {UseMutationResult} Mutation state.
 */
export function useDeleteProject() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string }) => (await execute(DeleteProjectDocument, variables)).deleteProject,
    // Its tasks leave it: the tasks are refreshed too.
    also: [tasksQueryKey],
    optimistic: (workspace, { id }) => {
      const removed = subtreeOf(workspace.projects, id);
      return { ...workspace, projects: workspace.projects.filter((project) => !removed.has(project.id)) };
    },
  });
}

/**
 * Moves a project (with its sub-projects) under a parent project or at the root of a client.
 * @returns {UseMutationResult} Mutation state.
 */
export function useMoveProject() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; parentId: string | null; clientId: string | null; index: number }) => (await execute(MoveProjectDocument, variables)).moveProject,
    optimistic: (workspace, { id, parentId, clientId, index }) => {
      const project = workspace.projects.find((item) => item.id === id);
      if (!project) return workspace;
      const targetClientId = parentId ? (workspace.projects.find((item) => item.id === parentId)?.clientId ?? null) : clientId;
      const siblings = unarchived(workspace.projects.filter((item) => (parentId ? item.parentId === parentId : !item.parentId && item.clientId === targetClientId))).sort(byPosition);
      const descendants = subtreeOf(workspace.projects, id, false);
      const projects = reposition(workspace.projects, siblings, { ...project, parentId, clientId: targetClientId }, index).map((item) =>
        descendants.has(item.id) ? { ...item, clientId: targetClientId } : item,
      );
      return { ...workspace, projects };
    },
  });
}

/**
 * Creates a project category.
 * @returns {UseMutationResult} Mutation state.
 */
export function useCreateProjectCategory() {
  return useProjectTreeMutation({
    mutationFn: async (input: { label: string; color: string }) => (await execute(CreateProjectCategoryDocument, { input })).createProjectCategory,
  });
}

/**
 * Updates a project category.
 * @returns {UseMutationResult} Mutation state.
 */
export function useUpdateProjectCategory() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; input: { label?: string; color?: string } }) => (await execute(UpdateProjectCategoryDocument, variables)).updateProjectCategory,
  });
}

/**
 * Deletes a project category.
 * @returns {UseMutationResult} Mutation state.
 */
export function useDeleteProjectCategory() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string }) => (await execute(DeleteProjectCategoryDocument, variables)).deleteProjectCategory,
  });
}

/**
 * Creates a project status.
 * @returns {UseMutationResult} Mutation state.
 */
export function useCreateProjectStatus() {
  return useProjectTreeMutation({
    mutationFn: async (input: { label: string; color: string }) => (await execute(CreateProjectStatusDocument, { input })).createProjectStatus,
  });
}

/**
 * Updates a project status.
 * @returns {UseMutationResult} Mutation state.
 */
export function useUpdateProjectStatus() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string; input: { label?: string; color?: string } }) => (await execute(UpdateProjectStatusDocument, variables)).updateProjectStatus,
  });
}

/**
 * Deletes a project status.
 * @returns {UseMutationResult} Mutation state.
 */
export function useDeleteProjectStatus() {
  return useProjectTreeMutation({
    mutationFn: async (variables: { id: string }) => (await execute(DeleteProjectStatusDocument, variables)).deleteProjectStatus,
  });
}
