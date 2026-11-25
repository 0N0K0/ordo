import { z } from 'zod';
import type { TaskCloseReason } from './task-columns';
import { REMOVED_FROM_BOARD } from './github-merge';

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

/**
 * How the issue of a task deleted in Ordo (or turned into a routine) is closed on GitHub: not at all when it is already
 * closed there (its last synced state, `closed` of the snapshot; a done issue stays done); closed as the task was when
 * the task is closed (done or cancelled); else as not planned (the task is gone).
 * @param {{ closedAt: Date | null, closeReason: TaskCloseReason | null, snapshot: unknown }} task Task.
 * @returns {TaskCloseReason | null} State reason to close it with (null: left as it is).
 */
export function goneIssueCloseReason(task: { closedAt: Date | null; closeReason: TaskCloseReason | null; snapshot: unknown }): TaskCloseReason | null {
  const snapshot = task.snapshot && typeof task.snapshot === 'object' ? (task.snapshot as { closed?: unknown }) : null;
  if (snapshot?.closed) return null;
  if (task.closedAt) return task.closeReason ?? 'COMPLETED';
  return 'NOT_PLANNED';
}

/**
 * Where a task of a project tree linked to a GitHub board stands: on the board (`SYNCED`), not on GitHub (`NOT_SENT`:
 * never sent, created before the link without « Envoyer aussi les tâches qui existaient avant la liaison », or waiting
 * for the next sync), or removed from the board (`REMOVED`: not sent again by the sync).
 */
export const GITHUB_TASK_STATES = ['SYNCED', 'NOT_SENT', 'REMOVED'] as const;
export type GithubTaskState = (typeof GITHUB_TASK_STATES)[number];

/** Names of the GitHub states of a task (its badge, its column). */
export const GITHUB_TASK_STATE_LABELS: Record<GithubTaskState, string> = {
  SYNCED: 'Sur GitHub',
  NOT_SENT: 'Pas sur GitHub',
  REMOVED: 'Retirée du tableau GitHub',
};

/**
 * GitHub state of a task: none outside a project tree linked to a board.
 * @param {{ githubItemId: string | null, githubContentType: string | null }} task Task.
 * @param {boolean} linked Its project tree is linked to a board.
 * @returns {GithubTaskState | null} State.
 */
export function githubTaskState(task: { githubItemId: string | null; githubContentType: string | null }, linked: boolean): GithubTaskState | null {
  if (!linked) return null;
  if (task.githubItemId) return 'SYNCED';
  return task.githubContentType === REMOVED_FROM_BOARD ? 'REMOVED' : 'NOT_SENT';
}

/** Error of any GitHub action without a connection. */
export const GITHUB_NOT_CONNECTED = 'Connectez d’abord GitHub (Paramètres › GitHub).';

/** Why « Envoyer sur GitHub » is refused for a task. */
export const GITHUB_SEND_REFUSALS = {
  unlinked: 'Le projet de cette tâche n’est lié à aucun tableau GitHub.',
  synced: 'Cette tâche est déjà sur GitHub.',
  archived: 'Une tâche archivée n’est pas envoyée sur GitHub : restaurez-la d’abord.',
  disabled: 'La synchronisation automatique de ce projet avec GitHub est désactivée : activez-la dans Projet › Paramètres › GitHub.',
  disconnected: GITHUB_NOT_CONNECTED,
} as const;

/**
 * Why a task cannot be sent to GitHub on request (« Envoyer sur GitHub »), or null when it can: its project tree linked
 * to a board whose sync is enabled, GitHub connected, the task active and not on GitHub (never sent, created before the
 * link, or removed from the board).
 * @param {{ archived: boolean, state: GithubTaskState | null }} task Task, with its GitHub state.
 * @param {{ enabled: boolean } | null} link Link of its project tree.
 * @param {boolean} connected GitHub is connected.
 * @returns {string | null} Refusal, or null.
 */
export function githubSendRefusal(task: { archived: boolean; state: GithubTaskState | null }, link: { enabled: boolean } | null, connected: boolean): string | null {
  if (!link || task.state === null) return GITHUB_SEND_REFUSALS.unlinked;
  if (task.state === 'SYNCED') return GITHUB_SEND_REFUSALS.synced;
  if (task.archived) return GITHUB_SEND_REFUSALS.archived;
  if (!link.enabled) return GITHUB_SEND_REFUSALS.disabled;
  if (!connected) return GITHUB_SEND_REFUSALS.disconnected;
  return null;
}
