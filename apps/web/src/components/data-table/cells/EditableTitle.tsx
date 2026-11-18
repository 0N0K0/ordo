import { Group, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useState, type ReactNode } from 'react';
import { Link, type To } from 'react-router';
import classes from './EditableCells.module.css';
import { checked, stopClick, type CellSchema } from './cell-field';

interface EditableTitleProps {
  value: string;
  /** Accessible name of the field when renamed (« Titre de la tâche #12 »). */
  label: string;
  /** Rule of the title (checks and normalizes it). */
  schema: CellSchema<string>;
  /** Page the title opens. Optional. */
  to?: To;
  /** What a click on the title opens, without a page (a form…). Optional. */
  onOpen?: () => void;
  /** Before the title (state icon, number…). Optional. */
  before?: ReactNode;
  /** After the title (sub-items done…). Optional. */
  after?: ReactNode;
  /** Not renamed (an archived row): a click still opens it, with `to` or `onOpen`. Optional. Default = false. */
  readOnly?: boolean;
  onSave: (value: string) => void;
}

/**
 * Title cell of a table: a click on the title opens the row (its page, or what `onOpen` opens); a double-click elsewhere
 * in the cell renames it in place, saved when leaving the field (or Enter) if valid and changed; Escape gives it up.
 * @param {EditableTitleProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EditableTitle({ value, label, schema, to, onOpen, before, after, readOnly = false, onSave }: EditableTitleProps) {
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * Saves the new title when valid and changed.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const result = checked(schema, draft, 'Titre invalide.');
    if (result && result.value !== value) onSave(result.value);
  };

  if (draft !== null) {
    return (
      <TextInput
        size="xs"
        value={draft}
        autoFocus
        aria-label={label}
        onClick={stopClick}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setDraft(null);
        }}
        onBlur={save}
        style={{ flex: 1 }}
      />
    );
  }

  const title = to ? (
    <Text component={Link} to={to} size="sm" fw={500} c="inherit" onClick={stopClick} truncate className={classes.titleLink}>
      {value}
    </Text>
  ) : onOpen ? (
    <UnstyledButton
      onClick={(event) => {
        stopClick(event);
        onOpen();
      }}
      className={classes.titleLink}
      style={{ minWidth: 0 }}
    >
      <Text size="sm" fw={500} truncate>
        {value}
      </Text>
    </UnstyledButton>
  ) : (
    <Text size="sm" fw={500} truncate>
      {value}
    </Text>
  );

  return (
    // The group fills the cell so a double-click on its empty part starts renaming.
    <Group
      gap={6}
      wrap="nowrap"
      className={classes.titleArea}
      title={readOnly ? undefined : 'Double-cliquez pour renommer'}
      onDoubleClick={(event) => {
        // A double-click on the title already opened it.
        if (readOnly || (event.target as HTMLElement).closest('a, button')) return;
        setDraft(value);
      }}
    >
      {before}
      {title}
      {after}
    </Group>
  );
}
