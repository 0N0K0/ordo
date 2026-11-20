import { Group, Radio, Stack, Text } from '@mantine/core';
import { TrashIcon, XIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ActionButton } from '../actions/ActionButton';

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
 * Buttons of every destructive dialog, bottom-right: the confirmation first (filled red), then Cancel (light).
 * @param {DestructiveActionsProps} props Component props.
 * @returns {JSX.Element} Buttons.
 */
export function DestructiveActions({ onConfirm, onCancel, loading = false, confirmLabel = 'Supprimer', confirmIcon = <TrashIcon aria-hidden /> }: DestructiveActionsProps) {
  return (
    <Group justify="flex-end" gap="sm">
      <ActionButton danger icon={confirmIcon} onClick={onConfirm} loading={loading} data-autofocus>
        {confirmLabel}
      </ActionButton>
      <ActionButton priority="secondary" icon={<XIcon aria-hidden />} onClick={onCancel}>
        Annuler
      </ActionButton>
    </Group>
  );
}

/**
 * « Supprimer » button of a form (its trash icon, filled red: decision CN); the deletion asks for a confirmation (confirmDestructive).
 * @param {{ onClick: () => void, loading?: boolean, children?: ReactNode }} props Component props: the label defaults to « Supprimer ».
 * @returns {JSX.Element} Button.
 */
export function DeleteButton({ onClick, loading = false, children = 'Supprimer' }: { onClick: () => void; loading?: boolean; children?: ReactNode }) {
  return (
    <ActionButton danger icon={<TrashIcon aria-hidden />} onClick={onClick} loading={loading}>
      {children}
    </ActionButton>
  );
}

/** Last sentence of every destructive confirmation (decision X). */
// eslint-disable-next-line no-restricted-syntax -- the one place the sentence is written.
const IRREVERSIBLE = 'Cette action est irréversible.';

/**
 * Risks of a destructive dialog, the same everywhere: what the action does and loses, then « Cette action est
 * irréversible. » (unless it can be undone by the opposite action: a conversion, lot 16).
 * @param {{ children: ReactNode, reversible?: boolean }} props Component props: the risks (a sentence, or more), and whether the opposite action undoes it.
 * @returns {JSX.Element} Text.
 */
export function DestructiveRisks({ children, reversible = false }: { children: ReactNode; reversible?: boolean }) {
  return (
    <Text size="sm" component="div">
      {children}
      {!reversible && ` ${IRREVERSIBLE}`}
    </Text>
  );
}

/** What a deletion does with what hangs from the element: kept (detached), or deleted along. */
type CascadeMode = 'detach' | 'delete';

/**
 * Choice of a deletion for what hangs from the element (sub-tasks, projects…): keep it, or delete it along, for good.
 * @param {{ label: string, keepLabel: string, value: CascadeMode, onChange: (mode: CascadeMode) => void }} props Question, what keeping does, choice and its change.
 * @returns {JSX.Element} Choice.
 */
export function CascadeChoice({ label, keepLabel, value, onChange }: { label: string; keepLabel: string; value: CascadeMode; onChange: (mode: CascadeMode) => void }) {
  return (
    <Radio.Group label={label} value={value} onChange={(mode) => onChange(mode as CascadeMode)}>
      <Stack gap="xs" mt="xs">
        <Radio value="detach" label={keepLabel} />
        <Radio value="delete" label="Les supprimer aussi, définitivement" color="red" />
      </Stack>
    </Radio.Group>
  );
}
