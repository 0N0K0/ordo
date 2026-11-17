import { taskTitleSchema } from '@ordo/shared';
import { AddRowButton, AddRowField } from '../../../components/data-table/cells/AddRowField';
import { useCreateTask, useSetTasksClosed } from '../api';
import type { TaskContext } from '../hooks/use-task-context';
import type { NewTaskDefaults } from '../lib/new-task-defaults';

interface AddTaskRowProps {
  context: TaskContext;
  defaults: NewTaskDefaults;
  /** Project of new tasks when the group gives none; without it, the creation form opens. */
  projectId?: string;
  onOpenForm: (defaults: NewTaskDefaults) => void;
}

/**
 * Field of the add row at the end of the table or of a group: type a title and press Enter to add a task.
 * Without a project to create it in (home page), the row opens the creation form.
 * @param {AddTaskRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function AddTaskRow({ context, defaults, projectId, onOpenForm }: AddTaskRowProps) {
  const createTask = useCreateTask();
  const setClosed = useSetTasksClosed();
  const targetProject = defaults.projectId ?? projectId;
  const firstTodo = context.statuses.find((status) => status.category === 'TODO');
  if (!targetProject) return <AddRowButton label="Ajouter une tâche" onClick={() => onOpenForm(defaults)} />;
  const { closed, ...values } = defaults;
  return (
    <AddRowField
      label="Ajouter une tâche"
      schema={taskTitleSchema}
      onCreate={(title) =>
        createTask.mutateAsync({ statusId: firstTodo?.id ?? null, ...values, title, projectId: targetProject }).then((task) => {
          if (closed) setClosed.mutate({ ids: [task.id], closed: true });
        })
      }
    />
  );
}
