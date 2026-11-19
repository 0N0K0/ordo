import { IconAction } from '../../actions/IconAction';
import { Anchor, Checkbox, Popover, Group, NumberInput, Select, Text, TextInput, type ComboboxItem, type ComboboxLikeRenderOptionInput, type OptionsFilter } from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { BatchMultiSelect } from '../../inputs/BatchMultiSelect';
import { StackedMultiCell, type StackedItem } from './StackedMultiCell';
import { AmountInput } from '../../inputs/AmountInput';
import { currencySymbol } from '../../../lib/format';
import { accepted, cellCombobox, cellField, checked, stopClick, useCellDraft, type CellSchema } from './cell-field';
import { FRENCH_NUMBER_FORMAT } from '../../inputs/number-format';
import { EXTERNAL_LINK } from '../../actions/link-props';

interface EditableTextProps {
  value: string | null;
  /** Accessible name of the field. */
  label: string;
  /** Empty value accepted (saved as null). Optional. Default = false. */
  nullable?: boolean;
  /** Error of a value, if any (stops the save). Optional. */
  validate?: (value: string) => string | null;
  /** Rule of the field (checks and normalizes the value typed, instead of `nullable` and `validate`). Optional. */
  schema?: CellSchema<string | null>;
  /** Shown when empty. Optional. Default = « — ». */
  placeholder?: string;
  /** A web link: typed as one, opened by a button beside it. Optional. Default = false. */
  link?: boolean;
  readOnly?: boolean;
  /** Text in bold (the name of the row). Optional. */
  strong?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Text cell: typed in place, saved when leaving the field (or Enter) if valid and changed; Escape gives it up. A link
 * can be opened.
 * @param {EditableTextProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableText({ value, label, nullable = false, validate, schema, placeholder = '—', link = false, readOnly = false, strong = false, onSave }: EditableTextProps) {
  const { draft, setDraft, take, onKeyDown } = useCellDraft<string>();

  /**
   * Saves the draft when valid and changed (none after Escape).
   * @returns {void}
   */
  const save = () => {
    const draft = take();
    if (draft === null) return;
    let next: string | null;
    if (schema) {
      const result = checked(schema, draft, 'Valeur invalide.');
      if (!result) return;
      next = result.value;
    } else {
      const typed = draft.trim();
      if (!accepted(!typed && !nullable ? 'Une valeur est requise.' : validate?.(typed))) return;
      next = typed || null;
    }
    if (next !== (value ?? null)) onSave(next);
  };

  const input = (
    <TextInput
      {...cellField}
      type={link ? 'url' : 'text'}
      aria-label={label}
      placeholder={readOnly ? undefined : placeholder}
      readOnly={readOnly}
      value={draft ?? value ?? ''}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={save}
      onKeyDown={onKeyDown}
      fw={strong ? 500 : undefined}
      onClick={stopClick}
      style={{ flex: 1, minWidth: 0 }}
    />
  );
  if (!link || !value) return input;
  return (
    <Group gap={2} wrap="nowrap">
      {input}
      <IconAction label="Ouvrir le lien" item={value} hint={value} component="a" href={value} {...EXTERNAL_LINK} size="sm" onClick={stopClick}>
        <ArrowSquareOutIcon aria-hidden />
      </IconAction>
    </Group>
  );
}

interface EditableNumberProps {
  value: number | null;
  label: string;
  /** Decimals (0: whole numbers). Optional. Default = 2. */
  decimals?: number;
  /** An amount: typed with up to 4 decimals, shown rounded to 2, followed by « € » (AmountInput). Optional. Default = false. */
  amount?: boolean;
  /** After the number (« % », « min »…; an amount: « € » by default). Optional. */
  suffix?: string;
  /** Negative numbers accepted. Optional. Default = false. */
  signed?: boolean;
  /** Bounds. Optional. */
  min?: number;
  max?: number;
  nullable?: boolean;
  validate?: (value: number) => string | null;
  /** Rule of the field (checks and normalizes the value typed, instead of `nullable` and `validate`). Optional. */
  schema?: CellSchema<number | null>;
  /** Saved even when unchanged (a cell of a selection gives its value to the others). Optional. Default = false. */
  saveUnchanged?: boolean;
  readOnly?: boolean;
  onSave: (value: number | null) => void;
}

/**
 * Number or amount cell: typed in place, right-aligned, saved when leaving the field if valid and changed.
 * @param {EditableNumberProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableNumber({
  value,
  label,
  decimals = 2,
  amount = false,
  suffix,
  signed = false,
  min,
  max,
  nullable = false,
  validate,
  schema,
  saveUnchanged = false,
  readOnly = false,
  onSave,
}: EditableNumberProps) {
  const { draft, setDraft, take, onKeyDown } = useCellDraft<string | number>();

  /**
   * Saves the draft when valid and changed (none after Escape).
   * @returns {void}
   */
  const save = () => {
    const draft = take();
    if (draft === null) return;
    const typed = draft === '' ? null : Number(draft);
    let next: number | null;
    if (schema) {
      const result = checked(schema, typed, 'Nombre invalide.');
      if (!result) return;
      next = result.value;
    } else {
      if (typed === null ? !accepted(nullable ? null : 'Une valeur est requise.') : !accepted(Number.isFinite(typed) ? validate?.(typed) : 'Nombre invalide.')) return;
      next = typed;
    }
    if (next !== value || saveUnchanged) onSave(next);
  };

  const Field = amount ? AmountInput : NumberInput;
  const unit = suffix ?? (amount ? currencySymbol() : undefined);
  return (
    <Field
      {...cellField}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      decimalScale={decimals}
      allowDecimal={decimals > 0}
      {...FRENCH_NUMBER_FORMAT}
      suffix={unit ? ` ${unit}` : undefined}
      allowNegative={signed}
      min={min}
      max={max}
      hideControls
      value={draft ?? value ?? ''}
      onChange={setDraft}
      onBlur={save}
      onKeyDown={onKeyDown}
      onClick={stopClick}
      styles={{ input: { textAlign: 'right' } }}
    />
  );
}

interface EditableTimeProps {
  /** HH:MM; empty: none. */
  value: string;
  label: string;
  /** May be cleared (saved as « »). Optional. Default = false. */
  clearable?: boolean;
  readOnly?: boolean;
  onSave: (value: string) => void;
}

/**
 * Time of day cell: picked in place (24-hour format), saved when changed.
 * @param {EditableTimeProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableTime({ value, label, clearable = false, readOnly = false, onSave }: EditableTimeProps) {
  return <TimePicker {...cellField} aria-label={label} readOnly={readOnly} clearable={clearable} value={value} onChange={(next) => next !== value && onSave(next)} onClick={stopClick} />;
}

interface EditableDateProps {
  /** YYYY-MM-DD. */
  value: string | null;
  label: string;
  nullable?: boolean;
  /** Earliest day. Optional. */
  minDate?: string;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Date cell: picked in place, saved once picked (or cleared, when it may be empty).
 * @param {EditableDateProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableDate({ value, label, nullable = false, minDate, readOnly = false, onSave }: EditableDateProps) {
  return (
    <DatePickerInput
      {...cellField}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      clearable={nullable && !readOnly}
      minDate={minDate}
      popoverProps={{ withinPortal: true }}
      value={value}
      onChange={(next) => (next || nullable) && (next ?? null) !== value && onSave(next ?? null)}
      onClick={stopClick}
    />
  );
}

interface EditableSelectProps {
  value: string | null;
  label: string;
  data: (ComboboxItem | { group: string; items: ComboboxItem[] })[];
  nullable?: boolean;
  /** Look of an option. Optional. */
  renderOption?: (item: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode;
  /** Search of the options (a tree keeps the parents of what is found). Optional. */
  filter?: OptionsFilter;
  /** Before the value (its color…). Optional. */
  leftSection?: ReactNode;
  /** Shown when empty. Optional. Default = « — ». */
  placeholder?: string;
  /** Shown when the search finds nothing. Optional. */
  nothingFoundMessage?: string;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Choice cell: one of a list (searched), saved once chosen.
 * @param {EditableSelectProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableSelect({ value, label, data, nullable = false, renderOption, filter, leftSection, placeholder = '—', nothingFoundMessage, readOnly = false, onSave }: EditableSelectProps) {
  return (
    <Select
      {...cellCombobox}
      aria-label={label}
      placeholder={readOnly ? undefined : placeholder}
      readOnly={readOnly}
      clearable={nullable && !readOnly}
      allowDeselect={nullable}
      searchable
      data={data}
      renderOption={renderOption}
      filter={filter}
      leftSection={leftSection}
      nothingFoundMessage={nothingFoundMessage}
      value={value}
      onChange={(next) => (next || nullable) && next !== value && onSave(next)}
      onClick={stopClick}
    />
  );
}

interface EditableMultiSelectProps {
  value: string[];
  label: string;
  data: (ComboboxItem | { group: string; items: ComboboxItem[] })[];
  /** Values as listed in the cell (an avatar, a state…). Optional. Default = their labels. */
  items?: StackedItem[];
  renderOption?: (item: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode;
  filter?: OptionsFilter;
  /** Shown when the search finds nothing. Optional. */
  nothingFoundMessage?: string;
  readOnly?: boolean;
  onSave: (value: string[]) => void;
}

/**
 * Choices cell: several of a list, one under the other (5 at most; beyond, 4 and « X de plus »); a click opens their
 * list, saved once it closes.
 * @param {EditableMultiSelectProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableMultiSelect({ value, label, data, items, renderOption, filter, nothingFoundMessage, readOnly = false, onSave }: EditableMultiSelectProps) {
  const labels = new Map(data.flatMap((item) => ('group' in item ? item.items : [item])).map((item) => [item.value, item.label]));
  return (
    <StackedMultiCell
      label={label}
      readOnly={readOnly}
      items={items ?? value.map((id) => ({ id, label: labels.get(id) ?? id }))}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellCombobox}
          aria-label={label}
          placeholder={value.length ? undefined : '—'}
          searchable
          data={data}
          renderOption={renderOption}
          filter={filter}
          nothingFoundMessage={nothingFoundMessage}
          value={value}
          onChange={(next) => onSave(next)}
          onDropdownClose={onDropdownClose}
          onClick={stopClick}
        />
      )}
    />
  );
}

/**
 * Yes / no cell: ticked in place, saved at once.
 * @param {{ value: boolean, label: string, readOnly?: boolean, onSave: (value: boolean) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableCheck({ value, label, readOnly = false, onSave }: { value: boolean; label: string; readOnly?: boolean; onSave: (value: boolean) => void }) {
  return <Checkbox size="xs" aria-label={label} checked={value} disabled={readOnly} onChange={(event) => onSave(event.currentTarget.checked)} onClick={stopClick} />;
}

interface EditablePopoverCellProps {
  /** What the cell shows (« — » when empty). */
  target: ReactNode;
  /** The cell is empty: shown dimmed. Optional. Default = false. */
  empty?: boolean;
  /** Accessible name of the cell. Optional. */
  label?: string;
  /** Width of the editor. */
  width: number;
  /** Long values are cut. Optional. Default = false. */
  truncate?: boolean;
  /** Its editor is open (controlled). Optional. */
  opened?: boolean;
  onOpenedChange?: (opened: boolean) => void;
  /** After the editor closes. Optional. */
  onClose?: () => void;
  /** Only shown (archived row…): no editor. Optional. Default = false. */
  readOnly?: boolean;
  /** Editor. */
  children: ReactNode;
}

/**
 * Cell whose value opens its editor in a popover (a place, alerts, a rule): the value as a link, dimmed when empty, its
 * clicks kept from the row.
 * @param {EditablePopoverCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditablePopoverCell({ target, empty = false, label, width, truncate = false, opened, onOpenedChange, onClose, readOnly = false, children }: EditablePopoverCellProps) {
  if (readOnly) {
    return (
      <Text component="div" size="sm" c={empty ? 'dimmed' : undefined} aria-label={label} truncate={truncate}>
        {target}
      </Text>
    );
  }
  return (
    <Popover opened={opened} onChange={onOpenedChange} onClose={onClose} position="bottom-start" withinPortal shadow="md" width={width}>
      <Popover.Target>
        <Anchor
          component="button"
          type="button"
          size="sm"
          c={empty ? 'dimmed' : undefined}
          aria-label={label}
          onClick={(event) => {
            stopClick(event);
            if (onOpenedChange) onOpenedChange(!opened);
          }}
          style={{ textAlign: 'left' }}
          truncate={truncate}
        >
          {target}
        </Anchor>
      </Popover.Target>
      <Popover.Dropdown onClick={stopClick}>{children}</Popover.Dropdown>
    </Popover>
  );
}
