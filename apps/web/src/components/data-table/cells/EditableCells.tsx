import { IconAction } from '../../actions/IconAction';
import { Anchor, Popover, Group, NumberInput, Text, TextInput, type ComboboxItem, type ComboboxLikeRenderOptionInput, type OptionsFilter } from '@mantine/core';
import { TimePicker } from '@mantine/dates';
import { DateField } from '../../inputs/DateField';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import classes from './EditableCells.module.css';
import { markdownSchema } from '@ordo/shared';
import { MarkdownEditor, type MarkdownSuggestions } from '../../markdown/MarkdownEditor';
import { NO_SUGGESTIONS } from '../../markdown/remark-references';
import { BatchMultiSelect } from '../../inputs/BatchMultiSelect';
import { StackedMultiCell, type StackedItem } from './StackedMultiCell';
import { StackedLines } from './StackedValues';
import { AmountInput } from '../../inputs/AmountInput';
import { currencySymbol } from '../../../lib/format';
import { accepted, checked, stopClick, stoppedCellCombobox, stoppedCellField, useCellDraft, type CellSchema } from './cell-field';
import { FRENCH_NUMBER_FORMAT } from '../../inputs/number-format';
import { EXTERNAL_LINK } from '../../actions/link-props';
import { CreatableSelect } from '../../inputs/CreatableSelect';

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
      {...stoppedCellField}
      type={link ? 'url' : 'text'}
      aria-label={label}
      placeholder={readOnly ? undefined : placeholder}
      readOnly={readOnly}
      value={draft ?? value ?? ''}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={save}
      onKeyDown={onKeyDown}
      fw={strong ? 500 : undefined}
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
      {...stoppedCellField}
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
      // At the end, unless its column is aligned otherwise (a duration: centred; DataTable.module.css).
      // eslint-disable-next-line no-restricted-syntax -- a number field: at the end out of a table.
      styles={{ input: { textAlign: 'var(--cell-text-align, right)' as CSSProperties['textAlign'] } }}
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
  return <TimePicker {...stoppedCellField} classNames={{ ...stoppedCellField.classNames, fieldsRoot: classes.timeFields }} aria-label={label} readOnly={readOnly} clearable={clearable} value={value} onChange={(next) => next !== value && onSave(next)} />;
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
    <DateField
      {...stoppedCellField}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      clearable={nullable && !readOnly}
      minDate={minDate}
      popoverProps={{ withinPortal: true }}
      value={value}
      onChange={(next) => (next || nullable) && (next ?? null) !== value && onSave(next ?? null)}
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
  /** Creates a choice named as typed (a setting: category, context…), resolving its value: it is then saved. Optional. */
  onCreate?: (label: string) => Promise<string | null | undefined>;
  onSave: (value: string | null) => void;
}

/**
 * Choice cell: one of a list (searched), saved once chosen; with `onCreate`, what is typed can be created.
 * @param {EditableSelectProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableSelect({ value, label, data, nullable = false, renderOption, filter, leftSection, placeholder = '—', nothingFoundMessage, readOnly = false, onCreate, onSave }: EditableSelectProps) {
  return (
    <CreatableSelect
      onCreate={readOnly ? undefined : onCreate}
      {...stoppedCellCombobox}
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
    />
  );
}

interface CellMultiSelectProps {
  value: string[];
  /** Accessible name. */
  label: string;
  data: (ComboboxItem | { group: string; items: ComboboxItem[] })[];
  renderOption?: (item: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode;
  filter?: OptionsFilter;
  /** Shown when the search finds nothing. Optional. */
  nothingFoundMessage?: string;
  onSave: (value: string[]) => void;
  /** Its list closed (from `StackedMultiCell`). */
  onDropdownClose: () => void;
}

/**
 * Multi-select of a choices cell, opened by `StackedMultiCell` (`EditableMultiSelect`, or a cell loading its options
 * once opened): its choices saved once its list closes.
 * @param {CellMultiSelectProps} props Component props.
 * @returns {JSX.Element} Multi-select.
 */
export function CellMultiSelect({ value, label, data, renderOption, filter, nothingFoundMessage, onSave, onDropdownClose }: CellMultiSelectProps) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- CellMultiSelect itself.
    <BatchMultiSelect
      {...stoppedCellCombobox}
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
    />
  );
}

interface EditableMultiSelectProps extends Omit<CellMultiSelectProps, 'onDropdownClose'> {
  /** Values as listed in the cell (an avatar, a state…). Optional. Default = their labels. */
  items?: StackedItem[];
  readOnly?: boolean;
}

/**
 * Choices cell: several of a list, one under the other (5 at most; beyond, 4 and « X de plus »); a click opens their
 * list, saved once it closes.
 * @param {EditableMultiSelectProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableMultiSelect({ items, readOnly = false, ...select }: EditableMultiSelectProps) {
  const labels = new Map(select.data.flatMap((item) => ('group' in item ? item.items : [item])).map((item) => [item.value, item.label]));
  return (
    <StackedMultiCell
      label={select.label}
      readOnly={readOnly}
      items={items ?? select.value.map((id) => ({ id, label: labels.get(id) ?? id }))}
      renderSelect={({ onDropdownClose }) => <CellMultiSelect {...select} onDropdownClose={onDropdownClose} />}
    />
  );
}

interface EditablePopoverCellProps {
  /** What the cell shows (« — » when empty; with `lines`, shown without any line). */
  target: ReactNode;
  /** Several values, shown one under the other in place of `target` (`StackedLines`). Optional. */
  lines?: readonly string[];
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
export function EditablePopoverCell({ target, lines, empty = false, label, width, truncate = false, opened, onOpenedChange, onClose, readOnly = false, children }: EditablePopoverCellProps) {
  /**
   * The value shown: read only, or the link opening the editor.
   * @param {ReactNode} content Value (or its lines).
   * @returns {JSX.Element} Value.
   */
  const shown = (content: ReactNode) =>
    readOnly ? (
      <Text component="div" size="sm" c={empty ? 'dimmed' : undefined} aria-label={label} truncate={truncate}>
        {content}
      </Text>
    ) : (
      <Popover opened={opened} onChange={onOpenedChange} onClose={onClose} position="bottom-start" withinPortal shadow="md" width={width}>
        <Popover.Target>
          <Anchor
            // eslint-disable-next-line no-restricted-syntax -- the value of the cell, shown as a link that opens its editor.
            component="button"
            type="button"
            size="sm"
            c={empty ? 'dimmed' : undefined}
            aria-label={label}
            onClick={(event) => {
              stopClick(event);
              if (onOpenedChange) onOpenedChange(!opened);
            }}
            // Aligned as the cells of its column (DataTable.module.css).
            // eslint-disable-next-line no-restricted-syntax -- the value of a cell, aligned as its column.
            style={{ textAlign: 'var(--cell-text-align, left)' as CSSProperties['textAlign'], maxWidth: '100%' }}
            truncate={truncate}
          >
            {content}
          </Anchor>
        </Popover.Target>
        <Popover.Dropdown onClick={stopClick}>{children}</Popover.Dropdown>
      </Popover>
    );
  return lines?.length ? <StackedLines lines={lines} wrap={shown} /> : shown(target);
}

interface EditableMarkdownProps {
  value: string | null;
  /** Accessible name of the cell. */
  label: string;
  /** Items offered when typing "#" and "@". Optional. Default = none. */
  suggestions?: MarkdownSuggestions;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Markdown cell (a note, a description): its text cut on one line, written in the shared markdown editor opened in a
 * popover, saved when it closes if changed (blank: none).
 * @param {EditableMarkdownProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableMarkdown({ value, label, suggestions = NO_SUGGESTIONS, readOnly = false, onSave }: EditableMarkdownProps) {
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * Saves the draft when valid and changed, then clears it.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const result = checked(markdownSchema, draft, 'Valeur invalide.');
    if (result && result.value !== (value ?? null)) onSave(result.value);
  };

  return (
    <EditablePopoverCell width={420} empty={!value} label={label} truncate readOnly={readOnly} opened={opened} onOpenedChange={setOpened} onClose={save} target={value || '—'}>
      <MarkdownEditor value={draft ?? value ?? ''} onChange={setDraft} suggestions={suggestions} minRows={3} autoFocus />
    </EditablePopoverCell>
  );
}
