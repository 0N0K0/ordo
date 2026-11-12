import { ActionIcon, Autocomplete, ColorSwatch, Group, NumberInput, Select, TextInput, Tooltip } from '@mantine/core';
import { shoppingItemSchema } from '@ordo/shared';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { useState, type KeyboardEvent } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { notifyError } from '../../lib/notify';
import classes from '../tasks/views/inline-cells.module.css';
import type { ShoppingStore } from './api';
import { UNITS, usePeople } from './shopping-format';

/** Borderless field filling the cell; a border shows on hover and focus (as the cells of the task tables). */
const cellField = {
  variant: 'unstyled',
  size: 'xs',
  classNames: { root: classes.root, input: classes.input, section: classes.section },
} as const;

/** Select fields: dropdown as wide as its options. */
const cellCombobox = { ...cellField, comboboxProps: { withinPortal: true, width: 'max-content', position: 'bottom-start' } } as const;

/**
 * Keys of a text cell: Enter saves (by leaving the field), Escape gives up the draft.
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
 * Validates a typed value with the rule of its field.
 * @param {'name' | 'unit' | 'url'} field Field.
 * @param {string} value Typed value.
 * @returns {{ ok: true, value: string | null } | { ok: false }} Value, or failure (reported).
 */
function checkText(field: 'name' | 'unit' | 'url', value: string): { ok: true; value: string | null } | { ok: false } {
  const result = shoppingItemSchema.shape[field].safeParse(value);
  if (result.success) return { ok: true, value: result.data };
  notifyError(`${result.error.issues[0]?.message ?? 'Valeur invalide.'} Rien n’a été modifié.`);
  return { ok: false };
}

interface TextCellProps {
  field: 'name' | 'url';
  value: string | null;
  label: string;
  placeholder?: string;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Name or link cell: typed in place, saved when leaving the field if valid and changed; a link can be opened.
 * @param {TextCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TextCell({ field, value, label, placeholder = '—', readOnly = false, onSave }: TextCellProps) {
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * Saves the draft when valid and changed.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const result = checkText(field, draft);
    if (result.ok && result.value !== value) onSave(result.value);
  };

  const input = (
    <TextInput
      {...cellField}
      type={field === 'url' ? 'url' : 'text'}
      aria-label={label}
      placeholder={readOnly ? undefined : placeholder}
      readOnly={readOnly}
      value={draft ?? value ?? ''}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={save}
      onKeyDown={(event) => cellKeys(event, () => setDraft(null))}
      fw={field === 'name' ? 500 : undefined}
      style={{ flex: 1, minWidth: 0 }}
    />
  );
  if (field !== 'url' || !value) return input;
  return (
    <Group gap={2} wrap="nowrap">
      {input}
      <Tooltip label={value}>
        <ActionIcon component="a" href={value} target="_blank" rel="noopener noreferrer" size="sm" variant="subtle" color="gray" aria-label={`Ouvrir ${value}`}>
          <ArrowSquareOutIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

interface UnitCellProps {
  value: string | null;
  label: string;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Unit cell: one of the usual units, or any other typed.
 * @param {UnitCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function UnitCell({ value, label, readOnly = false, onSave }: UnitCellProps) {
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * Saves a unit when valid and changed.
   * @param {string} typed Unit typed or chosen.
   * @returns {void}
   */
  const save = (typed: string) => {
    setDraft(null);
    const result = checkText('unit', typed);
    if (result.ok && result.value !== value) onSave(result.value);
  };

  return (
    <Autocomplete
      {...cellCombobox}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      data={UNITS}
      value={draft ?? value ?? ''}
      onChange={setDraft}
      onOptionSubmit={save}
      onBlur={() => draft !== null && save(draft)}
      onKeyDown={(event) => cellKeys(event, () => setDraft(null))}
    />
  );
}

interface NumberCellProps {
  value: number | null;
  label: string;
  /** Price (2 decimals, in euros) or quantity (3 decimals, more than 0). */
  kind: 'price' | 'quantity';
  readOnly?: boolean;
  onSave: (value: number | null) => void;
}

/**
 * Quantity or unit price cell: typed in place, saved when leaving the field if valid and changed.
 * @param {NumberCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function NumberCell({ value, label, kind, readOnly = false, onSave }: NumberCellProps) {
  const [draft, setDraft] = useState<string | number | null>(null);

  /**
   * Saves the draft when valid and changed.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const number = draft === '' ? null : Number(draft);
    const result = shoppingItemSchema.shape[kind === 'price' ? 'unitPrice' : 'quantity'].safeParse(number);
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Nombre invalide.'} Rien n’a été modifié.`);
      return;
    }
    if (result.data !== value) onSave(result.data);
  };

  return (
    <NumberInput
      {...cellField}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      min={0}
      decimalScale={kind === 'price' ? 2 : 3}
      decimalSeparator=","
      thousandSeparator=" "
      suffix={kind === 'price' ? ' €' : undefined}
      allowNegative={false}
      hideControls
      value={draft ?? value ?? ''}
      onChange={setDraft}
      onBlur={save}
      onKeyDown={(event) => cellKeys(event, () => setDraft(null))}
      styles={{ input: { textAlign: 'right' } }}
    />
  );
}

interface StoreCellProps {
  value: string | null;
  stores: ShoppingStore[];
  label: string;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Store cell: one of the stores of the settings, or none.
 * @param {StoreCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function StoreCell({ value, stores, label, readOnly = false, onSave }: StoreCellProps) {
  const color = stores.find((store) => store.id === value)?.color;
  return (
    <Select
      {...cellCombobox}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      clearable={!readOnly}
      searchable
      data={stores.map((store) => ({ value: store.id, label: store.name }))}
      renderOption={({ option }) => (
        <Group gap="xs" wrap="nowrap">
          <ColorSwatch color={stores.find((store) => store.id === option.value)?.color ?? 'gray'} size={10} />
          {option.label}
        </Group>
      )}
      leftSection={color ? <ColorSwatch color={color} size={10} /> : undefined}
      nothingFoundMessage="Aucun magasin (ajoutez-en dans les paramètres)"
      value={value}
      onChange={(storeId) => storeId !== value && onSave(storeId)}
    />
  );
}

interface PeopleCellProps {
  memberIds: string[];
  relationIds: string[];
  label: string;
  readOnly?: boolean;
  onSave: (people: { memberIds: string[]; relationIds: string[] }) => void;
}

/**
 * "Pour" cell: members of the team or household and relations the row is for (saved when the list closes).
 * @param {PeopleCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function PeopleCell({ memberIds, relationIds, label, readOnly = false, onSave }: PeopleCellProps) {
  const people = usePeople();
  return (
    <BatchMultiSelect
      {...cellCombobox}
      classNames={{ ...cellField.classNames, pillsList: classes.pills }}
      aria-label={label}
      placeholder={readOnly || memberIds.length + relationIds.length ? undefined : '—'}
      readOnly={readOnly}
      data={people.options}
      searchable
      value={[...memberIds.map((id) => `m:${id}`), ...relationIds.map((id) => `r:${id}`)]}
      onChange={(keys) =>
        onSave({ memberIds: keys.filter((key) => key.startsWith('m:')).map((key) => key.slice(2)), relationIds: keys.filter((key) => key.startsWith('r:')).map((key) => key.slice(2)) })
      }
    />
  );
}
