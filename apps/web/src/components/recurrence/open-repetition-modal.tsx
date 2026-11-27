import type { ReactNode } from 'react';
import { openModal } from '../panels/open-modal';
import { OpenedDraft } from './RepetitionField';

/**
 * Opens a repetition modal (a sub-form of a field: the exceptions of an event…) on a draft of a value, applied on
 * « Appliquer », dropped on « Annuler » (`openModal`, size `xl`, its buttons in its footer always visible).
 * @template V
 * @param {{ title: ReactNode, value: V, editor: (draft: V, setDraft: (value: V) => void) => ReactNode, valid?: (draft: V) => boolean, onApply: (value: V) => void }} options Title, value, settings, validity (optional), applying.
 * @returns {() => void} Closes it.
 */
export function openRepetitionModal<V>({
  title,
  value,
  editor,
  valid,
  onApply,
}: {
  title: ReactNode;
  value: V;
  editor: (draft: V, setDraft: (value: V) => void) => ReactNode;
  valid?: (draft: V) => boolean;
  onApply: (value: V) => void;
}): () => void {
  return openModal(title, (close) => <OpenedDraft value={value} editor={editor} valid={valid} onApply={onApply} onClose={close} />, { size: 'xl' });
}
