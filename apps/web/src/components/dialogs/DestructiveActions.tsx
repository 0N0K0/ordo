import { Button, Group, type ButtonProps } from '@mantine/core';
import type { ComponentPropsWithoutRef } from 'react';

interface DestructiveActionsProps {
  onConfirm: () => void;
  onCancel: () => void;
  /** The action runs (its button waits). Optional. Default = false. */
  loading?: boolean;
  /** Label of the confirmation (« Supprimer », « Retirer »…). Optional. Default = « Supprimer ». */
  confirmLabel?: string;
}

/**
 * Buttons of every destructive dialog, bottom-right: the confirmation first (in red), then Cancel.
 * @param {DestructiveActionsProps} props Component props.
 * @returns {JSX.Element} Buttons.
 */
export function DestructiveActions({ onConfirm, onCancel, loading = false, confirmLabel = 'Supprimer' }: DestructiveActionsProps) {
  return (
    <Group justify="flex-end" gap="sm">
      <Button color="red" onClick={onConfirm} loading={loading} data-autofocus>
        {confirmLabel}
      </Button>
      <Button variant="default" onClick={onCancel}>
        Annuler
      </Button>
    </Group>
  );
}

/**
 * Button starting a destructive action (deletion, removal…), the same everywhere: red, light; the action asks for a
 * confirmation (confirmDestructive).
 * @param {Omit<ButtonProps, 'variant' | 'color'> & Omit<ComponentPropsWithoutRef<'button'>, 'color'>} props Button props (its variant and color are fixed).
 * @returns {JSX.Element} Button.
 */
export function DestructiveButton(props: Omit<ButtonProps, 'variant' | 'color'> & Omit<ComponentPropsWithoutRef<'button'>, 'color'>) {
  return <Button {...props} variant="light" color="red" />;
}
