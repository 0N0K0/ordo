import { ActionIcon, Group, Menu, Text, type ActionIconProps, type MenuProps } from '@mantine/core';
import { CheckIcon, DotsThreeVerticalIcon } from '@phosphor-icons/react';
import { Fragment, type ReactNode } from 'react';
import { linkProps } from './link-props';
import { IconAction } from './IconAction';

/** Action of a menu (or of a row). */
export interface RowAction {
  label: string;
  /** Icon before the label. Optional for a checked entry (`checked`), whose tick takes its place. */
  icon?: ReactNode;
  /** Choice of a menu of options (a sort): ticked when chosen, else aligned with the ticked one; with an icon, the tick goes after the label. Optional. */
  checked?: boolean;
  /** Second line under the label, dimmed (what the entry holds). Optional. */
  description?: ReactNode;
  /** Depth of the entry in a tree (a folder): shifted right by as many steps. Optional. */
  indent?: number;
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
  /** Only ever in the « … » menu, never as a button (« Archiver » / « Restaurer », decision R). Optional. */
  inMenu?: boolean;
}

/** Title of a section of a menu (its actions follow). */
interface MenuSection {
  section: string;
}

/** Entry of the menu: an action, a separator, a section title, or nothing (not offered). */
export type RowMenuEntry = RowAction | MenuSection | 'divider' | null | false | undefined | '';

/** Entry shown in a menu. */
type ShownEntry = RowAction | MenuSection | 'divider';

/**
 * Whether an entry is an action (not a separator nor a section title).
 * @param {RowMenuEntry} item Entry.
 * @returns {boolean} An action.
 */
const isAction = (item: RowMenuEntry): item is RowAction => Boolean(item) && item !== 'divider' && !('section' in (item as object));

/**
 * Entries of a menu as shown: the destructive actions gathered at the end after a separator, no separator at an end
 * nor two in a row, no section title without an action under it.
 * @param {readonly RowMenuEntry[]} items Entries.
 * @returns {ShownEntry[]} Entries shown.
 */
function menuEntries(items: readonly RowMenuEntry[]): ShownEntry[] {
  const entries = items.filter((item): item is ShownEntry => Boolean(item));
  const safe = entries.filter((item) => !isAction(item) || !item.danger);
  const danger = entries.filter((item): item is RowAction => isAction(item) && Boolean(item.danger));
  const titled = [...safe, ...(danger.length ? ['divider' as const, ...danger] : [])].filter((item, index, all) => isAction(item) || item === 'divider' || isAction(all[index + 1]));
  return titled.filter((item, index, all) => item !== 'divider' || (index > 0 && index < all.length - 1 && all[index - 1] !== 'divider'));
}

interface ActionsMenuProps {
  /** What the actions are about (« Actions de … »). */
  name: string;
  items: readonly RowMenuEntry[];
  /** Button opening the menu. Optional. Default = a « ⋯ » icon. */
  target?: ReactNode;
  /** In a clickable row (a folder, a search): its clicks stay in the menu. Optional. */
  inRow?: boolean;
  /** Size of the default button. Optional. */
  size?: ActionIconProps['size'];
  /** Something runs (an export): the default button spins. Optional. */
  loading?: boolean;
  /** Where the menu opens. Optional. Default = « bottom-end ». */
  position?: MenuProps['position'];
  /** Open state, controlled (with onChange). Optional. */
  opened?: boolean;
  /** Opening or closing asked. Optional. */
  onChange?: (opened: boolean) => void;
  /** Opens on hover too (the menus of the top bar), a click still opening it by touch or keyboard. Optional. */
  hover?: boolean;
  /** Stays open after a choice (several flags ticked in a row). Optional. */
  keepOpen?: boolean;
  /** Width of the menu. Optional. Default = its content. */
  width?: MenuProps['width'];
  /** Highest height of the menu, scrolled beyond (a long list of folders). Optional. */
  maxHeight?: number;
}

/**
 * Menu of the actions of something (a row, or a page header), the same everywhere: sections under their titles, the
 * destructive actions last, in red, after a separator.
 * @param {ActionsMenuProps} props Component props.
 * @returns {JSX.Element | null} Menu, nothing without action.
 */
export function ActionsMenu({ name, items, target, inRow = false, size, loading, position = 'bottom-end', opened, onChange, hover = false, keepOpen = false, width, maxHeight }: ActionsMenuProps) {
  const menu = menuEntries(items);
  if (menu.length === 0) return null;
  return (
    <Menu
      position={position}
      shadow="md"
      withinPortal
      opened={opened}
      onChange={onChange}
      width={width}
      closeOnItemClick={!keepOpen}
      {...(hover ? { trigger: 'click-hover' as const, openDelay: 60, closeDelay: 150 } : {})}
    >
      <Menu.Target>
        {target ?? (
          <ActionIcon variant="subtle" color="gray" size={size} loading={loading} aria-label={`Actions de ${name}`} onClick={inRow ? (event) => event.stopPropagation() : undefined}>
            <DotsThreeVerticalIcon weight="bold" aria-hidden />
          </ActionIcon>
        )}
      </Menu.Target>
      <Menu.Dropdown onClick={inRow ? (event) => event.stopPropagation() : undefined} mah={maxHeight} style={maxHeight ? { overflowY: 'auto' } : undefined}>
        {menu.map((item, index) =>
          item === 'divider' ? (
            <Menu.Divider key={`divider-${index}`} />
          ) : !isAction(item) ? (
            <Menu.Label key={`section-${index}`}>{item.section}</Menu.Label>
          ) : (
            <Fragment key={`${index}-${item.label}`}>
              <Menu.Item
                leftSection={item.checked === undefined || item.icon ? item.icon : item.checked ? <CheckIcon aria-hidden /> : <span style={{ width: '1.25em' }} />}
                rightSection={item.icon && item.checked ? <CheckIcon aria-hidden /> : undefined}
                color={item.danger ? 'red' : undefined}
                disabled={item.disabled}
                title={item.hint}
                style={item.indent ? { paddingLeft: `calc(var(--mantine-spacing-sm) + ${item.indent} * var(--mantine-spacing-md))` } : undefined}
                onClick={item.onClick}
                {...linkProps(item)}
              >
                {item.label}
                {item.description && (
                  <Text size="xs" c="dimmed">
                    {item.description}
                  </Text>
                )}
              </Menu.Item>
            </Fragment>
          ),
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

interface InlineActionsProps {
  /** Element the actions are about, its name (« Modifier « Urgent » »). */
  name: string;
  /** Actions, each as an icon with its label in a tooltip (destructive ones in red); separators and section titles are left out. */
  items: readonly RowMenuEntry[];
}

/**
 * Actions shown side by side, each as an icon (a card, an item of a list): the same buttons everywhere; those kept to
 * a menu (`inMenu`: « Archiver ») in a « … » menu after them (`ActionsMenu`).
 * @param {InlineActionsProps} props Component props.
 * @returns {JSX.Element} Actions.
 */
export function InlineActions({ name, items }: InlineActionsProps) {
  const actions = items.filter(isAction);
  const menu = actions.filter((action) => action.inMenu);
  return (
    <Group gap={2} wrap="nowrap">
      {actions
        .filter((action) => !action.inMenu)
        .map((action) => (
          <IconAction
            key={action.label}
            label={action.label}
            item={name}
            hint={action.hint}
            color={action.danger ? 'red' : 'gray'}
            disabled={action.disabled}
            onClick={action.onClick}
            {...linkProps(action)}
          >
            {action.icon}
          </IconAction>
        ))}
      <ActionsMenu name={name} items={menu} />
    </Group>
  );
}
