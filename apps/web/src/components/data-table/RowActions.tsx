import { ActionIcon, Group, Menu, Tooltip } from '@mantine/core';
import { DotsThreeVerticalIcon } from '@phosphor-icons/react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';

/** Action of a row. */
export interface RowAction {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  /** Page of the app opened by the action. Optional. */
  to?: string;
  /** File or outside page opened by the action. Optional. */
  href?: string;
  /** Downloads `href`. Optional. */
  download?: boolean;
  disabled?: boolean;
  /** Why it is disabled, or what it does. Optional. */
  hint?: string;
  /** Destroys something (red, last in the menu, after a separator). Optional. */
  danger?: boolean;
}

/** Entry of the menu: an action, a separator, or nothing (not offered). */
export type RowMenuEntry = RowAction | 'divider' | null | false | undefined | '';

/** Width of the actions cell of a row: its main action and its menu. */
export const ROW_ACTIONS_WIDTH = 72;

/**
 * Props of an element opening an action (link, outside link or file).
 * @param {RowAction} action Action.
 * @returns {object} Props (typed loosely: the polymorphic components take either).
 */
function linkProps(action: RowAction): object {
  if (action.to) return { component: Link, to: action.to };
  if (action.href) return { component: 'a', href: action.href, ...(action.download ? { download: true } : { target: '_blank', rel: 'noreferrer' }) };
  return {};
}

/**
 * Entries of a menu as shown: the destructive actions gathered at the end after a separator, no separator at an end
 * nor two in a row.
 * @param {readonly RowMenuEntry[]} items Entries.
 * @returns {(RowAction | 'divider')[]} Entries shown.
 */
function menuEntries(items: readonly RowMenuEntry[]): (RowAction | 'divider')[] {
  const entries = items.filter((item): item is RowAction | 'divider' => Boolean(item));
  const safe = entries.filter((item) => item === 'divider' || !item.danger);
  const danger = entries.filter((item): item is RowAction => item !== 'divider' && Boolean(item.danger));
  return [...safe, ...(danger.length ? ['divider' as const, ...danger] : [])].filter((item, index, all) => item !== 'divider' || (index > 0 && index < all.length - 1 && all[index - 1] !== 'divider'));
}

interface ActionsMenuProps {
  /** What the actions are about (« Actions de … »). */
  name: string;
  items: readonly RowMenuEntry[];
  /** Button opening the menu. Optional. Default = a « ⋯ » icon. */
  target?: ReactNode;
}

/**
 * Menu of the actions of something (a row, or a page header), the same everywhere: the destructive actions last, in
 * red, after a separator.
 * @param {ActionsMenuProps} props Component props.
 * @returns {JSX.Element | null} Menu, nothing without action.
 */
export function ActionsMenu({ name, items, target }: ActionsMenuProps) {
  const menu = menuEntries(items);
  if (menu.length === 0) return null;
  return (
    <Menu position="bottom-end" shadow="md" withinPortal>
      <Menu.Target>
        {target ?? (
          <ActionIcon variant="subtle" color="gray" aria-label={`Actions de ${name}`}>
            <DotsThreeVerticalIcon weight="bold" aria-hidden />
          </ActionIcon>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        {menu.map((item, index) =>
          item === 'divider' ? (
            <Menu.Divider key={`divider-${index}`} />
          ) : (
            <Fragment key={item.label}>
              <Menu.Item leftSection={item.icon} color={item.danger ? 'red' : undefined} disabled={item.disabled} title={item.hint} onClick={item.onClick} {...linkProps(item)}>
                {item.label}
              </Menu.Item>
            </Fragment>
          ),
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

interface RowActionsProps {
  /** What the row is (« Actions de … »). */
  name: string;
  /** Most used action, as an icon of its own. Optional. */
  primary?: RowAction | null | false | '';
  /** Every other action, in the menu (destructive ones gathered at the end). */
  items: readonly RowMenuEntry[];
}

/**
 * Actions at the end of every table row, the same everywhere: the main one as an icon, the others in a « ⋯ » menu,
 * the destructive ones last, in red, after a separator.
 * @param {RowActionsProps} props Component props.
 * @returns {JSX.Element} Actions.
 */
export function RowActions({ name, primary, items }: RowActionsProps) {
  return (
    <Group gap={2} wrap="nowrap" justify="flex-end">
      {primary && (
        <Tooltip label={primary.label}>
          <ActionIcon variant="subtle" color="gray" aria-label={`${primary.label} : ${name}`} disabled={primary.disabled} onClick={primary.onClick} {...linkProps(primary)}>
            {primary.icon}
          </ActionIcon>
        </Tooltip>
      )}
      <ActionsMenu name={name} items={items} />
    </Group>
  );
}
