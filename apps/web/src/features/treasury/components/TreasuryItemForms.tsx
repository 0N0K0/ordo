import { SettingsItemForm } from '../../../components/settings/SettingsItemForm';
import { useAccountItems } from '../hooks/use-settings-items';

/**
 * New bank account, with the fields of its settings list.
 * @param {{ onDone: (createdId?: string) => void }} props Component props: closes the form, given the id of the account created (none: cancelled).
 * @returns {JSX.Element} Form.
 */
export function AccountItemForm({ onDone }: { onDone: (createdId?: string) => void }) {
  return <SettingsItemForm {...useAccountItems()} onDone={onDone} />;
}
