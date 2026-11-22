import { useState, type ReactNode } from 'react';
import { EditToggle } from '../actions/EditToggle';
import { SubSection } from '../page/SubSection';
import { MarkdownView } from './MarkdownView';
import type { ReferenceTargets } from './remark-references';
import { MarkdownEditor, type MarkdownSuggestions } from './MarkdownEditor';

interface DescriptionSectionProps {
  /** Description as saved (or as typed, in a form). */
  value: string | null | undefined;
  /** What its references (« #12 », « @handle ») link to. */
  targets: ReferenceTargets;
  /** Read only (archived): the text shown only. Optional. Default = false. */
  readOnly?: boolean;
  /** Saves the text once a task box of it is ticked or unticked in place. */
  onCheck: (markdown: string) => void;
  /** Its markdown editor, given its closing (Ctrl/⌘ + Enter) and whether it takes the focus (opened by the pencil). */
  editor: (options: { close: () => void; autoFocus: boolean }) => ReactNode;
}

/**
 * « Description » of the panel of a task, a routine or an event: without any description, its markdown editor shown
 * directly; otherwise the text shown in markdown (its task boxes ticked in place), edited from the pencil, the check
 * going back to the text shown (what was typed is saved by the editor).
 * @param {DescriptionSectionProps} props Component props.
 * @returns {JSX.Element} Section.
 */
export function DescriptionSection({ value, targets, readOnly = false, onCheck, editor }: DescriptionSectionProps) {
  const empty = !value?.trim();
  // Empty when the panel opens: the editor stays while the first words are typed.
  const [editing, setEditing] = useState<'opened' | 'pencil' | false>(empty ? 'opened' : false);
  const shown = !readOnly && (editing !== false || empty);
  return (
    <SubSection title="Description" gap="xs" action={!readOnly && !empty && <EditToggle editing={editing !== false} onChange={(next) => setEditing(next && 'pencil')} what="la description" />}>
      {shown ? (
        editor({ close: () => setEditing(false), autoFocus: editing === 'pencil' })
      ) : (
        <MarkdownView targets={targets} onChange={readOnly ? undefined : onCheck}>
          {value}
        </MarkdownView>
      )}
    </SubSection>
  );
}

interface FormDescriptionProps {
  /** Binding of the description field of the form (`fieldProps('description')` of `useFieldSave`). */
  field: { value: string | null | undefined; onChange: (value: string) => void; onBlur: () => void };
  /** Saves the description now (a task box ticked in place). */
  commit: () => void;
  targets: ReferenceTargets;
  suggestions: MarkdownSuggestions;
  readOnly?: boolean;
}

/**
 * `DescriptionSection` of a panel whose description is a field of its form (a routine, an event): saved on leaving
 * the editor, at once when a task box is ticked.
 * @param {FormDescriptionProps} props Component props.
 * @returns {JSX.Element} Section.
 */
export function FormDescription({ field, commit, targets, suggestions, readOnly = false }: FormDescriptionProps) {
  return (
    <DescriptionSection
      value={field.value}
      targets={targets}
      readOnly={readOnly}
      onCheck={(next) => {
        field.onChange(next);
        commit();
      }}
      editor={({ autoFocus }) => <MarkdownEditor {...field} value={field.value ?? ''} suggestions={suggestions} minRows={3} autoFocus={autoFocus} />}
    />
  );
}
