import { GITHUB_TASK_STATE_LABELS, GITHUB_TASK_STATES, type GithubTaskState } from '@ordo/shared';
import { FEEDBACK_COLORS } from '../../../components/feedback/feedback-colors';
import type { ColumnState } from '../../../components/data-table/table/state-column';

/** Colour of the badge of each GitHub state of a task: on GitHub green, not on GitHub gray, removed from the board orange. */
export const GITHUB_STATE_COLORS: Record<GithubTaskState, string> = { SYNCED: FEEDBACK_COLORS.success, NOT_SENT: 'gray', REMOVED: FEEDBACK_COLORS.warning };

/** What a task not on GitHub means, on hover of its badge. */
export const GITHUB_STATE_HINTS: Record<Exclude<GithubTaskState, 'SYNCED'>, string> = {
  NOT_SENT: 'Pas sur GitHub : créée avant la liaison (sans « Envoyer aussi les tâches qui existaient avant la liaison »), ou en attente de la prochaine synchronisation.',
  REMOVED: 'Retirée du tableau GitHub : la synchronisation ne la renvoie plus.',
};

/** What sends a task not on GitHub, added to its hint when it can be sent. */
export const GITHUB_SEND_HINT = '« Envoyer sur GitHub », dans le menu de la tâche, l’y envoie maintenant.';

/** What sends an archived task removed from the board again, added to its hint. */
export const GITHUB_RESTORE_HINT = 'Restaurée, « Envoyer sur GitHub » (menu de la tâche) l’y renvoie.';

/**
 * Hint of the badge of a task not on GitHub: what its state means, then what sends it (now, or once restored).
 * @param {{ githubState: Exclude<GithubTaskState, 'SYNCED'>, githubSendable: boolean, archived: boolean }} task Task.
 * @returns {string} Hint.
 */
export function githubStateHint(task: { githubState: Exclude<GithubTaskState, 'SYNCED'>; githubSendable: boolean; archived: boolean }): string {
  const next = task.githubSendable ? GITHUB_SEND_HINT : task.archived && task.githubState === 'REMOVED' ? GITHUB_RESTORE_HINT : null;
  return next ? `${GITHUB_STATE_HINTS[task.githubState]} ${next}` : GITHUB_STATE_HINTS[task.githubState];
}

/** GitHub states of a task, as the states of its column (« GitHub »). */
export const GITHUB_STATE_BADGES: ColumnState<GithubTaskState>[] = GITHUB_TASK_STATES.map((id) => ({ id, label: GITHUB_TASK_STATE_LABELS[id], color: GITHUB_STATE_COLORS[id] }));
