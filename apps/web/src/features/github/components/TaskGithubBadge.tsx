import { Badge, Tooltip } from '@mantine/core';
import { GithubLogoIcon } from '@phosphor-icons/react';
import { GITHUB_TASK_STATE_LABELS } from '@ordo/shared';
import type { Task } from '../../tasks/api';
import { EXTERNAL_LINK } from '../../../components/actions/link-props';
import { GITHUB_STATE_COLORS, githubStateHint } from '../lib/task-github-state';

/**
 * GitHub badge of a task of a project tree linked to a board (nothing outside one): on GitHub (« GitHub #n », a link
 * to its issue, or « Brouillon GitHub »), « Pas sur GitHub », or « Retirée du tableau GitHub », with what it means on
 * hover (`githubStateHint`: and what sends it, now or once restored).
 * @param {{ task: Task }} props Task.
 * @returns {JSX.Element | null} Badge.
 */
export function TaskGithubBadge({ task }: { task: Task }) {
  if (!task.githubState) return null;
  if (task.githubState === 'SYNCED')
    return (
      <Badge variant="light" color="dark" leftSection={<GithubLogoIcon aria-hidden />} {...(task.githubUrl ? { component: 'a' as const, href: task.githubUrl, ...EXTERNAL_LINK } : {})}>
        {task.githubNumber ? `GitHub #${task.githubNumber}` : 'Brouillon GitHub'}
      </Badge>
    );
  return (
    <Tooltip label={githubStateHint({ ...task, githubState: task.githubState })} multiline w={280}>
      <Badge variant="light" color={GITHUB_STATE_COLORS[task.githubState]} leftSection={<GithubLogoIcon aria-hidden />}>
        {GITHUB_TASK_STATE_LABELS[task.githubState]}
      </Badge>
    </Tooltip>
  );
}
