import { openFormPanel } from '../panels/panels';
import { NameForm, type NameFormProps } from './NameForm';

/**
 * Opens the form of a single name in the side panel (`NameForm`), closed once saved or cancelled.
 * @param {string} title Title of the panel (« Renommer le tableau de bord »).
 * @param {Omit<NameFormProps, 'onDone'>} props The form's props, but its closing.
 * @returns {void}
 */
export function openNameForm(title: string, props: Omit<NameFormProps, 'onDone'>): void {
  openFormPanel(title, (close) => <NameForm {...props} onDone={close} />);
}
