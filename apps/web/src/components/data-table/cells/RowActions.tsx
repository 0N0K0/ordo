import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { ActionsMenu, type RowAction, type RowMenuEntry } from '../../actions/ActionsMenu';
import { linkProps } from '../../actions/link-props';

/** Width of the actions cell of a row: its main action and its menu. */
export const ROW_ACTIONS_WIDTH = 72;

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
