import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { GithubBoardQuery, GithubProjectLinkQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import { tasksQueryKey } from '../tasks/api';

export type GithubBoard = GithubBoardQuery['githubBoard'];
export type GithubLink = NonNullable<GithubProjectLinkQuery['githubProjectLink']>;

const githubKey = ['github'] as const;

const LoginDocument = graphql(`
  query GithubLogin {
    githubLogin
  }
`);
const ContributorsDocument = graphql(`
  query GithubContributors {
    githubContributors {
      id
      name
      githubLogin
    }
  }
`);
const BoardDocument = graphql(`
  query GithubBoard($url: String!) {
    githubBoard(url: $url) {
      id
      title
      url
      fields {
        id
        name
        dataType
        iterationCount
        options {
          id
          name
        }
      }
    }
  }
`);
const LinkDocument = graphql(`
  query GithubProjectLink($projectId: ID!) {
    githubProjectLink(projectId: $projectId) {
      id
      projectId
      url
      title
      statusFieldId
      priorityFieldId
      iterationFieldId
      startFieldId
      endFieldId
      effortFieldId
      statusOptions
      priorityOptions
      repositoryName
      pushExisting
      enabled
      lastSyncAt
      lastSyncError
      lastSyncSummary
      linkedTaskCount
    }
  }
`);
const SetToken = graphql(`
  mutation SetGithubToken($token: String!) {
    setGithubToken(token: $token)
  }
`);
const RemoveToken = graphql(`
  mutation RemoveGithubToken {
    removeGithubToken
  }
`);
const SaveLink = graphql(`
  mutation SaveGithubLink($projectId: ID!, $input: GithubLinkInput!) {
    saveGithubLink(projectId: $projectId, input: $input)
  }
`);
const Unlink = graphql(`
  mutation UnlinkGithubProject($projectId: ID!) {
    unlinkGithubProject(projectId: $projectId)
  }
`);
const Sync = graphql(`
  mutation SyncGithubProject($projectId: ID!) {
    syncGithubProject(projectId: $projectId) {
      pulledNew
      pushedNew
      pulled
      pushed
      unlinked
      sprints
    }
  }
`);
const SetLogin = graphql(`
  mutation SetContributorGithubLogin($id: ID!, $login: String) {
    setContributorGithubLogin(id: $id, login: $login)
  }
`);

/**
 * Login of the connected GitHub account (null when not connected).
 * @returns {UseQueryResult} Query state.
 */
export function useGithubLogin() {
  return useQuery({ queryKey: [...githubKey, 'login'], queryFn: async () => (await execute(LoginDocument)).githubLogin });
}

/**
 * Contributors with their GitHub login.
 * @returns {UseQueryResult} Query state.
 */
export function useGithubContributors() {
  return useQuery({ queryKey: [...githubKey, 'contributors'], queryFn: async () => (await execute(ContributorsDocument)).githubContributors });
}

/**
 * Board of a URL with its fields (loaded once the URL is given).
 * @param {string | null} url Board URL.
 * @returns {UseQueryResult} Query state.
 */
export function useGithubBoard(url: string | null) {
  return useQuery({ queryKey: [...githubKey, 'board', url], queryFn: async () => (await execute(BoardDocument, { url: url! })).githubBoard, enabled: Boolean(url), retry: false });
}

/**
 * Board link of a project.
 * @param {string} projectId Project.
 * @returns {UseQueryResult} Query state.
 */
export function useGithubLink(projectId: string) {
  return useQuery({ queryKey: [...githubKey, 'link', projectId], queryFn: async () => (await execute(LinkDocument, { projectId })).githubProjectLink });
}

/**
 * Mutation refreshing GitHub data and tasks (a sync changes them) once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useGithubMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSettled: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: githubKey }), queryClient.invalidateQueries({ queryKey: tasksQueryKey })]);
    },
  });
}

export interface LinkValues {
  url: string;
  statusFieldId: string | null;
  priorityFieldId: string | null;
  iterationFieldId: string | null;
  startFieldId: string | null;
  endFieldId: string | null;
  effortFieldId: string | null;
  statusOptions: Record<string, string>;
  priorityOptions: Record<string, string>;
  repositoryName: string | null;
  pushExisting: boolean;
  enabled: boolean;
}

/**
 * GitHub connection, links and sync.
 * @returns {object} Mutations.
 */
export function useGithubMutations() {
  return {
    setToken: useGithubMutation(async (token: string) => (await execute(SetToken, { token })).setGithubToken),
    removeToken: useGithubMutation(async () => (await execute(RemoveToken)).removeGithubToken),
    saveLink: useGithubMutation(async (variables: { projectId: string; input: LinkValues }) => (await execute(SaveLink, variables)).saveGithubLink),
    unlink: useGithubMutation(async (projectId: string) => (await execute(Unlink, { projectId })).unlinkGithubProject),
    sync: useGithubMutation(async (projectId: string) => (await execute(Sync, { projectId })).syncGithubProject),
    setLogin: useGithubMutation(async (variables: { id: string; login: string | null }) => (await execute(SetLogin, variables)).setContributorGithubLogin),
  };
}
