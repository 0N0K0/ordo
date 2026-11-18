import { ActionIcon, Tooltip, type ActionIconProps } from '@mantine/core';
import { TrashIcon, XIcon } from '@phosphor-icons/react';
import type { MouseEvent } from 'react';

interface RemoveButtonProps extends Omit<ActionIconProps, 'variant' | 'color' | 'children'> {
  /** What it does, in its tooltip (« Retirer la ligne »). */
  label: string;
  /** Name read by screen readers, when the tooltip is not enough (« Retirer la ligne 2 »). Optional. Default = label. */
  'aria-label'?: string;
  /** `field`: gray cross of an item inside a field (chip, attachment, link in a badge). Optional. Default = red trash of a line. */
  variant?: 'field';
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Button removing an item, with its tooltip: a red trash for a line of a form or a list, a gray cross for an item inside a
 * field (variant `field`).
 * @param {RemoveButtonProps} props Component props (and those of the action icon).
 * @returns {JSX.Element} Button.
 */
export function RemoveButton({ label, 'aria-label': ariaLabel, variant, onClick, ...props }: RemoveButtonProps) {
  const field = variant === 'field';
  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" color={field ? 'gray' : 'red'} aria-label={ariaLabel ?? label} onClick={onClick} {...props}>
        {field ? <XIcon aria-hidden /> : <TrashIcon aria-hidden />}
      </ActionIcon>
    </Tooltip>
  );
}
