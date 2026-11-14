import { CommentThread } from '../../components/comments/CommentThread';
import { notifyError } from '../../lib/notify';
import { useTaskCommentMutations, useTaskComments, type Task } from './api';
import type { TaskContext } from './use-task-context';

interface TaskCommentsProps {
  task: Task;
  context: TaskContext;
}

/**
 * Comment thread of a task (the shared thread, on the task comments).
 * @param {TaskCommentsProps} props Component props.
 * @returns {JSX.Element} Thread.
 */
export function TaskComments({ task, context }: TaskCommentsProps) {
  const comments = useTaskComments(task.id);
  const { add, update, remove } = useTaskCommentMutations();
  const onError = { onError: (error: Error) => notifyError(error.message) };
  return (
    <CommentThread
      comments={comments.data}
      loading={comments.isPending}
      suggestions={context.suggestionsFor(task.projectId)}
      targets={context.targetsFor(task.projectId)}
      actions={{
        add: (body, done) => add.mutate({ taskId: task.id, body }, { onSuccess: done, ...onError }),
        update: (id, body, done) => update.mutate({ id, body }, { onSuccess: done, ...onError }),
        remove: (id) => remove.mutate({ id }, onError),
        adding: add.isPending,
        updating: update.isPending,
      }}
    />
  );
}
