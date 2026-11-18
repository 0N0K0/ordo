import { Button, Group, type ButtonProps } from '@mantine/core';
import { TrashIcon, XIcon } from '@phosphor-icons/react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface DestructiveActionsProps {
  onConfirm: () => void;
  onCancel: () => void;
  /** The action runs (its button waits). Optional. Default = false. */
  loading?: boolean;
  /** Label of the confirmation (« Supprimer », « Retirer »…). Optional. Default = « Supprimer ». */
  confirmLabel?: string;
  /** Icon before the confirmation label. Optional. Default = a trash. */
  confirmIcon?: ReactNode;
}

/**
 * Buttons of every destructive dialog, bottom-right: the confirmation first (in red), then Cancel.
 * @param {DestructiveActionsProps} props Component props.
 * @returns {JSX.Element} Buttons.
 */
export function DestructiveActions({ onConfirm, onCancel, loading = false, confirmLabel = 'Supprimer', confirmIcon = <TrashIcon aria-hidden /> }: DestructiveActionsProps) {
  return (
    <Group justify="flex-end" gap="sm">
      <Button color="red" leftSection={confirmIcon} onClick={onConfirm} loading={loading} data-autofocus>
        {confirmLabel}
      </Button>
      <Button variant="default" leftSection={<XIcon aria-hidden />} onClick={onCancel}>
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

/**
 * « Supprimer » button of a form (its trash icon, in red); the deletion asks for a confirmation (confirmDestructive).
 * @param {{ onClick: () => void, loading?: boolean, children?: ReactNode }} props Component props: the label defaults to « Supprimer ».
 * @returns {JSX.Element} Button.
 */
export function DeleteButton({ onClick, loading = false, children = 'Supprimer' }: { onClick: () => void; loading?: boolean; children?: ReactNode }) {
  return (
    <DestructiveButton leftSection={<TrashIcon aria-hidden />} onClick={onClick} loading={loading}>
      {children}
    </DestructiveButton>
  );
}
