import { closePanel, openPanel } from '../../components/panels/panels';
import type { TreasuryAccount } from './api';
import { AccountForm } from './AccountForm';

let panelCount = 0;

/**
 * Opens the form of a bank account in the side panel (new when none given).
 * @param {TreasuryAccount} [account] Account edited. Optional.
 * @returns {void}
 */
export function openAccountForm(account?: TreasuryAccount): void {
  const panelId = `treasury-account-${++panelCount}`;
  openPanel({ panelId, title: account ? 'Modifier le compte' : 'Nouveau compte', children: <AccountForm account={account} onDone={() => closePanel(panelId)} /> });
}
