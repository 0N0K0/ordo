import { Button, type ButtonProps } from '@mantine/core';
import { CaretDownIcon } from '@phosphor-icons/react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Link } from 'react-router';
import { ActionsMenu, type RowMenuEntry } from '../data-table/RowActions';

/** Weight of an action: the main ones of a page or a view (filled), the others (outlined). */
export type ActionPriority = 'primary' | 'secondary';

interface ActionButtonProps extends Omit<ButtonProps, 'variant' | 'color' | 'leftSection' | 'rightSection'>, Omit<ComponentPropsWithoutRef<'button'>, 'color' | 'children' | 'style'> {
  children: ReactNode;
  /** Main action (filled) or another one (outlined). Optional. Default = 'primary'. */
  priority?: ActionPriority;
  icon?: ReactNode;
  /** Page of the app it opens. Optional. */
  to?: string;
  /**
   * Other ways of the same action (a forecast besides an entry…), in a menu attached to the button: opened by the
   * button itself without `onClick`/`to`, by its caret otherwise. Optional.
   */
  menu?: readonly RowMenuEntry[];
}

/**
 * Button of an action of a page, a view or a section, the same everywhere: filled for the main actions, outlined for the
 * others; the ways of the same action gathered in its menu.
 * @param {ActionButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function ActionButton({ children, priority = 'primary', icon, to, menu, onClick, ...props }: ActionButtonProps) {
  const variant = priority === 'primary' ? 'filled' : 'default';
  const link = to ? ({ component: Link, to } as object) : {};
  if (menu && !onClick && !to) {
    return (
      <ActionsMenu
        name={String(children)}
        items={menu}
        target={
          <Button variant={variant} leftSection={icon} rightSection={<CaretDownIcon aria-hidden size={12} />} {...props}>
            {children}
          </Button>
        }
      />
    );
  }
  const button = (
    <Button variant={variant} leftSection={icon} onClick={onClick} {...link} {...props}>
      {children}
    </Button>
  );
  if (!menu) return button;
  return (
    <Button.Group>
      {button}
      <ActionsMenu
        name={String(children)}
        items={menu}
        target={
          <Button variant={variant} size={props.size} disabled={props.disabled} px="xs" aria-label={`Autres façons : ${String(children)}`}>
            <CaretDownIcon aria-hidden size={12} />
          </Button>
        }
      />
    </Button.Group>
  );
}
