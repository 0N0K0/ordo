import type { ActionIconProps } from '@mantine/core';
import { TrashIcon, XIcon } from '@phosphor-icons/react';
import type { MouseEvent } from 'react';
import { IconAction } from './IconAction';

interface RemoveButtonProps extends Omit<ActionIconProps, 'variant' | 'color' | 'children'> {
  /** The action, in its tooltip (« Retirer », « Supprimer »). */
  label: string;
  /** Element removed (« Urgent »): the hidden label says « Retirer « Urgent » ». Optional. */
  item?: string;
  /** Hidden label when the element is not a name (« Retirer la ligne 2 »). Optional. Default = from label and item. */
  'aria-label'?: string;
  /** `field`: gray cross of an item inside a field (chip, attachment, link in a badge). Optional. Default = red trash of a line. */
  variant?: 'field';
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Button removing an item, with its tooltip: a red trash for a line of a form or a list, a gray cross for an item inside a
 * field (variant `field`).
 * @param {RemoveButtonProps} props Component props (and those of the action icon).
 * @returns {JSX.Element} Button.
 */
export function RemoveButton({ variant, ...props }: RemoveButtonProps) {
  const field = variant === 'field';
  return (
    // eslint-disable-next-line no-restricted-syntax -- the one removal button.
    <IconAction color={field ? 'gray' : 'red'} {...props}>
      {field ? <XIcon aria-hidden /> : <TrashIcon aria-hidden />}
    </IconAction>
  );
}
