import { ProhibitIcon } from '@phosphor-icons/react';
import { StateButton } from '../../../components/data-table/cells/StateButton';
import { DONE_STATES, type YesNoStates } from '../../../components/data-table/table/data-table';
import type { Task } from '../api';
import { useTaskRowsActions } from './BulkBar';
import type { TaskContext } from '../hooks/use-task-context';

/** States of a cancelled task on its state button: « Annulée », the gray crossed circle of its state icon (`TaskStateIcon`). */
const TASK_CANCELLED_STATES: YesNoStates = {
  ...DONE_STATES,
  labels: { ...DONE_STATES.labels, yes: 'Annulée' },
  icons: { yes: { icon: ProhibitIcon, tone: 'neutral' } },
};

interface TaskDoneButtonProps {
  task: Task;
  context: TaskContext | null;
  /** Size of the button (`StateButton`). Optional. Default = « sm ». */
  size?: 'xs' | 'sm' | 'md';
}

/**
 * State button of a task in a row: « À faire » (an empty gray round) or « Faite » (a green check), a cancelled one
 * « Annulée » (a gray crossed circle); one click closes it as done or reopens it (« Fermer » / « Rouvrir » of its menu
 * and of the selection: told in a toast with « Annuler », `close` of `useTaskRowsActions`, as `useTaskActions().close`). An archived task is shown only.
 * @param {TaskDoneButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function TaskDoneButton({ task, context, size }: TaskDoneButtonProps) {
  const close = useTaskRowsActions(context)([task]).close;
  const states = task.closed && task.cancelled ? TASK_CANCELLED_STATES : DONE_STATES;
  return (
    <StateButton
      {...states}
      value={task.closed}
      label={task.label}
      size={size}
      readOnly={task.archived || Boolean(close.disabled)}
      loading={close.loading}
      onChange={() => void close.onClick()}
    />
  );
}
