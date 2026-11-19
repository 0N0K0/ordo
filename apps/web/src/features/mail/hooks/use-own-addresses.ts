import { useMemo } from 'react';
import { useMailAccounts } from '../api';

/**
 * Addresses of the user's mail accounts, lowercased: mails sent from one of them show their recipients, replies leave them out.
 * @returns {ReadonlySet<string>} Own addresses.
 */
export function useOwnAddresses(): ReadonlySet<string> {
  const { data: accounts } = useMailAccounts();
  // eslint-disable-next-line no-restricted-syntax -- useOwnAddresses itself.
  return useMemo(() => new Set((accounts ?? []).map((account) => account.email.toLowerCase())), [accounts]);
}
