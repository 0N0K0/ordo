import { openFormPanel } from '../../../components/panels/panels';
import type { TreasuryAccount } from '../api';
import { AccountForm } from '../components/AccountForm';

/**
 * Opens the form of a bank account in the side panel (new when none given).
 * @param {TreasuryAccount} [account] Account edited. Optional.
 * @returns {void}
 */
export function openAccountForm(account?: TreasuryAccount): void {
  openFormPanel(account ? 'Modifier le compte' : 'Nouveau compte', (close) => <AccountForm account={account} onDone={close} />);
}
