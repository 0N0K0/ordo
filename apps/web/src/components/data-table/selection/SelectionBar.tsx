import { CloseButton, Group, Paper, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { confirmDestructive } from '../../dialogs/confirm-destructive';
import classes from './SelectionBar.module.css';
import { ActionButton } from '../../actions/ActionButton';

/** Action on the rows selected that a column cannot do (close, clone, archive, delete…). */
export interface SelectionAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
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
}

/**
 * Bar of the actions on the rows selected of a table, at the bottom of the window: only those its columns cannot do
 * (the fields are changed in the cells of the rows selected). The same bar on every table.
 * @param {SelectionBarProps} props Component props.
 * @returns {JSX.Element} Bar.
 */
export function SelectionBar({ label, actions, onClear }: SelectionBarProps) {
  return (
    <Paper shadow="md" withBorder radius="md" className={classes.bar} role="region" aria-label="Actions de la sélection">
      <Group gap="xs" wrap="wrap">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        {actions.map((action) =>
          action.destructive || action.danger ? (
            <ActionButton
              priority="secondary"
              danger
              key={action.label}
              size="xs"
              icon={action.icon}
              loading={action.loading}
              disabled={action.disabled}
              onClick={() => (action.destructive ? confirmDestructive({ ...action.destructive, onConfirm: action.onClick }) : action.onClick())}
            >
              {action.label}
            </ActionButton>
          ) : (
            <ActionButton priority="secondary" key={action.label} size="xs" icon={action.icon} loading={action.loading} disabled={action.disabled} onClick={action.onClick}>
              {action.label}
            </ActionButton>
          ),
        )}
        <CloseButton aria-label="Désélectionner" onClick={onClear} />
      </Group>
    </Paper>
  );
}
