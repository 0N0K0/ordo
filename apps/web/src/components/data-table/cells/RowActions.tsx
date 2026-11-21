import { IconAction } from '../../actions/IconAction';
import { Group } from '@mantine/core';
import { ActionsMenu, type RowAction, type RowMenuEntry } from '../../actions/ActionsMenu';
import { actionIconProps, type ActionsSubject } from '../../actions/actions-subject';

/** Width of the actions cell of a row: its main action and its menu. */
export const ROW_ACTIONS_WIDTH = 72;

interface RowActionsProps extends ActionsSubject {
  /** Most used action, as an icon of its own (never one kept to the menu, `inMenu`). Optional. */
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
export function RowActions({ name, about, primary, items }: RowActionsProps) {
  // « Archiver » is never a button.
  if (primary && primary.inMenu) [primary, items] = [null, [primary, ...items]];
  return (
    <Group gap={2} wrap="nowrap" justify="flex-end">
      {primary && <IconAction {...actionIconProps(primary, { name, about })}>{primary.icon}</IconAction>}
      <ActionsMenu name={name} about={about} items={items} />
    </Group>
  );
}
