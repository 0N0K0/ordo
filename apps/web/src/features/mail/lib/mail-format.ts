import * as fmt from '../../../lib/format';
import type { YesNoStates } from '../../../components/data-table/table/data-table';

/** States of « Traité » of mails: on the state button of their toolbar, and the mark of a row of a list. */
export const MAIL_DONE_STATES: YesNoStates = {
  labels: { yes: 'Traité', no: 'À traiter' },
  toggleLabels: { yes: 'Marquer comme traité', no: 'Marquer comme à traiter' },
};

/** Address of a mail, as returned by the API. */
export interface Address {
  name?: string | null;
  address: string;
}

/**
 * "Name <address>", or the address alone.
 * @param {Address} address Address.
 * @returns {string} Label.
 */
export function addressLabel(address: Address): string {
  return address.name ? `${address.name} <${address.address}>` : address.address;
}

/**
 * A mail account as shown everywhere: « Name <address> », or the address alone.
 * @param {{ displayName?: string | null, email: string }} account Account.
 * @returns {string} Label.
 */
export function accountLabel(account: { displayName?: string | null; email: string }): string {
  return addressLabel({ name: account.displayName, address: account.email });
}

/**
 * Short name of a sender: its name, or its address.
 * @param {Address[]} addresses Addresses.
 * @returns {string} Label.
 */
export function senderName(addresses: Address[]): string {
  const first = addresses[0];
  return first ? first.name || first.address : '(inconnu)';
}

/**
 * Correspondent shown in a list: the recipients ("À : …") of a mail sent from one of the user's addresses,
 * else its sender; whatever the folder (folders mix sent and received mails).
 * @param {{ from: Address[], to: Address[] }} mail Mail.
 * @param {ReadonlySet<string>} own The user's addresses, in lower case.
 * @returns {string} Label.
 */
export function correspondent(mail: { from: Address[]; to: Address[] }, own: ReadonlySet<string>): string {
  const sent = mail.from.some((address) => own.has(address.address.toLowerCase()));
  return sent && mail.to.length ? `À : ${senderName(mail.to)}` : senderName(mail.from);
}

/**
 * Date of a mail in a list: time today, day this year, full date before.
 * @param {string} iso Date.
 * @returns {string} Label.
 */
export function listDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return fmt.time(date);
  if (date.getFullYear() === now.getFullYear()) return fmt.dayShort(date);
  return fmt.day(date);
}

/**
 * Escapes text for HTML.
 * @param {string} text Text.
 * @returns {string} Escaped text.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Subject with a prefix ("Re :", "Tr :"), without stacking it.
 * @param {string} subject Subject.
 * @param {'Re' | 'Tr'} prefix Prefix.
 * @returns {string} Subject.
 */
export function prefixedSubject(subject: string, prefix: 'Re' | 'Tr'): string {
  const pattern = prefix === 'Re' ? /^(re|ré|aw)\s*:/i : /^(tr|fwd?)\s*:/i;
  return pattern.test(subject.trim()) ? subject : `${prefix} : ${subject}`;
}

/**
 * Message of mails moved to a folder: « Mail déplacé dans « Factures ». », « 3 mails déplacés dans « Factures ». ».
 * @param {number} count Mails moved.
 * @param {string} folder Folder.
 * @returns {string} Message.
 */
export function movedMailsMessage(count: number, folder: string): string {
  // eslint-disable-next-line no-restricted-syntax -- movedMailsMessage itself.
  return `${count > 1 ? `${count} mails déplacés` : 'Mail déplacé'} dans « ${folder} ».`;
}
