import { CloseButton, Group, Paper, Text } from '@mantine/core';
import { useEffect, useRef, type ReactNode } from 'react';
import { confirmDestructive } from '../../dialogs/confirm-destructive';
import classes from './SelectionBar.module.css';
import { ActionButton } from '../../actions/ActionButton';

/** Action on the rows selected that a column cannot do (close, duplicate, archive, delete…). */
export interface SelectionAction {
  label: string;
  icon: ReactNode;
  /** With `closeOnChange`, gives how to close what it opened. */
  onClick: () => unknown;
  /** What it opens (a side panel asking first, its `onClick` giving how to close it) closes when the selection changes. Optional. */
  closeOnChange?: boolean;
  /** Destructive: in red, after a confirmation telling its risks. Optional. */
  destructive?: { title: string; risks: ReactNode; confirmLabel?: string };
  /** In red, its own dialog confirming it (the deletion of tasks…). Optional. */
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

interface SelectionBarProps {
  /** Rows selected, told: "3 tâches sélectionnées". */
  label: string;
  actions: readonly SelectionAction[];
  onClear: () => void;
  /** Rows selected (their keys): what an action opened for them closes when it changes. Optional. */
  selectionKey?: string;
}

/**
 * Bar of the actions on the rows selected of a table, at the bottom of the window: only those its columns cannot do
 * (the fields are changed in the cells of the rows selected). The same bar on every table. What an action opened for
 * the rows selected (`closeOnChange`: a side panel asking first) closes when the selection changes, or when the bar
 * goes (no row selected): it would apply to other rows than those selected.
 * @param {SelectionBarProps} props Component props.
 * @returns {JSX.Element} Bar.
 */
export function SelectionBar({ label, actions, onClear, selectionKey }: SelectionBarProps) {
  const opened = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      opened.current?.();
      opened.current = null;
    },
    [selectionKey],
  );
  /**
   * Runs an action, keeping how to close what it opened.
   * @param {SelectionAction} action Action.
   * @returns {void}
   */
  const run = (action: SelectionAction) => {
    const close = action.onClick();
    if (action.closeOnChange && typeof close === 'function') opened.current = close as () => void;
  };
  return (
    <Paper shadow="md" withBorder radius="md" className={classes.bar} role="region" aria-label="Actions de la sélection">
      <Group gap="xs" wrap="wrap">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        {actions.map((action) =>
          action.destructive || action.danger ? (
            <ActionButton
              danger
              key={action.label}
              size="xs"
              icon={action.icon}
              loading={action.loading}
              disabled={action.disabled}
              onClick={() => (action.destructive ? confirmDestructive({ ...action.destructive, onConfirm: () => void action.onClick() }) : run(action))}
            >
              {action.label}
            </ActionButton>
          ) : (
            <ActionButton priority="secondary" key={action.label} size="xs" icon={action.icon} loading={action.loading} disabled={action.disabled} onClick={() => run(action)}>
              {action.label}
            </ActionButton>
          ),
        )}
        <CloseButton aria-label="Désélectionner" onClick={onClear} />
      </Group>
    </Paper>
  );
}
