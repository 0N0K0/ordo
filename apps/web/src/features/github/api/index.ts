import type { GithubLinkInput } from '@ordo/shared';
import { useQuery } from '@tanstack/react-query';
import { useInvalidatingMutation } from '../../../lib/mutation';
import { graphql } from '../../../graphql';
import type { GithubBoardQuery, GithubProjectLinkQuery } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';
import { tasksQueryKey } from '../../tasks/api';

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
        issueField
        options {
          id
          name
        }
      }
      issueTypes {
        id
        name
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
      label
      statusFieldId
      priorityFieldId
      iterationFieldId
      startFieldId
      endFieldId
      effortFieldId
      deadlineFieldId
      timeSpentFieldId
      typeSource
      typeFieldId
      statusOptions
      priorityOptions
      typeOptions
      syncAssignees
      syncLabels
      repositoryName
      pushExisting
      writeIterations
      iterationWriteRefusal
      enabled
      lastSyncAt
      lastSyncError
      lastSyncSummary
      iterationWriteError
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
const ResumeIterations = graphql(`
  mutation ResumeGithubIterations($projectId: ID!) {
    resumeGithubIterations(projectId: $projectId)
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
      failed
      sprints
      sprintsPushed
      sprintsSkipped
      sprintsBlocked
      sprintsUnpaired
      renumbered
      comments
    }
  }
`);
const SendTasks = graphql(`
  mutation SendTasksToGithub($ids: [ID!]!) {
    sendTasksToGithub(ids: $ids) {
      sent
      errors
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
  return useInvalidatingMutation(mutationFn, { invalidate: [githubKey, tasksQueryKey] });
}

/** Settings of the link of a project with a GitHub board (the shared input of the API). */
export type LinkValues = GithubLinkInput;

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
    resumeIterations: useGithubMutation(async (projectId: string) => (await execute(ResumeIterations, { projectId })).resumeGithubIterations),
    sync: useGithubMutation(async (projectId: string) => (await execute(Sync, { projectId })).syncGithubProject),
    setLogin: useGithubMutation(async (variables: { id: string; login: string | null }) => (await execute(SetLogin, variables)).setContributorGithubLogin),
  };
}

/**
 * « Envoyer sur GitHub »: sends tasks not on GitHub by a sync of their link; GitHub data and tasks refreshed once done.
 * @returns {UseMutationResult} Mutation state (its result: the tasks sent, and why each other one is not).
 */
export function useSendTasksToGithub() {
  return useGithubMutation(async (ids: string[]) => (await execute(SendTasks, { ids })).sendTasksToGithub);
}
