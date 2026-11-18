import { CommentThread } from '../../../components/comments/CommentThread';
import { threadActions } from '../../../components/comments/thread-actions';
import { useTaskCommentMutations, useTaskComments, type Task } from '../api';
import type { TaskContext } from '../hooks/use-task-context';

interface TaskCommentsProps {
  task: Task;
  context: TaskContext;
}

/**
 * Comment thread of a task (the shared thread, on the task comments), read only on an archived task.
 * @param {TaskCommentsProps} props Component props.
 * @returns {JSX.Element} Thread.
 */
export function TaskComments({ task, context }: TaskCommentsProps) {
  const comments = useTaskComments(task.id);
  const mutations = useTaskCommentMutations();
  return (
    <CommentThread
      comments={comments.data}
      loading={comments.isPending}
      suggestions={context.suggestionsFor(task.projectId)}
      targets={context.targetsFor(task.projectId)}
      actions={threadActions(mutations, { add: (body) => ({ taskId: task.id, body }), remove: (id) => ({ id }) })}
      readOnly={task.archived}
    />
  );
}
