import { z } from 'zod';

/** Settings of the link of a project with a GitHub board: the fields synced, their options, what is pushed. */
// A type (not an interface): a form's values (`useAppForm`) are a record.
export type GithubLinkInput = {
  url: string;
  statusFieldId: string | null;
  priorityFieldId: string | null;
  iterationFieldId: string | null;
  startFieldId: string | null;
  endFieldId: string | null;
  effortFieldId: string | null;
  deadlineFieldId: string | null;
  timeSpentFieldId: string | null;
  /** FIELD (typeFieldId), ISSUE_TYPE (issue types of the organization) or null. */
  typeSource: 'FIELD' | 'ISSUE_TYPE' | null;
  typeFieldId: string | null;
  /** { [ordoStatusId]: optionId } */
  statusOptions: Record<string, string>;
  priorityOptions: Record<string, string>;
  /** { [ordoTypeId]: optionId or issue type id } */
  typeOptions: Record<string, string>;
  syncAssignees: boolean;
  syncLabels: boolean;
  /** "owner/name", or null for draft issues. */
  repositoryName: string | null;
  pushExisting: boolean;
  enabled: boolean;
  /** Sprints written as iterations on GitHub (off: iterations only read and paired). */
  writeIterations: boolean;
};

/**
 * A failed call to GitHub: no answer (network, time out), or its HTTP status (with, for a 403, whether GitHub says the
 * rate limit is reached) and the types of its GraphQL errors.
 */
export interface GithubFailure {
  network?: boolean;
  status?: number;
  rateLimited?: boolean;
  graphqlTypes?: readonly string[];
}

/**
 * Whether a failed call to GitHub stops the whole synchronization (every other call would fail the same way) rather
 * than only the task being synchronized: GitHub out of reach, the token refused (401), the rate limit reached (429, a
 * 403 saying so, or a GraphQL `RATE_LIMITED` error), the token without the scopes needed (`INSUFFICIENT_SCOPES`). Any
 * other failure concerns one task: a value refused, an issue gone, a right missing on one repository or issue
 * (`FORBIDDEN`, another 403).
 * @param {GithubFailure} failure Failure.
 * @returns {boolean} The synchronization stops.
 */
export function stopsGithubSync({ network = false, status, rateLimited = false, graphqlTypes = [] }: GithubFailure): boolean {
  if (network || status === 401 || status === 429 || (status === 403 && rateLimited)) return true;
  return graphqlTypes.some((type) => type === 'INSUFFICIENT_SCOPES' || type === 'RATE_LIMITED');
}

/**
 * Whether a failed call to GitHub says that what it names no longer exists (an issue deleted, or moved where the token
 * cannot see it): a GraphQL `NOT_FOUND` error.
 * @param {GithubFailure} failure Failure.
 * @returns {boolean} Gone on GitHub.
 */
export function goneOnGithub({ graphqlTypes = [] }: GithubFailure): boolean {
  return graphqlTypes.includes('NOT_FOUND');
}

/** Error under the repository of a link not written « compte/dépôt ». */
export const REPOSITORY_FORMAT_ERROR = 'Forme attendue : compte/dépôt.';

/** Settings of a link as its form checks them: a repository written « compte/dépôt » (the rest is chosen from the board). */
export const githubLinkFormSchema = z.object({
  repositoryName: z
    .string()
    .nullable()
    .refine((name) => !name?.trim() || /^[^/\s]+\/[^/\s]+$/.test(name.trim()), REPOSITORY_FORMAT_ERROR),
});
