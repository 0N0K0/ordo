import { Button, type ButtonProps } from '@mantine/core';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Link } from 'react-router';
import { ActionsMenu, type RowMenuEntry } from './ActionsMenu';
import { ActionTooltip } from './ActionTooltip';
import { MenuCaret } from './MenuCaret';

/**
 * Weight of an action: the main ones of a page or a view (filled), the others (outlined), the small ones of a section
 * or a form (subtle text, one size: « Ajouter une ligne », « Valeurs par défaut », « Retirer »).
 */
type ActionPriority = 'primary' | 'secondary' | 'tertiary';

interface ActionButtonProps extends Omit<ButtonProps, 'variant' | 'color' | 'leftSection' | 'rightSection'>, Omit<ComponentPropsWithoutRef<'button'>, 'color' | 'children' | 'style'> {
  children: ReactNode;
  /** Main action (filled), another one (outlined) or a small one (subtle text, xs: decision BE). Optional. Default = 'primary'. */
  priority?: ActionPriority;
  /** Destructive small action (« Retirer » the logo…), in red: tertiary only. Optional. Default = false. */
  danger?: boolean;
  /** Icon before the label: every action button has one. */
  icon: ReactNode;
  /** Page of the app it opens. Optional. */
  to?: string;
  /** File or outside page it opens (a download with `download`). Optional. */
  href?: string;
  /** Downloads `href` (under this name when a string). Optional. */
  download?: boolean | string;
  /**
   * Other ways of the same action (a forecast besides an entry…), in a menu attached to the button: opened by the
   * button itself without `onClick`/`to`, by its caret otherwise. Optional.
   */
  menu?: readonly RowMenuEntry[];
  /** Tooltip (what it does besides, why it is disabled): shown on a disabled button too. Optional. */
  hint?: ReactNode;
}

/**
 * Button of an action of a page, a view or a section, the same everywhere: filled for the main actions, outlined for the
 * others; the ways of the same action gathered in its menu; its tooltip (`hint`) shown even when it is disabled.
 * @param {ActionButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function ActionButton({ hint, ...props }: ActionButtonProps) {
  const button = <ActionButtonBody {...props} />;
  return hint ? (
    <ActionTooltip label={hint} disabled={Boolean(props.disabled)}>
      {button}
    </ActionTooltip>
  ) : (
    button
  );
}

/**
 * The button of ActionButton, without its tooltip.
 * @param {ActionButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
function ActionButtonBody({ children, priority = 'primary', danger = false, icon, to, href, download, menu, onClick, ...rest }: Omit<ActionButtonProps, 'hint'>) {
  const variant = priority === 'primary' ? 'filled' : priority === 'secondary' ? 'default' : 'subtle';
  // A small action: always xs, red when destructive.
  const props = priority === 'tertiary' ? { ...rest, size: 'xs', ...(danger ? { color: 'red' } : {}) } : rest;
  const link = to ? ({ component: Link, to } as object) : href ? ({ component: 'a', href, download } as object) : {};
  if (menu && !onClick && !to && !href) {
    return (
      <ActionsMenu
        name={String(children)}
        items={menu}
        target={
          <Button variant={variant} leftSection={icon} rightSection={<MenuCaret />} {...props}>
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
          <Button variant={variant} size={props.size} disabled={props.disabled} px="xs" aria-label={`Autres façons « ${String(children)} »`}>
            <MenuCaret />
          </Button>
        }
      />
    </Button.Group>
  );
}
