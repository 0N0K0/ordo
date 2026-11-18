import { openFormPanel } from '../panels/panels';
import { LabelForm, type LabelFormProps } from './LabelForm';

/**
 * Opens the form of a single label in the side panel (`LabelForm`), closed once saved or cancelled.
 * @param {string} title Title of the panel (« Renommer le tableau de bord »).
 * @param {Omit<LabelFormProps, 'onDone'>} props The form's props, but its closing.
 * @returns {void}
 */
export function openLabelForm(title: string, props: Omit<LabelFormProps, 'onDone'>): void {
  openFormPanel(title, (close) => <LabelForm {...props} onDone={close} />);
}
