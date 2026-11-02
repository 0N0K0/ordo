import { Table, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { taskTitleSchema } from '@ordo/shared';
import { PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError } from '../../../lib/notify';
import { useCreateTask, useSetTasksClosed } from '../api';
import type { TaskContext } from '../use-task-context';
import type { NewTaskDefaults } from './new-task-defaults';
import classes from './table-extras.module.css';

interface AddTaskRowProps {
  /** Number of visible columns, the select column included. */
  columnCount: number;
  /** Index of the title column among the visible ones. */
  titleIndex: number;
  context: TaskContext;
  defaults: NewTaskDefaults;
  /** Project of new tasks when the group gives none; without it, the creation form opens. */
  projectId?: string;
  onOpenForm: (defaults: NewTaskDefaults) => void;
}

/**
 * Empty row at the end of the table or of a group: type a title and press Enter to add a task.
 * Without a project to create it in (home page), the row opens the creation form.
 * @param {AddTaskRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function AddTaskRow({ columnCount, titleIndex, context, defaults, projectId, onOpenForm }: AddTaskRowProps) {
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

  const cells = Array.from({ length: columnCount }, (_, index) => {
    if (index !== titleIndex) return <Table.Td key={index} />;
    return (
      <Table.Td key={index}>
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
      </Table.Td>
    );
  });

  return <Table.Tr className={classes.addRow}>{cells}</Table.Tr>;
}

const effortFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

interface SummaryRowProps {
  columnCount: number;
  titleIndex: number;
  /** Index of the effort column among the visible ones, or -1 when hidden. */
  effortIndex: number;
  /** Tasks counted (without sub-tasks) and their total effort. */
  count: number;
  effort: number;
  /** Footer of the whole table (in a tfoot) rather than of a group. */
  total?: boolean;
}

/**
 * Footer row of the table or of a group: number of tasks without sub-tasks and their total effort
 * (parents are left out so their effort is not counted twice).
 * @param {SummaryRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function SummaryRow({ columnCount, titleIndex, effortIndex, count, effort, total }: SummaryRowProps) {
  const cells = Array.from({ length: columnCount }, (_, index) => {
    if (index === titleIndex) {
      return (
        <Table.Td key={index}>
          <Tooltip label="Tâches sans sous-tâche" withArrow>
            <Text span size="xs" c="dimmed" fw={total ? 700 : 600}>
              {total ? 'Total : ' : ''}
              {count} tâche{count > 1 ? 's' : ''}
            </Text>
          </Tooltip>
        </Table.Td>
      );
    }
    if (index === effortIndex) {
      return (
        <Table.Td key={index}>
          <Text span size="xs" c="dimmed" fw={total ? 700 : 600}>
            {effortFormat.format(effort)}
          </Text>
        </Table.Td>
      );
    }
    return <Table.Td key={index} />;
  });
  return (
    <Table.Tr className={total ? classes.totalRow : classes.summaryRow} aria-label={total ? 'Total' : 'Sous-total du groupe'}>
      {cells}
    </Table.Tr>
  );
}
