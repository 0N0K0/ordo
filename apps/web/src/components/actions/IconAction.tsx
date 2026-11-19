import { ActionIcon, Indicator, type ActionIconProps } from '@mantine/core';
import { ActionTooltip } from './ActionTooltip';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

/** Props of an element opened by the button (a link, a file, an outside page). */
interface IconActionLinkProps {
  component?: ElementType;
  href?: string;
  to?: string;
  download?: boolean | string;
  target?: string;
  rel?: string;
}

type IconActionProps = Omit<ActionIconProps, 'children'> & Omit<ComponentPropsWithoutRef<'button'>, keyof ActionIconProps | 'children' | 'type'> & IconActionLinkProps & IconActionOwnProps;

/** Props of its own. */
interface IconActionOwnProps {
  /** The action (« Modifier »): its tooltip. */
  label: string;
  /** Element acted on (« Urgent »): the hidden label, read by screen readers, says « Modifier « Urgent » ». Optional. */
  item?: string;
  /** Tooltip instead of the label (why it is disabled, what it does besides, a shortcut). Optional. Default = the label. */
  hint?: ReactNode;
  /** Hidden label when the element is not a name (« Fermer le mail »). Optional. Default = from `label` and `item`. */
  'aria-label'?: string;
  /** Number shown on its corner (how many things are attached), none at 0. Optional. */
  indicator?: number;
  /** Type of the button (« submit » in a form). Optional. Default = « button ». */
  type?: 'button' | 'submit' | 'reset';
  /** Its icon. */
  children: ReactNode;
}

/**
 * Button made of an icon alone, the same everywhere: its action in a tooltip, and the action with the element it acts on
 * as its hidden label (« Modifier « Urgent » »); subtle and gray unless told otherwise. The tooltip shows on a disabled
 * button too.
 * @param {IconActionProps} props Component props (and those of the action icon).
 * @returns {JSX.Element} Button.
 */
export function IconAction({ label, item, hint, 'aria-label': ariaLabel, indicator, children, variant = 'subtle', color = 'gray', ...props }: IconActionProps) {
  const button = (
    // eslint-disable-next-line no-restricted-syntax -- the one icon button with its tooltip.
    <ActionIcon variant={variant} color={color} aria-label={ariaLabel ?? (item ? `${label} « ${item} »` : label)} {...(props as object)}>
      {children}
    </ActionIcon>
  );
  return (
    <ActionTooltip label={hint ?? label} disabled={Boolean((props as { disabled?: boolean }).disabled)}>
      {indicator === undefined ? (
        button
      ) : (
        <Indicator label={indicator} size={16} disabled={!indicator} offset={4}>
          {button}
        </Indicator>
      )}
    </ActionTooltip>
  );
}
