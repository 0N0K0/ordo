import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { WorkspaceKind, WorkspacesQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import { rememberWorkspace } from './switch';

export type Workspace = WorkspacesQuery['workspaces'][number];
export type { WorkspaceKind };

const WorkspacesQueryDocument = graphql(`
  query Workspaces {
    workspaces {
      id
      name
      kind
      position
    }
    currentWorkspaceId
  }
`);

const CreateWorkspaceMutation = graphql(`
  mutation CreateWorkspace($input: WorkspaceInput!) {
    createWorkspace(input: $input) {
      id
    }
  }
`);

const UpdateWorkspaceMutation = graphql(`
  mutation UpdateWorkspace($id: ID!, $input: WorkspaceInput!) {
    updateWorkspace(id: $id, input: $input) {
      id
    }
  }
`);

const MoveWorkspaceMutation = graphql(`
  mutation MoveWorkspace($id: ID!, $index: Int!) {
    moveWorkspace(id: $id, index: $index)
  }
`);

const DeleteWorkspaceMutation = graphql(`
  mutation DeleteWorkspace($id: ID!) {
    deleteWorkspace(id: $id)
  }
`);

export const workspacesQueryKey = ['workspaces'] as const;

/**
 * Workspaces and the one the app works in (remembered, and the requests of the tab pinned to it).
 * @returns {UseQueryResult<WorkspacesQuery>} Query state.
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: workspacesQueryKey,
    queryFn: async () => {
      const data = await execute(WorkspacesQueryDocument);
      // The requests of this tab stay in this workspace from now on (before the pages load).
      rememberWorkspace(data.currentWorkspaceId);
      return data;
    },
    staleTime: Infinity,
  });
}

/**
 * Workspace the app shows (loaded before the pages: see the workspace gate of the layout).
 * @returns {{ workspace: Workspace | undefined, perso: boolean }} Workspace, and whether it is personal (no
 * invoicing, clients nor company).
 */
export function useActiveWorkspace(): { workspace: Workspace | undefined; perso: boolean } {
  const { data } = useWorkspaces();
  const workspace = data?.workspaces.find((item) => item.id === data.currentWorkspaceId);
  return { workspace, perso: workspace?.kind === 'PERSO' };
}

/**
 * Creating, changing, moving and deleting workspaces.
 * @returns {object} Mutations.
 */
export function useWorkspaceMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
  return {
    create: useMutation({
      mutationFn: async (input: { name: string; kind: WorkspaceKind }) => (await execute(CreateWorkspaceMutation, { input })).createWorkspace.id,
      onSuccess,
    }),
    update: useMutation({
      mutationFn: (variables: { id: string; input: { name: string; kind: WorkspaceKind } }) => execute(UpdateWorkspaceMutation, variables),
      onSuccess,
    }),
    move: useMutation({ mutationFn: (variables: { id: string; index: number }) => execute(MoveWorkspaceMutation, variables), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => execute(DeleteWorkspaceMutation, { id }), onSuccess }),
  };
}
