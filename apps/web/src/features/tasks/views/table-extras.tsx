import { Text, TextInput, UnstyledButton } from '@mantine/core';
import { taskTitleSchema } from '@ordo/shared';
import { PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError } from '../../../lib/notify';
import { useCreateTask, useSetTasksClosed } from '../api';
import type { TaskContext } from '../use-task-context';
import type { NewTaskDefaults } from './new-task-defaults';
import classes from './table-extras.module.css';

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
  const [title, setTitle] = useState('');
  const targetProject = defaults.projectId ?? projectId;
  const firstTodo = context.statuses.find((status) => status.category === 'TODO');

  /**
   * Creates the typed task.
   * @returns {void}
   */
  const submit = () => {
    const result = taskTitleSchema.safeParse(title);
    if (!result.success || !targetProject) return;
    const { closed, ...values } = defaults;
    createTask.mutate(
      { statusId: firstTodo?.id ?? null, ...values, title: result.data, projectId: targetProject },
      {
        onSuccess: (task) => {
          setTitle('');
          if (closed) setClosed.mutate({ ids: [task.id], closed: true });
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  return (
    <>
      {targetProject ? (
        <TextInput
          variant="unstyled"
          size="xs"
          classNames={{ input: classes.addInput }}
          leftSection={<PlusIcon aria-hidden />}
          placeholder="Ajouter une tâche (Entrée pour valider)"
          aria-label="Titre de la nouvelle tâche"
          value={title}
          disabled={createTask.isPending}
          onChange={(event) => setTitle(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') setTitle('');
          }}
        />
      ) : (
        <UnstyledButton className={classes.addButton} onClick={() => onOpenForm(defaults)}>
          <PlusIcon aria-hidden />
          <Text span size="sm">
            Ajouter une tâche
          </Text>
        </UnstyledButton>
      )}
    </>
  );
}
