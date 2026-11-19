import { ActionButton } from '../../../components/actions/ActionButton';
import { Group } from '@mantine/core';
import { PlayIcon, PlusIcon } from '@phosphor-icons/react';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { openTimerForm } from '../lib/open-timer-form';
import { useTimerHint } from '../hooks/use-start-timer';

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
 * Actions of a list of times: « Nouveau temps » (time added by hand) and « Démarrer le chrono » (one timer runs at a
 * time: the running one stops, decision Y).
 * @param {TimeLogActionsProps} props Component props.
 * @returns {JSX.Element} Actions.
 */
export function TimeLogActions({ context, onNew, projectId, archived = false }: TimeLogActionsProps) {
  const timerHint = useTimerHint();
  return (
    <Group gap="sm" wrap="nowrap">
      <ActionButton priority="secondary" icon={<PlusIcon aria-hidden />} onClick={onNew} disabled={!context || archived}>
        Nouveau temps
      </ActionButton>
      {/* Archived: greyed out, as everywhere (read only). */}
      <ActionButton
        priority="secondary"
        icon={<PlayIcon aria-hidden />}
        hint={timerHint(!context || archived)}
        onClick={() => context && openTimerForm(context, projectId)}
        disabled={!context || archived}
      >
        Démarrer le chrono
      </ActionButton>
    </Group>
  );
}
