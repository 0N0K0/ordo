import { Checkbox } from '@mantine/core';
import classes from './DataTable.module.css';
import type { RowSelection } from '../views/use-data-view';

/**
 * Check box of a row: checked, its fields are all edited in bulk with those of the other rows checked.
 * @param {{ selection: RowSelection, rowKey: string, name?: string }} props Selection, row, its name (quoted in the hidden label; none: « la ligne »).
 * @returns {JSX.Element} Check box.
 */
export function RowCheck({ selection, rowKey, name }: { selection: RowSelection; rowKey: string; name?: string }) {
  return (
    <Checkbox
      size="xs"
      className={classes.rowCheck}
      wrapperProps={{ 'data-reveal': true }}
      aria-label={name ? `Sélectionner « ${name} »` : 'Sélectionner la ligne'}
      checked={selection.isChecked(rowKey)}
      // A click checks the row, it does not open it.
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => selection.check([rowKey], event.currentTarget.checked)}
    />
  );
}

/**
 * Check box of the header: checks or unchecks every row shown.
 * @param {{ selection: RowSelection }} props Selection.
 * @returns {JSX.Element} Check box.
 */
export function AllRowsCheck({ selection }: { selection: RowSelection }) {
  const count = selection.keys.filter((key) => selection.isChecked(key)).length;
  const all = selection.keys.length > 0 && count === selection.keys.length;
  return (
    <Checkbox
      size="xs"
      className={classes.rowCheck}
      wrapperProps={{ 'data-reveal': true }}
      aria-label={all ? 'Tout décocher' : 'Tout cocher'}
      checked={all}
      indeterminate={count > 0 && !all}
      disabled={!selection.keys.length}
      onChange={() => selection.check(selection.keys, !all)}
    />
  );
}

/** Width of the column of the check boxes. */
export const ROW_CHECK_WIDTH = 36;
