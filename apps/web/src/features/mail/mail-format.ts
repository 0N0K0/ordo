import * as fmt from '../../lib/format';
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
 * Full date of an open mail.
 * @param {string} iso Date.
 * @returns {string} Label.
 */
export function fullDate(iso: string): string {
  return fmt.dateTime(new Date(iso));
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
