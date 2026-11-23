import type { ReactNode } from 'react';
import { IconAction } from '../../actions/IconAction';
import { nextStateLabel, stateIcons, type YesNoStates } from '../table/data-table';
import { stopClick } from './cell-field';
import classes from './StateButton.module.css';
import { YesNoIcon } from './YesNoIcon';

/** Size of the icon for each size of the button (px). */
const ICON_SIZES = { xs: 14, sm: 18, md: 22, 'input-sm': 26, xl: 36 } as const;

interface StateButtonProps extends YesNoStates {
  /** Yes or no. */
  value: boolean;
  /** The cell or the row it belongs to (« Fait de « Lait » »), read after the state's name. Optional. */
  label?: string;
  /** Tooltip instead of what a click does (why it is disabled, a date). Optional. */
  hint?: ReactNode;
  /** Shown only: disabled. Optional. Default = false. */
  readOnly?: boolean;
  /** Being saved: its spinner instead of its icon. Optional. Default = false. */
  loading?: boolean;
  /** An optional state (an optional time of a routine): outlined dashed. Optional. Default = false. */
  dashed?: boolean;
  /**
   * Size: « xs » / « sm » in cells and rows, « md » beside the other buttons of a toolbar, « input-sm » beside the
   * « … » menu of a page header (as high as it, 36 px), « xl » for a thumb (the collect mode of a shopping list).
   * Optional. Default = « sm ».
   */
  size?: keyof typeof ICON_SIZES;
  onChange: (value: boolean) => void;
}

/**
 * State button: a yes / no of the data changed in place (done, bought, missing, treated, favourite…) in a table cell, a
 * list row, a page header or a toolbar, never a switch. It shows its current state with the icon and colour of its
 * column, round instead of square (`YesNoIcon` `shape="round"`: a green check, an orange triangle, a blue check, a blue
 * cart, an empty gray round for a state still to reach, a yellow star for a favourite), is named after that state (`aria-pressed`), its tooltip says what a
 * click does; one click toggles it. Its click is kept from the row.
 * @param {StateButtonProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function StateButton({ value, labels, icons, toggleLabels, label, hint, readOnly = false, loading = false, dashed = false, size = 'sm', onChange }: StateButtonProps) {
  const state = value ? labels.yes : labels.no;
  const next = nextStateLabel({ labels, toggleLabels }, value);
  return (
    <IconAction
      label={readOnly ? state : next}
      hint={hint}
      aria-label={label ? `${state}, ${label}` : state}
      // eslint-disable-next-line no-restricted-syntax -- the one state button.
      aria-pressed={value}
      size={size}
      disabled={readOnly}
      loading={loading}
      className={dashed ? classes.optional : undefined}
      onClick={(event) => {
        stopClick(event);
        onChange(!value);
      }}
    >
      <YesNoIcon value={value} icons={stateIcons({ labels, icons })} shape="round" size={ICON_SIZES[size]} decorative />
    </IconAction>
  );
}
