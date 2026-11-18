import { ActionButton } from '../../../components/actions/ActionButton';
import { Group, Tooltip } from '@mantine/core';
import { PlayIcon, PlusIcon } from '@phosphor-icons/react';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useRunningTimer } from '../api';
import { openTimerForm } from '../lib/open-timer-form';

interface TimeLogActionsProps {
  context: TaskContext | null | undefined;
  /** Opens the form of a new time. */
  onNew: () => void;
  /** Project of the timer started. Optional. */
  projectId?: string;
  /** Archived project: no new time, no timer. Optional. */
  archived?: boolean;
}

/**
 * Actions of a list of times: « Nouveau temps » (time added by hand) and « Lancer un chrono » (one timer runs at a
 * time: disabled while one runs, it shows in the top bar).
 * @param {TimeLogActionsProps} props Component props.
 * @returns {JSX.Element} Actions.
 */
export function TimeLogActions({ context, onNew, projectId, archived = false }: TimeLogActionsProps) {
  const running = useRunningTimer();
  return (
    <Group gap="sm" wrap="nowrap">
      <ActionButton priority="secondary" icon={<PlusIcon aria-hidden />} onClick={onNew} disabled={!context || archived}>
        Nouveau temps
      </ActionButton>
      {!archived && (
        <Tooltip label="Un chrono tourne déjà" disabled={!running.data}>
          <ActionButton icon={<PlayIcon aria-hidden />} onClick={() => context && openTimerForm(context, projectId)} disabled={!context || Boolean(running.data)}>
            Lancer un chrono
          </ActionButton>
        </Tooltip>
      )}
    </Group>
  );
}
