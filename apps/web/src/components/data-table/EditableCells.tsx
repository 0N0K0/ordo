import { Checkbox, NumberInput, Select, TextInput, type ComboboxItem, type ComboboxLikeRenderOptionInput, type OptionsFilter } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { notifyError } from '../../lib/notify';
import { BatchMultiSelect } from '../BatchMultiSelect';
import classes from './EditableCells.module.css';
import { AmountInput } from '../AmountInput';

/** Borderless field filling the cell; a border shows on hover and focus (as the cells of the task tables). */
const cellField = {
  variant: 'unstyled',
  size: 'xs',
  classNames: { root: classes.root, input: classes.input, section: classes.section },
} as const;

/** Select fields: dropdown as wide as its options. */
const cellCombobox = { ...cellField, comboboxProps: { withinPortal: true, width: 'max-content', position: 'bottom-start' } } as const;

/**
 * Keys of a typed cell: Enter saves (by leaving the field), Escape gives up the draft.
 * @param {KeyboardEvent<HTMLInputElement>} event Key event.
 * @param {() => void} cancel Gives up the draft.
 * @returns {void}
 */
function cellKeys(event: KeyboardEvent<HTMLInputElement>, cancel: () => void): void {
  if (event.key === 'Enter') event.currentTarget.blur();
  if (event.key === 'Escape') {
    cancel();
    event.currentTarget.blur();
  }
}

/**
 * Checks a value before it is saved: an error message stops the save (and is told), nothing lets it through.
 * @param {string | null | undefined} error Error, if any.
 * @returns {boolean} The value can be saved.
 */
function accepted(error: string | null | undefined): boolean {
  if (!error) return true;
  notifyError(`${error} Rien n’a été modifié.`);
  return false;
}

interface EditableTextProps {
  value: string | null;
  /** Accessible name of the field. */
  label: string;
  /** Empty value accepted (saved as null). Optional. Default = false. */
  nullable?: boolean;
  /** Error of a value, if any (stops the save). Optional. */
  validate?: (value: string) => string | null;
  readOnly?: boolean;
  /** Text in bold (the name of the row). Optional. */
  strong?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Text cell: typed in place, saved when leaving the field (or Enter) if valid and changed; Escape gives it up.
 * @param {EditableTextProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableText({ value, label, nullable = false, validate, readOnly = false, strong = false, onSave }: EditableTextProps) {
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * Saves the draft when valid and changed.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const typed = draft.trim();
    if (!accepted(!typed && !nullable ? 'Une valeur est requise.' : validate?.(typed))) return;
    const next = typed || null;
    if (next !== (value ?? null)) onSave(next);
  };

  return (
    <TextInput
      {...cellField}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      value={draft ?? value ?? ''}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={save}
      onKeyDown={(event) => cellKeys(event, () => setDraft(null))}
      fw={strong ? 600 : undefined}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

interface EditableNumberProps {
  value: number | null;
  label: string;
  /** Decimals. Optional. Default = 2. */
  decimals?: number;
  /** An amount: typed with up to 4 decimals, shown rounded to 2 (AmountInput). Optional. Default = false. */
  amount?: boolean;
  /** After the number (« € », « % »…). Optional. */
  suffix?: string;
  /** Negative numbers accepted. Optional. Default = false. */
  signed?: boolean;
  nullable?: boolean;
  validate?: (value: number) => string | null;
  readOnly?: boolean;
  onSave: (value: number | null) => void;
}

/**
 * Number or amount cell: typed in place, right-aligned, saved when leaving the field if valid and changed.
 * @param {EditableNumberProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableNumber({ value, label, decimals = 2, amount = false, suffix, signed = false, nullable = false, validate, readOnly = false, onSave }: EditableNumberProps) {
  const [draft, setDraft] = useState<string | number | null>(null);

  /**
   * Saves the draft when valid and changed.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const next = draft === '' ? null : Number(draft);
    if (next === null ? !accepted(nullable ? null : 'Une valeur est requise.') : !accepted(Number.isFinite(next) ? validate?.(next) : 'Nombre invalide.')) return;
    if (next !== value) onSave(next);
  };

  const Field = amount ? AmountInput : NumberInput;
  return (
    <Field
      {...cellField}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      decimalScale={decimals}
      decimalSeparator=","
      thousandSeparator=" "
      suffix={suffix ? ` ${suffix}` : undefined}
      allowNegative={signed}
      hideControls
      value={draft ?? value ?? ''}
      onChange={setDraft}
      onBlur={save}
      onKeyDown={(event) => cellKeys(event, () => setDraft(null))}
      onClick={(event) => event.stopPropagation()}
      styles={{ input: { textAlign: 'right' } }}
    />
  );
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
      onClick={(event) => event.stopPropagation()}
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
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Choice cell: one of a list (searched), saved once chosen.
 * @param {EditableSelectProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableSelect({ value, label, data, nullable = false, renderOption, filter, leftSection, readOnly = false, onSave }: EditableSelectProps) {
  return (
    <Select
      {...cellCombobox}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      clearable={nullable && !readOnly}
      allowDeselect={nullable}
      searchable
      data={data}
      renderOption={renderOption}
      filter={filter}
      leftSection={leftSection}
      value={value}
      onChange={(next) => (next || nullable) && next !== value && onSave(next)}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

interface EditableMultiSelectProps {
  value: string[];
  label: string;
  data: (ComboboxItem | { group: string; items: ComboboxItem[] })[];
  renderOption?: (item: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode;
  filter?: OptionsFilter;
  readOnly?: boolean;
  onSave: (value: string[]) => void;
}

/**
 * Choices cell: several of a list, saved once the list closes.
 * @param {EditableMultiSelectProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableMultiSelect({ value, label, data, renderOption, filter, readOnly = false, onSave }: EditableMultiSelectProps) {
  return (
    <BatchMultiSelect
      {...cellCombobox}
      classNames={{ ...cellField.classNames, pillsList: classes.pills }}
      aria-label={label}
      placeholder={readOnly || value.length ? undefined : '—'}
      readOnly={readOnly}
      searchable
      data={data}
      renderOption={renderOption}
      filter={filter}
      value={value}
      onChange={(next) => onSave(next)}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

/**
 * Yes / no cell: ticked in place, saved at once.
 * @param {{ value: boolean, label: string, readOnly?: boolean, onSave: (value: boolean) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableCheck({ value, label, readOnly = false, onSave }: { value: boolean; label: string; readOnly?: boolean; onSave: (value: boolean) => void }) {
  return <Checkbox size="xs" aria-label={label} checked={value} disabled={readOnly} onChange={(event) => onSave(event.currentTarget.checked)} onClick={(event) => event.stopPropagation()} />;
}
