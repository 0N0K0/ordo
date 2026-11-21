import { openFormPanel } from '../../../components/panels/panels';
import { CountdownForm, type CountdownFormProps } from '../components/CountdownForm';

/**
 * Opens the form launching a timer in the side panel (« Nouveau minuteur »; for a dead time: « Lancer un temps mort »),
 * closed once launched.
 * @param {Omit<CountdownFormProps, 'onDone'>} [props] Item and dead times of a dead time launched. Optional.
 * @returns {void}
 */
export function openCountdownForm(props: Omit<CountdownFormProps, 'onDone'> = {}): void {
  const title = props.item ? `Lancer un temps mort · ${props.item.subject}` : 'Nouveau minuteur';
  openFormPanel(title, (close) => <CountdownForm {...props} onDone={close} />, { panelId: 'new-countdown' });
}
