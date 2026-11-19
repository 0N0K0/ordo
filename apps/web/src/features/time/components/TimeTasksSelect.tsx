import type { MultiSelectProps } from '@mantine/core';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { timeTaskOptions, timeTasks } from '../lib/time-tasks';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { treeSelectProps } from '../../../components/tree/tree-select';

interface TimeTasksSelectProps extends Omit<MultiSelectProps, 'data' | 'value' | 'onChange'> {
  context: TaskContext;
  projectId: string | null;
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Tasks a time is spent on: tasks of the project and its sub-projects ("#12 Title"); the time is shared
 * equally between them.
 * @param {TimeTasksSelectProps} props Component props.
 * @returns {JSX.Element} Multi-select.
 */
export function TimeTasksSelect({ context, projectId, value, onChange, ...props }: TimeTasksSelectProps) {
  const tasks = timeTasks(context, projectId, value);
  return (
    <BatchMultiSelect
      label="Tâches"
      description={value.length > 1 ? `Le temps est réparti à parts égales entre les ${value.length} tâches.` : undefined}
      placeholder={value.length ? undefined : projectId ? 'Aucune' : 'Choisissez d’abord un projet'}
      disabled={!projectId}
      // As their tree (sub-tasks under their parent), the closed ones told.
      {...treeSelectProps(timeTaskOptions(context, tasks))}
      value={value}
      onChange={onChange}
      searchable
      clearable
      nothingFoundMessage="Aucune tâche"
      {...props}
    />
  );
}
