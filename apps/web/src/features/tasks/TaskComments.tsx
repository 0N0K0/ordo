import { ActionIcon, Button, Group, Menu, Paper, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { DotsThreeIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../components/markdown/MarkdownView';
import { notifyError } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useTaskCommentMutations, useTaskComments, type Task, type TaskComment } from './api';
import type { TaskContext } from './use-task-context';

const absolute = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * "il y a 3 heures", "hier"…
 * @param {string} date ISO instant.
 * @returns {string} Relative time.
 */
function fromNow(date: string): string {
  const seconds = (Date.parse(date) - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'à l’instant';
}

interface CommentProps {
  comment: TaskComment;
  context: TaskContext;
}

/**
 * One comment, editable in place.
 * @param {CommentProps} props Component props.
 * @returns {JSX.Element} Comment.
 */
function Comment({ comment, context }: CommentProps) {
  const { update, remove } = useTaskCommentMutations();
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * Saves the edited comment.
   * @returns {void}
   */
  const save = () => {
    if (draft === null || !draft.trim()) return;
    update.mutate({ id: comment.id, body: draft }, { onSuccess: () => setDraft(null), onError: (e) => notifyError(e.message) });
  };

  /**
   * Asks for confirmation, then deletes the comment.
   * @returns {void}
   */
  const confirmDelete = () => {
    const modalId = `delete-comment-${comment.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le commentaire',
      children: (
        <Stack gap="md">
          <Text size="sm">Le commentaire sera supprimé définitivement. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate({ id: comment.id }, { onError: (e) => notifyError(e.message) });
            }}
          />
        </Stack>
      ),
    });
  };

  return (
    <Paper withBorder radius="md">
      <Group justify="space-between" px="sm" py={6} bg="var(--mantine-color-default-hover)" style={{ borderRadius: 'var(--mantine-radius-md) var(--mantine-radius-md) 0 0' }}>
        <Tooltip label={absolute.format(new Date(comment.createdAt))}>
          <Text size="xs" c="dimmed" component="time" dateTime={comment.createdAt}>
            {fromNow(comment.createdAt)}
          </Text>
        </Tooltip>
        {draft === null && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Actions sur le commentaire">
                <DotsThreeIcon weight="bold" aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => setDraft(comment.body)}>
                Modifier
              </Menu.Item>
              <Menu.Item leftSection={<TrashIcon aria-hidden />} color="red" onClick={confirmDelete}>
                Supprimer
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      <div style={{ padding: 'var(--mantine-spacing-sm)' }}>
        {draft === null ? (
          <MarkdownView targets={context.targets}>{comment.body}</MarkdownView>
        ) : (
          <Stack gap="xs">
            <MarkdownEditor
              value={draft}
              onChange={setDraft}
              suggestions={context.suggestions}
              minRows={3}
              autoFocus
              onSubmitShortcut={save}
            />
            <Group justify="flex-end" gap="xs">
              <Button variant="default" size="xs" onClick={() => setDraft(null)}>
                Annuler
              </Button>
              <Button size="xs" onClick={save} loading={update.isPending} disabled={!draft.trim()}>
                Enregistrer
              </Button>
            </Group>
          </Stack>
        )}
      </div>
    </Paper>
  );
}

interface TaskCommentsProps {
  task: Task;
  context: TaskContext;
}

/**
 * Comment thread of a task, with the new comment editor at the bottom.
 * @param {TaskCommentsProps} props Component props.
 * @returns {JSX.Element} Thread.
 */
export function TaskComments({ task, context }: TaskCommentsProps) {
  const comments = useTaskComments(task.number);
  const { add } = useTaskCommentMutations();
  const [body, setBody] = useState('');

  /**
   * Posts the new comment.
   * @returns {void}
   */
  const submit = () => {
    if (!body.trim()) return;
    add.mutate(
      { taskId: task.id, body },
      { onSuccess: () => setBody(''), onError: (error) => notifyError(error.message) },
    );
  };

  return (
    <Stack gap="sm">
      {comments.isPending ? (
        <Skeleton height={80} radius="md" />
      ) : (
        comments.data?.map((comment) => <Comment key={comment.id} comment={comment} context={context} />)
      )}
      <MarkdownEditor
        label="Ajouter un commentaire"
        value={body}
        onChange={setBody}
        suggestions={context.suggestions}
        minRows={3}
        placeholder="Écrivez un commentaire…"
        onSubmitShortcut={submit}
      />
      <Group justify="flex-end">
        <Button onClick={submit} loading={add.isPending} disabled={!body.trim()}>
          Commenter
        </Button>
      </Group>
    </Stack>
  );
}
