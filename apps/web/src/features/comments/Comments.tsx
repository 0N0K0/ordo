import { Stack, Text } from '@mantine/core';
import { CommentThread } from '../../components/comments/CommentThread';
import { notifyError } from '../../lib/notify';
import { useTaskContext } from '../tasks/use-task-context';
import { useCommentMutations, useComments, type CommentTarget } from './api';

interface CommentsProps {
  target: CommentTarget;
  /** Item (Message-ID for a mail). */
  id: string;
  /** Project of the item: « #12 » is task 12 of it. Optional. */
  projectId?: string | null;
  /** Heading above the thread. Optional. Default = « Commentaires ». */
  title?: string | null;
}

/**
 * Comments of an item (routine, event, document, mail…): the shared thread, under its heading.
 * @param {CommentsProps} props Component props.
 * @returns {JSX.Element} Comments.
 */
export function Comments({ target, id, projectId = null, title = 'Commentaires' }: CommentsProps) {
  const { context } = useTaskContext();
  const comments = useComments(target, id);
  const { add, update, remove } = useCommentMutations();
  const onError = { onError: (error: Error) => notifyError(error.message) };
  const empty = { projectId, tasks: [], contributors: [] };
  return (
    <Stack gap="xs">
      {title && (
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          {title}
        </Text>
      )}
      <CommentThread
        comments={comments.data}
        loading={comments.isPending}
        suggestions={context?.suggestionsFor(projectId) ?? empty}
        targets={context?.targetsFor(projectId) ?? { projectId, taskById: new Map(), taskByNumber: new Map(), handles: new Set() }}
        actions={{
          add: (body, done) => add.mutate({ target, id, body }, { onSuccess: done, ...onError }),
          update: (commentId, body, done) => update.mutate({ id: commentId, body }, { onSuccess: done, ...onError }),
          remove: (commentId) => remove.mutate(commentId, onError),
          adding: add.isPending,
          updating: update.isPending,
        }}
      />
    </Stack>
  );
}
