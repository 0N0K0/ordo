import { ActionIcon, Tooltip } from '@mantine/core';
import { CheckCircleIcon, CircleIcon } from '@phosphor-icons/react';
import classes from './Routines.module.css';

interface DoneToggleProps {
  title: string;
  done: boolean;
  /** Date of the current occurrence (none: not started yet, nothing to tick). */
  date: string | null;
  /** Its date, as shown in the tooltip ("lun. 10 nov."). */
  dateLabel?: string;
  disabled?: boolean;
  onChange: (done: boolean) => void;
}

/**
 * Round toggle marking the current occurrence of a routine as done (a circle, then a filled green check): distinct
 * from the square checkboxes selecting rows.
 * @param {DoneToggleProps} props Component props.
 * @returns {JSX.Element} Toggle.
 */
export function DoneToggle({ title, done, date, dateLabel, disabled = false, onChange }: DoneToggleProps) {
  const label = !date ? 'Pas encore commencée' : done ? 'Marquer comme à faire' : dateLabel ? `Marquer comme faite (${dateLabel})` : 'Marquer comme faite';
  return (
    <Tooltip label={label}>
      <ActionIcon
        variant={done ? 'light' : 'subtle'}
        color={done ? 'green' : 'gray'}
        radius="xl"
        size="sm"
        className={classes.doneToggle}
        data-done={done || undefined}
        aria-label={`${title} faite`}
        aria-pressed={done}
        disabled={disabled || !date}
        onClick={() => onChange(!done)}
      >
        {done ? <CheckCircleIcon weight="fill" aria-hidden /> : <CircleIcon aria-hidden />}
      </ActionIcon>
    </Tooltip>
  );
}
