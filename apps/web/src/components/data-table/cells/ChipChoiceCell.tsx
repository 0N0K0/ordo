import { Combobox, UnstyledButton, useCombobox } from '@mantine/core';
import { ItemBadge } from '../../items/ItemBadge';
import { unarchived } from '../../../lib/archive';
import { stopClick } from './cell-field';
import classes from './EditableCells.module.css';

/** Item of a settings list a chip cell offers (a status, a priority, a type…). */
export interface ChipChoice {
  id: string;
  label: string;
  color?: string | null;
  iconUrl?: string | null;
  archived?: boolean | null;
}

interface ChipChoiceCellProps {
  /** Current value; null: none. */
  value: string | null | undefined;
  /** Items of the list, in their order. */
  items: readonly ChipChoice[];
  /** Accessible label of the cell (`itemCellLabel`). */
  label: string;
  /** Read only (an archived row): its chip only. Optional. Default = false. */
  readOnly?: boolean;
  /** Saves the item chosen (null: cleared). */
  onChoose: (id: string | null) => void;
}

/**
 * Cell of one item of a settings list (status, priority, type of a task or a routine): its colored chip; clicking the
 * cell opens the list of chips. Choosing the current value again clears it; archived items are not offered, except the
 * current one.
 * @param {ChipChoiceCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ChipChoiceCell({ value, items, label, readOnly = false, onChoose }: ChipChoiceCellProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const current = items.find((item) => item.id === value);
  const offered = unarchived(items, value);

  /**
   * Saves the chosen item (or clears it when it is the current one).
   * @param {string} id Item id.
   * @returns {void}
   */
  const choose = (id: string) => {
    onChoose(id === value ? null : id);
    combobox.closeDropdown();
  };

  if (readOnly) return current ? <ItemBadge item={current} /> : <span className={classes.placeholder}>—</span>;
  return (
    <Combobox store={combobox} onOptionSubmit={choose} withinPortal position="bottom-start" width="max-content">
      <Combobox.Target>
        <UnstyledButton
          // eslint-disable-next-line no-restricted-syntax -- ChipChoiceCell itself.
          className={classes.chipTrigger}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={combobox.dropdownOpened}
          data-expanded={combobox.dropdownOpened || undefined}
          onClick={(event) => {
            stopClick(event);
            combobox.toggleDropdown();
          }}
        >
          {current ? <ItemBadge item={current} /> : <span className={classes.placeholder}>—</span>}
        </UnstyledButton>
      </Combobox.Target>
      <Combobox.Dropdown onClick={stopClick}>
        <Combobox.Options>
          {offered.length === 0 && <Combobox.Empty>Aucune valeur définie dans les paramètres</Combobox.Empty>}
          {offered.map((item) => (
            <Combobox.Option key={item.id} value={item.id} active={item.id === current?.id}>
              <ItemBadge item={item} />
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
