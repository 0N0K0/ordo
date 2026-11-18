import { ActionIcon, Tooltip, type ActionIconProps } from '@mantine/core';
import { XIcon } from '@phosphor-icons/react';

interface RemoveButtonProps extends Omit<ActionIconProps, 'variant' | 'color' | 'children'> {
  /** What it does, in its tooltip (« Retirer la ligne »). */
  label: string;
  /** Name read by screen readers, when the tooltip is not enough (« Retirer la ligne 2 »). Optional. Default = label. */
  'aria-label'?: string;
  onClick: () => void;
}

/**
 * Discreet cross removing an item of a list (a line, a document, a sheet…), with its tooltip.
 * @param {RemoveButtonProps} props Component props (and those of the action icon).
 * @returns {JSX.Element} Button.
 */
export function RemoveButton({ label, 'aria-label': ariaLabel, onClick, ...props }: RemoveButtonProps) {
  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" color="gray" aria-label={ariaLabel ?? label} onClick={onClick} {...props}>
        <XIcon aria-hidden />
      </ActionIcon>
    </Tooltip>
  );
}
