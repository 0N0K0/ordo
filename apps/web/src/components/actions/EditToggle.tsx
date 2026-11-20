import { CheckIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { IconAction } from './IconAction';

/**
 * Pencil of a section edited in place in a detail panel saved field by field (decision D22): opens its editor; while
 * editing, a check goes back to what is shown (what was typed is saved already, on leaving the editor).
 * @param {{ editing: boolean, onChange: (editing: boolean) => void, what: string }} props Whether it is edited, its change, and what is edited (« les liens », « la description »).
 * @returns {JSX.Element} Action.
 */
export function EditToggle({ editing, onChange, what }: { editing: boolean; onChange: (editing: boolean) => void; what: string }) {
  return editing ? (
    <IconAction label={`Terminer la modification de ${what}`} size="sm" onClick={() => onChange(false)}>
      <CheckIcon aria-hidden />
    </IconAction>
  ) : (
    <IconAction label={`Modifier ${what}`} size="sm" onClick={() => onChange(true)}>
      <PencilSimpleIcon aria-hidden />
    </IconAction>
  );
}
