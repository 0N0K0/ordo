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
  const mutations = useCommentMutations();
  const thread = (
    <CommentThread
      comments={comments.data}
      loading={comments.isPending}
      suggestions={context?.suggestionsFor(projectId) ?? { ...NO_SUGGESTIONS, projectId }}
      targets={context?.targetsFor(projectId) ?? { ...NO_TARGETS, projectId }}
      actions={threadActions(mutations, { add: (body) => ({ target, id, body }), remove: (commentId) => commentId })}
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
