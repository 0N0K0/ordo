import { Avatar, Group, NumberInput, TextInput } from '@mantine/core';
import { routineSchema } from '@ordo/shared';
import { useState, type KeyboardEvent } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { notifyError } from '../../lib/notify';
import type { TaskContext } from '../tasks/use-task-context';
import classes from '../tasks/views/inline-cells.module.css';
import type { Routine } from './api';

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

interface CellProps<T> {
  value: T;
  label: string;
  readOnly?: boolean;
  onSave: (value: T) => void;
}

/**
 * Title cell: typed in place, saved when leaving the field if valid and changed.
 * @param {CellProps<string>} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TitleCell({ value, label, readOnly = false, onSave }: CellProps<string>) {
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * Saves the draft when valid and changed.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const result = routineSchema.shape.title.safeParse(draft);
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Titre invalide.'} Rien n’a été modifié.`);
      return;
    }
    if (result.data !== value) onSave(result.data);
  };

  return (
    <TextInput
      {...cellField}
      aria-label={label}
      readOnly={readOnly}
      value={draft ?? value}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={save}
      onKeyDown={(event) => cellKeys(event, () => setDraft(null))}
      fw={500}
      style={{ flex: 1, minWidth: 0 }}
    />
  );
}

/**
 * Time to spend on it, in minutes: typed in place, saved when leaving the field if valid and changed.
 * @param {CellProps<number | null>} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EstimateCell({ value, label, readOnly = false, onSave }: CellProps<number | null>) {
  const [draft, setDraft] = useState<string | number | null>(null);

  /**
   * Saves the draft when valid and changed.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const result = routineSchema.shape.estimate.safeParse(draft === '' ? null : Number(draft));
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Durée invalide.'} Rien n’a été modifié.`);
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
      min={1}
      max={24 * 60}
      allowDecimal={false}
      allowNegative={false}
      suffix=" min"
      hideControls
      value={draft ?? value ?? ''}
      onChange={setDraft}
      onBlur={save}
      onKeyDown={(event) => cellKeys(event, () => setDraft(null))}
    />
  );
}

/**
 * Assignees cell: multi-select of the contributors.
 * @param {CellProps<string[]> & { context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function AssigneesCell({ value, label, readOnly = false, onSave, context }: CellProps<string[]> & { context: TaskContext }) {
  return (
    <BatchMultiSelect
      {...cellCombobox}
      classNames={{ ...cellField.classNames, pillsList: classes.pills }}
      aria-label={label}
      readOnly={readOnly}
      data={context.contributors.map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor) }))}
      renderOption={({ option }) => {
        const contributor = context.contributorById.get(option.value);
        return (
          <Group gap="xs" wrap="nowrap">
            <Avatar src={contributor?.avatarUrl} name={contributor?.name} color="initials" size={20} />
            {option.label}
          </Group>
        );
      }}
      value={value}
      onChange={onSave}
      placeholder={readOnly || value.length ? undefined : '—'}
      searchable
    />
  );
}

/**
 * "Dépend de" cell: multi-select of the other routines to do before this one.
 * @param {CellProps<string[]> & { routine: Routine, routines: Routine[] }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RequiresCell({ value, label, readOnly = false, onSave, routine, routines }: CellProps<string[]> & { routine: Routine; routines: Routine[] }) {
  return (
    <BatchMultiSelect
      {...cellCombobox}
      classNames={{ ...cellField.classNames, pillsList: classes.pills }}
      aria-label={label}
      readOnly={readOnly}
      data={routines
        .filter((other) => other.id !== routine.id && (!other.archived || value.includes(other.id)))
        .map((other) => ({ value: other.id, label: other.title }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr'))}
      value={value}
      onChange={onSave}
      placeholder={readOnly || value.length ? undefined : '—'}
      searchable
    />
  );
}
