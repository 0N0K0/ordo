import { ActionIcon, Group, Menu, Tooltip, type ActionIconProps, type MenuProps } from '@mantine/core';
import { CheckIcon, DotsThreeVerticalIcon } from '@phosphor-icons/react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';

/** Action of a row. */
interface RowAction {
  label: string;
  /** Icon before the label. Optional for a checked entry (`checked`), whose tick takes its place. */
  icon?: ReactNode;
  /** Choice of a menu of options (a sort): ticked when chosen, else aligned with the ticked one. Optional. */
  checked?: boolean;
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
}

/**
 * Menu of the actions of something (a row, or a page header), the same everywhere: sections under their titles, the
 * destructive actions last, in red, after a separator.
 * @param {ActionsMenuProps} props Component props.
 * @returns {JSX.Element | null} Menu, nothing without action.
 */
export function ActionsMenu({ name, items, target, inRow = false, size, loading, position = 'bottom-end', opened, onChange }: ActionsMenuProps) {
  const menu = menuEntries(items);
  if (menu.length === 0) return null;
  return (
    <Menu position={position} shadow="md" withinPortal opened={opened} onChange={onChange}>
      <Menu.Target>
        {target ?? (
          <ActionIcon variant="subtle" color="gray" size={size} loading={loading} aria-label={`Actions de ${name}`} onClick={inRow ? (event) => event.stopPropagation() : undefined}>
            <DotsThreeVerticalIcon weight="bold" aria-hidden />
          </ActionIcon>
        )}
      </Menu.Target>
      <Menu.Dropdown onClick={inRow ? (event) => event.stopPropagation() : undefined}>
        {menu.map((item, index) =>
          item === 'divider' ? (
            <Menu.Divider key={`divider-${index}`} />
          ) : !isAction(item) ? (
            <Menu.Label key={`section-${index}`}>{item.section}</Menu.Label>
          ) : (
            <Fragment key={`${index}-${item.label}`}>
              <Menu.Item
                leftSection={item.checked === undefined ? item.icon : item.checked ? <CheckIcon aria-hidden /> : <span style={{ width: '1.25em' }} />}
                color={item.danger ? 'red' : undefined}
                disabled={item.disabled}
                title={item.hint}
                onClick={item.onClick}
                {...linkProps(item)}
              >
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

interface InlineActionsProps {
  /** What the actions are about (« Modifier … »). */
  name: string;
  /** Actions, each as an icon with its label in a tooltip (destructive ones in red); separators and section titles are left out. */
  items: readonly RowMenuEntry[];
}

/**
 * Actions shown side by side, each as an icon (a card, an item of a list): the same buttons everywhere, a menu
 * gathering them when there are many (`ActionsMenu`).
 * @param {InlineActionsProps} props Component props.
 * @returns {JSX.Element} Actions.
 */
export function InlineActions({ name, items }: InlineActionsProps) {
  const actions = items.filter(isAction);
  return (
    <Group gap={2} wrap="nowrap">
      {actions.map((action) => (
        <Tooltip key={action.label} label={action.hint ?? action.label}>
          <ActionIcon variant="subtle" color={action.danger ? 'red' : 'gray'} aria-label={`${action.label} ${name}`} disabled={action.disabled} onClick={action.onClick} {...linkProps(action)}>
            {action.icon}
          </ActionIcon>
        </Tooltip>
      ))}
    </Group>
  );
}
