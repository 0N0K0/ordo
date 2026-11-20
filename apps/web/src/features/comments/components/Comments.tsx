import { NO_SUGGESTIONS, NO_TARGETS } from '../../../components/markdown/remark-references';
import { SubSection } from '../../../components/page/SubSection';
import { CommentThread } from '../../../components/comments/CommentThread';
import { threadActions } from '../../../components/comments/thread-actions';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useCommentMutations, useComments, type CommentTarget } from '../api';

interface CommentsProps {
  target: CommentTarget;
  /** Item (Message-ID for a mail). */
  id: string;
  /** Occurrence of a routine or a recurring event whose comments these are (decision D19); none: a one-off event or another item. Optional. */
  occurrenceDate?: string | null;
  /** Project of the item: « #12 » is task 12 of it. Optional. */
  projectId?: string | null;
  /** Heading above the thread. Optional. Default = « Commentaires ». */
  title?: string | null;
  /** An archived item: its comments shown only (the API refuses changes). Optional. Default = false. */
  readOnly?: boolean;
}

/**
 * Comments of an item (routine, event, document, mail…), of one occurrence for a routine or an event: the shared thread,
 * under its heading (read only on an archived item).
 * @param {CommentsProps} props Component props.
 * @returns {JSX.Element} Comments.
 */
export function Comments({ target, id, occurrenceDate = null, projectId = null, title = 'Commentaires', readOnly = false }: CommentsProps) {
  const { context } = useTaskContext();
  const comments = useComments(target, id, occurrenceDate);
  const mutations = useCommentMutations();
  const thread = (
    <CommentThread
      comments={comments.data}
      loading={comments.isPending}
      suggestions={context?.suggestionsFor(projectId) ?? { ...NO_SUGGESTIONS, projectId }}
      targets={context?.targetsFor(projectId) ?? { ...NO_TARGETS, projectId }}
      actions={threadActions(mutations, { add: (body) => ({ target, id, body, occurrenceDate }), remove: (commentId) => commentId })}
      readOnly={readOnly}
    />
  );
  return title ? (
    <SubSection title={title} gap="xs">
      {thread}
    </SubSection>
  ) : (
    thread
  );
}
